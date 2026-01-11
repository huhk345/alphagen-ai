
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
    Incorporate real-time market regime knowledge. The formula must be a valid one-line Pandas/Numpy expression.`,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          formula: { type: Type.STRING },
          description: { type: Type.STRING },
          intuition: { type: Type.STRING },
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
      # Task
        Perform a deep scan of current BTC/Crypto market conditions. Generate ${count} diverse and mathematically robust alpha factors (ta-lib indicators can be used, and Alpha101 concepts may be referenced). Each must have a unique name, a valid Pandas formula,  and strong economic intuition based on recent trends. 
      # Core requirements:
        High Information Coefficient (IC) and Information Ratio (IR)
        High trading frequency
        Factors must be practically actionable and adapted to the current market structure
    `,
    config: {
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