"""
鉴权路由 — 飞书 OAuth2 + JWT

支持两种场景：
1. 飞书客户端内嵌 H5：JS SDK 静默获取 code → POST /auth/feishu/code2token → JWT
2. 外部浏览器（PC）：GET /auth/feishu/redirect → 飞书网页授权页 → 回调
   GET /auth/feishu/callback?code=xxx → 后端换 JWT → 302 前端（携带 token query）
"""

import secrets
from typing import Optional
from urllib.parse import urlencode

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

# 飞书网页授权端点（扫码/账密登录，适合外部浏览器）
_FEISHU_OAUTH_AUTHORIZE_URL = "https://open.feishu.cn/open-apis/authen/v1/authorize"


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
    域名时被飞书客户端按"外部链接"处理。

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


@router.get("/feishu/redirect", summary="外部浏览器发起飞书网页授权")
async def feishu_redirect():
    """
    外部浏览器（非飞书客户端）点击「在飞书中授权」时，
    由前端直接跳转到此接口，后端组装飞书 OAuth 授权 URL 并 302 跳转。

    授权完成后飞书回调 /auth/feishu/callback，换取 JWT 后再跳回前端。
    """
    settings = get_settings()
    # state 用于防 CSRF，此处用随机串；生产可结合 Redis 做时效校验
    state = secrets.token_urlsafe(16)
    params = {
        "app_id": settings.feishu_app_id,
        "redirect_uri": settings.feishu_redirect_uri,
        "state": state,
    }
    authorize_url = f"{_FEISHU_OAUTH_AUTHORIZE_URL}?{urlencode(params)}"
    logger.info(f"外部浏览器发起飞书授权, state={state}")
    return RedirectResponse(url=authorize_url, status_code=302)


@router.get("/feishu/callback", summary="飞书 OAuth 授权回调（外部浏览器用）")
async def feishu_callback(
    code: Optional[str] = Query(default=None),
    state: Optional[str] = Query(default=None),
    error: Optional[str] = Query(default=None),
):
    """
    飞书完成授权后回调此接口（对应 feishu_redirect_uri 配置）。
    换取用户信息，签发 JWT，302 跳回前端并在 query 中携带 token。
    前端读取 query 中的 token 存入 localStorage，完成登录闭环。
    """
    settings = get_settings()
    base_url = settings.frontend_url.rstrip("/")

    if error or not code:
        reason = error or "no_code"
        logger.warning(f"飞书 OAuth 回调失败: error={reason}")
        return RedirectResponse(
            url=f"{base_url}/?auth_error={reason}",
            status_code=302,
        )

    try:
        user_info = await exchange_code_for_user(code)
    except Exception as e:
        logger.warning(f"飞书 callback 换用户信息失败: {e}")
        return RedirectResponse(
            url=f"{base_url}/?auth_error=exchange_failed",
            status_code=302,
        )

    token = create_access_token(
        {
            "open_id": user_info["open_id"],
            "name": user_info["name"],
            "avatar_url": user_info.get("avatar_url", ""),
            "email": user_info.get("email", ""),
        }
    )
    logger.info(f"外部浏览器 OAuth 授权成功: open_id={user_info['open_id']}")
    # 把 JWT 以 query 参数带回前端，前端存入 localStorage
    return RedirectResponse(
        url=f"{base_url}/?access_token={token}",
        status_code=302,
    )


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
