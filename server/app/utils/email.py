import logging
import secrets
from typing import Dict

verification_codes: Dict[str, Dict] = {}

logger = logging.getLogger(__name__)

def generate_verification_code():
    """生成6位随机验证码"""
    return f"{secrets.randbelow(1000000):06d}"

def send_verification_email(email: str, code: str):
    """发送验证码邮件

    TODO: 接入实际的 SMTP 邮件服务
    """
    logger.info(f"发送验证码邮件到 {email}, 验证码: {code}")
    print(f"[模拟] 发送验证码邮件到 {email}, 验证码: {code}")
    return True

def save_verification_code(email: str, code: str = None):
    """保存验证码"""
    from datetime import datetime
    
    if code is None:
        code = generate_verification_code()
        
    verification_codes[email] = {
        "code": code,
        "timestamp": datetime.now()
    }
    return code

def verify_code(email: str, code: str):
    """验证验证码"""
    from datetime import datetime, timedelta
    from app.utils.auth import VERIFICATION_CODE_EXPIRY
    
    if email not in verification_codes:
        return False
    
    stored_data = verification_codes[email]
    stored_code = stored_data["code"]
    timestamp = stored_data["timestamp"]
    
    if datetime.now() - timestamp > timedelta(seconds=VERIFICATION_CODE_EXPIRY):
        del verification_codes[email]
        return False
    
    if stored_code == code:
        del verification_codes[email]
        return True
        
    return False
