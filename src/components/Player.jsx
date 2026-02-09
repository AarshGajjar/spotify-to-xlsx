import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, Star, ExternalLink, Info, X, Trash2, Table } from 'lucide-react';
import { toast } from 'react-hot-toast';
import SpotifyAPI from '../services/spotify';
import SheetsAPI from '../services/sheets';
import LastFM from '../services/lastfm';
import config from '../config';

const Player = ({ mode, onRatingComplete }) => {
  const [track, setTrack] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRating, setIsRating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState(null);
  const [playlistId, setPlaylistId] = useState(null);
  const playlistIdRef = useRef(playlistId);
  const [existingRating, setExistingRating] = useState(null);
  const [showRubric, setShowRubric] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [isRemoved, setIsRemoved] = useState(false);
  const [genres, setGenres] = useState([]);
  
  // Playback state
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const progressInterval = useRef(null);
  const isTransitioningRef = useRef(false);

  useEffect(() => {
      setIsRemoved(false);
      if (track?.artistName && track?.songName) {
        LastFM.getTrackInfo(track.artistName, track.songName).then(setGenres);
      } else {
        setGenres([]);
      }
  }, [track?.trackId]);

  useEffect(() => {
    playlistIdRef.current = playlistId;
  }, [playlistId]);

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

              if (mode === 'playlist') {
                  const currentPid = playlistIdRef.current;
                  const isPlayingPlaylist = state?.context?.uri?.includes(currentPid);

                  if (!isTransitioningRef.current && currentPid && state?.is_playing && (!state?.context || !isPlayingPlaylist)) {
                      setTrack(null);
                      return;
                  }
              }

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
    isTransitioningRef.current = true;
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

          // Allow some time for Spotify state to update before polling checks take over
          setTimeout(() => {
              isTransitioningRef.current = false;
          }, 3000);
        } else {
          setIsPlaying(false);
          isTransitioningRef.current = false;
        }
      }
    } catch (e) {
      setError(e.message);
      isTransitioningRef.current = false;
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
        setExistingRating(rating);
        toast.success(
            <div className="flex flex-col gap-1">
                <span className="font-semibold text-green-400">Rated {rating}</span>
                <span className="text-zinc-400 text-xs">Removed from {config.playlistName}</span>
            </div>,
            { style: { background: '#18181b', border: '1px solid #27272a', color: '#fafafa' } }
        );
        onRatingComplete();
        // Do not auto-skip. Keep current track playing.
        setIsRating(false);
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

  const handleRemoveFromPlaylist = async () => {
    if (!track || !playlistId) return;
    try {
        await SpotifyAPI.removeTrackFromPlaylist(playlistId, track.trackId);
        setIsRemoved(true);
        toast.success("Removed from playlist", {
            style: { background: '#18181b', border: '1px solid #27272a', color: '#fafafa' }
        });
    } catch (e) {
        toast.error("Failed to remove");
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

  const openSheet = () => {
    window.open(`https://docs.google.com/spreadsheets/d/${config.sheetId}`, '_blank');
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
            <div className="flex-1 min-h-0 flex flex-col gap-3 items-center mb-3">
                <div
                    className="relative group shrink-0 w-full flex-1 min-h-0 flex justify-center items-center cursor-pointer"
                    onClick={() => setShowControls(!showControls)}
                >
                    <img 
                        src={track.albumArt || 'https://placehold.co/300x300/222/555?text=No+Art'} 
                        alt="Album Art" 
                        className="w-auto h-full max-h-full object-contain rounded-2xl shadow-2xl"
                    />

                    {/* Playback Controls Overlay */}
                    <div className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-all duration-300 flex items-center justify-center rounded-2xl gap-4 md:gap-6 z-20
                        ${showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none md:group-hover:opacity-100 md:group-hover:pointer-events-auto'}`}
                    >
                        {/* Genres */}
                        {genres.length > 0 && (
                            <div className="absolute top-4 left-0 right-0 flex justify-center gap-2 px-8 flex-wrap pointer-events-none">
                                {genres.map((g, i) => (
                                    <span key={i} className="text-[10px] uppercase tracking-wider bg-black/40 backdrop-blur-md text-white/90 px-2 py-1 rounded-full border border-white/10">
                                        {g}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Remove Button for Already Rated in Playlist Mode (Inside Overlay) */}
                        {mode === 'playlist' && existingRating && !isRemoved && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveFromPlaylist();
                                }}
                                className="absolute top-2 right-2 p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full transition-all shadow-lg pointer-events-auto"
                                title="Remove from playlist"
                            >
                                <Trash2 size={16} />
                            </button>
                        )}

                        <button 
                            onClick={(e) => { e.stopPropagation(); SpotifyAPI.previousTrack(); }}
                            className="p-2 md:p-3 hover:bg-white/20 active:scale-95 rounded-full text-white transition-all"
                        >
                            <SkipBack size={28} className="md:w-8 md:h-8" />
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); handlePlayPause(); }}
                            className="p-3 md:p-4 bg-white text-black rounded-full hover:scale-105 active:scale-95 transition-transform shadow-lg"
                        >
                            {isPlaying ? <Pause size={28} className="fill-black md:w-8 md:h-8" /> : <Play size={28} className="fill-black md:w-8 md:h-8" />}
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); SpotifyAPI.nextTrack(); }}
                            className="p-2 md:p-3 hover:bg-white/20 active:scale-95 rounded-full text-white transition-all"
                        >
                            <SkipForward size={28} className="md:w-8 md:h-8" />
                        </button>
                    </div>
                </div>
                
                <div className="shrink-0 w-full text-center">
                    <h2 className="text-lg md:text-3xl font-bold mb-1 leading-tight truncate">{track.songName}</h2>
                    <p className="text-zinc-400 text-sm md:text-xl mb-2 truncate">{track.artistName}</p>
                    
                    {existingRating && (
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-2 ${
                            existingRating >= 4.5 ? 'bg-green-900/30 text-green-400' :
                            existingRating >= 4.0 ? 'bg-blue-900/30 text-blue-400' :
                            existingRating >= 3.5 ? 'bg-blue-900/20 text-blue-300' :
                            existingRating >= 3.0 ? 'bg-zinc-800 text-zinc-400' :
                            existingRating >= 2.5 ? 'bg-orange-900/30 text-orange-400' :
                            existingRating >= 2.0 ? 'bg-orange-900/40 text-orange-500' :
                            'bg-red-950/30 text-red-500'
                        }`}>
                            <Star size={12} className={`${
                                existingRating >= 4.5 ? 'fill-green-400' :
                                existingRating >= 4.0 ? 'fill-blue-400' :
                                existingRating >= 3.5 ? 'fill-blue-300' :
                                existingRating >= 3.0 ? 'fill-zinc-400' :
                                existingRating >= 2.5 ? 'fill-orange-400' :
                                existingRating >= 2.0 ? 'fill-orange-500' :
                                'fill-red-500'
                            }`} />
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
                            <div className={`absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full transition-opacity shadow-lg ${showControls ? 'opacity-100' : 'opacity-0 md:group-hover:opacity-100'}`}></div>
                        </motion.div>
                    </div>
                    <div className="flex justify-between text-xs text-zinc-500 mb-2 font-mono">
                        <span>{formatTime(progress)}</span>
                        <span>{formatTime(duration)}</span>
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
                <div className="grid grid-cols-3 sm:grid-cols-9 gap-1.5 md:gap-2 mb-3">
                    {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((r) => {
                        const getSelectedColor = (rating) => {
                            if (rating === 5) return 'bg-green-500 text-black shadow-lg shadow-green-500/25';
                            if (rating === 4.5) return 'bg-green-400 text-black shadow-lg shadow-green-400/25';
                            if (rating === 4) return 'bg-blue-500 text-white shadow-lg shadow-blue-500/25';
                            if (rating === 3.5) return 'bg-blue-400 text-black shadow-lg shadow-blue-400/25';
                            if (rating === 3) return 'bg-zinc-500 text-white shadow-lg shadow-zinc-500/25';
                            if (rating === 2.5) return 'bg-orange-500 text-white shadow-lg shadow-orange-500/25';
                            if (rating === 2) return 'bg-orange-600 text-white shadow-lg shadow-orange-600/25';
                            return 'bg-red-600 text-white shadow-lg shadow-red-600/25';
                        };
                        
                        return (
                            <button
                                key={r}
                                onClick={() => handleRating(r)}
                                disabled={isLoading || isRating}
                                className={`
                                    py-2 px-0.5 rounded-lg font-bold text-xs md:text-sm transition-colors
                                    ${existingRating == r 
                                        ? getSelectedColor(r)
                                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'}
                                    ${isRating ? 'opacity-50 cursor-not-allowed' : ''}
                                `}
                            >
                                {r}
                            </button>
                        );
                    })}
                </div>
                
                <div className="flex justify-center gap-3 w-full md:w-auto">
                    <button 
                        onClick={openSpotify}
                        className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg transition-colors text-sm flex-1 md:flex-none justify-center"
                    >
                        <ExternalLink size={16} />
                        Open Spotify
                    </button>
                    <button
                        onClick={openSheet}
                        className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg transition-colors text-sm flex-1 md:flex-none justify-center"
                    >
                        <Table size={16} />
                        Open Sheet
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