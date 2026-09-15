/* ══════════════════════════════════════════════════════════════════════════
   Slurpee Map Thailand — service worker
   Caches the PMTiles basemap (data/basemap.pmtiles) in the Cache Storage API
   so repeat visits reuse tile bytes already on disk instead of re-issuing the
   same HTTP Range requests over the network. localStorage cannot hold this
   (5-10 MB, string-only, synchronous); Cache Storage is built for exactly
   this — large binary responses, origin-scoped, persistent across sessions.

   protomaps-leaflet reads the archive with `Range: bytes=start-end` requests
   (see PMTILES_URL in app.js), so each distinct byte range is cached under
   its own key (url + range) rather than trying to cache/slice one giant
   response — no need to download the whole 80 MB file up front, only the
   tiles a visitor actually views, once each, ever.

   Bump CACHE_NAME (matches the app's own slurpee_vN_ convention) whenever
   data/basemap.pmtiles is rebuilt, so stale cached ranges don't outlive it. */

var CACHE_NAME = 'slurpee_v1_pmtiles';
var CACHEABLE_SUFFIX = '/data/basemap.pmtiles';

function isCacheable(url) {
  try {
    return new URL(url).pathname.endsWith(CACHEABLE_SUFFIX);
  } catch (e) {
    return false;
  }
}

self.addEventListener('install', function (event) {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        return key === CACHE_NAME ? null : caches.delete(key);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET' || !isCacheable(req.url)) return;

  var range = req.headers.get('range') || 'full';
  var cacheKey = req.url + '#' + range;

  event.respondWith(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.match(cacheKey).then(function (hit) {
        if (hit) return hit;
        return fetch(req).then(function (res) {
          // Only cache clean 200/206 responses — never an error or opaque one.
          if (res.ok) cache.put(cacheKey, res.clone());
          return res;
        });
      });
    }).catch(function () {
      return fetch(req);
    })
  );
});
