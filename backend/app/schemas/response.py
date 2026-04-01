"""
统一响应结构
所有接口统一返回 {"code": 0, "msg": "ok", "data": ...}
"""

from typing import Any, Generic, Optional, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    code: int = 0
    msg: str = "ok"
    data: Optional[T] = None

    @classmethod
    def ok(cls, data: Any = None, msg: str = "ok") -> "ApiResponse":
        return cls(code=0, msg=msg, data=data)

    @classmethod
    def error(cls, code: int = 500, msg: str = "服务器内部错误") -> "ApiResponse":
        return cls(code=code, msg=msg, data=None)
