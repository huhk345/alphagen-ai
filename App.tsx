
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import GeneratorOverlay from './components/GeneratorOverlay';
import AuthModal from './components/AuthModal';
import PerformanceDashboard from './components/PerformanceDashboard';
import { AlphaFactor, BacktestDataPoint, BacktestMetrics, GenerationConfig, BenchmarkType, User, Trade, BacktestResult } from './types';
import { generateAlphaFactor, generateBulkAlphaFactors } from './services/geminiService';
import { runBacktestOnServer } from './services/dataService';
import { getSession, logout, completeGithubLogin } from './services/authService';
import { fetchFactorsFromCloud, saveBacktestResultToCloud, saveFactorToCloud, deleteFactorFromCloud } from './services/dbService';
import { BrainCircuit, Play, ChevronRight, Copy, Terminal, Info, LayoutDashboard, AlertCircle, ExternalLink, Globe, CloudDownload, Cloud, Code2 } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [factors, setFactors] = useState<AlphaFactor[]>([]);
  const [activeFactorId, setActiveFactorId] = useState<string | null>(null);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedBenchmark, setSelectedBenchmark] = useState<BenchmarkType>('BTC-USD');
  const [customAShareCode, setCustomAShareCode] = useState<string>('');
  const [simulationData, setSimulationData] = useState<BacktestResult | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'code' | 'python'>('overview');
  const [error, setError] = useState<string | null>(null);

  const activeFactor = factors.find(f => f.id === activeFactorId);

  useEffect(() => {
    const handleAuth = async () => {
      try {
        const newUser = await completeGithubLogin();
        if (newUser) {
          setUser(newUser);
          setIsAuthModalOpen(false);
          setError(null);
          await loadUserData(newUser.id);

          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete('code');
          cleanUrl.searchParams.delete('state');
          cleanUrl.searchParams.delete('github_callback');
          window.history.replaceState({}, document.title, cleanUrl.toString());
          return;
        }
      } catch (err: any) {
        setError(err.message || 'GitHub 登录失败，请检查配置或稍后重试。');
      }

      const sessionUser = getSession();
      if (sessionUser) {
        setUser(sessionUser);
        loadUserData(sessionUser.id);
      } else {
        const localFactors = localStorage.getItem('alpha_factors');
        if (localFactors) {
          const parsed = JSON.parse(localFactors);
          setFactors(parsed);
          if (parsed.length > 0) setActiveFactorId(parsed[0].id);
        }
      }
    };

    handleAuth();
  }, []);

  useEffect(() => {
    if (!user) {
      localStorage.setItem('alpha_factors', JSON.stringify(factors));
    }
  }, [factors, user]);

  const loadUserData = async (userId: string) => {
    setIsSyncing(true);
    try {
      const cloudFactors = await fetchFactorsFromCloud(userId);
      if (cloudFactors.length > 0) {
        setFactors(cloudFactors);
        setActiveFactorId(cloudFactors[0].id);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLoginSuccess = (newUser: User) => {
    setUser(newUser);
    setIsAuthModalOpen(false);
    setError(null); // Clear login requirement error
    loadUserData(newUser.id);
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    setFactors([]);
    setActiveFactorId(null);
    localStorage.removeItem('alpha_factors');
  };

  useEffect(() => {
    if (activeFactor) {
      handleRunSimulation(selectedBenchmark);
    } else {
      setSimulationData(null);
    }
  }, [activeFactorId]);

  const requireAuth = (): boolean => {
    if (!user) {
      setIsAuthModalOpen(true);
      setError("Please login to access this feature.");
      return false;
    }
    return true;
  };

  const handleRunSimulation = async (benchmark: BenchmarkType) => {
    if (!activeFactor) return;
    if (!requireAuth()) return;
    
    setIsSimulating(true);
    setIsFetchingData(true);
    setError(null);
    setSelectedBenchmark(benchmark);
    try {
      const result = await runBacktestOnServer(
        activeFactor.formula, 
        benchmark,
        activeFactor.buyThreshold,
        activeFactor.sellThreshold,
        activeFactor.pythonCode,
        benchmark === 'CUSTOM_A' ? customAShareCode : undefined
      );
      setSimulationData(result);
      
      // Save backtest result to cloud if user is logged in
      if (result.pythonCode && activeFactor) {
        setFactors(prev =>
          prev.map(f =>
            f.id === activeFactor.id ? { ...f, pythonCode: result.pythonCode } : f
          )
        );
        if (user) {
          const updatedFactor: AlphaFactor = {
            ...activeFactor,
            pythonCode: result.pythonCode
          };
          saveFactorToCloud(user.id, updatedFactor).catch(err =>
            console.error("Failed to save factor with python code:", err)
          );
        }
      }
      
      if (user && activeFactor.id) {
        saveBacktestResultToCloud(user.id, activeFactor.id, result).catch(err =>
          console.error("Failed to save backtest result:", err)
        );
      }
    } catch (err: any) {
      setError("Failed to fetch market data.");
    } finally {
      setIsSimulating(false);
      setIsFetchingData(false);
    }
  };

  const handleGenerate = async (prompt: string, config: GenerationConfig) => {
    if (!requireAuth()) return;
    setIsGenerating(true);
    setError(null);
    try {
      const newFactor = await generateAlphaFactor(prompt, config);
      setFactors([newFactor, ...factors]);
      setActiveFactorId(newFactor.id);
      setIsOverlayOpen(false);
      setActiveTab('overview');
      
      // Incremental save
      if (user) {
        saveFactorToCloud(user.id, newFactor).catch(console.error);
      }
    } catch (err: any) {
      setError(err.message || "AI Generation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBulkGenerate = async (count: number, config: GenerationConfig) => {
    if (!requireAuth()) return;
    setIsGenerating(true);
    setError(null);
    try {
      const newFactors = await generateBulkAlphaFactors(count, config);
      setFactors([...newFactors, ...factors]);
      setActiveFactorId(newFactors[0].id);
      setIsOverlayOpen(false);
      setActiveTab('overview');
      
      // Incremental save
      if (user) {
        Promise.all(newFactors.map(f => saveFactorToCloud(user.id, f))).catch(console.error);
      }
    } catch (err: any) {
      setError(err.message || "Bulk Discovery failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyCode = () => {
    if (activeFactor) navigator.clipboard.writeText(activeFactor.formula);
  };

  const handleDeleteFactor = async (id: string) => {
    const nextFactors = factors.filter(f => f.id !== id);
    setFactors(nextFactors);
    if (activeFactorId === id) {
      setActiveFactorId(nextFactors.length > 0 ? nextFactors[0].id : null);
    }
    
    // Incremental delete
    if (user) {
      deleteFactorFromCloud(user.id, id).catch(console.error);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#030712] overflow-hidden text-gray-200">
      <Sidebar 
        factors={factors} 
        activeFactorId={activeFactorId} 
        user={user}
        onSelectFactor={setActiveFactorId}
        onNewFactor={() => setIsOverlayOpen(true)}
        onQuickDiscover={() => handleBulkGenerate(5, { investmentUniverse: 'BTC-PERP', timeHorizon: 'Short Term', riskTolerance: 'High', targetMetrics: ['Sharpe'] })}
        onLogout={handleLogout}
        onLoginClick={() => setIsAuthModalOpen(true)}
        isGenerating={isGenerating}
        isSyncing={isSyncing}
      />

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 border-b border-gray-900 bg-[#030712]/80 backdrop-blur-xl flex items-center justify-between px-8 z-10">
          <div className="flex items-center gap-3">
            <nav className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest">
              <span>Workspace</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-blue-500">{activeFactor ? activeFactor.name : 'Terminal'}</span>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-gray-900/50 p-1 rounded-xl border border-gray-800">
              {[
                { id: 'overview', icon: LayoutDashboard, label: 'Analytics' },
                { id: 'code', icon: Terminal, label: 'Logic' },
                { id: 'python', icon: Code2, label: 'Python' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <tab.icon className="w-3 h-3" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-[#030712] p-8 custom-scrollbar">
          {error && (
            <div className="mb-6 bg-red-500/5 border border-red-500/20 p-4 rounded-xl flex items-center gap-3 text-red-400 text-xs font-bold animate-in slide-in-from-top-4">
              <AlertCircle className="w-4 h-4" />
              {error}
              <button onClick={() => setError(null)} className="ml-auto opacity-60 hover:opacity-100">Dismiss</button>
            </div>
          )}

          {!activeFactor ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-8 max-w-xl mx-auto">
              <BrainCircuit className="w-16 h-16 text-blue-500 animate-pulse" />
              <div className="space-y-4">
                <h2 className="text-5xl font-black text-white tracking-tighter uppercase italic leading-none">AlphaGen Studio</h2>
                <p className="text-gray-500 text-lg font-medium leading-relaxed">Please select a factor or create a new one to begin. Your research is powered by real-time market regimes.</p>
              </div>
              <button onClick={() => setIsOverlayOpen(true)} className="bg-blue-600 hover:bg-blue-500 text-white font-black py-4 px-10 rounded-2xl transition-all shadow-2xl shadow-blue-600/20 active:scale-95 uppercase text-sm">Configure Research</button>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto space-y-12 pb-24">
              <div className="border-b border-gray-900 pb-8 mb-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg border bg-blue-500/10 text-blue-500 border-blue-500/20">{activeFactor?.category} Mode</span>
                    <span className="text-[10px] text-gray-700 font-black uppercase tracking-widest bg-gray-900 px-3 py-1 rounded-lg">ID: {activeFactor?.id}</span>
                    {activeFactor?.buyThreshold && (
                      <span className="text-[10px] text-green-500 font-black uppercase tracking-widest bg-green-500/10 border border-green-500/20 px-3 py-1 rounded-lg">Buy: {activeFactor.buyThreshold}</span>
                    )}
                    {activeFactor?.sellThreshold && (
                      <span className="text-[10px] text-red-400 font-black uppercase tracking-widest bg-red-400/10 border border-red-400/20 px-3 py-1 rounded-lg">Sell: {activeFactor.sellThreshold}</span>
                    )}
                  </div>
                  
                  <div className="flex flex-col xl:flex-row xl:items-center gap-6 justify-between">
                    <h1 className="text-6xl font-black text-white tracking-tighter uppercase italic leading-none max-w-4xl">
                      {activeFactor?.name?.replace(/_/g, ' ')}
                    </h1>
                    
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-2 bg-gray-900/50 border border-gray-800 rounded-xl px-4 h-12">
                          <Globe className="w-3.5 h-3.5 text-gray-500" />
                          <select 
                            value={selectedBenchmark}
                            onChange={(e) => setSelectedBenchmark(e.target.value as any)}
                            className="bg-transparent text-xs font-bold uppercase tracking-widest text-gray-300 focus:outline-none cursor-pointer pr-2"
                          >
                            <option value="BTC-USD">BTC-USD</option>
                            <option value="ETH-USD">ETH-USD</option>
                            <option value="CSI 300">CSI 300 (A-Shares)</option>
                            <option value="CUSTOM_A">Custom A-Share</option>
                          </select>
                          {selectedBenchmark === 'CUSTOM_A' && (
                            <input
                              type="text"
                              value={customAShareCode}
                              onChange={(e) => setCustomAShareCode(e.target.value)}
                              placeholder="e.g. 600519"
                              className="bg-transparent text-xs font-mono text-gray-300 focus:outline-none border-l border-gray-800 pl-3"
                              maxLength={6}
                            />
                          )}
                        </div>
                        <button 
                          onClick={() => handleRunSimulation(selectedBenchmark)}
                          disabled={
                            isSimulating ||
                            (selectedBenchmark === 'CUSTOM_A' && !/^\d{6}$/.test(customAShareCode.trim()))
                          }
                          className="h-12 px-6 bg-white hover:bg-gray-200 text-black text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] uppercase tracking-tighter disabled:opacity-50"
                        >
                            {isFetchingData ? <CloudDownload className="animate-bounce w-4 h-4" /> : <Play className="w-4 h-4" />}
                            Run Simulation
                        </button>
                    </div>
                  </div>

                  <p className="text-gray-400 text-lg max-w-3xl font-bold tracking-tight">{activeFactor?.description}</p>
                </div>
              </div>

              {activeTab === 'overview' && (
                <div className="relative">
                  {simulationData ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                      <div className="lg:col-span-2 space-y-10">
                        <PerformanceDashboard 
                          data={simulationData.data} 
                          metrics={simulationData.metrics}
                          trades={simulationData.trades}
                          factorName={activeFactor?.name || ''}
                        />
                      </div>
                      <div className="space-y-10">
                        <div className="bg-gray-900/30 border border-gray-800 rounded-[32px] p-8 space-y-6">
                          <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Signal Intuition</h4>
                          <p className="text-gray-300 leading-relaxed font-bold text-lg">{activeFactor?.intuition}</p>
                        </div>
                        <div className="bg-gray-900/30 border border-gray-800 rounded-[32px] p-8">
                          <div className="bg-black/60 rounded-2xl p-6 border border-gray-800">
                            <code className="text-sm text-blue-400 font-mono break-all font-bold leading-relaxed">{activeFactor?.formula}</code>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-64 rounded-[32px] border border-dashed border-gray-800 bg-gray-900/20">
                      <div className="text-center space-y-2">
                        <p className="text-xs font-black uppercase tracking-widest text-gray-600">No Simulation Yet</p>
                        <p className="text-sm text-gray-500">Run a simulation to visualize performance and trade history.</p>
                      </div>
                    </div>
                  )}
                  {isSimulating && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-xl rounded-[32px] z-20">
                      <div className="flex flex-col items-center gap-6">
                        <div className="relative">
                          <div className="w-20 h-20 rounded-full border-2 border-blue-500/40 border-t-transparent border-b-transparent animate-spin" />
                          <div className="absolute inset-3 rounded-full border-2 border-indigo-400/40 border-l-transparent border-r-transparent animate-spin" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs font-black uppercase tracking-[0.35em] text-blue-200">ALPHA</span>
                          </div>
                        </div>
                        <div className="text-center space-y-1">
                          <p className="text-sm font-black uppercase tracking-[0.35em] text-gray-200">RUNNING SIMULATION</p>
                          <p className="text-xs text-gray-500 font-medium tracking-[0.25em] uppercase">Market Regime Backtest</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'code' && activeFactor && (
                <div className="bg-gray-900/20 border border-gray-800 rounded-[40px] p-12">
                  <pre className="text-gray-400 font-mono text-sm leading-8 whitespace-pre-wrap break-all">
                     {`# Strategy: ${activeFactor.name}\n# Formula: ${activeFactor.formula}\n\ndef compute_signal(df):\n    return ${activeFactor.formula}`}
                  </pre>
                </div>
              )}

              {activeTab === 'python' && activeFactor && (
                <div className="bg-gray-900/20 border border-gray-800 rounded-[40px] p-12">
                  <pre className="text-gray-400 font-mono text-sm leading-8 whitespace-pre-wrap break-all">
                    {activeFactor.pythonCode || '# Please run a backtest first to generate the Python factor calculation code'}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {isOverlayOpen && (
          <GeneratorOverlay 
            onClose={() => setIsOverlayOpen(false)} 
            onGenerate={handleGenerate}
            onBulkGenerate={handleBulkGenerate}
            isGenerating={isGenerating}
          />
        )}

        {isAuthModalOpen && (
          <AuthModal onLoginSuccess={handleLoginSuccess} onClose={() => setIsAuthModalOpen(false)} />
        )}
      </main>
    </div>
  );
};

export default App;
