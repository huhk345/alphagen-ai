
import { GoogleGenAI, Type } from "@google/genai";
import { AlphaFactor } from "../types";
import { setGlobalDispatcher, ProxyAgent } from 'undici';

const proxyAgent = new ProxyAgent('http://localhost:4780');
setGlobalDispatcher(proxyAgent);

const rawKeys = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '').split(',');
const GEMINI_KEYS = rawKeys.map(k => k.trim()).filter(k => k.length > 0);

if (GEMINI_KEYS.length === 0) {
  throw new Error("GEMINI_API_KEY or GEMINI_API_KEYS must be configured");
}

let geminiKeyIndex = 0;

const getCurrentGeminiClient = () => {
  const key = GEMINI_KEYS[geminiKeyIndex];
  return new GoogleGenAI({ apiKey: key });
};

const rotateGeminiKey = () => {
  geminiKeyIndex = (geminiKeyIndex + 1) % GEMINI_KEYS.length;
};

const withGeminiClient = async <T>(fn: (client: GoogleGenAI) => Promise<T>): Promise<T> => {
  let attempts = 0;
  let lastError: any = null;

  while (attempts < GEMINI_KEYS.length) {
    const client = getCurrentGeminiClient();
    try {
      return await fn(client);
    } catch (e: any) {
      const statusCode = (e && (e.status || e.code)) as number | undefined;
      if (statusCode === 429) {
        lastError = e;
        rotateGeminiKey();
        attempts += 1;
        console.warn(`[Gemini] Received 429, rotating API key (attempt ${attempts}/${GEMINI_KEYS.length})`);
        continue;
      }
      throw e;
    }
  }

  if (lastError) {
    throw lastError;
  }
  throw new Error("All Gemini API keys exhausted due to 429 errors");
};

export const generateAlphaFactor = async (prompt: string, config: any): Promise<AlphaFactor> => {
  const response = await withGeminiClient(async (client) => {
    return client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Acting as a Senior Quant for BTC markets, generate a sophisticated alpha factor for: "${prompt}". 
      Universe: ${config.investmentUniverse}. Target: ${config.timeHorizon}.
      Incorporate real-time market regime knowledge. The formula must be a valid one-line Pandas/Numpy expression.
      Also provide recommended buy and sell threshold values based on the factor's characteristics.`,
      config: {
        tools:[ { codeExecution: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            formula: { type: Type.STRING },
            description: { type: Type.STRING },
            intuition: { type: Type.STRING },
            buyThreshold: { type: Type.STRING },
            sellThreshold: { type: Type.STRING },
            category: { type: Type.STRING, enum: ['Momentum', 'Value', 'Volatility', 'Quality', 'Sentiment', 'Custom'] },
          },
          required: ['name', 'formula', 'description', 'intuition', 'category'],
        },
      },
    });
  });

  const text = response.text;
  if (!text) throw new Error("Empty response");

  // Extract search grounding if available
  const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
    ?.map((chunk: any) => ({
      title: chunk.web?.title || 'Market Reference',
      url: chunk.web?.uri || '#'
    })) || [];

  const result = JSON.parse(text);

  return {
    ...result,
    id: Math.random().toString(36).substr(2, 9),
    createdAt: Date.now(),
    sources
  };
};

export const generateBulkAlphaFactors = async (count: number, config: any): Promise<AlphaFactor[]> => {
  const response = await withGeminiClient(async (client) => {
    return client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `
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
        Select ${count} unique combinations of concepts from the word list. Ensure diversity in strategy types (Momentum, Mean Reversion, Volatility, etc.).
      
      # Task 2: Factor Generation
        For each combination, generate a sophisticated alpha factor tailored for the BTC/Crypto market.
        - **Context**: The crypto market operates 24/7 with high volatility and regime shifts. Factors should be robust to noise.
        - **Formula**: The formula MUST be a valid Python expression using \`pandas\` (as pd) and \`pandas_ta\` (as ta). 
          - Example: \`ta.rsi(df['close'], length=14) / ta.sma(df['volume'], length=20)\`
          - Assume \`df\` contains 'open', 'high', 'low', 'close', 'volume'.
        - **Naming**: Create a unique, professional name for each factor (e.g., "VolAdjusted_RSI_Momentum").
        - **Intuition**: Provide a clear economic or market microstructure intuition. Why should this work for BTC?
      
      # Task 3: Optimization & Thresholds
        - Analyze recent market trends (via your internal knowledge) to suggest optimal buy/sell thresholds.
        - Ensure the logic avoids look-ahead bias (e.g., do not use future data).
      
      # Core Requirements
        - **High Information Coefficient (IC)**: Target factors with predictive power for next-period returns.
        - **Actionability**: Avoid overly complex formulas that are hard to execute or prone to overfitting.
        - **Syntax Accuracy**: Ensure all generated formulas are syntactically correct for the \`pandas\` and \`pandas_ta\` libraries.
      `,
      config: {
        tools:[ { codeExecution: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              formula: { type: Type.STRING },
              description: { type: Type.STRING },
              intuition: { type: Type.STRING },
              buyThreshold: { type: Type.STRING },
              sellThreshold: { type: Type.STRING },
              category: { type: Type.STRING, enum: ['Momentum', 'Value', 'Volatility', 'Quality', 'Sentiment', 'Custom'] },
            },
            required: ['name', 'formula', 'description', 'intuition', 'category'],
          }
        },
      },
    });
  });

  const text = response.text;
  if (!text) throw new Error("Empty response");

  const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
    ?.map((chunk: any) => ({
      title: chunk.web?.title || 'Market Reference',
      url: chunk.web?.uri || '#'
    })) || [];

  const results = JSON.parse(text);

  return results.map((r: any) => ({
    ...r,
    id: Math.random().toString(36).substr(2, 9),
    createdAt: Date.now(),
    sources
  }));
};

export const generateBacktestPythonCode = async (formula: string): Promise<string> => {
  const response = await withGeminiClient(async (client) => {
    return client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `
      You are an expert Python developer and Quantitative Analyst.
  
      Your task is to generate ONLY the factor calculation code snippet for a given alpha formula.
      This snippet will be executed inside an existing Python backtest framework that already handles:
      - Imports and input parsing
      - Data processing (priceData -> pandas DataFrame df)
      - IC calculation
      - Backtest simulation and metrics
      - JSON output
  
      Formula: "${formula}"
  
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
      7. Do NOT include any code related to:
         * Reading from stdin
         * IC calculation
         * Backtest simulation
         * Printing or returning JSON
         * The __name__ == "__main__" guard
      8. Output ONLY raw Python code for the factor calculation snippet. Do NOT wrap it in markdown fences.
      `,
      config: {
        responseMimeType: "text/plain",
      },
    });
  });

  const text = response.text;
  if (!text) throw new Error("Empty response from Gemini");
  
  return text.replace(/^```python\s*/, '').replace(/^```\s*/, '').replace(/```$/, '').trim();
};
