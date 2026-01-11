import { BenchmarkType, PricePoint } from "../types";
import { setGlobalDispatcher, ProxyAgent } from 'undici';
import YahooFinance from 'yahoo-finance2';

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
        close: quote.close as number
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
