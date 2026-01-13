
import { GoogleGenAI, Type } from "@google/genai";
import { AlphaFactor } from "../types";
import { setGlobalDispatcher, ProxyAgent } from 'undici';

const proxyAgent = new ProxyAgent('http://localhost:4780');
setGlobalDispatcher(proxyAgent);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const generateAlphaFactor = async (prompt: string, config: any): Promise<AlphaFactor> => {
  const response = await ai.models.generateContent({
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
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `
     # Role
      Chief Quantitative Strategist
    # word list
      - Indicators
        MA, SMA, EMA, MACD, RSI, Bollinger Bands, KDJ, Stochastic Oscillator, CCI, ATR, OBV, Ichimoku Cloud, Parabolic SAR, ADX, MFI, Williams %R, VWAP, DMI, ROC, Aroon Indicator
      - Signal Types
        金叉, 死叉, 交叉, 背离, 隐形背离, 趋势反转, 超买, 超卖, 突破, 假突破, 挤压, 扩张, 零轴穿越, 中轴穿越, 柱状图翻转, 柱状图缩减, 失败摆动, 趋势线突破, 骑乘, 坡度
      - Conditions & Thresholds
        上轨, 下轨, 中轨, 带宽, 信号线, MACD线, 柱状图, 阈值70/30, 中轴50, 成交量放大, 成交量缩减, 多时间帧, 同步信号, 动能减弱, 趋势加速, 支撑反弹, 阻力回落, 排列, 多重交叉, Time-Serial, Cross-Sectional, D Days, Abs, Log, Sign, Power, Mean_Volume, High-Low, Open-Close, Prev_Close, Turnover
      - Composite & Strategy Terms
        复合因子, 与...复合, 确认信号, 看涨, 看跌, 多头趋势, 空头趋势, 震荡策略, 趋势延续, 反转点, 买入信号, 卖出信号, 过滤器, 伴随, 当...且...时, 创新高/低
    # Task1
      create ${count} prompt use some concept in the word list
    # Task2
      Perform a deep scan of current BTC/Crypto market conditions. use every promot to generate diverse and mathematically robust alpha factors. Each must have a unique name, a valid Pandas formula, and strong economic intuition based on recent trends.
    # Task3
      execute the Pandas formula with BTC data and find best buy or sell threshold value. 
    # Core requirements
      High Information Coefficient (IC) and Information Ratio (IR)
      High trading frequency
      Factors must be practically actionable and adapted to the current market structure
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