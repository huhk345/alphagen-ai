import { BenchmarkType, PricePoint, BacktestResult, BacktestDataPoint, Trade } from "../types";
import { setGlobalDispatcher, ProxyAgent } from 'undici';
import YahooFinance from 'yahoo-finance2';
import axios from 'axios';
import { generateBacktestPythonCode } from './geminiService';

// Set up proxy for undici (fetch)
const proxyUrl = 'http://localhost:4780';
const proxyAgent = new ProxyAgent(proxyUrl);
setGlobalDispatcher(proxyAgent);

// Initialize yahoo-finance2 instance
const yahooFinance = new YahooFinance();

async function fetchYahooFinanceData(ticker: string): Promise<PricePoint[]> {
  try {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Start of today for stability
    const period1 = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); // Exactly 1 year ago from today
    const period2 = now;

    const queryOptions: any = {
      period1,
      period2,
      interval: '1d',
    };

    const result: any = await yahooFinance.chart(ticker, queryOptions);
    
    if (!result || !result.quotes || result.quotes.length === 0) {
      throw new Error(`No data returned for ${ticker}`);
    }

    return (result.quotes as any[])
      .filter(quote => quote.date && quote.close !== null && quote.close !== undefined)
      .map(quote => ({
        date: new Date(quote.date).toISOString().split('T')[0],
        close: quote.close as number,
        open: quote.open as number,
        high: quote.high as number,
        low: quote.low as number,
        volume: quote.volume as number
      }));
  } catch (e: any) {
    console.error(`Yahoo Finance fetch failed for ${ticker}:`, e.message);
    throw e;
  }
}

export const getMarketData = async (benchmark: BenchmarkType): Promise<PricePoint[]> => {
  const tickerMap: Record<string, string> = {
    'BTC-USD': 'BTC-USD',
    'ETH-USD': 'ETH-USD',
    'S&P 500': '^GSPC',
    'CSI 300': '000300.SS'
  };
  
  const ticker = tickerMap[benchmark];
  if (ticker) {
    return await fetchYahooFinanceData(ticker);
  }
  
  throw new Error(`Unsupported benchmark: ${benchmark}`);
};

function buildLongOnlyTrades(data: BacktestDataPoint[], priceSeries: PricePoint[]): Trade[] {
  const priceMap = new Map<string, number>();
  for (const p of priceSeries) {
    if (!priceMap.has(p.date) && typeof p.close === 'number' && p.close > 0) {
      priceMap.set(p.date, p.close);
    }
  }
  const trades: Trade[] = [];
  let position = 0;
  let cash = 100;
  let holdings = 0;
  for (const point of data) {
    const signal = (point as any).signal as 'BUY' | 'SELL' | undefined;
    if (!signal) continue;
    const price = priceMap.get(point.date);
    if (!price || price <= 0) continue;
    if (signal === 'BUY' && position === 0) {
      const quantity = cash / price;
      const amount = quantity * price;
      trades.push({
        date: point.date,
        type: 'BUY',
        price,
        quantity,
        amount
      });
      holdings = quantity;
      cash = 0;
      position = 1;
    } else if (signal === 'SELL' && position === 1) {
      const amount = holdings * price;
      trades.push({
        date: point.date,
        type: 'SELL',
        price,
        quantity: holdings,
        amount
      });
      cash = amount;
      holdings = 0;
      position = 0;
    }
  }
  if (position === 1 && data.length > 0) {
    const lastPoint = data[data.length - 1];
    const price = priceMap.get(lastPoint.date);
    if (price && price > 0 && holdings > 0) {
      const amount = holdings * price;
      trades.push({
        date: lastPoint.date,
        type: 'SELL',
        price,
        quantity: holdings,
        amount
      });
    }
  }
  return trades;
}

export const runBacktest = async (
  formula: string, 
  benchmark: BenchmarkType,
  buyThreshold?: string,
  sellThreshold?: string,
  requestId?: string,
  pythonCode?: string
): Promise<BacktestResult> => {
  const id = requestId || `bk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  console.log(`[Backtest] [${id}] Starting backtest benchmark=${benchmark}`);
  console.log(`[Backtest] [${id}] Formula length=${formula.length} buy=${buyThreshold || '-'} sell=${sellThreshold || '-'}`);

  const priceData = await getMarketData(benchmark);
  console.log(`[Backtest] [${id}] Loaded market data points=${priceData.length}`);
  
  try {
    const pythonScript = pythonCode || await generateBacktestPythonCode(formula);
    console.log(`[Backtest] [${id}] Generated python script : \n ${pythonScript}`);
    
    try {
      const response = await axios.post('http://localhost:5001/execute', {
        code: pythonScript,
        data: {
          priceData,
          formula,
          benchmark,
          buyThreshold,
          sellThreshold
        }
      });

      const result = response.data;
      console.log(`[Backtest] [${id}] Python service status=${result.status}`);
      
      if (result.status === 'error') {
        console.error(`[Backtest] [${id}] Python error=${result.error}`);
        throw new Error(`Python Service Error: ${result.error}\nStdout: ${result.stdout}`);
      }
      
      if (result.result && result.result.metrics) {
        const m = result.result.metrics;
        console.log(`[Backtest] [${id}] Metrics sharpe=${m.sharpeRatio} annReturn=${m.annualizedReturn} maxDD=${m.maxDrawdown}`);
      }

      let payload: BacktestResult = {
        ...result.result,
        pythonCode: pythonScript
      };
      if (Array.isArray(payload?.data) && payload.data.length > 0) {
        const syntheticTrades = buildLongOnlyTrades(payload.data, priceData);
        if (syntheticTrades.length > 0) {
          payload = {
            ...payload,
            trades: syntheticTrades
          };
        }
      }

      console.log(`[Backtest] [${id}] Completed successfully with ${payload.trades?.length || 0} trades`);
      return payload;

    } catch (e: any) {
      if (axios.isAxiosError(e)) {
        console.error(`[Backtest] [${id}] Python HTTP error=${e.message}`);
        throw new Error(`Python Service HTTP Error: ${e.message} - ${JSON.stringify(e.response?.data)}`);
      }
      console.error(`[Backtest] [${id}] Python execution error=${e.message}`);
      throw new Error(`Failed to execute backtest on python service: ${e.message}`);
    }

  } catch (e: any) {
    console.error(`[Backtest] [${id}] Backtest failed=${e.message}`);
    throw new Error(`Failed to run backtest: ${e.message}`);
  }
};
