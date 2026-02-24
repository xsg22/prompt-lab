#!/usr/bin/env python3
"""
统一调度器测试脚本
测试列任务和行任务的统一调度功能
"""

import asyncio
import sys
import os

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.eval_task_scheduler import get_scheduler, start_global_scheduler, stop_global_scheduler
from app.core.logging import get_logger

logger = get_logger(__name__)

async def test_scheduler_basic_functions():
    """测试调度器基本功能"""
    logger.info("开始测试统一调度器基本功能")
    
    try:
        # 获取调度器实例
        scheduler = await get_scheduler()
        logger.info("成功获取调度器实例")
        
        # 获取调度器状态
        status = await scheduler.get_scheduler_status()
        logger.info(f"调度器状态: {status}")
        
        # 启动调度器
        await start_global_scheduler()
        logger.info("调度器已启动")
        
        # 等待一段时间让调度器运行
        await asyncio.sleep(5)
        
        # 获取运行状态
        status = await scheduler.get_scheduler_status()
        logger.info(f"运行中的调度器状态: {status}")
        
        # 停止调度器
        await stop_global_scheduler()
        logger.info("调度器已停止")
        
        logger.info("统一调度器基本功能测试完成")
        
    except Exception as e:
        logger.error(f"调度器测试失败: {str(e)}", exc_info=True)

async def test_row_task_scheduling():
    """测试行任务调度功能"""
    logger.info("开始测试行任务调度功能")
    
    try:
        # 获取调度器实例
        scheduler = await get_scheduler()
        
        # 启动调度器
        await start_global_scheduler()
        
        # 模拟强制调度行任务批次
        result_id = 1  # 假设的result_id
        dataset_item_ids = [1, 2, 3]  # 假设的数据集项ID
        
        success = await scheduler.force_schedule_row_task_batch(result_id, dataset_item_ids)
        logger.info(f"强制调度行任务批次结果: {success}")
        
        # 等待调度器处理
        await asyncio.sleep(10)
        
        # 获取调度器状态
        status = await scheduler.get_scheduler_status()
        logger.info(f"调度后状态: {status}")
        
        # 停止调度器
        await stop_global_scheduler()
        
        logger.info("行任务调度功能测试完成")
        
    except Exception as e:
        logger.error(f"行任务调度测试失败: {str(e)}", exc_info=True)

async def main():
    """主测试函数"""
    logger.info("开始统一调度器测试")
    
    # 测试基本功能
    await test_scheduler_basic_functions()
    
    print("\n" + "="*50 + "\n")
    
    # 测试行任务调度
    await test_row_task_scheduling()
    
    logger.info("所有测试完成")

if __name__ == "__main__":
    asyncio.run(main()) 