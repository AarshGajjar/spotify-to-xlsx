import config from '../config';

const cleanTrackName = (name) => {
    if (!name) return '';
    return name
        .replace(/ - \d{4} Remaster/i, '')
        .replace(/ - Remastered \d{4}/i, '')
        .replace(/ - Remastered/i, '')
        .replace(/ \(Remastered\)/i, '')
        .replace(/ \[Remastered\]/i, '')
        .replace(/ \(feat\..*\)/i, '')
        .replace(/ - Live.*/i, '')
        .trim();
};

const LastFM = {
    baseUrl: 'https://ws.audioscrobbler.com/2.0/',

    async getTrackTags(artist, trackName) {
        console.log('[LastFM] API Key present:', !!config.lastFmApiKey);

        if (!config.lastFmApiKey) {
            console.warn('[LastFM] API key is missing');
            return [];
        }

        const cleanedTrackName = cleanTrackName(trackName);

        try {
            // Try track tags first
            const trackTags = await this.fetchTrackTags(artist, cleanedTrackName);
            
            if (trackTags.length > 0) {
                console.log('[LastFM] Found track tags:', trackTags);
                return trackTags;
            }

            // Fallback to artist tags if no track tags found
            console.log('[LastFM] No track tags found, trying artist tags...');
            const artistTags = await this.fetchArtistTags(artist);
            
            if (artistTags.length > 0) {
                console.log('[LastFM] Found artist tags:', artistTags);
                return artistTags;
            }

            console.log('[LastFM] No tags found for track or artist');
            return [];

        } catch (error) {
            console.error('[LastFM] API error:', error);
            return [];
        }
    },

    async fetchTrackTags(artist, trackName) {
        const params = new URLSearchParams({
            method: 'track.getTopTags',
            api_key: config.lastFmApiKey,
            artist: artist,
            track: trackName,
            format: 'json',
            autocorrect: 1
        });

        const url = `${this.baseUrl}?${params.toString()}`;
        console.log(`[LastFM] Fetching track tags for: ${artist} - ${trackName}`);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'SpotifyToXlsx/1.0.0'
            }
        });

        console.log('[LastFM] Track tags response status:', response.status);

        if (!response.ok) {
            console.error(`[LastFM] Track tags API error: ${response.status} ${response.statusText}`);
            return [];
        }

        const data = await response.json();
        console.log('[LastFM] Track tags raw response:', JSON.stringify(data).substring(0, 500));

        if (data.error) {
            console.warn('[LastFM] Track tags API returned error:', data.message);
            return [];
        }

        if (!data.toptags || !data.toptags.tag) {
            console.log('[LastFM] No track tags data found');
            return [];
        }

        return this.parseTags(data.toptags.tag);
    },

    async fetchArtistTags(artist) {
        const params = new URLSearchParams({
            method: 'artist.getTopTags',
            api_key: config.lastFmApiKey,
            artist: artist,
            format: 'json',
            autocorrect: 1
        });

        const url = `${this.baseUrl}?${params.toString()}`;
        console.log(`[LastFM] Fetching artist tags for: ${artist}`);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'SpotifyToXlsx/1.0.0'
            }
        });

        console.log('[LastFM] Artist tags response status:', response.status);

        if (!response.ok) {
            console.error(`[LastFM] Artist tags API error: ${response.status} ${response.statusText}`);
            return [];
        }

        const data = await response.json();
        console.log('[LastFM] Artist tags raw response:', JSON.stringify(data).substring(0, 500));

        if (data.error) {
            console.warn('[LastFM] Artist tags API returned error:', data.message);
            return [];
        }

        if (!data.toptags || !data.toptags.tag) {
            console.log('[LastFM] No artist tags data found');
            return [];
        }

        return this.parseTags(data.toptags.tag);
    },

    parseTags(tagsData) {
        let tags = [];
        if (Array.isArray(tagsData)) {
            tags = tagsData;
        } else if (tagsData && typeof tagsData === 'object') {
            tags = [tagsData];
        }

        const result = tags
            .map(tag => tag.name)
            .filter(name => name)
            .slice(0, 3);

        console.log('[LastFM] Parsed tags:', result);
        return result;
    }
};

export default LastFM;
