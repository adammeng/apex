"""
JWT 工具 — 签发与验证
"""

from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt

from .config import get_settings


def create_access_token(payload: dict[str, Any]) -> str:
    """签发 JWT access token。payload 中至少包含 open_id 和 name。"""
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    data = {**payload, "exp": expire}
    return jwt.encode(data, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    """解码并验证 JWT，返回 payload。失败时抛出 JWTError。"""
    settings = get_settings()
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
