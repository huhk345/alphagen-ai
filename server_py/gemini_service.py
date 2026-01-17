import json
import os
from typing import Any, Callable, Dict, List, Optional

from google import genai
from google.genai import types

from .models import AlphaFactor, GenerationConfig, Source

def _load_gemini_keys() -> List[str]:
    raw = (os.getenv("GEMINI_API_KEY") or "").split(",")
    keys = [k.strip() for k in raw if k.strip()]
    if not keys:
        raise RuntimeError("GEMINI_API_KEY must be configured")
    return keys


GEMINI_KEYS = _load_gemini_keys()


def _with_gemini_client(fn: Callable[[genai.Client], Any]) -> Any:
    last_error: Optional[Exception] = None
    for key in GEMINI_KEYS:
        client = genai.Client(api_key=key)
        try:
            return fn(client)
        except Exception as exc:
            last_error = exc
            continue
    if last_error:
        raise last_error
    raise RuntimeError("No Gemini API keys available")


def _extract_sources(response: Any) -> List[Source]:
    candidates = getattr(response, "candidates", None)
    if not candidates:
        return []
    first = candidates[0]
    metadata = getattr(first, "grounding_metadata", None) or getattr(
        first, "groundingMetadata", None
    )
    if not metadata:
        return []
    chunks = getattr(metadata, "grounding_chunks", None) or getattr(
        metadata, "groundingChunks", None
    )
    if not chunks:
        return []
    result: List[Source] = []
    for chunk in chunks:
        web = getattr(chunk, "web", None) or getattr(chunk, "web_content", None)
        title = getattr(web, "title", None) or "Market Reference"
        url = getattr(web, "uri", None) or "#"
        result.append(Source(title=title, url=url))
    return result


def generate_alpha_factor(prompt: str, config: GenerationConfig) -> AlphaFactor:
    def _call(client: genai.Client) -> AlphaFactor:
        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=(
                f'Acting as a Senior Quant for BTC markets, generate a sophisticated alpha factor for: "{prompt}". '
                f"Universe: {config.investmentUniverse}. Target: {config.timeHorizon}. "
                "Incorporate real-time market regime knowledge. The formula must be a valid one-line Pandas/Numpy expression. "
                "Also provide recommended buy and sell threshold values based on the factor's characteristics."
            ),
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "name": types.Schema(type=types.Type.STRING),
                        "formula": types.Schema(type=types.Type.STRING),
                        "description": types.Schema(type=types.Type.STRING),
                        "intuition": types.Schema(type=types.Type.STRING),
                        "buyThreshold": types.Schema(type=types.Type.STRING),
                        "sellThreshold": types.Schema(type=types.Type.STRING),
                        "category": types.Schema(type=types.Type.STRING),
                    },
                    required=[
                        "name",
                        "formula",
                        "description",
                        "intuition",
                        "category",
                    ],
                ),
            ),
        )
        text = getattr(response, "text", None)
        if not text:
            raise RuntimeError("Empty response from Gemini")
        payload: Dict[str, Any] = json.loads(text)
        sources = _extract_sources(response)
        factor = AlphaFactor(
            id=os.urandom(6).hex(),
            createdAt=int(__import__("time").time() * 1000),
            sources=sources,
            name=payload["name"],
            formula=payload["formula"],
            description=payload["description"],
            intuition=payload["intuition"],
            buyThreshold=payload.get("buyThreshold"),
            sellThreshold=payload.get("sellThreshold"),
            category=payload.get("category", "Custom"),
        )
        return factor

    return _with_gemini_client(_call)


