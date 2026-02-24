import logging
import json
import re
from typing import Dict, Any, Tuple, Optional

from sqlalchemy import select, and_

from app.schemas.prompt import LLMRequest
from app.models.base import PromptVersion
from app.services.llm import LLMService
from app.schemas.llm import LLMConfig
from app.models.prompt import Prompt
from app.db.session import get_db_session


async def _get_feature_model(project_id: int, feature_key: str, default_model: str) -> str:
    """从 project_ai_feature_configs 表中读取指定功能的模型名称，不存在则返回 default_model"""
    try:
        from app.models.ai_feature_config import AIFeatureConfig
        async with get_db_session() as db:
            result = await db.execute(
                select(AIFeatureConfig.model_id).where(
                    and_(
                        AIFeatureConfig.project_id == project_id,
                        AIFeatureConfig.feature_key == feature_key,
                    )
                )
            )
            model_id = result.scalar_one_or_none()
            return model_id if model_id else default_model
    except Exception:
        return default_model


# 评估类型常量定义
EVAL_TYPE_EXACT = "exact"  # 精确匹配
EVAL_TYPE_EXACT_MULTI_MATCH = "exact_multi_match"  # 多列精确匹配
EVAL_TYPE_CONTAINS = "contains"  # 包含匹配
EVAL_TYPE_KEYWORDS = "keywords"  # 关键词匹配
EVAL_TYPE_JSON_STRUCTURE = "json_structure"  # JSON结构匹配
EVAL_TYPE_REGEX = "regex"  # 正则表达式匹配
EVAL_TYPE_NUMERIC_DISTANCE = "numeric_distance"  # 数值距离
EVAL_TYPE_LLM_ASSERTION = "llm_assertion"  # LLM断言
EVAL_TYPE_COSINE_SIMILARITY = "cosine_similarity"  # 余弦相似度
EVAL_TYPE_JSON_EXTRACTION = "json_extraction"  # JSON提取
EVAL_TYPE_PARSE_VALUE = "parse_value"  # 值解析
EVAL_TYPE_STATIC_VALUE = "static_value"  # 静态值
EVAL_TYPE_TYPE_VALIDATION = "type_validation"  # 类型验证
EVAL_TYPE_COALESCE = "coalesce"  # 合并
EVAL_TYPE_COUNT = "count"  # 计数
EVAL_TYPE_PROMPT_TEMPLATE = "prompt_template"  # 提示词模板
EVAL_TYPE_CUSTOM_API = "custom_api"  # 自定义API
EVAL_TYPE_HUMAN_INPUT = "human_input"  # 人工输入
EVAL_TYPE_CODE_EXECUTION = "code_execution"  # 代码执行

