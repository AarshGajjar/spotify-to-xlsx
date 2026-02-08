import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, Star, ExternalLink, Info, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import SpotifyAPI from '../services/spotify';
import SheetsAPI from '../services/sheets';
import config from '../config';

const Player = ({ mode, onRatingComplete }) => {
  const [track, setTrack] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRating, setIsRating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState(null);
  const [playlistId, setPlaylistId] = useState(null);
  const [existingRating, setExistingRating] = useState(null);
  const [showRubric, setShowRubric] = useState(false);
  
  // Playback state
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
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

  const loadPlaylistTrack = async (isTransition = false, autoPlay = true) => {
    if (!isTransition) setIsLoading(true);
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
        const saved = await SheetsAPI.findTrackById(nextTrack.trackId);
        setExistingRating(saved ? saved.rating : null);
        setTrack(nextTrack);
        
        if (autoPlay) {
          await SpotifyAPI.setShuffle(false);
          await SpotifyAPI.playTrack(nextTrack.trackId, `spotify:playlist:${pid}`, 0);
          setIsPlaying(true);
        } else {
          setIsPlaying(false);
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
      setIsRating(false);
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
    if (!track || isRating) return;
    setIsRating(true);
    try {
      await SheetsAPI.saveRating(track.trackId, track.artistName, track.songName, rating);
      
      if (mode === 'playlist') {
        if (playlistId) {
            await SpotifyAPI.removeTrackFromPlaylist(playlistId, track.trackId);
        }
        toast.success(
            <div className="flex flex-col gap-1">
                <span className="font-semibold text-green-400">Rated {rating}</span>
                <span className="text-zinc-400 text-xs">Removed from {config.playlistName}</span>
            </div>,
            { style: { background: '#18181b', border: '1px solid #27272a', color: '#fafafa' } }
        );
        onRatingComplete();
        await loadPlaylistTrack(true, false);
      } else {
        setExistingRating(rating);
        toast.success(
            <div className="flex flex-col gap-1">
                <span className="font-semibold text-green-400">Rated {rating}</span>
            </div>,
            { style: { background: '#18181b', border: '1px solid #27272a', color: '#fafafa' } }
        );
        onRatingComplete();
        setIsRating(false);
      }
    } catch (e) {
      setError(e.message);
      toast.error(
          <div className="flex flex-col gap-1">
              <span className="font-semibold text-red-400">Failed to rate track</span>
          </div>,
          { style: { background: '#18181b', border: '1px solid #27272a', color: '#fafafa' } }
      );
      setIsRating(false);
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

  const handleSeek = async (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const seekTime = percentage * duration;
    
    try {
        await SpotifyAPI.seek(seekTime);
        setProgress(seekTime);
    } catch (error) {
        console.error('Seek failed:', error);
    }
  };

  const handleProgressMouseDown = (e) => {
    setIsDragging(true);
    handleSeek(e);
  };

  const handleProgressMouseMove = (e) => {
    if (isDragging) {
      handleSeek(e);
    }
  };

  const handleProgressMouseUp = () => {
    setIsDragging(false);
  };

  const openSpotify = () => {
    window.location.href = 'spotify:';
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      if (isDragging) {
        handleProgressMouseMove(e);
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, duration]);
  
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
        className="bg-zinc-900 rounded-3xl p-4 md:p-6 border border-zinc-800 shadow-2xl w-full h-full flex flex-col relative overflow-hidden"
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
            <button onClick={mode === 'playlist' ? () => loadPlaylistTrack() : refreshNowPlaying} className="ml-auto text-xs underline">Retry</button>
        </div>
      )}

      {isLoading && !track ? (
          <div className="flex-1 flex items-center justify-center relative z-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
          </div>
      ) : track ? (
        <div className="relative z-10 flex flex-col h-full overflow-hidden">
            <div className="flex-1 min-h-0 flex flex-col gap-4 items-center mb-4">
                <div className="relative group shrink-0 w-full flex-1 min-h-0 flex justify-center items-center">
                    <img 
                        src={track.albumArt || 'https://placehold.co/300x300/222/555?text=No+Art'} 
                        alt="Album Art" 
                        className="w-auto h-full max-h-full object-contain rounded-2xl shadow-2xl"
                    />
                    <button 
                        onClick={handlePlayPause}
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl"
                    >
                        {isPlaying ? <Pause className="fill-white text-white w-12 h-12" /> : <Play className="fill-white text-white w-12 h-12" />}
                    </button>
                </div>
                
                <div className="shrink-0 w-full text-center">
                    <h2 className="text-xl md:text-3xl font-bold mb-1 leading-tight truncate">{track.songName}</h2>
                    <p className="text-zinc-400 text-sm md:text-xl mb-2 truncate">{track.artistName}</p>
                    
                    {existingRating && (
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-900/30 text-green-400 rounded-full text-xs font-medium mb-3">
                            <Star size={12} className="fill-green-400" />
                            Rated: {existingRating}
                        </div>
                    )}
                    
                    <div className="w-full bg-zinc-800 rounded-full h-2 mb-2 overflow-hidden cursor-pointer relative group"
                         onMouseDown={handleProgressMouseDown}
                         onMouseMove={handleProgressMouseMove}
                         onMouseUp={handleProgressMouseUp}>
                        <motion.div 
                            className="bg-green-500 h-full rounded-full relative"
                            style={{ width: `${(progress / duration) * 100}%` }}
                        >
                            <div className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"></div>
                        </motion.div>
                    </div>
                    <div className="flex justify-between text-xs text-zinc-500 mb-3 font-mono">
                        <span>{formatTime(progress)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>

                    <div className="flex items-center justify-center gap-4 mb-2">
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

            <div className="shrink-0 mt-auto pt-2 border-t border-zinc-800/50">
                <div className="flex items-center justify-center gap-2 mb-2">
                    <p className="text-center text-xs text-zinc-500 uppercase tracking-wider font-semibold">Rate this track</p>
                    <button 
                        onClick={() => setShowRubric(true)}
                        className="text-zinc-500 hover:text-green-400 transition-colors"
                        title="View rating guide"
                    >
                        <Info size={14} />
                    </button>
                </div>
                <div className="grid grid-cols-9 gap-1.5 md:gap-2 mb-3">
                    {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((r) => (
                        <button
                            key={r}
                            onClick={() => handleRating(r)}
                            disabled={isLoading || isRating}
                            className={`
                                py-2 px-0.5 rounded-lg font-bold text-xs md:text-sm transition-colors
                                ${existingRating == r 
                                    ? 'bg-green-500 text-black shadow-lg shadow-green-500/25' 
                                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'}
                                ${isRating ? 'opacity-50 cursor-not-allowed' : ''}
                            `}
                        >
                            {r}
                        </button>
                    ))}
                </div>
                
                <div className="flex justify-center">
                    <button 
                        onClick={openSpotify}
                        className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg transition-colors text-sm w-full md:w-auto justify-center"
                    >
                        <ExternalLink size={16} />
                        Open Spotify
                    </button>
                </div>
            </div>

            {/* Rating Rubric Overlay */}
            {showRubric && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-zinc-900/95 backdrop-blur-sm z-50 flex flex-col p-4 overflow-y-auto"
                >
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Rating Guide</h3>
                        <button 
                            onClick={() => setShowRubric(false)}
                            className="p-1 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                    <div className="space-y-3 text-xs">
                        <div className="flex gap-3">
                            <span className="font-bold text-green-400 shrink-0 w-8">5.0</span>
                            <div>
                                <span className="font-semibold text-zinc-200">Exceptional</span>
                                <p className="text-zinc-500 mt-0.5">Strong emotional or personal connection. Highly replayable. Core favorites.</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <span className="font-bold text-green-300 shrink-0 w-8">4.5</span>
                            <div>
                                <span className="font-semibold text-zinc-200">Excellent</span>
                                <p className="text-zinc-500 mt-0.5">Very high quality and highly enjoyable, but missing a deeper personal attachment.</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <span className="font-bold text-blue-400 shrink-0 w-8">4.0</span>
                            <div>
                                <span className="font-semibold text-zinc-200">Great</span>
                                <p className="text-zinc-500 mt-0.5">Consistently enjoyable. Solid additions to playlists. Would play regularly.</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <span className="font-bold text-blue-300 shrink-0 w-8">3.5</span>
                            <div>
                                <span className="font-semibold text-zinc-200">Good</span>
                                <p className="text-zinc-500 mt-0.5">Pleasant and worthwhile, but not essential. Situational listening.</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <span className="font-bold text-zinc-400 shrink-0 w-8">3.0</span>
                            <div>
                                <span className="font-semibold text-zinc-200">Neutral</span>
                                <p className="text-zinc-500 mt-0.5">Neither particularly good nor bad. Indifferent response.</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <span className="font-bold text-orange-400 shrink-0 w-8">2.5</span>
                            <div>
                                <span className="font-semibold text-zinc-200">Below Average</span>
                                <p className="text-zinc-500 mt-0.5">Tolerable occasionally, but rarely chosen intentionally.</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <span className="font-bold text-orange-500 shrink-0 w-8">2.0</span>
                            <div>
                                <span className="font-semibold text-zinc-200">Poor</span>
                                <p className="text-zinc-500 mt-0.5">Usually skipped. Low enjoyment.</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <span className="font-bold text-red-500 shrink-0 w-8">1.5–1.0</span>
                            <div>
                                <span className="font-semibold text-zinc-200">Unpleasant</span>
                                <p className="text-zinc-500 mt-0.5">Actively dislike. Avoid listening.</p>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
      ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 relative z-10">
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