def generate_bulk_alpha_factors(count: int, config: GenerationConfig) -> List[AlphaFactor]:
    def _call(client: genai.Client) -> List[AlphaFactor]:
        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=f"""
       # Role
        Chief Quantitative Strategist
      # word list
        - Indicators
          MA, SMA, EMA, MACD, RSI, Bollinger Bands, KDJ, Stochastic Oscillator, CCI, ATR, OBV, Ichimoku Cloud, Parabolic SAR, ADX, MFI, Williams %R, VWAP, DMI, ROC, Aroon Indicator
        - Signal Types
          Golden Cross, Death Cross, Crossover, Divergence, Hidden Divergence, Trend Reversal, Overbought, Oversold, Breakout, False Breakout, Squeeze, Expansion, Zero Line Cross, Midline Cross, Histogram Flip, Histogram Shrink, Failure Swing, Trendline Break, Riding, Slope
        - Conditions & Thresholds
          Upper Band, Lower Band, Mid Band, Bandwidth, Signal Line, MACD Line, Histogram, Threshold 70/30, Midline 50, Volume Spike, Volume Shrink, Multi-Timeframe, Synchronous Signal, Momentum Wane, Trend Accelerate, Support Bounce, Resistance Reject, Alignment, Multiple Cross, Time-Serial, Cross-Sectional, D Days, Abs, Log, Sign, Power, Mean_Volume, High-Low, Open-Close, Prev_Close, Turnover
        - Composite & Strategy Terms
          Composite Factor, Combine with..., Confirmation Signal, Bullish, Bearish, Long Trend, Short Trend, Range Strategy, Trend Continuation, Reversal Point, Buy Signal, Sell Signal, Filter, Confluence, When...and..., New High/Low
      
      # Task 1: Concept Selection
        Select {count} unique combinations of concepts from the word list. Ensure diversity in strategy types (Momentum, Mean Reversion, Volatility, etc.).
      
      # Task 2: Factor Generation
        For each combination, generate a sophisticated alpha factor tailored for the BTC/Crypto market.
        - Context: The crypto market operates 24/7 with high volatility and regime shifts. Factors should be robust to noise.
        - Formula: The formula MUST be a valid Python expression using pandas (as pd) and pandas_ta (as ta). 
          - Example: ta.rsi(df['close'], length=14) / ta.sma(df['volume'], length=20)
          - Assume df contains 'open', 'high', 'low', 'close', 'volume'.
        - Naming: Create a unique, professional name for each factor.
        - Intuition: Provide a clear economic or market microstructure intuition.
      
      # Task 3: Optimization & Thresholds
        - Analyze recent market trends to suggest optimal buy/sell thresholds.
        - Ensure the logic avoids look-ahead bias.
      
      # Core Requirements
        - High Information Coefficient (IC).
        - Actionability.
        - Syntax Accuracy for pandas and pandas_ta.
      """,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=types.Schema(
                    type=types.Type.ARRAY,
                    items=types.Schema(
                        type=types.Type.OBJECT,
                        properties={
                            "name": types.Schema(type=types.Type.STRING),
                            "formula": types.Schema(type=types.Type.STRING),
                            "description": types.Schema(type=types.Type.STRING),
                            "intuition": types.Schema(type=types.Type.STRING),
                            "buyThreshold": types.Schema(type=types.Type.STRING),
                            "sellThreshold": types.Schema(type=types.Type.STRING),
                            "category": types.Schema(type=types.Type.STRING),
                        },
                        required=[
                            "name",
                            "formula",
                            "description",
                            "intuition",
                            "category",
                        ],
                    ),
                ),
            ),
        )
        text = getattr(response, "text", None)
        if not text:
            raise RuntimeError("Empty response from Gemini")
        raw_items = json.loads(text)
        sources = _extract_sources(response)
        now_ms = int(__import__("time").time() * 1000)
        factors: List[AlphaFactor] = []
        for item in raw_items:
            factors.append(
                AlphaFactor(
                    id=os.urandom(6).hex(),
                    createdAt=now_ms,
                    sources=sources,
                    name=item["name"],
                    formula=item["formula"],
                    description=item["description"],
                    intuition=item["intuition"],
                    buyThreshold=item.get("buyThreshold"),
                    sellThreshold=item.get("sellThreshold"),
                    category=item.get("category", "Custom"),
                )
            )
        return factors

    return _with_gemini_client(_call)


def generate_backtest_python_code(formula: str) -> str:
    def _call(client: genai.Client) -> str:
        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=f"""
      You are an expert Python developer and Quantitative Analyst.
  
      Your task is to generate ONLY the factor calculation code snippet for a given alpha formula.
      This snippet will be executed inside an existing Python backtest framework that already handles:
      - Imports and input parsing
      - Data processing (priceData -> pandas DataFrame df)
      - IC calculation
      - Backtest simulation and metrics
      - JSON output
  
      Formula: "{formula}"
  
      Requirements:
      1. Assume a pandas DataFrame named df already exists with columns: 'open', 'high', 'low', 'close', 'volume'.
      2. Assume the following modules are already imported and available:
         * pandas as pd
         * numpy as np
         * pandas_ta as ta
      3. Using the provided formula and any necessary pandas_ta indicators, compute the alpha factor values.
      4. Store the final factor values in a column named 'factor', i.e. df['factor'].
      5. Handle numerical issues robustly:
         * Replace inf and -inf with 0
         * Fill NaN values with 0
      6. You may create intermediate helper columns, but the final signal must be in df['factor'].
      7. Do not include any code related to:
         * Reading from stdin
         * IC calculation
         * Backtest simulation
         * Printing or returning JSON
         * The __name__ == "__main__" guard
      8. Output only raw Python code for the factor calculation snippet. Do not wrap it in markdown fences.
      """,
            config=types.GenerateContentConfig(
                response_mime_type="text/plain",
            ),
        )
        text = getattr(response, "text", None)
        if not text:
            raise RuntimeError("Empty response from Gemini")
        cleaned = text.replace("```python", "").replace("```", "").strip()
        return cleaned

    return _with_gemini_client(_call)
