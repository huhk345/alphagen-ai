from typing import List, Mapping, Optional

import os
import re
import requests
import yfinance as yf

from .executor import execute_backtest
from .gemini_service import generate_backtest_python_code
from .models import (
    BacktestDataPoint,
    BacktestResult,
    BenchmarkType,
    PricePoint,
    Trade,
)

def _fetch_yahoo_finance_data(ticker: str) -> List[PricePoint]:
    df = yf.download(
        ticker,
        period="1y",
        interval="1d",
        auto_adjust=False,
        progress=False,
    )
    if df.empty:
        raise RuntimeError(f"No data returned for {ticker}")
    records: List[PricePoint] = []
    for index, row in df.iterrows():
        close = float(row.get("Close"))
        if not close:
            continue
        price_point = PricePoint(
            date=index.strftime("%Y-%m-%d"),
            close=close,
            open=float(row.get("Open")) if row.get("Open") is not None else None,
            high=float(row.get("High")) if row.get("High") is not None else None,
            low=float(row.get("Low")) if row.get("Low") is not None else None,
            volume=float(row.get("Volume")) if row.get("Volume") is not None else None,
        )
        records.append(price_point)
    if not records:
        raise RuntimeError(f"No valid price points for {ticker}")
    return records


def get_market_data(benchmark: BenchmarkType) -> List[PricePoint]:
    ticker_map: Mapping[BenchmarkType, str] = {
        BenchmarkType.BTC_USD: "BTC-USD",
        BenchmarkType.ETH_USD: "ETH-USD",
        BenchmarkType.SP500: "^GSPC",
        BenchmarkType.CSI300: "000300.SS",
    }
    ticker = ticker_map.get(benchmark)
    if not ticker:
        raise ValueError(f"Unsupported benchmark: {benchmark}")
    return _fetch_yahoo_finance_data(ticker)


def _normalize_a_share_ticker(code: str) -> str:
    raw = (code or "").strip()
    if not raw or not re.fullmatch(r"\d{6}", raw):
        raise ValueError(f"Invalid A-share code: {code}")
    first = raw[0]
    if first in ("6", "9"):
        suffix = ".SS"
    else:
        suffix = ".SZ"
    return f"{raw}{suffix}"


def get_a_share_market_data_from_code(code: str) -> List[PricePoint]:
    ticker = _normalize_a_share_ticker(code)
    return _fetch_yahoo_finance_data(ticker)


def _build_long_only_trades(
    data: List[BacktestDataPoint], price_series: List[PricePoint]
) -> List[Trade]:
    price_map: dict[str, float] = {}
    for p in price_series:
        if p.date not in price_map and p.close and p.close > 0:
            price_map[p.date] = p.close
    trades: List[Trade] = []
    position = 0
    cash = 100.0
    holdings = 0.0
    for point in data:
        signal = point.signal
        if not signal:
            continue
        price = price_map.get(point.date)
        if not price or price <= 0:
            continue
        if signal == "BUY" and position == 0:
            quantity = cash / price
            amount = quantity * price
            trades.append(
                Trade(
                    date=point.date,
                    type="BUY",
                    price=price,
                    quantity=quantity,
                    amount=amount,
                )
            )
            holdings = quantity
            cash = 0.0
            position = 1
        elif signal == "SELL" and position == 1:
            amount = holdings * price
            trades.append(
                Trade(
                    date=point.date,
                    type="SELL",
                    price=price,
                    quantity=holdings,
                    amount=amount,
                )
            )
            cash = amount
            holdings = 0.0
            position = 0
    if position == 1 and data:
        last_point = data[-1]
        price = price_map.get(last_point.date)
        if price and price > 0 and holdings > 0:
            amount = holdings * price
            trades.append(
                Trade(
                    date=last_point.date,
                    type="SELL",
                    price=price,
                    quantity=holdings,
                    amount=amount,
                )
            )
    return trades


def run_backtest(
    formula: str,
    benchmark: BenchmarkType,
    buyThreshold: Optional[str] = None,
    sellThreshold: Optional[str] = None,
    pythonCode: Optional[str] = None,
    customCode: Optional[str] = None,
) -> BacktestResult:
    import time

    request_id = f"bk-{int(time.time() * 1000):x}"
    print(f"[Backtest] [{request_id}] Starting backtest benchmark={benchmark}")
    print(
        f"[Backtest] [{request_id}] Formula length={len(formula)} buy={buyThreshold or '-'} sell={sellThreshold or '-'}"
    )
    if customCode:
        print(f"[Backtest] [{request_id}] Using custom A-share code={customCode}")
        price_data = get_a_share_market_data_from_code(customCode)
        benchmark_label = customCode
    else:
        price_data = get_market_data(benchmark)
        benchmark_label = benchmark.value
    print(f"[Backtest] [{request_id}] Loaded market data points={len(price_data)}")
    try:
        python_script = pythonCode or generate_backtest_python_code(formula)
        print(f"[Backtest] [{request_id}] Generated python script:\n{python_script}")
        payload = execute_backtest(
            python_script,
            {
                "priceData": [p.dict() for p in price_data],
                "formula": formula,
                "benchmark": benchmark_label,
                "buyThreshold": buyThreshold,
                "sellThreshold": sellThreshold,
            },
        )
        status = payload.get("status")
        print(f"[Backtest] [{request_id}] Python service status={status}")
        if status == "error":
            error_message = payload.get("error") or "Unknown error"
            stdout = payload.get("stdout") or ""
            print(f"[Backtest] [{request_id}] Python error={error_message}")
            raise RuntimeError(
                f"Python Service Error: {error_message}\nStdout: {stdout}"
            )
        result_data = payload.get("result") or {}
        if result_data.get("metrics"):
            m = result_data["metrics"]
            print(
                f"[Backtest] [{request_id}] Metrics sharpe={m.get('sharpeRatio')} annReturn={m.get('annualizedReturn')} maxDD={m.get('maxDrawdown')}"
            )
        result = BacktestResult(**result_data)
        if result.data:
            synthetic_trades = _build_long_only_trades(result.data, price_data)
            if synthetic_trades:
                result.trades = synthetic_trades
        print(
            f"[Backtest] [{request_id}] Completed successfully with {len(result.trades)} trades"
        )
        result.pythonCode = python_script
        return result
    except Exception as exc:
        print(f"[Backtest] [{request_id}] Backtest failed={exc}")
        raise RuntimeError(f"Failed to run backtest: {exc}") from exc
