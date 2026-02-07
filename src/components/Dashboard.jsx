import React, { useState, useEffect } from 'react';
import { LogOut, BarChart2, Play, Radio } from 'lucide-react';
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
  
  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const newStats = await SheetsAPI.getStats();
      setStats(newStats);
    } catch (e) {
      console.error("Failed to load stats", e);
    }
  };

  const handleLogout = () => {
    Auth.logout();
    window.location.reload();
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 pb-24">
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Spotify Rater</h1>
        <div className="flex gap-4 items-center">
            <div className="hidden md:flex gap-4 text-sm text-zinc-400">
                <span>Today: <b className="text-white">{stats.today}</b></span>
                <span>Total: <b className="text-white">{stats.total}</b></span>
            </div>
            <button 
            onClick={handleLogout}
            className="p-2 hover:bg-zinc-800 rounded-full transition-colors" title="Logout">
            <LogOut size={20} />
            </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex p-1 bg-zinc-900 rounded-xl mb-8">
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
      <div className="min-h-[400px]">
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
