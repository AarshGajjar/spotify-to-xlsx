const config = {
  spotifyClientId: import.meta.env.VITE_SPOTIFY_CLIENT_ID,
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
  sheetId: import.meta.env.VITE_SHEET_ID,
  playlistName: import.meta.env.VITE_PLAYLIST_NAME,
  lastFmApiKey: import.meta.env.VITE_LASTFM_API_KEY,
  redirectUri: window.location.origin + window.location.pathname.replace(/\/$/, '') + '/',
  spotifyScopes: [
    'playlist-read-private',
    'playlist-modify-private',
    'playlist-modify-public',
    'user-read-playback-state',
    'user-read-currently-playing',
    'user-modify-playback-state'
  ].join(' '),
  googleScopes: 'https://www.googleapis.com/auth/spreadsheets'
};

export default config;
