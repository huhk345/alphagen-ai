import { BenchmarkType } from "../types";

const API_BASE_URL = process.env.VITE_API_URL || 'http://localhost:3001/api';

export const fetchMarketData = async (benchmark: BenchmarkType): Promise<any[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/market-data?benchmark=${encodeURIComponent(benchmark)}`);
    if (!response.ok) throw new Error("Failed to fetch market data from server");
    return await response.json();
  } catch (e) {
    console.error("Market data fetch failed:", e);
    throw e;
  }
};
