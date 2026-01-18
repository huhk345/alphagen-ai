
export type BenchmarkType = 'BTC-USD' | 'S&P 500' | 'CSI 300' | 'ETH-USD' | 'CUSTOM_A';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  provider: 'google' | 'github';
  isLoggedIn: boolean;
  accessToken?: string;
}

export interface AlphaFactor {
  id: string;
  userId?: string; // Owner of the factor
  name: string;
  formula: string;
  description: string;
  intuition: string;
  category: 'Momentum' | 'Value' | 'Volatility' | 'Quality' | 'Sentiment' | 'Custom';
  createdAt: number;
  sources?: { title: string, url: string }[];
  lastBenchmark?: BenchmarkType;
  buyThreshold?: string;
  sellThreshold?: string;
  pythonCode?: string;
}

export interface PricePoint {
  date: string;
  close: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
}

export interface BacktestMetrics {
  sharpeRatio: number;
  annualizedReturn: number;
  maxDrawdown: number;
  volatility: number;
  winRate: number;
  benchmarkName: string;
  ic?: number;
}

export interface BacktestDataPoint {
  date: string;
  strategyReturn: number;
  benchmarkReturn: number;
  cumulativeStrategy: number;
  cumulativeBenchmark: number;
  signal?: 'BUY' | 'SELL';
}

export interface Trade {
  date: string;
  type: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  amount: number;
}

export interface BacktestResult {
  data: BacktestDataPoint[];
  metrics: BacktestMetrics;
  trades: Trade[];
  pythonCode?: string;
}

export interface GenerationConfig {
  investmentUniverse: string;
  timeHorizon: string;
  riskTolerance: 'Low' | 'Medium' | 'High';
  targetMetrics: string[];
}
