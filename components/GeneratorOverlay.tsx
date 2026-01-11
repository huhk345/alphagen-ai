
import React, { useState } from 'react';
import { Sparkles, X, Target, Globe, ShieldAlert, Cpu, Layers } from 'lucide-react';
import { GenerationConfig } from '../types';

interface GeneratorOverlayProps {
  onGenerate: (prompt: string, config: GenerationConfig) => void;
  onBulkGenerate: (count: number, config: GenerationConfig) => void;
  onClose: () => void;
  isGenerating: boolean;
}

const GeneratorOverlay: React.FC<GeneratorOverlayProps> = ({ onGenerate, onBulkGenerate, onClose, isGenerating }) => {
  const [mode, setMode] = useState<'custom' | 'bulk'>('custom');
  const [prompt, setPrompt] = useState('');
  const [bulkCount, setBulkCount] = useState(5);
  const [config, setConfig] = useState<GenerationConfig>({
    investmentUniverse: 'US Large Cap Equities',
    timeHorizon: 'Medium Term (1-3 months)',
    riskTolerance: 'Medium',
    targetMetrics: ['Sharpe Ratio', 'Max Drawdown']
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'custom') {
      if (!prompt.trim()) return;
      onGenerate(prompt, config);
    } else {
      onBulkGenerate(bulkCount, config);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center">
              <Sparkles className="text-blue-500 w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Alpha Architect</h2>
              <p className="text-xs text-gray-500">Discover new market anomalies with AI</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pt-6">
          <div className="flex bg-gray-950 p-1 rounded-xl border border-gray-800">
            <button 
              onClick={() => setMode('custom')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${mode === 'custom' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <Cpu className="w-4 h-4" />
              Custom Hypothesis
            </button>
            <button 
              onClick={() => setMode('bulk')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${mode === 'bulk' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <Layers className="w-4 h-4" />
              Bulk Discovery
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {mode === 'custom' ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Hypothesis Description</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., A momentum factor based on 12-month return excluding the most recent month..."
                className="w-full h-32 bg-gray-950 border border-gray-800 rounded-xl p-4 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-600/50 resize-none transition-all"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <label className="text-sm font-medium text-gray-300">Generation Quantity</label>
              <div className="grid grid-cols-4 gap-3">
                {[3, 5, 8, 12].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setBulkCount(num)}
                    className={`py-3 rounded-xl border text-sm font-bold transition-all ${bulkCount === num ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-950 border-gray-800 text-gray-500 hover:border-gray-600'}`}
                  >
                    {num} Factors
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 italic">Gemini will automatically diversify factors across Value, Momentum, Quality, and Volatility categories.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <Globe className="w-3 h-3" /> Universe
              </label>
              <select 
                value={config.investmentUniverse}
                onChange={(e) => setConfig({...config, investmentUniverse: e.target.value})}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl p-2.5 text-sm text-gray-300 focus:outline-none"
              >
                <option>US Large Cap Equities</option>
                <option>Emerging Markets</option>
                <option>Crypto Top 50</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <Target className="w-3 h-3" /> Time Horizon
              </label>
              <select 
                value={config.timeHorizon}
                onChange={(e) => setConfig({...config, timeHorizon: e.target.value})}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl p-2.5 text-sm text-gray-300 focus:outline-none"
              >
                <option>Short Term</option>
                <option>Medium Term</option>
                <option>Long Term</option>
              </select>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between border-t border-gray-800">
            <div className="flex gap-4">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <ShieldAlert className="w-3.5 h-3.5 text-yellow-500" />
                <span>Risk Filter</span>
              </div>
            </div>
            <button
              disabled={isGenerating || (mode === 'custom' && !prompt.trim())}
              className="bg-white hover:bg-gray-100 text-black font-bold py-2.5 px-8 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                mode === 'custom' ? 'Generate Factor' : `Generate ${bulkCount} Alphas`
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GeneratorOverlay;
