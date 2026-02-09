import config from '../config';

const Auth = {
  spotifyAccessToken: null,
  spotifyTokenExpiry: null,
  spotifyRefreshToken: null,
  googleAccessToken: null,
  googleTokenExpiry: null,
  googleTokenClient: null,
  googleTokenPromise: null,
  listeners: [],

  init() {
    this.restoreTokens();
    this.initGoogleAuth();
    this.handleCallback();
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
    const spotifyToken = localStorage.getItem('spotify_token');
    const spotifyExpiry = localStorage.getItem('spotify_expiry');
    const spotifyRefreshToken = localStorage.getItem('spotify_refresh_token');

    this.spotifyRefreshToken = spotifyRefreshToken;

    if (spotifyToken && spotifyExpiry && Date.now() < parseInt(spotifyExpiry)) {
      this.spotifyAccessToken = spotifyToken;
      this.spotifyTokenExpiry = parseInt(spotifyExpiry);
    }

    const googleToken = localStorage.getItem('google_token');
    const googleExpiry = localStorage.getItem('google_expiry');

    if (googleToken && googleExpiry && Date.now() < parseInt(googleExpiry)) {
      this.googleAccessToken = googleToken;
      this.googleTokenExpiry = parseInt(googleExpiry);
    } else {
      localStorage.removeItem('google_token');
      localStorage.removeItem('google_expiry');
    }
    this.notifyAuthChange();
  },

  initGoogleAuth() {
    if (window.google) {
      this.googleTokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: config.googleClientId,
        scope: config.googleScopes,
        callback: (response) => {
          if (response.access_token) {
            this.googleAccessToken = response.access_token;
            const expiresIn = response.expires_in || 3600;
            this.googleTokenExpiry = Date.now() + expiresIn * 1000;

            localStorage.setItem('google_token', this.googleAccessToken);
            localStorage.setItem('google_expiry', this.googleTokenExpiry);
            this.notifyAuthChange();

            if (this.googleTokenResolve) {
                this.googleTokenResolve(this.googleAccessToken);
                this.googleTokenResolve = null;
                this.googleTokenPromise = null;
            }
          } else if (this.googleTokenReject) {
             this.googleTokenReject(new Error('Failed to get Google token'));
             this.googleTokenResolve = null;
             this.googleTokenReject = null;
             this.googleTokenPromise = null;
          }
        },
      });
    } else {
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
    if (this.googleTokenClient) {
      if (this.googleTokenPromise) return this.googleTokenPromise;

      this.googleTokenPromise = new Promise((resolve, reject) => {
          this.googleTokenResolve = resolve;
          this.googleTokenReject = reject;
          this.googleTokenClient.requestAccessToken();
      });
      return this.googleTokenPromise;
    }
    return Promise.reject(new Error('Google client not initialized'));
  },

  isAuthenticated() {
    return this.isSpotifyAuthenticated() && this.isGoogleAuthenticated();
  },

  isSpotifyAuthenticated() {
    return !!((this.spotifyAccessToken && Date.now() < this.spotifyTokenExpiry) || this.spotifyRefreshToken);
  },

  isGoogleAuthenticated() {
    return !!(this.googleAccessToken && Date.now() < this.googleTokenExpiry);
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

  async getGoogleToken() {
    if (!this.googleAccessToken || Date.now() >= this.googleTokenExpiry) {
      // Try to refresh (login again)
      if (this.googleTokenClient) {
          return await this.loginGoogle();
      }
      throw new Error('Google token expired or not available');
    }
    return this.googleAccessToken;
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
    this.listeners.forEach(listener => listener(state));
  },
  
  logout() {
      this.spotifyAccessToken = null;
      this.spotifyTokenExpiry = null;
      this.spotifyRefreshToken = null;
      this.googleAccessToken = null;
      this.googleTokenExpiry = null;
      localStorage.clear();
      this.notifyAuthChange();
  }
};

export default Auth;