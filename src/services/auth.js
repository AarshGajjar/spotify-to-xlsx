import config from '../config';

const Auth = {
  spotifyAccessToken: null,
  spotifyTokenExpiry: null,
  googleAccessToken: null,
  googleTokenClient: null,
  listeners: [],

  init() {
    this.restoreTokens();
    this.initGoogleAuth();
    this.handleCallback();
  },
  
  subscribe(callback) {
      this.listeners.push(callback);
      // Immediately invoke with current state
      callback(this.getAuthState());
      
      // Return unsubscribe function
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
    const spotifyToken = sessionStorage.getItem('spotify_token');
    const spotifyExpiry = sessionStorage.getItem('spotify_expiry');

    if (spotifyToken && spotifyExpiry && Date.now() < parseInt(spotifyExpiry)) {
      this.spotifyAccessToken = spotifyToken;
      this.spotifyTokenExpiry = parseInt(spotifyExpiry);
    }

    const googleToken = sessionStorage.getItem('google_token');
    if (googleToken) {
      this.googleAccessToken = googleToken;
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
            sessionStorage.setItem('google_token', this.googleAccessToken);
            this.notifyAuthChange();
          }
        },
      });
    } else {
      // Retry if script hasn't loaded
      setTimeout(() => this.initGoogleAuth(), 100);
    }
  },

  async loginSpotify() {
    const codeVerifier = this.generateRandomString(128);
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);
    const state = this.generateRandomString(16);

    localStorage.setItem('spotify_code_verifier', codeVerifier);
    sessionStorage.setItem('spotify_auth_state', state);

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

    sessionStorage.setItem('spotify_token', this.spotifyAccessToken);
    sessionStorage.setItem('spotify_expiry', this.spotifyTokenExpiry);
    localStorage.removeItem('spotify_code_verifier');
  },

  loginGoogle() {
    if (this.googleTokenClient) {
      this.googleTokenClient.requestAccessToken();
    }
  },

  isAuthenticated() {
    return this.isSpotifyAuthenticated() && this.isGoogleAuthenticated();
  },

  isSpotifyAuthenticated() {
    return !!(this.spotifyAccessToken && Date.now() < this.spotifyTokenExpiry);
  },

  isGoogleAuthenticated() {
    return !!this.googleAccessToken;
  },

  getSpotifyToken() {
    if (!this.isSpotifyAuthenticated()) {
      throw new Error('Spotify token expired or not available');
    }
    return this.spotifyAccessToken;
  },

  getGoogleToken() {
    if (!this.isGoogleAuthenticated()) {
      throw new Error('Google token not available');
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
      this.googleAccessToken = null;
      sessionStorage.clear();
      this.notifyAuthChange();
  }
};

export default Auth;