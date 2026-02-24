"""LLM API限流器"""

import asyncio
import time
from typing import Optional, Dict, Any
from collections import deque
from app.core.logging import get_logger

logger = get_logger(__name__)


class LLMRateLimiter:
    """LLM API调用限流器，支持QPS和QPM限制"""
    
    def __init__(self, qps: float = 1.0, qpm: float = 60.0):
        """
        初始化限流器
        
        Args:
            qps: 每秒查询数限制 (Queries Per Second)
            qpm: 每分钟查询数限制 (Queries Per Minute)
        """
        self.qps = qps
        self.qpm = qpm
        
        # 使用双端队列记录请求时间戳
        self.second_window = deque()  # 记录1秒内的请求
        self.minute_window = deque()  # 记录1分钟内的请求
        
        # 锁，确保线程安全
        self._lock = asyncio.Lock()
        
        logger.info(f"LLM限流器初始化: QPS={qps}, QPM={qpm}")
    
    async def acquire(self) -> None:
        """
        获取调用许可，如果超过限制则等待
        """
        async with self._lock:
            current_time = time.time()
            
            # 清理过期的请求记录
            self._cleanup_windows(current_time)
            
            # 计算需要等待的时间
            wait_time = self._calculate_wait_time(current_time)
            
            if wait_time > 0:
                logger.info(f"LLM限流等待: {wait_time:.2f}秒")
                await asyncio.sleep(wait_time)
                current_time = time.time()
                self._cleanup_windows(current_time)
            
            # 记录这次请求
            self.second_window.append(current_time)
            self.minute_window.append(current_time)
            
            logger.debug(f"LLM请求通过，当前QPS: {len(self.second_window)}, QPM: {len(self.minute_window)}")
    
    def _cleanup_windows(self, current_time: float) -> None:
        """清理过期的请求记录"""
        # 清理1秒窗口
        while self.second_window and current_time - self.second_window[0] > 1.0:
            self.second_window.popleft()
        
        # 清理1分钟窗口  
        while self.minute_window and current_time - self.minute_window[0] > 60.0:
            self.minute_window.popleft()
    
    def _calculate_wait_time(self, current_time: float) -> float:
        """计算需要等待的时间"""
        wait_times = []
        
        # 检查QPS限制
        if len(self.second_window) >= self.qps:
            # 需要等待直到最早的请求超过1秒
            oldest_request = self.second_window[0]
            qps_wait = 1.0 - (current_time - oldest_request)
            if qps_wait > 0:
                wait_times.append(qps_wait)
        
        # 检查QPM限制
        if len(self.minute_window) >= self.qpm:
            # 需要等待直到最早的请求超过1分钟
            oldest_request = self.minute_window[0]
            qpm_wait = 60.0 - (current_time - oldest_request)
            if qpm_wait > 0:
                wait_times.append(qpm_wait)
        
        # 返回最长的等待时间
        return max(wait_times) if wait_times else 0.0
    
    def get_current_stats(self) -> Dict[str, Any]:
        """获取当前限流统计信息"""
        current_time = time.time()
        
        # 临时清理窗口以获取准确统计
        temp_second = deque(t for t in self.second_window if current_time - t <= 1.0)
        temp_minute = deque(t for t in self.minute_window if current_time - t <= 60.0)
        
        return {
            "qps_current": len(temp_second),
            "qps_limit": self.qps,
            "qpm_current": len(temp_minute), 
            "qpm_limit": self.qpm,
            "qps_available": max(0, self.qps - len(temp_second)),
            "qpm_available": max(0, self.qpm - len(temp_minute))
        } 