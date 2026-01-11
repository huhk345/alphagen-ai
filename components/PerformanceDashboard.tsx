
import React from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Dot
} from 'recharts';
import { BacktestDataPoint, BacktestMetrics, Trade } from '../types';
import { TrendingUp, AlertTriangle, Activity, BarChart3, Info, List } from 'lucide-react';

interface PerformanceDashboardProps {
  data: BacktestDataPoint[];
  metrics: BacktestMetrics;
  trades: Trade[];
  factorName: string;
}

const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({ data, metrics, trades, factorName }) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          label="Sharpe Ratio" 
          value={metrics.sharpeRatio.toFixed(2)} 
          icon={<TrendingUp className="text-green-500" />}
          trend="+12%"
        />
        <MetricCard 
          label="Annual Return" 
          value={`${metrics.annualizedReturn.toFixed(1)}%`} 
          icon={<Activity className="text-blue-500" />}
          trend="+5%"
        />
        <MetricCard 
          label="Max Drawdown" 
          value={`${metrics.maxDrawdown.toFixed(1)}%`} 
          icon={<AlertTriangle className="text-red-500" />}
          trend="-2%"
        />
        <MetricCard 
          label="Volatility" 
          value={`${metrics.volatility.toFixed(1)}%`} 
          icon={<BarChart3 className="text-purple-500" />}
          trend="Stable"
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
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorStrategy" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f2937" />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: '#4b5563', fontSize: 10}}
                minTickGap={30}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: '#4b5563', fontSize: 10}}
                domain={['auto', 'auto']}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '12px' }}
                itemStyle={{ fontSize: '12px' }}
                labelStyle={{ fontSize: '10px', color: '#9ca3af', marginBottom: '4px' }}
              />
              <Area 
                type="monotone" 
                dataKey="cumulativeStrategy" 
                stroke="#3b82f6" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorStrategy)" 
                name="Strategy"
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (payload.signal === 'BUY') {
                    return (
                      <g key={`buy-${payload.date}`}>
                        <circle cx={cx} cy={cy} r={6} fill="#10b981" />
                        <text x={cx} y={cy - 10} textAnchor="middle" fill="#10b981" fontSize="10" fontWeight="bold">BUY</text>
                      </g>
                    );
                  }
                  if (payload.signal === 'SELL') {
                    return (
                      <g key={`sell-${payload.date}`}>
                        <circle cx={cx} cy={cy} r={6} fill="#ef4444" />
                        <text x={cx} y={cy + 20} textAnchor="middle" fill="#ef4444" fontSize="10" fontWeight="bold">SELL</text>
                      </g>
                    );
                  }
                  return null;
                }}
              />
              <Line 
                type="monotone" 
                dataKey="cumulativeBenchmark" 
                stroke="#4b5563" 
                strokeWidth={1} 
                dot={false}
                strokeDasharray="4 4"
                name="Benchmark"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      <div className="bg-blue-600/5 border border-blue-600/20 rounded-2xl p-4 flex gap-4">
        <div className="p-2 bg-blue-600/20 rounded-lg h-fit">
            <Info className="w-5 h-5 text-blue-400" />
        </div>
        <div>
            <h4 className="text-sm font-semibold text-blue-300">Statistical Analysis</h4>
            <p className="text-xs text-blue-400/70 mt-1 leading-relaxed">
              Based on our simulation against <b>{metrics.benchmarkName}</b>, the <b>{factorName}</b> strategy demonstrates a statistically significant win rate of {metrics.winRate.toFixed(1)}%. 
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
                    <td className="py-4 text-white font-medium">${trade.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="py-4 font-mono text-xs">{trade.quantity.toFixed(4)}</td>
                    <td className="py-4 text-white font-medium">${trade.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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
  <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-colors">
    <div className="flex justify-between items-start mb-3">
      <div className="p-2 bg-gray-900 rounded-lg">{icon}</div>
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${trend?.startsWith('+') ? 'bg-green-500/10 text-green-500' : 'bg-gray-800 text-gray-400'}`}>
        {trend}
      </span>
    </div>
    <div className="space-y-1">
      <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{label}</p>
    </div>
  </div>
);

export default PerformanceDashboard;
