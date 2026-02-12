import React, { useState, useEffect } from 'react';
import { LogOut, BarChart2, Play, Radio, RefreshCcw } from 'lucide-react';
import Auth from '../services/auth';
import SpotifyAPI from '../services/spotify';
import SheetsAPI from '../services/sheets';
import Player from './Player';
import Stats from './Stats';
import config from '../config';
import { motion, AnimatePresence } from 'framer-motion';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('rate-playlist'); // 'rate-playlist', 'rate-now', 'stats'
  const [stats, setStats] = useState({ total: 0, today: 0, distribution: {} });
  const [authError, setAuthError] = useState(false);
  
  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setAuthError(false);
      const newStats = await SheetsAPI.getStats();
      setStats(newStats);
    } catch (e) {
      console.error("Failed to load stats", e);
      if (e.message && (e.message.includes('GoogleAuthRequired') || e.message.includes('expired'))) {
        setAuthError(true);
      }
    }
  };

  const handleReconnect = async () => {
    try {
      await Auth.loginGoogle();
      await loadStats();
    } catch (e) {
      console.error("Reconnection failed", e);
    }
  };

  const handleLogout = () => {
    Auth.logout();
    window.location.reload();
  };

  return (
    <div className="h-full flex flex-col w-full max-w-4xl mx-auto p-4 md:p-6 overflow-hidden">
      {/* Header */}
      <header className="flex justify-between items-center mb-4 md:mb-6 shrink-0">
        <h1 className="text-2xl font-bold">Spotify Dataset Builder</h1>
        <div className="flex gap-4 items-center">
            {authError ? (
              <button
                onClick={handleReconnect}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg text-sm transition-colors border border-red-500/20"
              >
                <RefreshCcw size={14} />
                <span>Reconnect Google</span>
              </button>
            ) : (
              <div className="hidden md:flex gap-4 text-sm text-zinc-400">
                  <span>Today: <b className="text-white">{stats.today}</b></span>
                  <span>Total: <b className="text-white">{stats.total}</b></span>
              </div>
            )}
            <button 
            onClick={handleLogout}
            className="p-2 hover:bg-zinc-800 rounded-full transition-colors" title="Logout">
            <LogOut size={20} />
            </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex p-1 bg-zinc-900 rounded-xl mb-4 md:mb-6 shrink-0">
        <TabButton 
          active={activeTab === 'rate-playlist'} 
          onClick={() => setActiveTab('rate-playlist')}
          icon={<Play size={18} />}
          label={config.playlistName}
        />
        <TabButton 
          active={activeTab === 'rate-now'} 
          onClick={() => setActiveTab('rate-now')}
          icon={<Radio size={18} />}
          label="Now Playing"
        />
        <TabButton 
          active={activeTab === 'stats'} 
          onClick={() => setActiveTab('stats')}
          icon={<BarChart2 size={18} />}
          label="Stats"
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 relative">
        <AnimatePresence mode="wait">
          {activeTab === 'rate-playlist' && (
            <Player 
                key="playlist" 
                mode="playlist" 
                onRatingComplete={loadStats} 
            />
          )}
          {activeTab === 'rate-now' && (
            <Player 
                key="now" 
                mode="nowplaying" 
                onRatingComplete={loadStats} 
            />
          )}
          {activeTab === 'stats' && (
            <Stats stats={stats} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const TabButton = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all ${
      active 
        ? 'bg-zinc-800 text-white shadow-sm' 
        : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
    }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);

export default Dashboard;
