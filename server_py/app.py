import os
import time

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import requests

from . import data_service, db_service
from .gemini_service import generate_alpha_factor, generate_bulk_alpha_factors
from .models import (
    AlphaFactor,
    BacktestRequest,
    BenchmarkType,
    DeleteFactorRequest,
    GenerateBulkRequest,
    GenerateRequest,
    SaveBacktestResultRequest,
    SaveFactorRequest,
    SaveUserRequest,
    SyncFactorsRequest,
)


env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
if os.path.exists(env_path):
    load_dotenv(env_path)


raw_allowed_emails = os.getenv("ALLOWED_EMAILS") or ""
ALLOWED_EMAILS = {
    email.strip().lower() for email in raw_allowed_emails.split(",") if email.strip()
}


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


def _verify_google_token(access_token: str):
    try:
        res = requests.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=5,
        )
        if res.status_code != 200:
            return None
        data = res.json()
        if not data.get("sub") or not data.get("email"):
            return None
        return data
    except Exception:
        return None


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    if request.url.path.startswith("/api/") and request.method != "OPTIONS":
        auth_header = request.headers.get("Authorization") or ""
        if not auth_header.startswith("Bearer "):
            return JSONResponse(status_code=401, content={"detail": "Unauthorized"})
        token = auth_header.split(" ", 1)[1].strip()
        userinfo = _verify_google_token(token)
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


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT") or "3001")
    uvicorn.run("backend.server_py.app:app", host="0.0.0.0", port=port, reload=True)
