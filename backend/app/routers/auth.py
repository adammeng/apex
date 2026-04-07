"""
鉴权路由 — 飞书 OAuth2 + JWT
主场景：飞书内嵌 H5 应用，JS SDK 静默获取 code，POST 给后端换 JWT。
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from pydantic import BaseModel

from ..core.config import get_settings
from ..core.jwt import create_access_token, decode_access_token
from ..core.logging import get_logger
from ..schemas.response import ApiResponse
from ..services.feishu_auth import exchange_code_for_user

router = APIRouter(prefix="/auth", tags=["鉴权"])
logger = get_logger(__name__)

_bearer = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# 依赖：从 Bearer Token 中提取当前用户
# ---------------------------------------------------------------------------


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> dict:
    """FastAPI 依赖，验证 JWT 并返回用户 payload。"""
    if credentials is None:
        raise HTTPException(status_code=401, detail="未提供认证 Token")
    try:
        payload = decode_access_token(credentials.credentials)
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Token 无效或已过期")


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------


class CodeExchangeRequest(BaseModel):
    code: str


# ---------------------------------------------------------------------------
# 路由
# ---------------------------------------------------------------------------


@router.post("/feishu/code2token", summary="飞书 code 换 JWT（静默登录）")
async def feishu_code2token(body: CodeExchangeRequest):
    """
    前端在飞书客户端内通过 JS SDK 静默获取授权码后，POST code 到此接口。
    后端换取用户信息，签发 JWT 返回。全程用户无感知。
    """
    try:
        user_info = await exchange_code_for_user(body.code)
    except Exception as e:
        logger.warning(f"飞书 code 换 JWT 失败: {e}")
        raise HTTPException(status_code=400, detail=f"飞书授权失败: {e}")

    token = create_access_token(
        {
            "open_id": user_info["open_id"],
            "name": user_info["name"],
            "avatar_url": user_info.get("avatar_url", ""),
            "email": user_info.get("email", ""),
        }
    )
    return ApiResponse.ok(data={"access_token": token, "token_type": "bearer"})


@router.get("/feishu/launch", summary="飞书网页应用入口跳转")
async def feishu_launch(
    code: Optional[str] = Query(default=None),
    state: Optional[str] = Query(default=None),
):
    """
    作为飞书网页应用的 redirect_uri 落地点使用。

    飞书官方网页应用入口推荐先走授权页，再回调到业务域名。这里先把回调
    统一落到后端，再 302 到前端 /matrix 页面，避免工作台首页直接填写业务
    域名时被飞书客户端按“外部链接”处理。

    当前前端仍沿用 H5 JS SDK 静默登录，因此这里不消费 code，只负责把用户
    稳定带进飞书内嵌页面。后续如需收敛登录链路，可在此直接消费 code。
    """
    settings = get_settings()
    base_url = settings.frontend_url.rstrip("/")
    target = f"{base_url}/matrix"

    # 先透传回调参数，便于后续前端或后端切换为直接消费 OAuth code。
    if code:
        separator = "&" if "?" in target else "?"
        target = f"{target}{separator}code={code}"
        if state:
            target = f"{target}&state={state}"

    return RedirectResponse(url=target, status_code=302)


@router.get("/me", summary="获取当前登录用户信息")
async def get_me(user: dict = Depends(get_current_user)):
    """返回当前 JWT 对应的用户信息。"""
    return ApiResponse.ok(
        data={
            "open_id": user.get("open_id"),
            "name": user.get("name"),
            "avatar_url": user.get("avatar_url", ""),
            "email": user.get("email", ""),
        }
    )


@router.post("/mock-login", summary="非飞书环境登录（PC 浏览器访问用）")
async def mock_login():
    """
    非飞书客户端环境（PC 浏览器等）访问时，自动走此接口获取开发用户 JWT。
    内部工具，无需对外暴露真实飞书凭据。
    """
    token = create_access_token(
        {
            "open_id": "mock_open_id_dev",
            "name": "开发测试用户",
            "avatar_url": "",
            "email": "dev@example.com",
        }
    )
    return ApiResponse.ok(data={"access_token": token, "token_type": "bearer"})
