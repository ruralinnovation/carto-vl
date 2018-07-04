import DataframeCache from './DataframeCache';

export default class TileClient {
    constructor(templateURLs) {
        if (!Array.isArray(templateURLs)) {
            templateURLs = [templateURLs];
        }
        this._templateURLs = templateURLs;
        this._requestGroupID = 0;
        this._cache = new DataframeCache();

    }

    getTiles(tiles) {
        return tiles.map(({ x, y, z }) => ({ response: this._getTile(x, y, z), xyz: { x, y, z } }));
    }

    _getTile(x, y, z) {
        return fetch(this._getTileUrl(x, y, z));
    }

    _getTileUrl(x, y, z) {
        const subdomainIndex = this._getSubdomainIndex(x, y);
        return this._templateURLs[subdomainIndex].replace('{x}', x).replace('{y}', y).replace('{z}', z);
    }

    _getSubdomainIndex(x, y) {
        // Reference https://github.com/Leaflet/Leaflet/blob/v1.3.1/src/layer/tile/TileLayer.js#L214-L217
        return Math.abs(x + y) % this._templateURLs.length;
    }
}
