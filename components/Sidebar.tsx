
import React from 'react';
import { AlphaFactor, User } from '../types';
import { Database, Plus, Sparkles, TrendingUp, TrendingDown, Clock, LogOut, User as UserIcon, ShieldCheck } from 'lucide-react';

interface SidebarProps {
  factors: AlphaFactor[];
  activeFactorId: string | null;
  user: User | null;
  onSelectFactor: (id: string) => void;
  onNewFactor: () => void;
  onQuickDiscover: () => void;
  onLogout: () => void;
  onLoginClick: () => void;
  isGenerating: boolean;
  isSyncing?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  factors, 
  activeFactorId, 
  user,
  onSelectFactor, 
  onNewFactor, 
  onQuickDiscover,
  onLogout,
  onLoginClick,
  isGenerating,
  isSyncing
}) => {
  return (
    <div className="w-72 bg-gray-950 border-r border-gray-900 flex flex-col h-full overflow-hidden">
      <div className="p-6 border-b border-gray-900 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Database className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-black tracking-tight text-white uppercase italic">
            AlphaGen<span className="text-blue-500">.</span>
          </h1>
        </div>
        
        <div className="space-y-2">
          <button 
            onClick={onNewFactor}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-3 px-4 flex items-center justify-center gap-2 transition-all font-bold text-sm shadow-lg shadow-blue-900/20"
          >
            <Plus className="w-4 h-4" />
            Create Factor
          </button>

          <button 
            onClick={onQuickDiscover}
            disabled={isGenerating}
            className="w-full bg-gray-900 hover:bg-gray-800 text-blue-400 border border-blue-500/10 rounded-xl py-2.5 px-4 flex items-center justify-center gap-2 transition-all font-bold text-xs disabled:opacity-50"
          >
            {isGenerating ? (
              <div className="w-3 h-3 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            Auto-Discovery (5)
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="flex items-center justify-between mb-4 px-2">
          <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-widest flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> Factory History
          </h3>
          <div className="flex items-center gap-2">
            {isSyncing && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />}
            <span className="text-[10px] bg-gray-900 text-gray-500 px-2 py-0.5 rounded-md border border-gray-800 font-mono">
              {factors.length}
            </span>
          </div>
        </div>
        
        <div className="space-y-1.5">
          {isSyncing && factors.length === 0 ? (
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className="px-4 py-3 rounded-xl border border-gray-800 bg-gray-900/60"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="h-2 w-16 bg-gray-800 rounded-full" />
                    <div className="h-3 w-6 bg-gray-800 rounded-full" />
                  </div>
                  <div className="h-3 w-32 bg-gray-800 rounded-full mb-1.5" />
                  <div className="h-2 w-full bg-gray-900 rounded-full" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {factors.map(f => (
                <button
                  key={f.id}
                  onClick={() => onSelectFactor(f.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all group border ${
                    activeFactorId === f.id 
                      ? 'bg-blue-600/5 border-blue-500/30 ring-1 ring-blue-500/20 shadow-inner' 
                      : 'border-transparent hover:bg-gray-900 hover:border-gray-800'
                  }`}
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold uppercase tracking-tighter ${
                        activeFactorId === f.id ? 'text-blue-400' : 'text-gray-500'
                      }`}>
                        {f.category}
                      </span>
                      <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                        {Math.random() > 0.5 ? <TrendingUp className="w-3 h-3 text-green-500" /> : <TrendingDown className="w-3 h-3 text-red-400" />}
                      </div>
                    </div>
                    <h4 className={`text-sm font-bold truncate ${activeFactorId === f.id ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>
                      {f.name}
                    </h4>
                    <p className="text-[10px] text-gray-600 truncate line-clamp-1 opacity-70 font-mono">
                      {f.formula}
                    </p>
                  </div>
                </button>
              ))}
              {factors.length === 0 && (
                <div className="text-center py-10 opacity-20 flex flex-col items-center gap-2">
                  <Database className="w-8 h-8" />
                  <p className="text-xs">No factors created yet</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-gray-900 bg-gray-950/50">
        {user ? (
          <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-gray-900 transition-all group">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-xl border border-gray-800" />
                <div className="absolute -bottom-1 -right-1 bg-green-500 w-3 h-3 border-2 border-gray-950 rounded-full" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-black text-white truncate max-w-[100px]">{user.name}</span>
                  <ShieldCheck className="w-3 h-3 text-blue-500" />
                </div>
                <span className="text-[10px] text-gray-600 font-bold uppercase tracking-tighter">{user.provider} Cloud</span>
              </div>
            </div>
            <button 
              onClick={onLogout}
              className="p-2 text-gray-600 hover:text-red-400 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button 
            onClick={onLoginClick}
            className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl border border-dashed border-gray-800 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group"
          >
            <UserIcon className="w-5 h-5 text-gray-700 group-hover:text-blue-500" />
            <span className="text-xs font-black text-gray-600 group-hover:text-white uppercase tracking-widest">Sign In</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
