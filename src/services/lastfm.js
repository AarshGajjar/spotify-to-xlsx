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
            const params = new URLSearchParams({
                method: 'track.getTopTags',
                api_key: config.lastFmApiKey,
                artist: artist,
                track: cleanedTrackName,
                format: 'json',
                autocorrect: 1
            });

            const url = `${this.baseUrl}?${params.toString()}`;
            console.log(`[LastFM] Fetching tags for: ${artist} - ${cleanedTrackName}`);

            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'SpotifyToXlsx/1.0.0'
                }
            });

            console.log('[LastFM] Response status:', response.status);

            if (!response.ok) {
                 console.error(`[LastFM] API error: ${response.status} ${response.statusText}`);
                 return [];
            }

            const data = await response.json();
            console.log('[LastFM] Raw response:', JSON.stringify(data).substring(0, 500));

            if (data.error) {
                console.warn('[LastFM] API returned error:', data.message);
                return [];
            }

            if (!data.toptags) {
                console.log('[LastFM] No tags data found for:', cleanedTrackName);
                return [];
            }

            const tagsData = data.toptags.tag;
            console.log('[LastFM] tagsData type:', typeof tagsData, 'isArray:', Array.isArray(tagsData));
            console.log('[LastFM] toptags object:', JSON.stringify(data.toptags));
            console.log('[LastFM] tagsData:', JSON.stringify(tagsData));

            let tags = [];
            if (Array.isArray(tagsData)) {
                tags = tagsData;
            } else if (tagsData && typeof tagsData === 'object') {
                tags = [tagsData];
            }

            console.log('[LastFM] parsed tags:', JSON.stringify(tags));

            const result = tags
                .map(tag => tag.name)
                .filter(name => name)
                .slice(0, 3);

            console.log('[LastFM] Tags found:', result);
            return result;

        } catch (error) {
            console.error('[LastFM] API error:', error);
            return [];
        }
    }
};

export default LastFM;
