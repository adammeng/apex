"""
Redis 客户端（异步，基于 redis-py async）
提供简单的 JSON 缓存 get/set/delete/flush_pattern 工具函数。
"""

import hashlib
import json
from typing import Any, Optional

import redis.asyncio as aioredis

from .config import get_settings
from .logging import get_logger

logger = get_logger(__name__)

_redis: Optional[aioredis.Redis] = None


def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        settings = get_settings()
        _redis = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis


async def cache_get(key: str) -> Optional[Any]:
    """获取缓存，不存在时返回 None。"""
    try:
        r = get_redis()
        value = await r.get(key)
        if value is None:
            return None
        return json.loads(value)
    except Exception as e:
        logger.warning(f"Redis GET 失败 key={key}: {e}")
        return None


async def cache_set(key: str, value: Any, ttl: Optional[int] = None) -> None:
    """设置缓存，ttl 默认从配置读取。"""
    try:
        settings = get_settings()
        r = get_redis()
        await r.set(
            key,
            json.dumps(value, ensure_ascii=False),
            ex=ttl or settings.cache_ttl_seconds,
        )
    except Exception as e:
        logger.warning(f"Redis SET 失败 key={key}: {e}")


async def cache_delete(key: str) -> None:
    try:
        r = get_redis()
        await r.delete(key)
    except Exception as e:
        logger.warning(f"Redis DELETE 失败 key={key}: {e}")


async def cache_flush_pattern(pattern: str) -> int:
    """删除匹配 pattern 的所有 key，返回删除数量。"""
    try:
        r = get_redis()
        keys = await r.keys(pattern)
        if keys:
            await r.delete(*keys)
        return len(keys)
    except Exception as e:
        logger.warning(f"Redis FLUSH PATTERN 失败 pattern={pattern}: {e}")
        return 0


def make_cache_key(prefix: str, params: Any) -> str:
    """基于参数 dict 生成稳定的缓存 key。"""
    params_str = json.dumps(params, sort_keys=True, ensure_ascii=False)
    params_hash = hashlib.md5(params_str.encode()).hexdigest()
    return f"{prefix}:{params_hash}"
