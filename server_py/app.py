import os
import time

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import requests
from typing import Optional, Dict, Any

from . import data_service, db_service
from .gemini_service import generate_alpha_factor, generate_bulk_alpha_factors
from .models import (
    AlphaFactor,
    AuthProvider,
    BacktestRequest,
    BenchmarkType,
    DeleteFactorRequest,
    GenerateBulkRequest,
    GenerateRequest,
    SaveBacktestResultRequest,
    SaveFactorRequest,
    SaveUserRequest,
    SyncFactorsRequest,
    GithubAuthExchangeRequest,
    User,
)


env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
if os.path.exists(env_path):
    load_dotenv(env_path)


raw_allowed_emails = os.getenv("ALLOWED_EMAILS") or ""
ALLOWED_EMAILS = {
    email.strip().lower() for email in raw_allowed_emails.split(",") if email.strip()
}

GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def request_id_dependency(request: Request) -> str:
    if hasattr(request.state, "request_id"):
        return request.state.request_id
    return ""


def _fetch_github_user(access_token: str) -> Optional[Dict[str, Any]]:
    try:
        user_res = requests.get(
            "https://api.github.com/user",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github+json",
            },
            timeout=5,
        )
        if user_res.status_code != 200:
            return None
        user_data = user_res.json()
        if not user_data.get("id"):
            return None

        email = user_data.get("email") or ""
        if not email:
            emails_res = requests.get(
                "https://api.github.com/user/emails",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.github+json",
                },
                timeout=5,
            )
            if emails_res.status_code == 200:
                emails = emails_res.json() or []
                primary_email = None
                for item in emails:
                    if item.get("primary") and item.get("verified"):
                        primary_email = item.get("email")
                        break
                if not primary_email and emails:
                    primary_email = emails[0].get("email")
                email = primary_email or ""

        return {
            "sub": str(user_data["id"]),
            "email": email,
            "name": user_data.get("name") or user_data.get("login") or "",
            "avatar": user_data.get("avatar_url") or "",
            "login": user_data.get("login") or "",
        }
    except Exception:
        return None


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    if os.getenv("PY_ENV") == "DEBUG" and not (request.headers.get("Authorization") or ""):
        request.state.userinfo = {"sub": os.getenv("TEST_USER_ID")}
    elif request.url.path.startswith("/api/") and request.method != "OPTIONS":
        auth_header = request.headers.get("Authorization") or ""
        if not auth_header.startswith("Bearer "):
            return JSONResponse(status_code=401, content={"detail": "Unauthorized"})
        token = auth_header.split(" ", 1)[1].strip()
        userinfo = _fetch_github_user(token)
        if not userinfo:
            return JSONResponse(status_code=401, content={"detail": "Unauthorized"})
        email = (userinfo.get("email") or "").lower()
        if ALLOWED_EMAILS and email not in ALLOWED_EMAILS:
            return JSONResponse(status_code=403, content={"detail": "Forbidden"})
        request.state.userinfo = userinfo
    response = await call_next(request)
    return response


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    request_id = f"{int(start * 1000):x}"
    request.state.request_id = request_id
    method = request.method
    url = request.url.path
    print(f"[HTTP] [{request_id}] {method} {url}")
    if method == "POST":
        try:
            body = await request.json()
            preview = str(body)
            print(f"[HTTP] [{request_id}] Body: {preview[:500]}")
        except Exception:
            pass
    response = await call_next(request)
    duration_ms = int((time.time() - start) * 1000)
    print(f"[HTTP] [{request_id}] {response.status_code} {method} {url} - {duration_ms}ms")
    return response


@app.get("/api/market-data")
def get_market_data(benchmark: BenchmarkType):
    try:
        return data_service.get_market_data(benchmark)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/backtest")
def run_backtest(
    body: BacktestRequest,
    request_id: str = Depends(request_id_dependency),
):
    print(f"[HTTP] [{request_id}] /api/backtest called benchmark={body.benchmark} hasFormula={bool(body.formula)}")
    if not body.formula or not body.benchmark:
        raise HTTPException(status_code=400, detail="Formula and benchmark are required")
    try:
        print(f"[HTTP] [{request_id}] Dispatching to data_service.run_backtest")
        result = data_service.run_backtest(
            formula=body.formula,
            benchmark=body.benchmark,
            buyThreshold=body.buyThreshold,
            sellThreshold=body.sellThreshold,
            pythonCode=body.pythonCode,
            customCode=body.customCode,
        )
        print(f"[HTTP] [{request_id}] Backtest finished in data_service")
        return result
    except Exception as exc:
        print(f"[HTTP] [{request_id}] Backtest error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/generate")
def generate(body: GenerateRequest) -> AlphaFactor:
    try:
        return generate_alpha_factor(body.prompt, body.config)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/generate-bulk")
