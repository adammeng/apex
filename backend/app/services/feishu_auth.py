"""
飞书 OAuth2 服务层
调用飞书开放平台接口，完成 code → user_info 的换取流程。
"""

import httpx

from ..core.config import get_settings


FEISHU_TOKEN_URL = "https://open.feishu.cn/open-apis/authen/v1/oidc/access_token"
FEISHU_USER_URL = "https://open.feishu.cn/open-apis/authen/v1/user_info"
FEISHU_APP_ACCESS_TOKEN_URL = (
    "https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal"
)


def _safe_json(resp: httpx.Response) -> dict:
    try:
        body = resp.json()
        if isinstance(body, dict):
            return body
    except Exception:
        pass
    return {}


def _format_feishu_error(prefix: str, body: dict, resp: httpx.Response) -> str:
    code = body.get("code")
    msg = body.get("msg") or body.get("message") or "unknown error"
    request_id = (
        body.get("request_id")
        or body.get("requestId")
        or resp.headers.get("x-tt-logid")
        or resp.headers.get("x-request-id")
        or ""
    )
    extras = []
    if code is not None:
        extras.append(f"code={code}")
    if msg:
        extras.append(f"msg={msg}")
    if request_id:
        extras.append(f"request_id={request_id}")
    extras.append(f"http_status={resp.status_code}")
    return f"{prefix}: {'; '.join(extras)}"


async def get_app_access_token() -> str:
    """获取飞书应用级 access token（app_access_token）。"""
    settings = get_settings()
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            FEISHU_APP_ACCESS_TOKEN_URL,
            json={
                "app_id": settings.feishu_app_id,
                "app_secret": settings.feishu_app_secret,
            },
        )
        body = _safe_json(resp)
        if resp.status_code >= 400:
            raise RuntimeError(_format_feishu_error("获取飞书 app_access_token 失败", body, resp))
        if body.get("code") != 0:
            raise RuntimeError(_format_feishu_error("获取飞书 app_access_token 失败", body, resp))
        return body["app_access_token"]


async def exchange_code_for_user(code: str) -> dict:
    """
    用授权码换取用户信息。
    返回包含 open_id、name（display_name）、avatar_url 的字典。
    """
    app_token = await get_app_access_token()

    async with httpx.AsyncClient(timeout=10) as client:
        # 用 code 换取用户 access_token
        resp = await client.post(
            FEISHU_TOKEN_URL,
            headers={"Authorization": f"Bearer {app_token}"},
            json={"grant_type": "authorization_code", "code": code},
        )
        body = _safe_json(resp)
        if resp.status_code >= 400:
            raise RuntimeError(_format_feishu_error("飞书 code 换 token 失败", body, resp))
        if body.get("code") != 0:
            raise RuntimeError(_format_feishu_error("飞书 code 换 token 失败", body, resp))

        token_data = body.get("data") or {}
        user_access_token = token_data.get("access_token")
        if not user_access_token:
            raise RuntimeError(
                _format_feishu_error("飞书 code 换 token 失败", body, resp)
            )

        user_resp = await client.get(
            FEISHU_USER_URL,
            headers={"Authorization": f"Bearer {user_access_token}"},
        )
        user_body = _safe_json(user_resp)
        if user_resp.status_code >= 400:
            raise RuntimeError(
                _format_feishu_error("获取飞书用户信息失败", user_body, user_resp)
            )
        if user_body.get("code") != 0:
            raise RuntimeError(
                _format_feishu_error("获取飞书用户信息失败", user_body, user_resp)
            )

        data = user_body.get("data") or {}
        return {
            "open_id": data["open_id"],
            "name": data.get("name") or data.get("display_name") or "未知用户",
            "avatar_url": data.get("avatar_url") or data.get("avatar_thumb") or "",
            "email": data.get("email") or "",
        }
