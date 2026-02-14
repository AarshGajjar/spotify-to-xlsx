import config from '../config';

const Auth = {
  spotifyAccessToken: null,
  spotifyTokenExpiry: null,
  spotifyRefreshToken: null,
  googleAccessToken: null,
  googleTokenExpiry: null,
  googleTokenClient: null,
  googleTokenPromise: null,
  googleRefreshTimer: null,
  listeners: [],

  init() {
    console.log('[Auth] Initializing...');
    this.restoreTokens();
    this.initGoogleAuth();
    this.handleCallback();
    this.startGoogleTokenRefreshTimer();
  },

  subscribe(callback) {
      this.listeners.push(callback);
      callback(this.getAuthState());
      return () => {
          this.listeners = this.listeners.filter(l => l !== callback);
      };
  },

  async handleCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (code) {
      try {
        await this.exchangeCodeForToken(code);
        window.history.replaceState({}, document.title, window.location.pathname);
        this.notifyAuthChange();
      } catch (error) {
        console.error('Failed to exchange code:', error);
      }
    }
  },

  restoreTokens() {
    console.log('[Auth] Restoring tokens...');
    const spotifyToken = localStorage.getItem('spotify_token');
    const spotifyExpiry = localStorage.getItem('spotify_expiry');
    const spotifyRefreshToken = localStorage.getItem('spotify_refresh_token');

    this.spotifyRefreshToken = spotifyRefreshToken;

    if (spotifyToken && spotifyExpiry && Date.now() < parseInt(spotifyExpiry)) {
      this.spotifyAccessToken = spotifyToken;
      this.spotifyTokenExpiry = parseInt(spotifyExpiry);
      console.log('[Auth] Spotify token restored, expires:', new Date(this.spotifyTokenExpiry).toLocaleString());
    } else {
      console.log('[Auth] Spotify token expired or not found');
    }

    const googleToken = localStorage.getItem('google_token');
    const googleExpiry = localStorage.getItem('google_expiry');

    if (googleToken) {
      this.googleAccessToken = googleToken;
      this.googleTokenExpiry = googleExpiry ? parseInt(googleExpiry) : 0;
      if (googleExpiry && Date.now() < parseInt(googleExpiry)) {
        console.log('[Auth] Google token restored, expires:', new Date(this.googleTokenExpiry).toLocaleString());
      } else {
        console.log('[Auth] Google token restored (expired)');
      }
    } else {
      console.log('[Auth] Google token not found');
    }
    this.notifyAuthChange();
  },

  startGoogleTokenRefreshTimer() {
    // Clear any existing timer
    if (this.googleRefreshTimer) {
      clearInterval(this.googleRefreshTimer);
    }

    // Check every minute if token needs refresh (refresh 5 minutes before expiry)
    this.googleRefreshTimer = setInterval(() => {
      if (this.googleAccessToken && this.googleTokenExpiry) {
        const timeUntilExpiry = this.googleTokenExpiry - Date.now();
        const fiveMinutes = 5 * 60 * 1000;

        console.log(`[Auth] Google token check: expires in ${Math.round(timeUntilExpiry / 1000)}s`);

        if (timeUntilExpiry < fiveMinutes && timeUntilExpiry > 0) {
          console.log('[Auth] Proactively refreshing Google token...');
          this.refreshGoogleTokenSilently().catch(err => {
            console.log('[Auth] Silent refresh failed, will retry on next API call:', err.message);
          });
        }
      }
    }, 60000); // Check every minute

    console.log('[Auth] Google token refresh timer started');
  },

  async refreshGoogleTokenSilently() {
    if (!this.googleTokenClient) {
      throw new Error('Google client not initialized');
    }

    // Use Google's built-in method to refresh the token
    return new Promise((resolve, reject) => {
      const originalCallback = this.googleTokenClient.callback;

      this.googleTokenClient.callback = (response) => {
        // Restore original callback
        this.googleTokenClient.callback = originalCallback;

        if (response.error) {
          console.error('[Auth] Google silent refresh error:', response.error);
          reject(new Error(response.error));
          return;
        }

        if (response.access_token) {
          this.googleAccessToken = response.access_token;
          const expiresIn = response.expires_in || 3600;
          this.googleTokenExpiry = Date.now() + expiresIn * 1000;

          localStorage.setItem('google_token', this.googleAccessToken);
          localStorage.setItem('google_expiry', this.googleTokenExpiry);
          console.log('[Auth] Google token refreshed silently, expires in', expiresIn, 'seconds');
          this.notifyAuthChange();
          resolve(this.googleAccessToken);
        } else {
          reject(new Error('No access token received'));
        }
      };

      // Request new token with prompt=none for silent refresh if possible
      // Note: Google's token client doesn't support prompt param directly,
      // but calling requestAccessToken when already authorized often works silently
      try {
        this.googleTokenClient.requestAccessToken({ prompt: '' });
      } catch (e) {
        // Fallback: try without options
        this.googleTokenClient.requestAccessToken();
      }
    });
  },

  initGoogleAuth() {
    if (window.google) {
      console.log('[Auth] Initializing Google auth client...');
      this.googleTokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: config.googleClientId,
        scope: config.googleScopes,
        callback: (response) => {
          console.log('[Auth] Google token callback received:', response.error ? 'error' : 'success');
          if (response.error) {
            console.error('[Auth] Google auth error:', response.error, response.error_description);
            if (this.googleTokenReject) {
               this.googleTokenReject(new Error(response.error_description || response.error));
               this.googleTokenResolve = null;
               this.googleTokenReject = null;
               this.googleTokenPromise = null;
            }
            return;
          }
          if (response.access_token) {
            this.googleAccessToken = response.access_token;
            const expiresIn = response.expires_in || 3600;
            this.googleTokenExpiry = Date.now() + expiresIn * 1000;

            localStorage.setItem('google_token', this.googleAccessToken);
            localStorage.setItem('google_expiry', this.googleTokenExpiry);
            console.log('[Auth] Google token saved, expires in', expiresIn, 'seconds');
            this.notifyAuthChange();

            if (this.googleTokenResolve) {
                this.googleTokenResolve(this.googleAccessToken);
                this.googleTokenResolve = null;
                this.googleTokenPromise = null;
            }
          } else {
            console.error('[Auth] No access_token in Google response');
            if (this.googleTokenReject) {
               this.googleTokenReject(new Error('Failed to get Google token'));
               this.googleTokenResolve = null;
               this.googleTokenReject = null;
               this.googleTokenPromise = null;
            }
          }
        },
        error_callback: (error) => {
          console.error('[Auth] Google auth error_callback:', error);
          if (this.googleTokenReject) {
             this.googleTokenReject(error);
             this.googleTokenResolve = null;
             this.googleTokenReject = null;
             this.googleTokenPromise = null;
          }
        }
      });
      console.log('[Auth] Google auth client initialized');
    } else {
      console.log('[Auth] Google API not loaded yet, retrying...');
      setTimeout(() => this.initGoogleAuth(), 100);
    }
  },

  async loginSpotify() {
    const codeVerifier = this.generateRandomString(128);
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);
    const state = this.generateRandomString(16);

    localStorage.setItem('spotify_code_verifier', codeVerifier);
    localStorage.setItem('spotify_auth_state', state);

    const params = new URLSearchParams({
      client_id: config.spotifyClientId,
      response_type: 'code',
      redirect_uri: config.redirectUri,
      state: state,
      scope: config.spotifyScopes,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
    });

    window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
  },

  async generateCodeChallenge(codeVerifier) {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  },

  async exchangeCodeForToken(code) {
    const codeVerifier = localStorage.getItem('spotify_code_verifier');

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.spotifyClientId,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: config.redirectUri,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code for token');
    }

    const data = await response.json();
    this.spotifyAccessToken = data.access_token;
    const expiresIn = data.expires_in || 3600;
    this.spotifyTokenExpiry = Date.now() + expiresIn * 1000;

    if (data.refresh_token) {
        this.spotifyRefreshToken = data.refresh_token;
        localStorage.setItem('spotify_refresh_token', this.spotifyRefreshToken);
    }

    localStorage.setItem('spotify_token', this.spotifyAccessToken);
    localStorage.setItem('spotify_expiry', this.spotifyTokenExpiry);
    localStorage.removeItem('spotify_code_verifier');
  },

  async refreshSpotifyToken() {
    if (!this.spotifyRefreshToken) {
        throw new Error('No refresh token available');
    }

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.spotifyClientId,
        grant_type: 'refresh_token',
        refresh_token: this.spotifyRefreshToken,
      }),
    });

    if (!response.ok) {
        this.logout();
        throw new Error('Failed to refresh Spotify token');
    }

    const data = await response.json();
    this.spotifyAccessToken = data.access_token;
    const expiresIn = data.expires_in || 3600;
    this.spotifyTokenExpiry = Date.now() + expiresIn * 1000;

    if (data.refresh_token) {
        this.spotifyRefreshToken = data.refresh_token;
        localStorage.setItem('spotify_refresh_token', this.spotifyRefreshToken);
    }

    localStorage.setItem('spotify_token', this.spotifyAccessToken);
    localStorage.setItem('spotify_expiry', this.spotifyTokenExpiry);

    this.notifyAuthChange();
    return this.spotifyAccessToken;
  },

  loginGoogle() {
    console.log('[Auth] loginGoogle called, client:', !!this.googleTokenClient);
    if (this.googleTokenClient) {
      if (this.googleTokenPromise) return this.googleTokenPromise;

      this.googleTokenPromise = new Promise((resolve, reject) => {
          this.googleTokenResolve = resolve;
          this.googleTokenReject = reject;
          console.log('[Auth] Requesting Google access token...');
          this.googleTokenClient.requestAccessToken();
      });
      return this.googleTokenPromise;
    }
    return Promise.reject(new Error('Google client not initialized'));
  },

  async getGoogleToken(authOptions = { autoLogin: true }) {
    console.log('[Auth] getGoogleToken called, current token exists:', !!this.googleAccessToken, 'autoLogin:', authOptions.autoLogin);
    if (!this.googleAccessToken || Date.now() >= this.googleTokenExpiry) {
      console.log('[Auth] Google token expired or missing, requesting new one...');
      // Try silent refresh first, then interactive login
      if (this.googleTokenClient) {
        try {
          return await this.refreshGoogleTokenSilently();
        } catch (silentError) {
          console.log('[Auth] Silent refresh failed:', silentError.message);

          if (authOptions.autoLogin) {
             console.log('[Auth] Trying interactive login...');
             return await this.loginGoogle();
          } else {
             console.log('[Auth] Auto login disabled, throwing error');
             throw new Error('GoogleAuthRequired');
          }
        }
      }
      throw new Error('Google token expired or not available');
    }

    // Check if token expires soon (within 5 minutes) and refresh proactively
    const timeUntilExpiry = this.googleTokenExpiry - Date.now();
    if (timeUntilExpiry < 5 * 60 * 1000) {
      console.log('[Auth] Google token expires soon, refreshing...');
      try {
        return await this.refreshGoogleTokenSilently();
      } catch (e) {
        console.log('[Auth] Proactive refresh failed, using existing token');
      }
    }

    console.log('[Auth] Returning existing Google token');
    return this.googleAccessToken;
  },

  isAuthenticated() {
    return this.isSpotifyAuthenticated() && this.isGoogleAuthenticated();
  },

  isSpotifyAuthenticated() {
    return !!((this.spotifyAccessToken && Date.now() < this.spotifyTokenExpiry) || this.spotifyRefreshToken);
  },

  isGoogleAuthenticated() {
    // Check if token exists and is not expired
    const isAuth = !!this.googleAccessToken && Date.now() < this.googleTokenExpiry;
    // console.log('[Auth] isGoogleAuthenticated:', isAuth, 'token exists:', !!this.googleAccessToken, 'expiry:', this.googleTokenExpiry ? new Date(this.googleTokenExpiry).toLocaleString() : 'none');
    return isAuth;
  },

  async getSpotifyToken() {
    if (!this.spotifyAccessToken || Date.now() >= this.spotifyTokenExpiry) {
        if (this.spotifyRefreshToken) {
            return await this.refreshSpotifyToken();
        }
        throw new Error('Spotify token expired or not available');
    }
    return this.spotifyAccessToken;
  },


  getAuthState() {
      return {
        spotify: this.isSpotifyAuthenticated(),
        google: this.isGoogleAuthenticated(),
        all: this.isAuthenticated(),
      };
  },

  generateRandomString(length) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let text = '';
    for (let i = 0; i < length; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  },

  notifyAuthChange() {
    const state = this.getAuthState();
    console.log('[Auth] State changed:', state);
    this.listeners.forEach(listener => listener(state));
  },

  logout() {
      this.spotifyAccessToken = null;
      this.spotifyTokenExpiry = null;
      this.spotifyRefreshToken = null;
      this.googleAccessToken = null;
      this.googleTokenExpiry = null;
      if (this.googleRefreshTimer) {
        clearInterval(this.googleRefreshTimer);
        this.googleRefreshTimer = null;
      }
      localStorage.clear();
      this.notifyAuthChange();
  }
};

export default Auth;
