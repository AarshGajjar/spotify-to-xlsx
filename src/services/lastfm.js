import config from '../config';

const LastFM = {
    baseUrl: 'https://ws.audioscrobbler.com/2.0/',

    async getTrackInfo(artist, trackName) {
        if (!config.lastFmApiKey) {
            return [];
        }

        try {
            const params = new URLSearchParams({
                method: 'track.getInfo',
                api_key: config.lastFmApiKey,
                artist: artist,
                track: trackName,
                format: 'json',
                autocorrect: 1
            });

            const url = `${this.baseUrl}?${params.toString()}`;
            const response = await fetch(url);

            if (!response.ok) {
                 return [];
            }

            const data = await response.json();

            if (data.error || !data.track || !data.track.toptags) {
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
