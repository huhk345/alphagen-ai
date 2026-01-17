import os
from datetime import datetime
from typing import List

from supabase import Client, create_client

from .models import AlphaFactor, BacktestResult, User


def _get_supabase_client() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_ANON_KEY")
    if not url or not key:
        raise RuntimeError("Supabase is not configured")
    return create_client(url, key)


supabase = _get_supabase_client()


def save_user(user: User) -> None:
    payload = {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "avatar": user.avatar,
        "provider": user.provider.value,
        "last_login": datetime.utcnow().isoformat(),
    }
    supabase.table("users").upsert(payload).execute()


def save_factor(user_id: str, factor: AlphaFactor) -> None:
    payload = {
        "id": factor.id,
        "user_id": user_id,
        "name": factor.name,
        "formula": factor.formula,
        "description": factor.description,
        "intuition": factor.intuition,
        "category": factor.category,
        "sources": [s.dict() for s in factor.sources] if factor.sources else [],
        "last_benchmark": factor.lastBenchmark.value if factor.lastBenchmark else None,
        "buy_threshold": factor.buyThreshold,
        "sell_threshold": factor.sellThreshold,
        "python_code": factor.pythonCode,
        "created_at": datetime.utcfromtimestamp(factor.createdAt / 1000).isoformat(),
    }
    supabase.table("alpha_factors").upsert(payload, on_conflict="id").execute()


def delete_factor(user_id: str, factor_id: str) -> None:
    supabase.table("alpha_factors").delete().eq("id", factor_id).eq("user_id", user_id).execute()


def sync_factors(user_id: str, factors: List[AlphaFactor]) -> None:
    mapped = []
    for f in factors:
        mapped.append(
            {
                "id": f.id,
                "user_id": user_id,
                "name": f.name,
                "formula": f.formula,
                "description": f.description,
                "intuition": f.intuition,
                "category": f.category,
                "sources": [s.dict() for s in f.sources] if f.sources else [],
                "last_benchmark": f.lastBenchmark.value if f.lastBenchmark else None,
                "buy_threshold": f.buyThreshold,
                "sell_threshold": f.sellThreshold,
                "python_code": f.pythonCode,
                "created_at": datetime.utcfromtimestamp(f.createdAt / 1000).isoformat(),
            }
        )
    supabase.table("alpha_factors").upsert(mapped, on_conflict="id").execute()


def fetch_factors(user_id: str) -> List[AlphaFactor]:
    res = supabase.table("alpha_factors").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
    data = getattr(res, "data", None) or []
    factors: List[AlphaFactor] = []
    for f in data:
        created_at_iso = f.get("created_at")
        created_at_ms = 0
        if created_at_iso:
            try:
                created_at_ms = int(
                    datetime.fromisoformat(created_at_iso.replace("Z", "")).timestamp()
                    * 1000
                )
            except Exception:
                created_at_ms = 0
        factors.append(
            AlphaFactor(
                id=f.get("id"),
                userId=f.get("user_id"),
                name=f.get("name"),
                formula=f.get("formula"),
                description=f.get("description"),
                intuition=f.get("intuition"),
                category=f.get("category"),
                createdAt=created_at_ms,
                sources=f.get("sources"),
                lastBenchmark=f.get("last_benchmark"),
                buyThreshold=f.get("buy_threshold"),
                sellThreshold=f.get("sell_threshold"),
                pythonCode=f.get("python_code"),
            )
        )
    return factors


def save_backtest_result(user_id: str, factor_id: str, result: BacktestResult) -> None:
    payload = {
        "user_id": user_id,
        "factor_id": factor_id,
        "benchmark_name": result.metrics.benchmarkName,
        "sharpe_ratio": result.metrics.sharpeRatio,
        "annualized_return": result.metrics.annualizedReturn,
        "max_drawdown": result.metrics.maxDrawdown,
        "volatility": result.metrics.volatility,
        "win_rate": result.metrics.winRate,
        "data": [p.dict() for p in result.data],
        "trades": [t.dict() for t in result.trades],
        "created_at": datetime.utcnow().isoformat(),
    }
    supabase.table("backtest_results").insert(payload).execute()


def fetch_backtest_results(factor_id: str) -> List[BacktestResult]:
    res = supabase.table("backtest_results").select("*").eq("factor_id", factor_id).order("created_at", desc=True).execute()
    data = getattr(res, "data", None) or []
    results: List[BacktestResult] = []
    for r in data:
        metrics = {
            "sharpeRatio": r.get("sharpe_ratio"),
            "annualizedReturn": r.get("annualized_return"),
            "maxDrawdown": r.get("max_drawdown"),
            "volatility": r.get("volatility"),
            "winRate": r.get("win_rate"),
            "benchmarkName": r.get("benchmark_name"),
        }
        result = BacktestResult(
            data=r.get("data") or [],
            metrics=metrics,
            trades=r.get("trades") or [],
        )
        results.append(result)
    return results
