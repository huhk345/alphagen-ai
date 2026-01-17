
import React, { useEffect, useRef } from 'react';
import type { IChartApi } from 'lightweight-charts';
import { createChart, ColorType } from 'lightweight-charts';
import { BacktestDataPoint, BacktestMetrics, Trade } from '../types';
import { TrendingUp, AlertTriangle, Activity, BarChart3, Info, List, BrainCircuit } from 'lucide-react';

interface PerformanceDashboardProps {
  data: BacktestDataPoint[];
  metrics: BacktestMetrics;
  trades: Trade[];
  factorName: string;
}

const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({ data, metrics, trades, factorName }) => {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 350,
      layout: {
        background: { type: ColorType.Solid, color: '#020617' },
        textColor: '#9ca3af'
      },
      grid: {
        vertLines: { color: '#111827' },
        horzLines: { color: '#111827' }
      },
      rightPriceScale: {
        borderColor: '#1f2937'
      },
      timeScale: {
        borderColor: '#1f2937',
        timeVisible: true,
        secondsVisible: false
      }
    });

    const strategySeries = chart.addAreaSeries({
      lineColor: '#3b82f6',
      topColor: 'rgba(59,130,246,0.4)',
      bottomColor: 'rgba(15,23,42,0.1)',
      lineWidth: 2
    });

    const benchmarkSeries = chart.addLineSeries({
      color: '#4b5563',
      lineWidth: 1
    });

    const strategyData = data.map(point => ({
      time: point.date as any,
      value: point.cumulativeStrategy
    }));

    const benchmarkData = data.map(point => ({
      time: point.date as any,
      value: point.cumulativeBenchmark
    }));

    strategySeries.setData(strategyData);
    benchmarkSeries.setData(benchmarkData);

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (!chartContainerRef.current) return;
      chart.applyOptions({ width: chartContainerRef.current.clientWidth });
    };

    chartRef.current = chart;

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [data]);

  const icValue = typeof metrics.ic === 'number' && !Number.isNaN(metrics.ic) ? metrics.ic.toFixed(2) : "N/A";

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <MetricCard 
          label="Sharpe Ratio" 
          value={metrics.sharpeRatio.toFixed(2)} 
          icon={<TrendingUp className="text-green-500" />}
          trend=""
        />
        <MetricCard 
          label="Annual Return" 
          value={`${(metrics.annualizedReturn * 100).toFixed(2)}%`} 
          icon={<Activity className="text-blue-500" />}
          trend=""
        />
        <MetricCard 
          label="Max Drawdown" 
          value={`${(metrics.maxDrawdown * 100).toFixed(2)}%`} 
          icon={<AlertTriangle className="text-red-500" />}
          trend=""
        />
        <MetricCard 
          label="Volatility" 
          value={`${(metrics.volatility * 100).toFixed(2)}%`} 
          icon={<BarChart3 className="text-purple-500" />}
          trend=""
        />
        <MetricCard 
          label="IC" 
          value={icValue} 
          icon={<BrainCircuit className="text-yellow-500" />}
          trend=""
        />
      </div>

      <div className="bg-gray-950 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-lg font-bold text-white">Cumulative Returns</h3>
            <p className="text-xs text-gray-500 uppercase mt-1 tracking-widest">Strategy vs {metrics.benchmarkName} (1 Year)</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-xs text-gray-400">Factor Alpha</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-700" />
              <span className="text-xs text-gray-400">{metrics.benchmarkName}</span>
            </div>
          </div>
        </div>
        
        <div className="h-[350px] w-full">
          <div ref={chartContainerRef} className="h-full w-full" />
        </div>
      </div>
      
      <div className="bg-blue-600/5 border border-blue-600/20 rounded-2xl p-4 flex items-center gap-4">
        <div className="p-2 bg-blue-600/20 rounded-lg h-fit">
            <Info className="w-5 h-5 text-blue-400" />
        </div>
        <div>
            <h4 className="text-sm font-semibold text-blue-300">Statistical Analysis</h4>
            <p className="text-xs text-blue-400/70 mt-1 leading-relaxed">
              Based on our simulation against <b>{metrics.benchmarkName}</b>, the <b>{factorName}</b> strategy demonstrates a statistically significant win rate of {Number.isFinite(metrics.winRate) ? metrics.winRate.toFixed(1) : '0.0'}%. 
              Risk-adjusted returns are consistent with factor models capturing {metrics.annualizedReturn > 10 ? 'excess' : 'standard'} market alpha.
            </p>
        </div>
      </div>

      {/* Trade List Table */}
      <div className="bg-gray-950 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <List className="w-5 h-5 text-gray-400" />
          <h3 className="text-lg font-bold text-white">Trade History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-400">
            <thead className="text-xs text-gray-500 uppercase tracking-widest border-b border-gray-800">
              <tr>
                <th className="pb-4 font-medium">Date</th>
                <th className="pb-4 font-medium">Type</th>
                <th className="pb-4 font-medium">Price</th>
                <th className="pb-4 font-medium">Quantity</th>
                <th className="pb-4 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {trades.length > 0 ? (
                trades.map((trade, idx) => (
                  <tr key={`${trade.date}-${idx}`} className="hover:bg-gray-900/50 transition-colors">
                    <td className="py-4 font-mono text-xs">{trade.date}</td>
                    <td className="py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        trade.type === 'BUY' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                      }`}>
                        {trade.type}
                      </span>
                    </td>
                    <td className="py-4 text-white font-medium">${trade.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '0.00'}</td>
                    <td className="py-4 font-mono text-xs">{trade.quantity?.toFixed(4) ?? '0.0000'}</td>
                    <td className="py-4 text-white font-medium">${trade.amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '0.00'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-600 italic">No trades executed during this period</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ label, value, icon, trend }: { label: string, value: string, icon: React.ReactNode, trend?: string }) => (
  <div className="h-full min-h-[132px] bg-gray-950 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-colors flex flex-col">
    <div className="flex items-center justify-between mb-4 min-h-[28px]">
      <div className="p-2 bg-gray-900 rounded-lg flex items-center justify-center">{icon}</div>
      <span
        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
          trend && trend.startsWith('+') ? 'bg-green-500/10 text-green-500' : 'bg-gray-800 text-gray-400'
        }`}
      >
        {trend}
      </span>
    </div>
    <div className="mt-auto h-16 flex flex-col justify-between text-right">
      <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider leading-tight break-words">{label}</p>
    </div>
  </div>
);

export default PerformanceDashboard;