def generate_bulk(body: GenerateBulkRequest):
    try:
        return generate_bulk_alpha_factors(body.count, body.config)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/db/user")
def save_user(body: SaveUserRequest, request: Request):
    userinfo = getattr(request.state, "userinfo", None) or {}
    sub = userinfo.get("sub")
    if not sub or body.user.id != sub:
        raise HTTPException(status_code=403, detail="User mismatch")
    try:
        db_service.save_user(body.user)
        return {"success": True}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/db/factors/sync")
def sync_factors(body: SyncFactorsRequest, request: Request):
    userinfo = getattr(request.state, "userinfo", None) or {}
    sub = userinfo.get("sub")
    if not sub or body.userId != sub:
        raise HTTPException(status_code=403, detail="User mismatch")
    try:
        db_service.sync_factors(body.userId, body.factors)
        return {"success": True}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/db/factors/save")
def save_factor(body: SaveFactorRequest, request: Request):
    userinfo = getattr(request.state, "userinfo", None) or {}
    sub = userinfo.get("sub")
    if not sub or body.userId != sub:
        raise HTTPException(status_code=403, detail="User mismatch")
    try:
        db_service.save_factor(body.userId, body.factor)
        return {"success": True}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.delete("/api/db/factors/{factor_id}")
def delete_factor(factor_id: str, body: DeleteFactorRequest, request: Request):
    userinfo = getattr(request.state, "userinfo", None) or {}
    sub = userinfo.get("sub")
    if not sub or body.userId != sub:
        raise HTTPException(status_code=403, detail="User mismatch")
    try:
        db_service.delete_factor(body.userId, factor_id)
        return {"success": True}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/db/factors")
def fetch_factors(userId: str, request: Request):
    userinfo = getattr(request.state, "userinfo", None) or {}
    sub = userinfo.get("sub")
    if not userId:
        raise HTTPException(status_code=400, detail="UserId is required")
    if not sub or userId != sub:
        raise HTTPException(status_code=403, detail="User mismatch")
    try:
        return db_service.fetch_factors(userId)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/db/backtest/save")
def save_backtest(body: SaveBacktestResultRequest, request: Request):
    userinfo = getattr(request.state, "userinfo", None) or {}
    sub = userinfo.get("sub")
    if not sub or body.userId != sub:
        raise HTTPException(status_code=403, detail="User mismatch")
    try:
        db_service.save_backtest_result(body.userId, body.factorId, body.result)
        return {"success": True}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/db/backtest")
def fetch_backtest(factorId: str, request: Request):
    if not factorId:
        raise HTTPException(status_code=400, detail="FactorId is required")
    userinfo = getattr(request.state, "userinfo", None) or {}
    sub = userinfo.get("sub")
    if not sub:
        raise HTTPException(status_code=403, detail="User mismatch")
    try:
        return db_service.fetch_backtest_results(factorId)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/auth/github/exchange")
def github_exchange(body: GithubAuthExchangeRequest):
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="GitHub OAuth 未正确配置，请设置 GITHUB_CLIENT_ID 和 GITHUB_CLIENT_SECRET。")

    try:
        token_res = requests.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": body.code,
                "redirect_uri": body.redirectUri,
            },
            timeout=5,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"GitHub token 请求失败: {exc}")

    if token_res.status_code != 200:
        raise HTTPException(status_code=400, detail="GitHub token 请求返回异常状态码。")

    token_data = token_res.json()
    if "error" in token_data:
        message = token_data.get("error_description") or token_data.get("error") or "GitHub OAuth 失败。"
        raise HTTPException(status_code=400, detail=message)

    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="GitHub 未返回访问令牌。")

    userinfo = _fetch_github_user(access_token)
    if not userinfo:
        raise HTTPException(status_code=401, detail="无法获取 GitHub 用户信息。")

    email = (userinfo.get("email") or "").lower()
    if ALLOWED_EMAILS and email not in ALLOWED_EMAILS:
        raise HTTPException(status_code=403, detail="当前 GitHub 邮箱没有访问权限。")

    user_model = User(
        id=str(userinfo.get("sub")),
        name=userinfo.get("name") or "",
        email=email,
        avatar=userinfo.get("avatar") or "",
        provider=AuthProvider.GITHUB,
        isLoggedIn=True,
    )
    db_service.save_user(user_model)

    return {
        "id": user_model.id,
        "name": user_model.name,
        "email": user_model.email,
        "avatar": user_model.avatar,
        "provider": user_model.provider.value,
        "isLoggedIn": user_model.isLoggedIn,
        "accessToken": access_token,
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT") or "3001")
    uvicorn.run("backend.server_py.app:app", host="0.0.0.0", port=port, reload=True)
