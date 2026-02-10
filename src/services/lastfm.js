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

    async getTrackInfo(artist, trackName) {
        if (!config.lastFmApiKey) {
            console.warn('Last.fm API key is missing');
            return [];
        }

        const cleanedTrackName = cleanTrackName(trackName);

        try {
            const params = new URLSearchParams({
                method: 'track.getInfo',
                api_key: config.lastFmApiKey,
                artist: artist,
                track: cleanedTrackName,
                format: 'json',
                autocorrect: 1
            });

            const url = `${this.baseUrl}?${params.toString()}`;
            console.log(`Fetching Last.fm tags for: ${artist} - ${cleanedTrackName} (original: ${trackName})`);

            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'SpotifyToXlsx/1.0.0'
                }
            });

            if (!response.ok) {
                 console.error(`Last.fm API error: ${response.status} ${response.statusText}`);
                 return [];
            }

            const data = await response.json();

            if (data.error) {
                console.warn('Last.fm API returned error:', data.message);
                return [];
            }

            if (!data.track || !data.track.toptags) {
                console.log('No tags found for track:', trackName);
                return [];
            }

            const tagsData = data.track.toptags.tag;

            let tags = [];
            if (Array.isArray(tagsData)) {
                tags = tagsData;
            } else if (tagsData && typeof tagsData === 'object') {
                tags = [tagsData];
            }

            return tags
                .map(tag => tag.name)
                .filter(name => name)
                .slice(0, 3);

        } catch (error) {
            console.error('Last.fm API error:', error);
            return [];
        }
    }
};

export default LastFM;
