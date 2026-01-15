
import { createClient } from '@supabase/supabase-js';
import { AlphaFactor, User, BacktestResult } from "../types";

const getSupabaseClient = () => {
  const url = process.env.SUPABASE_URL;
  // Use SERVICE_ROLE_KEY if available to bypass RLS in the backend
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  
  if (url && key) {
    return createClient(url, key);
  }
  return null;
};

export const saveUser = async (user: User): Promise<void> => {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase not configured");

  const { error } = await supabase
    .from('users')
    .upsert({
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      provider: user.provider,
      last_login: new Date().toISOString()
    });

  if (error) {
    console.error("Save User Error:", error.message);
    throw error;
  }
};

export const saveFactor = async (userId: string, f: AlphaFactor): Promise<void> => {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase not configured");

  const { error } = await supabase
    .from('alpha_factors')
    .upsert({
      id: f.id,
      user_id: userId,
      name: f.name,
      formula: f.formula,
      description: f.description,
      intuition: f.intuition,
      category: f.category,
      sources: f.sources || [],
      last_benchmark: f.lastBenchmark,
      buy_threshold: f.buyThreshold,
      sell_threshold: f.sellThreshold,
      python_code: f.pythonCode,
      created_at: new Date(f.createdAt).toISOString()
    }, { onConflict: 'id' });

  if (error) {
    console.error("Save Factor Error:", error.message);
    throw error;
  }
};

export const deleteFactor = async (userId: string, factorId: string): Promise<void> => {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase not configured");

  const { error } = await supabase
    .from('alpha_factors')
    .delete()
    .eq('id', factorId)
    .eq('user_id', userId);

  if (error) {
    console.error("Delete Factor Error:", error.message);
    throw error;
  }
};

export const syncFactors = async (userId: string, factors: AlphaFactor[]): Promise<void> => {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase not configured");

  const { error } = await supabase
    .from('alpha_factors')
    .upsert(
      factors.map(f => ({
        id: f.id,
        user_id: userId,
        name: f.name,
        formula: f.formula,
        description: f.description,
        intuition: f.intuition,
        category: f.category,
        sources: f.sources || [],
        last_benchmark: f.lastBenchmark,
        buy_threshold: f.buyThreshold,
        sell_threshold: f.sellThreshold,
        python_code: f.pythonCode,
        created_at: new Date(f.createdAt).toISOString()
      })),
      { onConflict: 'id' }
    );

  if (error) {
    console.error("Cloud Sync Error:", error.message);
    throw error;
  }
};

export const fetchFactors = async (userId: string): Promise<AlphaFactor[]> => {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase not configured");

  const { data, error } = await supabase
    .from('alpha_factors')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Cloud Fetch Error:", error.message);
    throw error;
  }

  return (data || []).map(f => ({
    id: f.id,
    userId: f.user_id,
    name: f.name,
    formula: f.formula,
    description: f.description,
    intuition: f.intuition,
    category: f.category as any,
    createdAt: new Date(f.created_at).getTime(),
    sources: f.sources,
    lastBenchmark: f.last_benchmark,
    buyThreshold: f.buy_threshold,
    sellThreshold: f.sell_threshold,
    pythonCode: f.python_code
  }));
};

export const saveBacktestResult = async (
  userId: string, 
  factorId: string, 
  result: BacktestResult
): Promise<void> => {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase not configured");

  const { error } = await supabase
    .from('backtest_results')
    .insert({
      user_id: userId,
      factor_id: factorId,
      benchmark_name: result.metrics.benchmarkName,
      sharpe_ratio: result.metrics.sharpeRatio,
      annualized_return: result.metrics.annualizedReturn,
      max_drawdown: result.metrics.maxDrawdown,
      volatility: result.metrics.volatility,
      win_rate: result.metrics.winRate,
      data: result.data,
      trades: result.trades,
      created_at: new Date().toISOString()
    });

  if (error) {
    console.error("Save Backtest Result Error:", error.message);
    throw error;
  }
};

export const fetchBacktestResults = async (factorId: string): Promise<BacktestResult[]> => {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase not configured");

  const { data, error } = await supabase
    .from('backtest_results')
    .select('*')
    .eq('factor_id', factorId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Fetch Backtest Results Error:", error.message);
    throw error;
  }

  return (data || []).map(r => ({
    data: r.data,
    metrics: {
      sharpeRatio: r.sharpe_ratio,
      annualizedReturn: r.annualized_return,
      maxDrawdown: r.max_drawdown,
      volatility: r.volatility,
      winRate: r.win_rate,
      benchmarkName: r.benchmark_name
    },
    trades: r.trades
  }));
};
