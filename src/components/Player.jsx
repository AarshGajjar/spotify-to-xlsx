import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, Star } from 'lucide-react';
import SpotifyAPI from '../services/spotify';
import SheetsAPI from '../services/sheets';
import config from '../config';

const Player = ({ mode, onRatingComplete }) => {
  const [track, setTrack] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState(null);
  const [playlistId, setPlaylistId] = useState(null);
  const [existingRating, setExistingRating] = useState(null);
  
  // Playback state
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const progressInterval = useRef(null);

  useEffect(() => {
    initialize();
    return () => clearInterval(progressInterval.current);
  }, [mode]);

  const initialize = async () => {
    setError(null);
    setTrack(null);
    
    if (mode === 'playlist') {
        await checkPlaylistPlayback();
    } else {
        refreshNowPlaying();
    }
    
    // Start polling for progress
    startProgressPolling();
  };

  const startProgressPolling = () => {
      clearInterval(progressInterval.current);
      progressInterval.current = setInterval(async () => {
          if (document.hidden) return; // Save API calls
          try {
              const state = await SpotifyAPI.getPlaybackState();
              if (state && state.item) {
                  setProgress(state.progress_ms);
                  setDuration(state.item.duration_ms);
                  setIsPlaying(state.is_playing);
                  
                  // Auto-refresh track info if song changed externally
                  setTrack(prevTrack => {
                      if (prevTrack && state.item.id !== prevTrack.trackId) {
                         if (mode === 'nowplaying') {
                             const newTrack = SpotifyAPI.formatTrackData(state.item);
                             SheetsAPI.findTrackById(state.item.id).then(saved => {
                                 setExistingRating(saved ? saved.rating : null);
                             });
                             return newTrack;
                         }
                         if (mode === 'playlist') {
                             const newTrack = SpotifyAPI.formatTrackData(state.item);
                             SheetsAPI.findTrackById(state.item.id).then(saved => {
                                 setExistingRating(saved ? saved.rating : null);
                             });
                             return newTrack;
                         }
                      }
                      return prevTrack;
                  });
              }
          } catch (e) {
              // Silent fail
          }
      }, 1000);
  };

  const checkPlaylistPlayback = async () => {
    setIsLoading(true);
    try {
        let pid = playlistId;
        if (!pid) {
            pid = await SpotifyAPI.findPlaylistByName(config.playlistName);
            setPlaylistId(pid);
        }

        const state = await SpotifyAPI.getPlaybackState();
        const isPlayingPlaylist = state?.context?.uri?.includes(pid);

        if (isPlayingPlaylist && state?.item) {
             setTrack(SpotifyAPI.formatTrackData(state.item));
             setIsPlaying(state.is_playing);
             setProgress(state.progress_ms);
             setDuration(state.item.duration_ms);
             
             const saved = await SheetsAPI.findTrackById(state.item.id);
             setExistingRating(saved ? saved.rating : null);
        }
    } catch (e) {
        setError(e.message);
    } finally {
        setIsLoading(false);
    }
  };

  const loadPlaylistTrack = async () => {
    setIsLoading(true);
    setError(null);
    try {
      let pid = playlistId;
      if (!pid) {
        pid = await SpotifyAPI.findPlaylistByName(config.playlistName);
        setPlaylistId(pid);
      }
      
      const nextTrack = await SpotifyAPI.getFirstTrackFromPlaylist(pid);
      if (!nextTrack) {
        setError("Playlist is empty! All songs rated.");
        setTrack(null);
      } else {
        setTrack(nextTrack);
        const saved = await SheetsAPI.findTrackById(nextTrack.trackId);
        setExistingRating(saved ? saved.rating : null);
        
        await SpotifyAPI.playTrack(nextTrack.trackId, `spotify:playlist:${pid}`);
        setIsPlaying(true);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshNowPlaying = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const current = await SpotifyAPI.getCurrentlyPlaying();
      if (!current) {
        setError("No song currently playing on Spotify.");
        setTrack(null);
      } else {
        setTrack(current);
        const saved = await SheetsAPI.findTrackById(current.trackId);
        setExistingRating(saved ? saved.rating : null);
        
        const pbState = await SpotifyAPI.getPlaybackState();
        setIsPlaying(pbState?.is_playing || false);
        if (pbState && pbState.item) {
            setDuration(pbState.item.duration_ms);
            setProgress(pbState.progress_ms);
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRating = async (rating) => {
    if (!track) return;
    setIsLoading(true);
    try {
      await SheetsAPI.saveRating(track.trackId, track.artistName, track.songName, rating);
      
      if (mode === 'playlist') {
        if (playlistId) {
            await SpotifyAPI.removeTrackFromPlaylist(playlistId, track.trackId);
        }
        onRatingComplete();
        setTimeout(loadPlaylistTrack, 500);
      } else {
        setExistingRating(rating);
        onRatingComplete();
        setIsLoading(false);
      }
    } catch (e) {
      setError(e.message);
      setIsLoading(false);
    }
  };

  const handlePlayPause = async () => {
    try {
        if(mode === 'playlist' && !track) {
           loadPlaylistTrack();
           return;
        }
        
        if (track) {
             const state = await SpotifyAPI.getPlaybackState();
             const isSameTrack = state?.item?.id === track.trackId;
             
             if (!isSameTrack && mode === 'playlist') {
                 await SpotifyAPI.playTrack(track.trackId, `spotify:playlist:${playlistId}`);
                 setIsPlaying(true);
             } else {
                 await SpotifyAPI.togglePlayback();
                 setIsPlaying(!isPlaying);
             }
        }
    } catch (e) {
    }
  };
  
  const formatTime = (ms) => {
      if (!ms) return "0:00";
      const totalSeconds = Math.floor(ms / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!track && !isLoading && !error && mode === 'playlist') {
      return (
          <div className="flex flex-col items-center justify-center h-64">
              <button 
                onClick={loadPlaylistTrack}
                className="bg-green-500 text-black font-bold py-3 px-8 rounded-full hover:scale-105 transition-transform flex items-center gap-2"
              >
                  <Play size={20} className="fill-black" />
                  Start Rating {config.playlistName}
              </button>
          </div>
      );
  }

  return (
    <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-zinc-900 rounded-3xl p-6 md:p-8 border border-zinc-800 shadow-2xl max-w-2xl mx-auto relative overflow-hidden"
    >
      {track?.albumArt && (
         <div 
            className="absolute inset-0 opacity-10 blur-3xl pointer-events-none"
            style={{ backgroundImage: `url(${track.albumArt})`, backgroundSize: 'cover' }}
         />
      )}
    
      {error && (
        <div className="relative z-10 bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-xl mb-6 flex items-center gap-2">
            <span className="text-sm">{error}</span>
            <button onClick={mode === 'playlist' ? loadPlaylistTrack : refreshNowPlaying} className="ml-auto text-xs underline">Retry</button>
        </div>
      )}

      {isLoading && !track ? (
          <div className="h-64 flex items-center justify-center relative z-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
          </div>
      ) : track ? (
        <div className="relative z-10">
            <div className="flex flex-col md:flex-row gap-8 items-center md:items-start mb-8">
                <div className="relative group shrink-0">
                    <img 
                        src={track.albumArt || 'https://placehold.co/300x300/222/555?text=No+Art'} 
                        alt="Album Art" 
                        className="w-48 h-48 md:w-64 md:h-64 rounded-2xl shadow-2xl object-cover"
                    />
                    <button 
                        onClick={handlePlayPause}
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl"
                    >
                        {isPlaying ? <Pause className="fill-white text-white w-12 h-12" /> : <Play className="fill-white text-white w-12 h-12" />}
                    </button>
                </div>
                
                <div className="flex-1 text-center md:text-left w-full">
                    <h2 className="text-2xl md:text-3xl font-bold mb-2 leading-tight truncate">{track.songName}</h2>
                    <p className="text-zinc-400 text-lg md:text-xl mb-4 truncate">{track.artistName}</p>
                    
                    {existingRating && (
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-900/30 text-green-400 rounded-full text-sm font-medium mb-6">
                            <Star size={14} className="fill-green-400" />
                            Rated: {existingRating}
                        </div>
                    )}
                    
                    <div className="w-full bg-zinc-800 rounded-full h-1.5 mb-2 overflow-hidden">
                        <motion.div 
                            className="bg-green-500 h-full rounded-full"
                            style={{ width: `${(progress / duration) * 100}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-xs text-zinc-500 mb-6 font-mono">
                        <span>{formatTime(progress)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>

                    <div className="flex items-center justify-center md:justify-start gap-4">
                        <button onClick={() => SpotifyAPI.previousTrack()} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors">
                            <SkipBack size={24} />
                        </button>
                        <button onClick={handlePlayPause} className="p-3 bg-white text-black rounded-full hover:scale-105 transition-transform">
                            {isPlaying ? <Pause size={24} className="fill-black" /> : <Play size={24} className="fill-black" />}
                        </button>
                        <button onClick={() => SpotifyAPI.nextTrack()} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors">
                            <SkipForward size={24} />
                        </button>
                    </div>
                </div>
            </div>

            <div>
                <p className="text-center md:text-left text-sm text-zinc-500 mb-3 uppercase tracking-wider font-semibold">Rate this track</p>
                <div className="grid grid-cols-3 md:grid-cols-9 gap-2">
                    {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((r) => (
                        <button
                            key={r}
                            onClick={() => handleRating(r)}
                            disabled={isLoading}
                            className={`
                                py-3 rounded-lg font-bold text-sm transition-all
                                ${existingRating == r 
                                    ? 'bg-green-500 text-black scale-105 ring-2 ring-green-500 ring-offset-2 ring-offset-zinc-900' 
                                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'}
                            `}
                        >
                            {r}
                        </button>
                    ))}
                </div>
            </div>
        </div>
      ) : (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-500 relative z-10">
              <div className="mb-4 opacity-50">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
              </div>
              <p>No track loaded</p>
          </div>
      )}
    </motion.div>
  );
};

export default Player;