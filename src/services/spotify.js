import Auth from './auth';

const SpotifyAPI = {
  baseUrl: 'https://api.spotify.com/v1',
  playlistId: null,

  async request(endpoint, options = {}) {
    const token = await Auth.getSpotifyToken();
    const defaultOptions = {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `Spotify API error: ${response.status}`);
    }

    if (response.status === 204) return null;
    
    // Don't parse JSON if explicitly disabled
    if (options.parseJson === false) return null;
    
    return response.json();
  },

  async findPlaylistByName(playlistName) {
    if (this.playlistId) return this.playlistId;

    let offset = 0;
    const limit = 50;
    while (true) {
      const data = await this.request(`/me/playlists?limit=${limit}&offset=${offset}`);
      const playlist = data.items.find((p) => p.name === playlistName);
      if (playlist) {
        this.playlistId = playlist.id;
        return this.playlistId;
      }
      if (data.items.length < limit) break;
      offset += limit;
    }
    throw new Error(`Playlist "${playlistName}" not found`);
  },

  async getFirstTrackFromPlaylist(playlistId) {
    const data = await this.request(`/playlists/${playlistId}/tracks?limit=1&offset=0`);
    if (!data.items || data.items.length === 0) return null;
    return this.formatTrackData(data.items[0].track);
  },
  
  async getPlaylistTrackCount(playlistId) {
      const data = await this.request(`/playlists/${playlistId}?fields=tracks.total`);
      return data.tracks.total;
  },

  async getCurrentlyPlaying() {
    try {
      const data = await this.request('/me/player/currently-playing');
      if (!data || !data.item) return null;
      return this.formatTrackData(data.item);
    } catch (error) {
       // Ignore 404 or just return null
       return null;
    }
  },

  async getPlaybackState() {
    try {
        return await this.request('/me/player');
    } catch(e) { return null; }
  },

  async togglePlayback() {
    const state = await this.getPlaybackState();
    if (!state) throw new Error('No active device found');
    if (state.is_playing) {
      await this.request('/me/player/pause', { method: 'PUT', parseJson: false });
    } else {
      await this.request('/me/player/play', { method: 'PUT', parseJson: false });
    }
  },

  async nextTrack() {
    await this.request('/me/player/next', { method: 'POST', parseJson: false });
  },

  async previousTrack() {
    await this.request('/me/player/previous', { method: 'POST', parseJson: false });
  },
  
  async playTrack(trackId, contextUri = null, offset = null) {
      const body = { uris: [`spotify:track:${trackId}`] };
      if (contextUri) {
          body.context_uri = contextUri;
          delete body.uris;
          if (offset !== null) {
              body.offset = { position: offset };
          }
      }
      await this.request('/me/player/play', { method: 'PUT', body: JSON.stringify(body), parseJson: false });
  },

  async seek(positionMs) {
    await this.request(`/me/player/seek?position_ms=${Math.floor(positionMs)}`, { method: 'PUT', parseJson: false });
  },

  async setShuffle(state) {
    await this.request(`/me/player/shuffle?state=${state}`, { method: 'PUT', parseJson: false });
  },

  async removeTrackFromPlaylist(playlistId, trackId) {
    await this.request(`/playlists/${playlistId}/tracks`, {
      method: 'DELETE',
      body: JSON.stringify({ tracks: [{ uri: `spotify:track:${trackId}` }] }),
    });
  },

  formatTrackData(track) {
    if (!track) return null;
    return {
      trackId: track.id,
      songName: track.name,
      artistName: track.artists?.[0]?.name || 'Unknown Artist',
      albumArt: track.album?.images?.[0]?.url || null,
      uri: track.uri
    };
  },
};

export default SpotifyAPI;