class EvaluationEngine:
    """评估服务类，处理各种评估类型"""
    
    def __init__(self):
        self.eval_strategies = {
            EVAL_TYPE_EXACT: self._eval_exact_match,
            EVAL_TYPE_EXACT_MULTI_MATCH: self._eval_exact_multi_match,
            EVAL_TYPE_CONTAINS: self._eval_contains,
            EVAL_TYPE_KEYWORDS: self._eval_keywords,
            EVAL_TYPE_JSON_STRUCTURE: self._eval_json_structure,
            EVAL_TYPE_REGEX: self._eval_regex,
            EVAL_TYPE_NUMERIC_DISTANCE: self._eval_numeric_distance,
            EVAL_TYPE_LLM_ASSERTION: self._eval_llm_assertion,
            EVAL_TYPE_COSINE_SIMILARITY: self._eval_cosine_similarity,
            EVAL_TYPE_JSON_EXTRACTION: self._eval_json_extraction,
            EVAL_TYPE_PARSE_VALUE: self._eval_parse_value,
            EVAL_TYPE_STATIC_VALUE: self._eval_static_value,
            EVAL_TYPE_TYPE_VALIDATION: self._eval_type_validation,
            EVAL_TYPE_COALESCE: self._eval_coalesce,
            EVAL_TYPE_COUNT: self._eval_count,
        }
    
    async def evaluate_output(self, output: str, expected_output: str, strategy: str, config: Dict[str, Any]) -> Tuple[bool, Dict[str, Any]]:
        """根据不同策略评估输出结果"""
        # 补充基本信息到评估详细信息中
        evaluation_details = {
            "strategy": strategy,
            "output": output,
            "expected_output": expected_output
        }
        
        # 查找并调用对应的评估策略
        eval_func = self.eval_strategies.get(strategy, self._eval_exact_match)
        passed, details = await eval_func(output, expected_output, config)
        
        # 合并详细信息
        evaluation_details.update(details)
        # 记录最终是否通过
        evaluation_details["match"] = passed
        
        return passed, evaluation_details
    
    # 基本评估类型实现
    async def _eval_exact_match(self, output: str, expected_output: str, config: Dict[str, Any]) -> Tuple[bool, Dict[str, Any]]:
        """精确匹配评估"""
        output_clean = output.strip()
        expected_clean = expected_output.strip()
        
        # 是否忽略大小写
        ignore_case = config.get("ignore_case", False)
        if ignore_case:
            output_clean = output_clean.lower()
            expected_clean = expected_clean.lower()
        
        # 是否忽略空白
        ignore_whitespace = config.get("ignore_whitespace", False)
        if ignore_whitespace:
            output_clean = re.sub(r'\s+', ' ', output_clean)
            expected_clean = re.sub(r'\s+', ' ', expected_clean)
        
        passed = output_clean == expected_clean
        
        return passed, {
            "config": {
                "ignore_case": ignore_case,
                "ignore_whitespace": ignore_whitespace
            }
        }
    
    async def _eval_exact_multi_match(self, output: str, expected_output: str, config: Dict[str, Any]) -> Tuple[bool, Dict[str, Any]]:
        """多列精确匹配评估"""
        # 获取匹配对配置
        match_pairs = config.get("match_pairs", [])
        if not match_pairs:
            return False, {"error": "未配置匹配对"}
        
        # 获取全局选项
        options = config.get("options", [])
        ignore_case = "ignore_case" in options
        ignore_whitespace = "ignore_whitespace" in options
        none_as_empty = "none_as_empty" in options
        
        # 获取前面列的数据
        variables = config.get("variables", {})
        
        # 存储匹配结果
        match_results = []
        all_passed = True
        failed_pairs = []
        
        for i, pair in enumerate(match_pairs):
            try:
                # 获取输入列名称
                input_column = pair.get("input_column")
                
                if not input_column:
                    match_results.append({
                        "pair_index": i,
                        "passed": False,
                        "error": "输入列未配置"
                    })
                    all_passed = False
                    failed_pairs.append(f"匹配对 {i + 1}: 输入列配置错误")
                    continue
                
                # 从变量中获取输入值
                input_value = variables.get(input_column, "")
                
                # 根据期望值类型获取期望值
                expected_value_type = pair.get("expected_value_type", "column")
                expected_value = ""
                expected_source = ""
                
                if expected_value_type == "fixed_value":
                    # 使用固定值
                    expected_value = pair.get("fixed_expected_value", "")
                    expected_source = f"固定值: {expected_value}"
                    
                    if not expected_value and expected_value != 0:  # 允许0作为有效的期望值
                        match_results.append({
                            "pair_index": i,
                            "passed": False,
                            "error": "固定期望值未配置"
                        })
                        all_passed = False
                        failed_pairs.append(f"匹配对 {i + 1}: 固定期望值未配置")
                        continue
                else:
                    # 从列获取期望值
                    expected_column = pair.get("expected_column")
                    if not expected_column:
                        match_results.append({
                            "pair_index": i,
                            "passed": False,
                            "error": "期望列未配置"
                        })
                        all_passed = False
                        failed_pairs.append(f"匹配对 {i + 1}: 期望列配置错误")
                        continue
                    
                    expected_value = variables.get(expected_column, "")
                    expected_source = f"列: {expected_column}"
                
                # 处理输入列的JSON提取
                if pair.get("enable_input_json_extraction", False):
                    input_json_path = pair.get("input_json_path", "")
                    
                    if input_json_path:
                        try:
                            input_json = json.loads(str(input_value)) if isinstance(input_value, str) else input_value
                            input_value = self._extract_from_json_path(input_json, input_json_path)
                        except (json.JSONDecodeError, Exception) as e:
                            match_results.append({
                                "pair_index": i,
                                "passed": False,
                                "error": f"输入值JSON解析失败: {str(e)}",
                                "input_json_path": input_json_path
                            })
                            all_passed = False
                            failed_pairs.append(f"匹配对 {i + 1}: 输入值JSON解析失败")
                            continue
                
                # 处理期望值列的JSON提取（仅当期望值类型为列时）
                if expected_value_type == "column" and pair.get("enable_expected_json_extraction", False):
                    expected_json_path = pair.get("expected_json_path", "")
                    
                    if expected_json_path:
                        try:
                            expected_json = json.loads(str(expected_value)) if isinstance(expected_value, str) else expected_value
                            expected_value = self._extract_from_json_path(expected_json, expected_json_path)
                        except (json.JSONDecodeError, Exception) as e:
                            match_results.append({
                                "pair_index": i,
                                "passed": False,
                                "error": f"期望值JSON解析失败: {str(e)}",
                                "expected_json_path": expected_json_path
                            })
                            all_passed = False
                            failed_pairs.append(f"匹配对 {i + 1}: 期望值JSON解析失败")
                            continue
                
                if none_as_empty:
                    if input_value is None:
                        input_value = ""
                    if expected_value is None:
                        expected_value = ""
                        
                # 转换为字符串并清理
                input_str = str(input_value).strip()
                expected_str = str(expected_value).strip()
                
                # 应用全局选项
                if ignore_case:
                    input_str = input_str.lower()
                    expected_str = expected_str.lower()
                
                if ignore_whitespace:
                    input_str = re.sub(r'\s+', ' ', input_str)
                    expected_str = re.sub(r'\s+', ' ', expected_str)
                    
                # 执行匹配
                pair_passed = input_str == expected_str
                logging.info(f"input_str: {input_str}, expected_str: {expected_str}, expected_str is None: {expected_str is None}, none_as_empty: {none_as_empty}")
                
                # 记录匹配结果
                match_result = {
                    "pair_index": i,
                    "input_column": input_column,
                    "expected_value_type": expected_value_type,
                    "expected_source": expected_source,
                    "input_value": str(input_value),
                    "expected_value": str(expected_value),
                    "input_processed": input_str,
                    "expected_processed": expected_str,
                    "passed": pair_passed
                }
                
                # 为兼容性保留expected_column字段
                if expected_value_type == "column":
                    match_result["expected_column"] = pair.get("expected_column")
                
                # 添加JSON提取信息
                json_extraction_info = {}
                if pair.get("enable_input_json_extraction", False):
                    json_extraction_info.update({
                        "input_enabled": True,
                        "input_json_path": pair.get("input_json_path", "")
                    })
                
                if expected_value_type == "column" and pair.get("enable_expected_json_extraction", False):
                    json_extraction_info.update({
                        "expected_enabled": True,
                        "expected_json_path": pair.get("expected_json_path", "")
                    })
                
                if json_extraction_info:
                    match_result["json_extraction"] = json_extraction_info
                
                match_results.append(match_result)
                
                # 如果这个对失败了，记录到失败列表
                if not pair_passed:
                    all_passed = False
                    failed_pairs.append(f"匹配对 {i + 1}: 期望'{expected_str}'({expected_source})，实际'{input_str}'(列: {input_column})")
                    
            except Exception as e:
                match_results.append({
                    "pair_index": i,
                    "description": f"匹配对 {i + 1}",
                    "passed": False,
                    "error": f"处理异常: {str(e)}"
                })
                all_passed = False
                failed_pairs.append(f"匹配对 {i + 1}: 处理异常")
        
        # 汇总结果
        passed_count = sum(1 for result in match_results if result.get("passed", False))
        total_count = len(match_pairs)
        
        return all_passed, {
            "total_pairs": total_count,
            "passed_pairs": passed_count,
            "failed_pairs": failed_pairs,
            "match_results": match_results,
            "config": {
                "ignore_case": ignore_case,
                "ignore_whitespace": ignore_whitespace,
                "options": options
            }
        }
    
    async def _eval_contains(self, output: str, expected_output: str, config: Dict[str, Any]) -> Tuple[bool, Dict[str, Any]]:
        """包含匹配评估"""
        output_clean = output.strip()
        expected_clean = expected_output.strip()
        
        # 是否忽略大小写
        ignore_case = config.get("ignore_case", False)
        if ignore_case:
            output_clean = output_clean.lower()
            expected_clean = expected_clean.lower()
        
        passed = expected_clean in output_clean
        
        return passed, {
            "config": {
                "ignore_case": ignore_case
            }
        }
    
    async def _eval_keywords(self, output: str, expected_output: str, config: Dict[str, Any]) -> Tuple[bool, Dict[str, Any]]:
        """关键词匹配评估"""
        keywords = config.get("keywords", [])
        if not keywords and expected_output:
            keywords = expected_output.strip().split(",")
        
        # 是否忽略大小写
        ignore_case = config.get("ignore_case", False)
        output_check = output.lower() if ignore_case else output
        
        matched_keywords = []
        for keyword in keywords:
            keyword_check = keyword.strip().lower() if ignore_case else keyword.strip()
            if keyword_check in output_check:
                matched_keywords.append(keyword.strip())
        
        required_count = config.get("required_count", len(keywords))
        passed = len(matched_keywords) >= required_count
        
        return passed, {
            "keywords": keywords,
            "matched_keywords": matched_keywords,
            "required_count": required_count,
            "config": {
                "ignore_case": ignore_case
            }
        }
    
    async def _eval_json_structure(self, output: str, expected_output: str, config: Dict[str, Any]) -> Tuple[bool, Dict[str, Any]]:
        """JSON结构匹配评估"""
        try:
            output_json = json.loads(output)
            expected_json = json.loads(expected_output) if expected_output else {}
            
            # 检查是否包含所有必需字段
            required_fields = config.get("required_fields", list(expected_json.keys()))
            missing_fields = [field for field in required_fields if field not in output_json]
            
            passed = len(missing_fields) == 0
            return passed, {
                "required_fields": required_fields,
                "missing_fields": missing_fields
            }
            
        except json.JSONDecodeError as e:
            return False, {
                "error": f"输出不是有效的JSON格式: {str(e)}"
            }
    
    async def _eval_regex(self, output: str, expected_output: str, config: Dict[str, Any]) -> Tuple[bool, Dict[str, Any]]:
        """正则表达式匹配评估"""
        pattern = config.get("pattern", expected_output)
        if not pattern:
            return False, {"error": "未提供正则表达式模式"}
        
        try:
            # 编译正则表达式
            flags = 0
            if config.get("ignore_case", False):
                flags |= re.IGNORECASE
            if config.get("multiline", False):
                flags |= re.MULTILINE
            if config.get("dotall", False):
                flags |= re.DOTALL
                
            regex = re.compile(pattern, flags)
            matches = regex.findall(output)
            
            passed = len(matches) > 0
            return passed, {
                "pattern": pattern,
                "matches": matches,
                "match_count": len(matches),
                "config": {
                    "ignore_case": bool(flags & re.IGNORECASE),
                    "multiline": bool(flags & re.MULTILINE),
                    "dotall": bool(flags & re.DOTALL)
                }
            }
        except re.error as e:
            return False, {
                "error": f"正则表达式错误: {str(e)}",
                "pattern": pattern
            }
    
    async def _eval_numeric_distance(self, output: str, expected_output: str, config: Dict[str, Any]) -> Tuple[bool, Dict[str, Any]]:
        """数值距离评估"""
        try:
            # 尝试将输出和期望值转换为数值
            output_num = self._extract_number(output)
            expected_num = self._extract_number(expected_output)
            
            if output_num is None or expected_num is None:
                return False, {"error": "无法从输出或期望值中提取有效数字"}
            
            # 计算距离
            distance = abs(output_num - expected_num)
            
            # 判断是否在容许范围内
            threshold = config.get("threshold", 0)
            passed = distance <= threshold
            
            # 如果是百分比阈值
            if config.get("percentage_threshold", False) and expected_num != 0:
                percentage_diff = (distance / abs(expected_num)) * 100
                percentage_threshold = config.get("percentage_value", 5)  # 默认5%
                passed = percentage_diff <= percentage_threshold
                return passed, {
                    "output_value": output_num,
                    "expected_value": expected_num,
                    "distance": distance,
                    "percentage_diff": percentage_diff,
                    "percentage_threshold": percentage_threshold,
                    "config": {
                        "percentage_threshold": True,
                        "percentage_value": percentage_threshold
                    }
                }
            
            return passed, {
                "output_value": output_num,
                "expected_value": expected_num,
                "distance": distance,
                "threshold": threshold
            }
        
        except Exception as e:
            return False, {"error": f"数值比较错误: {str(e)}"}
    
    async def _eval_llm_assertion(self, output: str, expected_output: str, config: Dict[str, Any]) -> Tuple[bool, Dict[str, Any]]:
        """LLM断言评估 - 使用语言模型评估输出是否符合要求"""
        assertion = config.get("assertion", "")
        if not assertion:
            return False, {"error": "未提供断言内容"}
        
        # 准备LLM请求
        prompt = f"""你是一个帮助评估文本的助手。请评估以下文本是否满足给定的断言条件。
        
文本内容:
---
{output}
---

断言:
{assertion}

请以JSON格式回答，包含以下字段:
1. passed: true或false，表示断言是否成立
2. explanation: 简短解释为什么断言成立或不成立

JSON格式例子:
{{
  "passed": true,
  "explanation": "文本满足断言条件，因为..."
}}"""
        
        # 调用LLM服务
        try:
            project_id = config.get("project_id", 1)
            provider = config.get("provider", "openai")
            model = config.get("model") or await _get_feature_model(project_id, "evaluation_llm", "gpt-4.1")
            llm_result = await LLMService().call_llm(
                project_id=project_id,
                request=LLMRequest(
                    messages=[{"role": "user", "content": prompt}],
                    config=LLMConfig(
                        provider=provider,
                        model=model,
                    ),
                    prompt_version_id=config.get("prompt_version_id", 1),
                    project_id=project_id,
                ),
                user_id=config.get("user_id", 1),
                request_source="evaluation"
            )
            
            # 解析LLM结果
            try:
                response_text = llm_result.get("message", "")
                # 尝试提取JSON部分
                json_match = re.search(r'```json\s*(.*?)\s*```|{.*}', response_text, re.DOTALL)
                if json_match:
                    json_str = json_match.group(1) if json_match.group(1) else json_match.group(0)
                    result = json.loads(json_str)
                else:
                    # 如果没有找到JSON，尝试直接解析整个回复
                    result = json.loads(response_text)
                
                passed = result.get("passed", False)
                explanation = result.get("explanation", "未提供解释")
                
                return passed, {
                    "assertion": assertion,
                    "llm_response": response_text,
                    "explanation": explanation
                }
            
            except json.JSONDecodeError:
                # 如果无法解析JSON，尝试直接从文本判断
                passed = "true" in response_text.lower() and "false" not in response_text.lower()
                return passed, {
                    "assertion": assertion,
                    "llm_response": response_text,
                    "error": "无法解析LLM响应为JSON格式",
                    "fallback_evaluation": "基于关键词判断"
                }
        
        except Exception as e:
            return False, {
                "assertion": assertion,
                "error": f"LLM评估失败: {str(e)}"
            }
    
    async def _eval_cosine_similarity(self, output: str, expected_output: str, config: Dict[str, Any]) -> Tuple[bool, Dict[str, Any]]:
        """余弦相似度评估 - 计算两个文本的语义相似度"""
        if not output or not expected_output:
            return False, {"error": "输出或期望输出为空"}
        
        # 调用获取嵌入的LLM接口
        try:
            # 获取嵌入
            embedding_result = await self._get_embeddings(output, expected_output, config)
            
            # 计算余弦相似度
            similarity = embedding_result.get("similarity", 0)
            
            # 判断是否通过
            threshold = config.get("threshold", 0.7)  # 默认阈值为0.7
            passed = similarity >= threshold
            
            return passed, {
                "similarity": similarity,
                "threshold": threshold,
                "embedding_model": embedding_result.get("model", "unknown")
            }
        
        except Exception as e:
            return False, {"error": f"余弦相似度计算失败: {str(e)}"}
    
    async def _eval_json_extraction(self, output: str, expected_output: str, config: Dict[str, Any]) -> Tuple[bool, Dict[str, Any]]:
        """JSON提取评估 - 从JSON中提取特定路径的值"""
        try:
            # 将输出解析为JSON
            output_json = None
            if output:
                try:
                    output_json = json.loads(output)
                except json.JSONDecodeError:
                    return False, {"error": "输出不是有效的JSON格式"}
            else:
                return False, {"error": "输出为空"}
            
            # 获取JSON路径
            json_path = config.get("json_path", "")
            if not json_path:
                return False, {"error": "未提供JSON路径"}
            
            # 提取值
            extracted_value = self._extract_from_json_path(output_json, json_path)
            
            # 判断提取是否成功
            if extracted_value is None:
                return False, {
                    "json_path": json_path,
                    "error": "指定路径下无值"
                }
            
            # 如果有期望值，比较是否匹配
            if expected_output:
                try:
                    expected_json = json.loads(expected_output)
                    passed = extracted_value == expected_json
                except json.JSONDecodeError:
                    # 直接比较字符串
                    passed = str(extracted_value) == expected_output
            else:
                # 没有期望值时，只要提取到值就算通过
                passed = True
            
            return passed, {
                "json_path": json_path,
                "extracted_value": extracted_value
            }
        
        except Exception as e:
            return False, {"error": f"JSON提取失败: {str(e)}"}
    
    async def _eval_parse_value(self, output: str, expected_output: str, config: Dict[str, Any]) -> Tuple[bool, Dict[str, Any]]:
        """值解析评估 - 将值转换为指定类型"""
        try:
            # 获取目标类型
            target_type = config.get("target_type", "string")
            
            # 解析值
            parsed_value = None
            parsing_error = None
            
            try:
                if target_type == "number":
                    parsed_value = float(output)
                    # 如果是整数，转换为整数
                    if parsed_value.is_integer():
                        parsed_value = int(parsed_value)
                elif target_type == "boolean":
                    parsed_value = output.lower() in ["true", "yes", "1", "y"]
                elif target_type == "json":
                    parsed_value = json.loads(output)
                else:  # 默认为字符串
                    parsed_value = str(output)
            except Exception as e:
                parsing_error = str(e)
            
            # 判断解析是否成功
            if parsing_error:
                return False, {
                    "target_type": target_type,
                    "error": f"解析为{target_type}类型失败: {parsing_error}"
                }
            
            # 如果有期望值，比较是否匹配
            if expected_output:
                try:
                    if target_type == "number":
                        expected_value = float(expected_output)
                        if expected_value.is_integer():
                            expected_value = int(expected_value)
                        passed = parsed_value == expected_value
                    elif target_type == "boolean":
                        expected_value = expected_output.lower() in ["true", "yes", "1", "y"]
                        passed = parsed_value == expected_value
                    elif target_type == "json":
                        expected_value = json.loads(expected_output)
                        passed = parsed_value == expected_value
                    else:
                        passed = str(parsed_value) == expected_output
                    
                    return passed, {
                        "target_type": target_type,
                        "parsed_value": parsed_value,
                        "expected_value": expected_value
                    }
                except Exception as e:
                    return False, {
                        "target_type": target_type,
                        "parsed_value": parsed_value,
                        "error": f"期望值解析失败: {str(e)}"
                    }
            
            # 没有期望值时，只要解析成功就算通过
            return True, {
                "target_type": target_type,
                "parsed_value": parsed_value
            }
        
        except Exception as e:
            return False, {"error": f"值解析失败: {str(e)}"}
    
    async def _eval_static_value(self, output: str, expected_output: str, config: Dict[str, Any]) -> Tuple[bool, Dict[str, Any]]:
        """静态值评估 - 返回预设的静态值"""
        # 获取静态值
        static_value = config.get("static_value", None)
        
        # 返回静态值，不关心输入和输出
        return True, {"static_value": static_value}
    
    async def _eval_type_validation(self, output: str, expected_output: str, config: Dict[str, Any]) -> Tuple[bool, Dict[str, Any]]:
        """类型验证评估 - 验证值是否符合特定类型"""
        # 获取目标类型
        validation_type = config.get("validation_type", "json")
        
        if validation_type == "json":
            try:
                json.loads(output)
                return True, {"validation_type": "json", "is_valid": True}
            except json.JSONDecodeError as e:
                return False, {"validation_type": "json", "is_valid": False, "error": str(e)}
        
        elif validation_type == "number":
            try:
                float(output)
                return True, {"validation_type": "number", "is_valid": True}
            except ValueError:
                return False, {"validation_type": "number", "is_valid": False}
        
        elif validation_type == "sql":
            # 暂时实现简单SQL验证
            # 如果需要更复杂的验证，可以引入SQLGlot库
            sql_patterns = [
                r'SELECT\s+.+\s+FROM\s+.+',
                r'INSERT\s+INTO\s+.+\s+VALUES\s*\(.+\)',
                r'UPDATE\s+.+\s+SET\s+.+',
                r'DELETE\s+FROM\s+.+'
            ]
            
            is_valid = any(re.search(pattern, output, re.IGNORECASE | re.DOTALL) for pattern in sql_patterns)
            return is_valid, {"validation_type": "sql", "is_valid": is_valid}
        
        else:
            return False, {"error": f"不支持的验证类型: {validation_type}"}
    
    async def _eval_coalesce(self, output: str, expected_output: str, config: Dict[str, Any]) -> Tuple[bool, Dict[str, Any]]:
        """合并评估 - 合并多个值，返回第一个非空值"""
        values = config.get("values", [])
        
        # 添加当前输出和期望输出到值列表开头
        if output:
            values.insert(0, output)
        if expected_output:
            values.insert(0, expected_output)
        
        # 查找第一个非空值
        coalesced_value = None
        for value in values:
            if value is not None and value != "":
                coalesced_value = value
                break
        
        return True, {"coalesced_value": coalesced_value, "values": values}
    
    async def _eval_count(self, output: str, expected_output: str, config: Dict[str, Any]) -> Tuple[bool, Dict[str, Any]]:
        """计数评估 - 计算文本中的字符、单词或段落数"""
        count_type = config.get("count_type", "characters")
        
        if not output:
            return True, {"count": 0, "count_type": count_type}
        
        count = 0
        
        if count_type == "characters":
            count = len(output)
        elif count_type == "words":
            count = len(output.split())
        elif count_type == "paragraphs":
            count = len([p for p in output.split("\n\n") if p.strip()])
        else:
            return False, {"error": f"不支持的计数类型: {count_type}"}
        
        # 如果有期望值，检查计数是否匹配
        if expected_output:
            try:
                expected_count = int(expected_output)
                passed = count == expected_count
                return passed, {
                    "count": count,
                    "count_type": count_type,
                    "expected_count": expected_count
                }
            except ValueError:
                return False, {
                    "count": count,
                    "count_type": count_type,
                    "error": "期望值不是有效的数字"
                }
        
        # 没有期望值时，直接返回计数结果
        return True, {"count": count, "count_type": count_type}
    
    # 辅助方法
    def _extract_number(self, text: str) -> Optional[float]:
        """从文本中提取数字"""
        if not text:
            return None
            
        # 首先尝试直接转换整个字符串
        try:
            return float(text.strip())
        except ValueError:
            pass
        
        # 然后尝试使用正则表达式提取
        numbers = re.findall(r'-?\d+\.?\d*', text)
        if numbers:
            try:
                return float(numbers[0])
            except ValueError:
                pass
        
        return None
    
    def _extract_from_json_path(self, json_obj: Any, json_path: str) -> Any:
        """从JSON对象中按路径提取值"""
        if not json_path:
            return json_obj
        
        parts = json_path.split('.')
        current = json_obj
        
        for part in parts:
            # 处理数组索引，如 items[0]
            array_match = re.match(r'(\w+)\[(\d+)\]', part)
            
            if array_match:
                key = array_match.group(1)
                index = int(array_match.group(2))
                
                if key not in current:
                    return None
                    
                array_data = current[key]
                if not isinstance(array_data, list) or index >= len(array_data):
                    return None
                    
                current = array_data[index]
            else:
                # 普通属性
                if part not in current:
                    return None
                current = current[part]
        
        return current
    
    async def _get_embeddings(self, text1: str, text2: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """获取两个文本的嵌入并计算余弦相似度"""
        # 使用提供的 API 获取嵌入
        try:
            # 这里可以根据你的实际 API 调用方式修改
            # 通常使用 OpenAI 的 Embeddings API
            embedding_model = config.get("embedding_model") or "text-embedding-ada-002"
            
            # 分别调用嵌入API获取向量，这里需要根据实际情况修改
            # 以下为示例代码，需要替换为实际的嵌入调用
            '''
            embedding1_result = await openai.Embedding.create(
                model=embedding_model,
                input=text1
            )
            
            embedding2_result = await openai.Embedding.create(
                model=embedding_model,
                input=text2
            )
            
            embedding1 = embedding1_result.data[0].embedding
            embedding2 = embedding2_result.data[0].embedding
            '''
            
            # 由于我们没有实际的嵌入调用，这里返回一个模拟的结果
            # 在实际应用中需要替换成真实的调用和计算
            logging.warning("使用模拟的嵌入计算，在生产环境中请实现真实的嵌入调用")
            
            # 模拟相似度：根据相同词的比例来模拟
            words1 = set(text1.lower().split())
            words2 = set(text2.lower().split())
            common_words = words1.intersection(words2)
            union_words = words1.union(words2)
            
            if not union_words:
                similarity = 0
            else:
                similarity = len(common_words) / len(union_words)
            
            return {
                "model": embedding_model,
                "similarity": similarity,
                "warning": "这是模拟的嵌入结果，非真实计算"
            }
        
        except Exception as e:
            logging.error(f"获取嵌入失败: {str(e)}")
            raise
    
    # 高级评估类型（需要外部支持的实现）
    async def evaluate_prompt_version(self, 
                                      prompt_id: int, 
                                      user_id: int, 
                                      input_variables: Dict[str, Any],
                                      model_override: Dict[str, Any] = None) -> Dict[str, Any]:
        """执行提示词模板评估"""
        # 需要查询提示词模板
        async with get_db_session() as db:
            prompt_version = await db.execute(select(PromptVersion).where(PromptVersion.prompt_id == prompt_id).order_by(PromptVersion.id.desc()).limit(1))
            prompt_version = prompt_version.scalar_one_or_none()
        
            if not prompt_version:
                return {
                    "success": False,
                    "error": f"找不到ID为{prompt_id}的提示词模板"
                }
        
            prompt = await db.execute(select(Prompt).where(Prompt.id == prompt_version.prompt_id))
            prompt = prompt.scalar_one_or_none()
        
        # 替换消息中的变量
        messages = prompt_version.messages
        replaced_messages = []
        
        for message in messages:
            content = message.get("content", "")
            role = message.get("role", "")
            
            # 替换变量
            for var_name, var_value in input_variables.items():
                placeholder = "{{" + var_name + "}}"
                content = content.replace(placeholder, str(var_value))
            
            replaced_messages.append({
                "role": role,
                "content": content
            })
            
        # 准备大模型请求参数
        model_params = prompt_version.model_params
        
        # 如果有模型参数覆盖，应用它们
        if model_override:
            model_params.update(model_override)
        
        # 调用大模型 API
        try:
            call_llm_result = await LLMService().call_llm(
                user_id=user_id,
                project_id=prompt.project_id,
                request=LLMRequest(
                    messages=replaced_messages,
                    config=LLMConfig(**model_params),
                    prompt_version_id=prompt_id,
                    project_id=prompt.project_id
                ),
                request_source="evaluation"
            )
            
            if "error" in call_llm_result:
                return {
                    "success": False,
                    "error": call_llm_result["error"]
                }
            
            # 获取结果
            output = call_llm_result.get("message", "")
            tokens = call_llm_result.get("tokens", {})
            execution_time = call_llm_result.get("execution_time", 0)
            
            return {
                "success": True,
                "output": output,
                "tokens": tokens,
                "execution_time": execution_time
            }
        
        except Exception as e:
            logging.error(f"执行提示词模板评估失败: {str(e)}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }