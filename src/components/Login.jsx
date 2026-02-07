import React, { useEffect, useState } from 'react';
import { Music, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';
import Auth from '../services/auth';
import { motion } from 'framer-motion';

const Login = () => {
  const [authState, setAuthState] = useState({
    spotify: false,
    google: false,
  });

  useEffect(() => {
    const unsubscribe = Auth.subscribe((newState) => {
        setAuthState(newState);
    });
    
    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-zinc-900 rounded-2xl p-8 border border-zinc-800 shadow-2xl"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Spotify Dataset Builder</h1>
          <p className="text-zinc-400">Connect your accounts to start building your dataset</p>
        </div>

        <div className="space-y-4">
          {/* Spotify Button */}
          <button
            onClick={() => !authState.spotify && Auth.loginSpotify()}
            disabled={authState.spotify}
            className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
              authState.spotify
                ? 'bg-green-900/20 border-green-500/50 text-green-500 cursor-default'
                : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-750 text-white hover:border-green-500'
            }`}
          >
            <div className="flex items-center gap-3">
              <Music className={authState.spotify ? "text-green-500" : "text-white"} />
              <span className="font-medium">Spotify</span>
            </div>
            {authState.spotify && <CheckCircle className="w-5 h-5" />}
          </button>

          {/* Google Button */}
          <button
            onClick={() => !authState.google && Auth.loginGoogle()}
            disabled={authState.google}
            className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
              authState.google
                ? 'bg-blue-900/20 border-blue-500/50 text-blue-500 cursor-default'
                : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-750 text-white hover:border-blue-500'
            }`}
          >
            <div className="flex items-center gap-3">
              <FileSpreadsheet className={authState.google ? "text-blue-500" : "text-white"} />
              <span className="font-medium">Google Sheets</span>
            </div>
            {authState.google && <CheckCircle className="w-5 h-5" />}
          </button>
        </div>

        {!authState.spotify && !authState.google && (
            <p className="text-xs text-center text-zinc-500 mt-6">
                Please connect both services to continue.
            </p>
        )}
      </motion.div>
    </div>
  );
};

export default Login;