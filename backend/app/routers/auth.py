"""
鉴权路由 — 飞书 OAuth2 + JWT
V1: /api/auth/feishu/login, /api/auth/feishu/callback, /api/auth/me
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse

from ..core.config import get_settings
from ..schemas.response import ApiResponse

router = APIRouter(prefix="/auth", tags=["鉴权"])


@router.get("/feishu/login", summary="飞书登录入口")
async def feishu_login():
    """重定向到飞书 OAuth2 授权页面。"""
    settings = get_settings()
    if not settings.feishu_app_id:
        raise HTTPException(status_code=503, detail="飞书应用未配置")
    auth_url = (
        "https://open.feishu.cn/open-apis/authen/v1/index"
        f"?app_id={settings.feishu_app_id}"
        f"&redirect_uri={settings.feishu_redirect_uri}"
        "&response_type=code"
    )
    return RedirectResponse(url=auth_url)


@router.get("/feishu/callback", summary="飞书 OAuth2 回调")
async def feishu_callback(code: str, state: str = ""):
    """接收飞书回调，换取 access_token，生成 JWT。"""
    # TODO: 调用 feishu_auth service 换 token，写入 users 表，签发 JWT
    return ApiResponse.ok(
        data={"code": code, "state": state, "msg": "TODO: 完整飞书登录流程待实现"}
    )


@router.get("/me", summary="获取当前登录用户信息")
async def get_me():
    """返回当前 JWT 对应的用户信息。"""
    # TODO: 解析 JWT，查询用户表
    return ApiResponse.ok(data={"open_id": "mock_user", "name": "开发测试用户"})


@router.post("/mock-login", summary="Mock 登录（开发调试用）")
async def mock_login():
    """跳过飞书鉴权，直接返回测试 JWT（仅 debug 模式可用）。"""
    settings = get_settings()
    if not settings.debug:
        raise HTTPException(status_code=403, detail="仅开发模式可用")
    # TODO: 生成 JWT
    return ApiResponse.ok(
        data={"access_token": "mock_jwt_token", "token_type": "bearer"}
    )
