from fastapi import FastAPI
from pydantic import BaseModel
import json
import logging
import time
import pandas as pd
import numpy as np
import pandas_ta as ta

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)

app = FastAPI()


class BacktestRequest(BaseModel):
    code: str
    data: dict


def calculate_ic(df):
    try:
        temp = df.copy()
        temp["next_return"] = temp["close"].shift(-1) / temp["close"] - 1
        temp = temp[["factor", "next_return"]].replace([np.inf, -np.inf], np.nan).dropna()
        if temp.empty:
            return float("nan")
        return float(temp["factor"].corr(temp["next_return"], method="spearman"))
    except Exception:
        return float("nan")


def run_backtest(df, benchmark_name, buy_threshold, sell_threshold):
    df = df.copy()
    df["return"] = df["close"].pct_change()
    factor = df["factor"].astype(float).replace([np.inf, -np.inf], 0).fillna(0)
    mean = factor.mean()
    std = factor.std(ddof=0)
    if std and std != 0:
        z = (factor - mean) / std
    else:
        z = factor * 0
    df["factor_z"] = z
    if buy_threshold is None or sell_threshold is None or str(buy_threshold) == "" or str(sell_threshold) == "":
        buy_level = z.quantile(0.8)
        sell_level = z.quantile(0.2)
    else:
        try:
            buy_level = float(buy_threshold)
            sell_level = float(sell_threshold)
        except ValueError:
            buy_level = z.quantile(0.8)
            sell_level = z.quantile(0.2)
    position = 0
    positions = []
    signals = []
    for value in z:
        signal = None
        if position == 0 and value > buy_level:
            position = 1
            signal = "BUY"
        elif position == 1 and value < sell_level:
            position = 0
            signal = "SELL"
        signals.append(signal)
        positions.append(position)
    df["position"] = pd.Series(positions, index=df.index)
    df["signal"] = pd.Series(signals, index=df.index)
    df["strategyReturn"] = df["position"].shift(1).fillna(0) * df["return"]
    df["benchmarkReturn"] = df["return"]

    df["strategyReturn"] = df["strategyReturn"].replace([np.inf, -np.inf], 0).fillna(0)
    df["benchmarkReturn"] = df["benchmarkReturn"].replace([np.inf, -np.inf], 0).fillna(0)

    df["cumulativeStrategy"] = (1 + df["strategyReturn"]).cumprod()
    df["cumulativeBenchmark"] = (1 + df["benchmarkReturn"]).cumprod()
    n = len(df)
    if n <= 1:
        sharpe = 0.0
        ann_return = 0.0
        vol = 0.0
        max_dd = 0.0
        win_rate = 0.0
    else:
        daily_mean = df["strategyReturn"].mean()
        daily_vol = df["strategyReturn"].std(ddof=0)
        if daily_vol and daily_vol != 0:
            sharpe = float(daily_mean / daily_vol * (252 ** 0.5))
        else:
            sharpe = 0.0
        ann_return = float((df["cumulativeStrategy"].iloc[-1] ** (252 / n) - 1)) if n > 0 else 0.0
        vol = float(daily_vol * (252 ** 0.5))
        cummax = df["cumulativeStrategy"].cummax()
        max_dd = float(((df["cumulativeStrategy"] / cummax) - 1).min())
        wins = int((df["strategyReturn"] > 0).sum())
        total_trades = int((df["strategyReturn"] != 0).sum())
        win_rate = float(wins / total_trades * 100) if total_trades > 0 else 0.0

    def _clean_num(x, default=0.0):
        try:
            v = float(x)
        except Exception:
            return default
        if np.isnan(v) or np.isinf(v):
            return default
        return v

    records = []
    for _, row in df.iterrows():
        date = row["date"]
        if not isinstance(date, str):
            date_str = date.strftime("%Y-%m-%d")
        else:
            date_str = date
        signal_val = row.get("signal")
        if isinstance(signal_val, float) and (np.isnan(signal_val) or np.isinf(signal_val)):
            signal_val = None
        records.append(
            {
                "date": date_str,
                "strategyReturn": _clean_num(row.get("strategyReturn", 0.0), 0.0),
                "benchmarkReturn": _clean_num(row.get("benchmarkReturn", 0.0), 0.0),
                "cumulativeStrategy": _clean_num(row.get("cumulativeStrategy", 1.0), 1.0),
                "cumulativeBenchmark": _clean_num(row.get("cumulativeBenchmark", 1.0), 1.0),
                "signal": signal_val,
            }
        )
    ic = calculate_ic(df)
    result = {
        "data": records,
        "metrics": {
            "sharpeRatio": _clean_num(sharpe, 0.0),
            "annualizedReturn": _clean_num(ann_return, 0.0),
            "maxDrawdown": _clean_num(max_dd, 0.0),
            "volatility": _clean_num(vol, 0.0),
            "winRate": _clean_num(win_rate, 0.0),
            "benchmarkName": str(benchmark_name),
            "ic": None if ic is None or (isinstance(ic, float) and (np.isnan(ic) or np.isinf(ic))) else float(ic),
        },
        "trades": [],
    }
    return result


@app.post("/execute")
async def execute_backtest(request: BacktestRequest):
    request_id = f"py-{int(time.time() * 1000)}"
    logging.info("[%s] Received backtest execute request", request_id)
    try:
        price_data = request.data.get("priceData", [])
        data_summary = {
            "has_priceData": bool(price_data),
            "priceData_len": len(price_data),
            "has_formula": "formula" in request.data,
            "benchmark": request.data.get("benchmark"),
        }
        logging.info("[%s] Input summary %s", request_id, data_summary)
        if not price_data:
            return {"status": "error", "error": "priceData is empty"}
        df = pd.DataFrame(price_data)
        if "date" not in df.columns or "close" not in df.columns:
            return {"status": "error", "error": "priceData must contain date and close fields"}
        df["date"] = pd.to_datetime(df["date"])
        df = df.sort_values("date").reset_index(drop=True)
        local_vars = {"df": df, "ta": ta, "np": np, "pd": pd}
        code = request.code or ""
        start = time.time()
        try:
            exec(code, {}, local_vars)
        except Exception as e:
            duration = (time.time() - start) * 1000
            logging.exception("[%s] Factor code execution error after %.2f ms: %s", request_id, duration, str(e))
            return {"status": "error", "error": f"Factor code execution error: {str(e)}"}
        duration = (time.time() - start) * 1000
        logging.info("[%s] Factor code executed in %.2f ms", request_id, duration)
        df = local_vars.get("df", df)
        if "factor" not in df.columns:
            return {"status": "error", "error": "Factor code did not produce 'factor' column"}
        df["factor"] = df["factor"].replace([np.inf, -np.inf], 0).fillna(0)
        benchmark = request.data.get("benchmark") or "Benchmark"
        buy_threshold = request.data.get("buyThreshold")
        sell_threshold = request.data.get("sellThreshold")
        result = run_backtest(df, benchmark, buy_threshold, sell_threshold)
        logging.info("[%s] Backtest completed", request_id)
        return {"status": "success", "result": result}
    except Exception as e:
        logging.exception("[%s] Server error %s", request_id, str(e))
        return {"status": "error", "error": str(e)}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=5001)
