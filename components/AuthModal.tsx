
import React, { useState } from 'react';
import { ShieldCheck, Github, X, Loader2, AlertCircle } from 'lucide-react';
import { startGithubLogin } from '../services/authService';
import { User } from '../types';

interface AuthModalProps {
  onLoginSuccess: (user: User) => void;
  onClose?: () => void;
  isDismissible?: boolean;
}

const AuthModal: React.FC<AuthModalProps> = ({ onLoginSuccess, onClose, isDismissible = true }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      startGithubLogin();
    } catch (err: any) {
      console.error(`GitHub login failed:`, err);
      setError(err.message || 'Authentication failed. Please check your configuration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-[40px] p-10 shadow-2xl relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full" />

        {isDismissible && onClose && (
          <button onClick={onClose} className="absolute top-6 right-6 p-2 text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="text-center space-y-6 relative">
          <div className="w-20 h-20 bg-blue-600 rounded-[28px] flex items-center justify-center mx-auto shadow-2xl shadow-blue-600/20">
            <ShieldCheck className="w-10 h-10 text-white" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic">Secure Access</h2>
            <p className="text-gray-500 text-sm font-medium">Join AlphaGen Studio to sync your research across devices.</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-start gap-3 text-left animate-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Configuration Error</p>
                <p className="text-xs text-red-200/70 leading-relaxed font-medium">{error}</p>
              </div>
            </div>
          )}

          <div className="space-y-3 pt-2">
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-white hover:bg-gray-100 text-black h-14 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Github className="w-5 h-5" />}
              Continue with GitHub
            </button>
          </div>

          <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest pt-4">
            Encrypted by Cloud Security Layer
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
