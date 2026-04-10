import json
import logging

import redis
from flask import current_app

logger = logging.getLogger(__name__)

_pool = None


def _get_redis():
    global _pool
    if _pool is None:
        _pool = redis.ConnectionPool.from_url(current_app.config["REDIS_URL"])
    return redis.Redis(connection_pool=_pool)


class CacheService:
    @staticmethod
    def get(key):
        try:
            r = _get_redis()
            value = r.get(key)
            if value:
                return json.loads(value)
        except Exception as e:
            logger.warning(f"Cache get failed for {key}: {e}")
        return None

    @staticmethod
    def set(key, value, ttl=300):
        try:
            r = _get_redis()
            r.setex(key, ttl, json.dumps(value, default=str))
        except Exception as e:
            logger.warning(f"Cache set failed for {key}: {e}")

    @staticmethod
    def delete(key):
        try:
            r = _get_redis()
            r.delete(key)
        except Exception as e:
            logger.warning(f"Cache delete failed for {key}: {e}")

    @staticmethod
    def delete_pattern(pattern):
        """Delete all keys matching a glob pattern."""
        try:
            r = _get_redis()
            keys = r.keys(pattern)
            if keys:
                r.delete(*keys)
        except Exception as e:
            logger.warning(f"Cache delete_pattern failed for {pattern}: {e}")

    @staticmethod
    def incr(key):
        try:
            r = _get_redis()
            return r.incr(key)
        except Exception as e:
            logger.warning(f"Cache incr failed for {key}: {e}")
            return None

    @staticmethod
    def decr(key):
        try:
            r = _get_redis()
            return r.decr(key)
        except Exception as e:
            logger.warning(f"Cache decr failed for {key}: {e}")
            return None
