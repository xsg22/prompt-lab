import time
from typing import Any, Dict, Optional, AsyncGenerator
import json

from fastapi import HTTPException, status
from litellm import acompletion, completion_cost, register_model
from openai import APITimeoutError
from sqlalchemy import and_, select

from app.core.logging import get_logger
from app.db.session import get_db_session
from app.models.project import Project
from app.models.prompt import Request
from app.schemas.prompt import LLMRequest
from app.schemas.llm import LLMStreamRequest, LLMStreamChunk, TokenUsage
from app.models.provider_instance import ModelProviderInstance
from app.services.background_task_service import create_task_with_session
from app.core.config import settings

logger = get_logger(__name__)

# 注册额外模型（支持更多上下文长度的模型）
register_model({
    "llama-3.3-70b": {
        "max_tokens": 128000,
        "max_input_tokens": 128000,
        "max_output_tokens": 128000,
        "input_cost_per_token": 0.00000085,
        "output_cost_per_token": 0.0000012,
        "litellm_provider": "cerebras",
        "mode": "chat",
        "supports_function_calling": True,
        "supports_tool_choice": True
    }
})


class LLMService:
    """LLM服务类"""
    
    def __init__(self):
        """初始化"""
        pass
    
    async def get_project_by_user(self, user_id: int, project_id: Optional[int] = None) -> Project:
        """获取用户所属的项目"""
        # 查询条件
        conditions = []
        
        # 如果指定了项目ID，则添加项目ID条件
        if project_id:
            conditions.append(Project.id == project_id)
        
        # 查询用户所属的项目
        query = select(Project).join(
            Project.members
        ).where(
            Project.members.any(user_id=user_id),
            *conditions
        )
        
        async with get_db_session() as db:
            result = await db.execute(query)
            project = result.scalar_one_or_none()
        
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="项目未找到或您没有访问权限",
            )
        
        return project
    
    async def get_provider_config(self, project_id: int, provider: str) -> Dict[str, Any]:
        """获取提供商配置"""
        query = select(ModelProviderInstance).where(
            and_(
                ModelProviderInstance.name == provider,
                ModelProviderInstance.project_id == project_id,
                ModelProviderInstance.is_enabled == True
            )
        )
        
        async with get_db_session() as db:
            result = await db.execute(query)
            instance = result.scalar_one_or_none()
        
        if not instance:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="提供商实例不存在"
            )
        
        config = instance.config
        
        return {
            "api_key": config["api_key"],
            "base_url": config["base_url"] if "base_url" in config else None,
            "api_version": config["api_version"] if "api_version" in config else None,
        }
    
    async def _save_request_record_async(
        self,
        db,
        project_id: int,
        user_id: int,
        prompt_id: Optional[int],
        prompt_version_id: Optional[int],
        request_source: str,
        input_data: Dict[str, Any],
        variables_values: Dict[str, Any],
        output: Optional[str],
        prompt_tokens: int,
        completion_tokens: int,
        total_tokens: int,
        execution_time: int,
        cost: str,
        success: bool,
        error_message: str = ""
    ) -> None:
        """
        异步保存请求记录
        
        Args:
            db: 数据库会话
            project_id: 项目ID
            user_id: 用户ID
            prompt_id: 提示词ID
            prompt_version_id: 提示词版本ID
            request_source: 请求来源
            input_data: 输入数据
            variables_values: 变量值
            output: 输出内容
            prompt_tokens: 提示词tokens
            completion_tokens: 完成tokens
            total_tokens: 总tokens
            execution_time: 执行时间
            cost: 成本
            success: 是否成功
            error_message: 错误信息
        """
        try:
            request_record = Request(
                project_id=project_id,
                user_id=user_id,
                prompt_id=prompt_id,
                prompt_version_id=prompt_version_id,
                source=request_source,
                input=input_data,
                variables_values=variables_values,
                output=output,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                execution_time=execution_time,
                cost=cost,
                success=success,
                error_message=error_message,
            )
            
            db.add(request_record)
            await db.commit()
            
            logger.debug(f"异步保存请求记录成功: project_id={project_id}, user_id={user_id}")
            
        except Exception as e:
            logger.error(f"异步保存请求记录失败: {str(e)}", exc_info=True)
            # 异步保存失败不影响主流程，只记录日志
    
    async def call_llm(self, user_id: int, project_id: int, request: LLMRequest, request_source: str) -> Dict[str, Any]:
        """调用LLM"""
        if not request.config.model:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="模型不能为空",
            )
        
        # 获取提示词信息
        prompt_id = request.prompt_id
        prompt_version_id = request.prompt_version_id

        # 获取提供商配置
        provider_config = await self.get_provider_config(project_id, request.config.provider)
            
        # 将消息转换为LiteLLM格式
        messages = [
            {"role": msg.role, "content": msg.content}
            for msg in request.messages
        ]
            
        # 构建模型名称
        model_name = f"{request.config.provider}/{request.config.model}"
        
        # 将输入数据转换为JSON字符串, 只保留非None的值
        input_data = {
            "messages": messages,
            "model": model_name,
            "temperature": request.config.temperature,
            "top_p": request.config.top_p,
            "max_tokens": request.config.max_tokens,
            "presence_penalty": request.config.presence_penalty,
            "frequency_penalty": request.config.frequency_penalty,
        }
        input_data = {k: v for k, v in input_data.items() if v is not None}
        
        try:
            # 记录开始时间
            start_time = time.time()
            base_url = provider_config["base_url"] if "base_url" in provider_config and provider_config["base_url"] else None
            api_version = provider_config["api_version"] if "api_version" in provider_config and provider_config["api_version"] else None
            
            logger.info(
                f"LLM调用开始: {model_name}, "
                f"base_url: {base_url}, "
                f"api_version: {api_version}, "
                f"temperature: {request.config.temperature}, "
                f"top_p: {request.config.top_p}, "
                f"max_tokens: {request.config.max_tokens}, "
                f"presence_penalty: {request.config.presence_penalty},"
                f"frequency_penalty: {request.config.frequency_penalty}"
            )
            
            # 调用API
            response = await acompletion(
                model=model_name,
                messages=messages,
                api_key=provider_config["api_key"],
                api_version=api_version,
                base_url=base_url,
                timeout=60,
                max_retries=0,
                temperature=request.config.temperature,
                top_p=request.config.top_p,
                max_tokens=request.config.max_tokens,
                presence_penalty=request.config.presence_penalty,
                frequency_penalty=request.config.frequency_penalty,
            )
            
            # 计算执行时间 (毫秒)
            execution_time = int((time.time() - start_time) * 1000)
            
            # 获取使用的tokens
            prompt_tokens = response.usage.prompt_tokens
            completion_tokens = response.usage.completion_tokens
            total_tokens = response.usage.total_tokens
            
            # 计算成本
            try:
                # 保留7位小数
                cost = float(completion_cost(completion_response=response))
                cost = round(cost, 7)
            except Exception as e:
                logger.error(f"计算成本失败: {str(e)}", exc_info=True)
                cost = 0
            
            raw_output = response.choices[0].message.content
            output = raw_output.encode('utf-8').decode('unicode_escape') if '\\u' in raw_output else raw_output
            # output = raw_output

            logger.info(f"LLM调用成功: {output}")
            
            # 异步保存请求记录
            create_task_with_session(
                self._save_request_record_async,
                project_id=project_id,
                user_id=user_id,
                prompt_id=prompt_id,
                prompt_version_id=prompt_version_id,
                request_source=request_source,
                input_data=input_data,
                variables_values={},
                output=output,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                execution_time=execution_time,
                cost=str(cost),
                success=True,
                error_message="",
                task_name="save_llm_request_record"
            )
            
            # 构建响应
            result = {
                "params": {
                    "provider": request.config.provider,
                    "model": request.config.model,
                    "messages": messages,
                    "temperature": request.config.temperature,
                    "top_p": request.config.top_p,
                    "max_tokens": request.config.max_tokens,
                    "presence_penalty": request.config.presence_penalty,
                    "frequency_penalty": request.config.frequency_penalty,
                },
                "message": output,
                "tokens": {
                    "prompt": prompt_tokens,
                    "completion": completion_tokens,
                    "total": total_tokens,
                },
                "cost": f"{float(cost):.7f}",
                "execution_time": execution_time,
            }
            
            logger.debug(f"LLM调用成功: {result}")
            
            return result
        except Exception as e:
            
            # 异步保存失败请求记录
            create_task_with_session(
                self._save_request_record_async,
                project_id=project_id,
                user_id=user_id,
                prompt_id=prompt_id,
                prompt_version_id=prompt_version_id,
                request_source=request_source,
                input_data=input_data,
                variables_values={},
                output=None,
                prompt_tokens=0,
                completion_tokens=0,
                total_tokens=0,
                execution_time=int((time.time() - start_time) * 1000) if 'start_time' in locals() else 0,
                cost="0",
                success=False,
                error_message=str(e),
                task_name="save_llm_error_record"
            )

            if isinstance(e, APITimeoutError):
                logger.error(f"LLM调用超时: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"llm request timeout: {str(e)}",
                )
            
            logger.error(f"LLM调用失败: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"llm request failed: {str(e)}",
            )

    async def call_llm_stream(
        self, 
        user_id: int, 
        project_id: int, 
        request: LLMStreamRequest, 
        request_source: str,
    ) -> AsyncGenerator[str, None]:
        """流式调用LLM"""
        if not request.config.model:
            error_chunk = LLMStreamChunk(
                type="error",
                error="模型不能为空"
            )
            yield f"data: {json.dumps(error_chunk.model_dump(), ensure_ascii=False)}\n\n"
            return
        
        # 获取提示词信息
        prompt_id = request.prompt_id
        prompt_version_id = request.prompt_version_id

        try:
            # 获取提供商配置
            provider_config = await self.get_provider_config(project_id, request.config.provider)
        except Exception as e:
            error_chunk = LLMStreamChunk(
                type="error",
                error=str(e)
            )
            yield f"data: {json.dumps(error_chunk.model_dump(), ensure_ascii=False)}\n\n"
            return
        
        try:
            # 记录开始时间
            start_time = time.time()
            
            # 将消息转换为LiteLLM格式
            messages = [
                {"role": msg.role, "content": msg.content}
                for msg in request.messages
            ]
            
            # 构建模型名称
            model_name = f"{request.config.provider}/{request.config.model}"
            
            logger.info(f"LLM流式调用开始: {model_name}")
            
            # 用于累积完整内容
            accumulated_content = ""
            
            # 调用流式API
            response_stream = await acompletion(
                model=model_name,
                messages=messages,
                api_key=provider_config["api_key"],
                api_version=provider_config["api_version"] if "api_version" in provider_config else None,
                base_url=provider_config["base_url"] if "base_url" in provider_config else None,
                timeout=60,
                max_retries=0,
                temperature=request.config.temperature,
                top_p=request.config.top_p,
                max_tokens=request.config.max_tokens,
                presence_penalty=request.config.presence_penalty,
                frequency_penalty=request.config.frequency_penalty,
                stream=True,  # 启用流式响应
            )
            
            # 流式处理响应
            async for chunk in response_stream:
                if hasattr(chunk, 'choices') and len(chunk.choices) > 0:
                    delta = chunk.choices[0].delta
                    if hasattr(delta, 'content') and delta.content:
                        content = delta.content
                        accumulated_content += content
                        
                        # 发送内容片段
                        chunk_data = LLMStreamChunk(
                            type="chunk",
                            content=content
                        )
                        yield f"data: {json.dumps(chunk_data.model_dump(), ensure_ascii=False)}\n\n"
            
            # 计算执行时间 (毫秒)
            execution_time = int((time.time() - start_time) * 1000)
            
            # 计算token使用量和成本（流式响应中可能无法直接获取，使用估算或后续API调用）
            # 这里我们简化处理，实际项目中可能需要更复杂的token计算
            try:
                # 估算token数量（粗略计算）
                prompt_tokens = sum(len(msg["content"].split()) for msg in messages) * 1.3  # 粗略估算
                completion_tokens = len(accumulated_content.split()) * 1.3  # 粗略估算
                total_tokens = prompt_tokens + completion_tokens
                
                # 由于是流式响应，无法直接获取准确的usage，这里使用估算
                # 实际项目中可以通过调用专门的token计算API或使用tiktoken库
                cost = 0.0  # 简化处理，实际可能需要根据模型计费规则计算
                
                prompt_tokens = int(prompt_tokens)
                completion_tokens = int(completion_tokens)
                total_tokens = int(total_tokens)
                
            except Exception as e:
                logger.error(f"计算流式响应成本失败: {str(e)}", exc_info=True)
                prompt_tokens = 0
                completion_tokens = 0
                total_tokens = 0
                cost = 0.0
            
            # 异步保存请求记录
            create_task_with_session(
                self._save_request_record_async,
                project_id=project_id,
                user_id=user_id,
                prompt_id=prompt_id,
                prompt_version_id=prompt_version_id,
                request_source=request_source,
                input_data={"messages": messages},
                variables_values={},
                output=accumulated_content,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                execution_time=execution_time,
                cost=str(cost),
                success=True,
                error_message="",
                task_name="save_llm_stream_request_record"
            )
            
            # 发送完成信号
            done_chunk = LLMStreamChunk(
                type="done",
                usage=TokenUsage(
                    prompt=prompt_tokens,
                    completion=completion_tokens,
                    total=total_tokens
                ),
                cost=f"{cost:.7f}",
                execution_time=execution_time,
                model=model_name
            )
            yield f"data: {json.dumps(done_chunk.model_dump(), ensure_ascii=False)}\n\n"
            
            logger.info(f"LLM流式调用成功完成: {len(accumulated_content)} 字符")
            
        except Exception as e:
            logger.error(f"LLM流式调用失败: {str(e)}", exc_info=True)
            
            # 异步保存失败请求记录
            create_task_with_session(
                self._save_request_record_async,
                project_id=project_id,
                user_id=user_id,
                prompt_id=prompt_id,
                prompt_version_id=prompt_version_id,
                request_source=request_source,
                input_data={"messages": [m.model_dump() for m in request.messages]},
                variables_values={},
                output=None,
                prompt_tokens=0,
                completion_tokens=0,
                total_tokens=0,
                execution_time=int((time.time() - start_time) * 1000) if 'start_time' in locals() else 0,
                cost="0",
                success=False,
                error_message=str(e),
                task_name="save_llm_stream_error_record"
            )
            
            # 发送错误信号
            error_chunk = LLMStreamChunk(
                type="error",
                error=str(e)
            )
            yield f"data: {json.dumps(error_chunk.model_dump(), ensure_ascii=False)}\n\n" 