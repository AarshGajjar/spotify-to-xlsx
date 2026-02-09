import Auth from './auth';
import config from '../config';

const SheetsAPI = {
  baseUrl: 'https://sheets.googleapis.com/v4/spreadsheets',
  cache: null,

  async request(endpoint, options = {}) {
    const token = await Auth.getGoogleToken();
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
      throw new Error(error.error?.message || `Google Sheets API error: ${response.status}`);
    }

    return response.json();
  },

  async readAllRows() {
    const range = `${config.sheetId}/values/${config.sheetName || 'Sheet1'}!A2:E`;
    const data = await this.request(`/${range}`); // Use range directly in path for cleaner URL construction if possible, but standard is /ID/values/Range
    // Actually the logic in previous file was: `/${CONFIG.SHEET_ID}/values/${encodeURIComponent(range)}`
    
    // Correct URL construction
    const rangeParam = `${config.sheetName || 'Sheet1'}!A2:E`;
    // We'll just call the previous method's logic
    return this.readAllRowsInternal(rangeParam);
  },
  
  async readAllRowsInternal(range) {
      const data = await this.request(`/${config.sheetId}/values/${encodeURIComponent(range)}`);
      
      const rows = (data.values || []).map((row, index) => ({
          rowNumber: index + 2,
          trackId: row[0] || '',
          artist: row[1] || '',
          song: row[2] || '',
          rating: row[3] || '',
          dateRated: row[4] || ''
      }));
      this.cache = rows;
      return rows;
  },

  async findTrackById(trackId) {
    if (!this.cache) await this.readAllRows();
    return this.cache.find((row) => row.trackId === trackId);
  },

  async saveRating(trackId, artist, song, rating) {
    const existingTrack = await this.findTrackById(trackId);
    if (existingTrack) {
      await this.updateRow(existingTrack.rowNumber, rating);
    } else {
      await this.appendRow(trackId, artist, song, rating);
    }
  },

  async appendRow(trackId, artist, song, rating) {
    const dateRated = this.formatDateTime(new Date());
    const range = `${config.sheetName || 'Sheet1'}!A:E`;
    
    await this.request(`/${config.sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW`, {
      method: 'POST',
      body: JSON.stringify({
        values: [[trackId, artist, song, rating, dateRated]],
      }),
    });
    
    // Update local cache optimistically
    if(this.cache) {
        this.cache.push({
            rowNumber: this.cache.length + 2,
            trackId, artist, song, rating, dateRated
        })
    }
  },

  async updateRow(rowNumber, rating) {
    const dateRated = this.formatDateTime(new Date());
    const range = `${config.sheetName || 'Sheet1'}!D${rowNumber}:E${rowNumber}`;
    
    await this.request(`/${config.sheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
      method: 'PUT',
      body: JSON.stringify({
        values: [[rating, dateRated]],
      }),
    });
    
    if(this.cache) {
        const row = this.cache.find(r => r.rowNumber === rowNumber);
        if(row) {
            row.rating = rating;
            row.dateRated = dateRated;
        }
    }
  },

  async getStats() {
    if (!this.cache) await this.readAllRows();

    // FIX: Use local date string for comparison to match how it's stored
    const today = this.formatDateTime(new Date()).split(' ')[0]; 

    const stats = {
      total: this.cache.filter((row) => row.rating !== '').length,
      today: this.cache.filter((row) => {
        if (!row.dateRated) return false;
        const rowDate = row.dateRated.split(' ')[0];
        return rowDate === today;
      }).length,
      distribution: {
          1: 0, 1.5: 0, 2: 0, 2.5: 0, 3: 0, 3.5: 0, 4: 0, 4.5: 0, 5: 0
      }
    };
    
    // Calculate distribution and gather artist data
    let totalRating = 0;
    const artistCounts = {};

    this.cache.forEach(row => {
        if (row.rating) {
            const r = parseFloat(row.rating);
            if (stats.distribution[r] !== undefined) {
                stats.distribution[r]++;
            }
            totalRating += r;

            if (row.artist) {
                artistCounts[row.artist] = (artistCounts[row.artist] || 0) + 1;
            }
        }
    });

    stats.averageRating = stats.total > 0 ? (totalRating / stats.total).toFixed(2) : 0;

    stats.topArtists = Object.entries(artistCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

    return stats;
  },

  formatDateTime(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  },
};

export default SheetsAPI;
