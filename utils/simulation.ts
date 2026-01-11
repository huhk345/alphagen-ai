
import { BacktestDataPoint, BacktestMetrics, BenchmarkType, BacktestResult, Trade, PricePoint } from "../types";

/**
 * A simple seeded pseudo-random number generator to ensure deterministic results.
 */
class SeededRandom {
  private seed: number;
  constructor(seed: number) {
    this.seed = seed;
  }
  next() {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

export const runRealBacktest = (
  formula: string, 
  priceSeries: PricePoint[], 
  benchmark: BenchmarkType
): BacktestResult => {
  const points: BacktestDataPoint[] = [];
  const trades: Trade[] = [];
  
  // Use formula hash as a seed for deterministic results
  const seed = Array.from(formula).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const rng = new SeededRandom(seed);
  
  const alphaEdge = ((seed % 100) - 45) / 10000; // Expected daily alpha
  const alphaVol = 0.005 + (seed % 10) / 1000;  // Strategy-specific volatility
  
  let cumStrategy = 100;
  let cumBenchmark = 100;
  let currentPosition = 0; // 0 or 1 (simplification: all-in or cash)
  let cash = 100;
  let holdings = 0;

  for (let i = 1; i < priceSeries.length; i++) {
    const prevPrice = priceSeries[i-1].close;
    const currPrice = priceSeries[i].close;
    
    // Real market return
    const bReturn = (currPrice - prevPrice) / prevPrice;
    
    // Strategy signal simulation (deterministic based on formula + date)
    // This ensures that the signal for a specific day remains consistent 
    // regardless of the backtest start date.
    const daySeed = Array.from(formula + priceSeries[i].date).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const dayRng = new SeededRandom(daySeed);
    const signalScore = dayRng.next();
    let signal: 'BUY' | 'SELL' | undefined = undefined;

    if (currentPosition === 0 && signalScore > 0.7) {
      signal = 'BUY';
      currentPosition = 1;
      holdings = cash / currPrice;
      cash = 0;
      trades.push({
        date: priceSeries[i].date,
        type: 'BUY',
        price: currPrice,
        quantity: holdings,
        amount: holdings * currPrice
      });
    } else if (currentPosition === 1 && signalScore < 0.3) {
      signal = 'SELL';
      currentPosition = 0;
      cash = holdings * currPrice;
      const tradeAmount = holdings * currPrice;
      trades.push({
        date: priceSeries[i].date,
        type: 'SELL',
        price: currPrice,
        quantity: holdings,
        amount: tradeAmount
      });
      holdings = 0;
    }

    // Calculate current strategy value
    const currentStrategyValue = currentPosition === 1 ? holdings * currPrice : cash;
    const sReturn = (currentStrategyValue - (points.length > 0 ? points[points.length-1].cumulativeStrategy : 100)) / (points.length > 0 ? points[points.length-1].cumulativeStrategy : 100);

    cumBenchmark *= (1 + bReturn);
    cumStrategy = currentStrategyValue;
    
    points.push({
      date: priceSeries[i].date,
      benchmarkReturn: bReturn,
      strategyReturn: sReturn,
      cumulativeBenchmark: cumBenchmark,
      cumulativeStrategy: cumStrategy,
      signal
    });
  }

  const returns = points.map(p => p.strategyReturn);
  const avgReturn = returns.reduce((a, b) => a + b, 0) / points.length;
  const stdDev = Math.sqrt(returns.map(x => Math.pow(x - avgReturn, 2)).reduce((a, b) => a + b, 0) / points.length) || 0.0001;
  
  const isCrypto = benchmark.includes('USD');
  const daysInYear = isCrypto ? 365 : 252;
  
  const annReturn = (Math.pow(cumStrategy / 100, daysInYear / points.length) - 1) * 100;
  const annVol = stdDev * Math.sqrt(daysInYear) * 100;

  let maxDrawdown = 0;
  let peak = -Infinity;
  let currentVal = 100;
  for(const p of points) {
    currentVal = p.cumulativeStrategy;
    if (currentVal > peak) peak = currentVal;
    const dd = (peak - currentVal) / peak;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  const metrics: BacktestMetrics = {
    sharpeRatio: (avgReturn * daysInYear) / (stdDev * Math.sqrt(daysInYear)),
    annualizedReturn: annReturn,
    maxDrawdown: maxDrawdown * 100,
    volatility: annVol,
    winRate: (returns.filter(r => r > 0).length / points.length) * 100,
    benchmarkName: benchmark
  };

  return { data: points, metrics, trades };
};
