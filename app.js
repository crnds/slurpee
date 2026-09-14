/* ══════════════════════════════════════════════════════════════════════════
   Slurpee Map Thailand — application logic
   Data comes from data/stores.js (window.SLURPEE_STORES), built by
   fetch_stores.py. No modules, no build step: plain script, single STATE.
   ══════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── CONSTANTS ───────────────────────────────────────────────────────────

  var THAILAND = [[5.6, 97.3], [20.5, 105.7]];
  var LIST_LIMIT = 150;        // rows rendered at once; the map shows them all
  var LIST_FIRST = 40;         // rows painted immediately; the rest land on idle
  var SEARCH_DEBOUNCE = 150;
  var CULL_DEBOUNCE = 120;     // re-cull offscreen pins this long after a pan
  var PIN_MIN_ZOOM = 11;       // below this, branches draw as canvas dots
  var STORAGE = {
    province: 'slurpee_v1_province',
    confirmed: 'slurpee_v1_confirmedonly',
    layer: 'slurpee_v1_layer'
  };

  var OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  /* Both basemaps are the same Thailand extract of the Protomaps OpenStreetMap
     basemap, served from this project's own data/ directory and drawn in two
     different flavours. No API key, no rate limit, no third party in the
     request path at all. It is a PMTiles archive read with HTTP range
     requests, so it needs a server that honours Range: serve.py does,
     `python3 -m http.server` does not, and file:// cannot. GitHub Pages does,
     which is what lets the deployed site use the same file.

     Every hosted alternative was tried and rejected: Stadia 401s without a paid
     key, CARTO returns "API KEY REQUIRED" watermark tiles, and OpenStreetMap's
     own tile.openstreetmap.org serves "Access blocked — app is not following
     the tile usage policy" 403s to a browser it cannot identify. Hosting the
     data ourselves is the only arrangement nobody can switch off.

     data/basemap.pmtiles is committed so GitHub Pages can serve it, which caps
     it at GitHub's 100 MB per-file limit. That is what fixes maxzoom at 12: the
     same extract measures 168 MB at z13 and 469 MB at z14. Trading z13-14 away
     costs buildings, POIs and minor streets — a branch viewed at z16 sits on an
     overzoomed basemap — and it is the price of keeping the map in the repo.

     Rebuild with a recent Protomaps planet build (they keep about two weeks):
       brew install pmtiles
       pmtiles extract https://build.protomaps.com/YYYYMMDD.pmtiles \
         data/thailand.pmtiles --bbox=97.2,5.5,105.8,20.6 --maxzoom=14
       pmtiles extract data/thailand.pmtiles data/basemap.pmtiles \
         --region=tha.geojson --maxzoom=12
     The first archive is the gitignored full-detail source; only the second is
     committed. tha.geojson is Thailand's ADM0 boundary as a bare MultiPolygon
     (geoBoundaries gbOpen THA ADM0, unwrapped from its FeatureCollection) —
     clipping to the border rather than the bbox is worth roughly a third of the
     bytes. Check the size with --dry-run before running the extract for real. */
  var PMTILES_URL = 'data/basemap.pmtiles';
  var PMTILES_MAXZOOM = 12;    // extract's native zoom; overzoomed past this

  var TILE_ATTR = OSM_ATTR + ' &middot; tiles <a href="https://protomaps.com">Protomaps</a>';

  var TILES = {
    frost: { flavor: 'white' },   // pale, so the pins carry the colour
    full:  { flavor: 'light' }    // greens and blues, closer to a paper map
  };

  /* Product categories that earn a Flavor Swirl dot on the pin base.
     DESIGN.md reserves this palette for pins and tags only. */
  var DOTS = [
    ['AC', 'var(--cola)'],        // All Café
    ['KS', 'var(--raspberry)'],   // Kudsan
    ['BS', 'var(--strawberry)'],  // bakery
    ['VF', 'var(--apple)'],       // fresh produce
    ['FP', 'var(--mango)']        // Food Place
  ];

  // ── STATE ───────────────────────────────────────────────────────────────

  var STATE = {
    all: [],
    filtered: [],
    province: '',
    query: '',
    confirmedOnly: false,
    userPos: null,
    map: null,
    pins: null,
    markers: {},        // code -> L.Marker (divIcon pins, zoom >= PIN_MIN_ZOOM)
    dots: {},           // code -> L.CircleMarker (canvas, zoom < PIN_MIN_ZOOM)
    dotRenderer: null,  // shared L.canvas renderer for the dots
    selected: null,
    layer: 'frost',
    basemapMissing: false,
    tileLayer: null,
    meMarker: null,
    listRender: 0       // token: latest renderList pass owns the list DOM
  };

  var el = {};

  // ── FORMATTING ──────────────────────────────────────────────────────────

  function fmtKm(m) {
    if (m == null) return '';
    if (m < 1000) return Math.round(m) + ' m';
    return (m / 1000).toFixed(m < 10000 ? 1 : 0) + ' km';
  }

  function fmtTel(tel) {
    if (!tel) return '';
    return tel.split(',')[0].trim();
  }

  function fmtCount(n) {
    return n.toLocaleString('en-US');
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function haversine(aLat, aLng, bLat, bLng) {
    var R = 6371000, rad = Math.PI / 180;
    var dLat = (bLat - aLat) * rad, dLng = (bLng - aLng) * rad;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(aLat * rad) * Math.cos(bLat * rad) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }

  /* requestIdleCallback with a Safari-safe fallback, for work that should not
     fight first paint or an in-flight gesture. */
  function idle(fn) {
    if (window.requestIdleCallback) return window.requestIdleCallback(fn);
    return setTimeout(fn, 30);
  }

  function svgIcon(name, cls) {
    return '<svg class="icon' + (cls ? ' ' + cls : '') + '" aria-hidden="true">' +
      '<use href="#icon-' + name + '"></use></svg>';
  }

  // ── DATA ────────────────────────────────────────────────────────────────

  function unpack(raw) {
    var P = raw.provinces, D = raw.districts, S = raw.subdistricts;
    return raw.stores.map(function (r) {
      return {
        code: r[0],
        name: r[1],
        lat: r[2],
        lng: r[3],
        province: P[r[4]] || '',
        district: D[r[5]] || '',
        subdistrict: S[r[6]] || '',
        address: r[7] || '',
        tel: r[8] || '',
        products: (r[9] || '').split(',').filter(Boolean),
        sp: r[10] === 1,
        listName: r[11] || '',
        dist: null,
        // one lower-cased haystack, built once, for fast substring search
        hay: (r[0] + ' ' + r[1] + ' ' + (r[11] || '') + ' ' + (r[7] || '') + ' ' +
          (P[r[4]] || '') + ' ' + (D[r[5]] || '')).toLowerCase()
      };
    });
  }

  // ── FILTERING ───────────────────────────────────────────────────────────

  function applyFilters() {
    var q = STATE.query.trim().toLowerCase();
    var prov = STATE.province;
    var only = STATE.confirmedOnly;

    STATE.filtered = STATE.all.filter(function (s) {
      if (only && !s.sp) return false;
      if (prov && s.province !== prov) return false;
      if (q && s.hay.indexOf(q) === -1) return false;
      return true;
    });

    if (STATE.userPos) {
      STATE.filtered.sort(function (a, b) { return a.dist - b.dist; });
    }

    renderMarkers();
    renderList();
    renderCount();
  }

  // ── MAP ─────────────────────────────────────────────────────────────────

  /* Ask the server for the first 16 bytes of the archive. A 206 with the
     PMTiles magic means the basemap is usable; anything else (file://, plain
     http.server answering 200 with the whole file, archive not built yet)
     means there is no basemap to draw, so say so rather than leaving the user
     staring at bare pins on an empty page. */
  function probeBasemap() {
    if (typeof protomapsL === 'undefined' || !window.fetch ||
        location.protocol === 'file:') {
      return Promise.resolve(false);
    }
    return fetch(PMTILES_URL, { headers: { Range: 'bytes=0-15' } })
      .then(function (r) {
        if (r.status !== 206) return false;
        return r.arrayBuffer().then(function (buf) {
          var b = new Uint8Array(buf);
          // "PMTiles" + spec version 3
          return b.length >= 8 && b[0] === 0x50 && b[1] === 0x4d &&
                 b[2] === 0x54 && b[3] === 0x69 && b[4] === 0x6c &&
                 b[5] === 0x65 && b[6] === 0x73 && b[7] === 3;
        });
      })
      .catch(function () { return false; });
  }

  function setTiles(which) {
    STATE.layer = which;
    if (STATE.tileLayer) STATE.map.removeLayer(STATE.tileLayer);
    STATE.tileLayer = null;

    // No archive reachable: say so plainly rather than reaching for someone
    // else's tile server, which is what got the map blocked before.
    if (STATE.basemapMissing) {
      el.basemapNotice.hidden = false;
      el.layerBtn.disabled = true;
      return;
    }

    // protomaps-leaflet v5 calls this option "flavor", not "theme" — an
    // unrecognised key is ignored silently and paints an empty canvas.
    // The rest are L.GridLayer options (the layer extends it): deferring tile
    // updates until the gesture ends and shrinking the offscreen tile buffer
    // is the difference between a slideshow and a smooth pan on a phone.
    // devicePixelRatio sizes the tile canvas (256 × dpr), so a DPR-3 phone
    // would otherwise paint 768px tiles; 2 is plenty for a map under pins.
    STATE.tileLayer = protomapsL.leafletLayer({
      url: PMTILES_URL,
      flavor: TILES[which].flavor,
      lang: 'th',                       // match the Thai store list
      maxDataZoom: PMTILES_MAXZOOM,
      updateWhenIdle: true,
      updateWhenZooming: false,
      keepBuffer: 1,
      devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      attribution: TILE_ATTR
    });

    STATE.tileLayer.addTo(STATE.map);
    STATE.tileLayer.bringToBack();

    el.layerBtn.setAttribute('aria-pressed', which === 'full' ? 'true' : 'false');
    el.layerBtn.setAttribute('aria-label',
      which === 'frost' ? 'Switch to the full-colour map' : 'Switch to the frosted map');
    try { localStorage.setItem(STORAGE.layer, which); } catch (e) { /* private mode */ }
  }

  function pinHtml(s, active) {
    var dots = '';
    var n = 0;
    for (var i = 0; i < DOTS.length && n < 4; i++) {
      if (s.products.indexOf(DOTS[i][0]) !== -1) {
        dots += '<i style="background:' + DOTS[i][1] + '"></i>';
        n++;
      }
    }
    return '<div class="pin' + (s.sp ? '' : ' pin--unconfirmed') +
      (active ? ' pin--active' : '') + '">' +
      '<svg aria-hidden="true"><use href="#icon-straw"></use></svg>' +
      (dots ? '<span class="pin-dots">' + dots + '</span>' : '') +
      '</div>';
  }

  function makeMarker(s) {
    var m = L.marker([s.lat, s.lng], {
      icon: L.divIcon({
        className: 'pin-icon',
        html: pinHtml(s, STATE.selected === s),
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      }),
      keyboard: true,
      title: s.name,
      alt: s.name + ' — ' + s.province
    });
    m.on('click', function () { select(s, false); });
    return m;
  }

  function refreshMarkerIcon(s, active) {
    var m = STATE.markers[s.code];
    if (!m) return;
    m.setIcon(L.divIcon({
      className: 'pin-icon',
      html: pinHtml(s, active),
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    }));
  }

  /* At country zoom, thousands of branches overlap into an unreadable mass
     anyway — and 2,600 divIcon DOM nodes are what made phones crawl. So two
     regimes, both still one marker per branch (never a count bubble):

       zoom <  PIN_MIN_ZOOM: L.circleMarker dots on a single shared canvas —
                             one <canvas> for the whole country.
       zoom >= PIN_MIN_ZOOM: the full divIcon pins, but only for branches in
                             (or near) the viewport; re-culled on moveend.

     Markers and dots are built lazily and cached in STATE.markers/STATE.dots,
     so panning or zooming back costs nothing. Colours mirror .pin in
     style.css (Slurpee Red border, Cup White fill, Melted Gray when
     unconfirmed). */
  function makeDot(s) {
    if (!STATE.dotRenderer) STATE.dotRenderer = L.canvas({ padding: 0.4 });
    var d = L.circleMarker([s.lat, s.lng], {
      renderer: STATE.dotRenderer,
      radius: 5,
      color: s.sp ? '#E8402A' : '#5C6B7A',
      weight: 2,
      fillColor: '#FFFFFF',
      fillOpacity: 1,
      title: s.name,
      alt: s.name + ' — ' + s.province
    });
    d.on('click', function () { select(s, false); });
    return d;
  }

  function renderMarkers() {
    if (!STATE.map) return;
    STATE.pins.clearLayers();
    var bounds = STATE.map.getBounds().pad(0.15);
    var dotsOnly = STATE.map.getZoom() < PIN_MIN_ZOOM;
    for (var i = 0; i < STATE.filtered.length; i++) {
      var s = STATE.filtered[i];
      if (!bounds.contains([s.lat, s.lng])) continue;
      if (dotsOnly) {
        var d = STATE.dots[s.code];
        if (!d) { d = makeDot(s); STATE.dots[s.code] = d; }
        STATE.pins.addLayer(d);
      } else {
        var m = STATE.markers[s.code];
        if (!m) { m = makeMarker(s); STATE.markers[s.code] = m; }
        STATE.pins.addLayer(m);
      }
    }
  }

  // ── LIST ────────────────────────────────────────────────────────────────

  function renderCount() {
    var n = STATE.filtered.length;
    el.count.textContent = fmtCount(n);
    el.countLabel.textContent = n === 1 ? 'branch' : 'branches';
  }

  function rowHtml(s, i) {
    var tag = s.sp
      ? '<span class="tag tag-yes">' + svgIcon('check') + 'Slurpee</span>'
      : '<span class="tag tag-no">' + svgIcon('alert') + 'Unconfirmed</span>';
    var place = esc(s.district + (s.province && s.district !== s.province ? ', ' + s.province : s.province));
    return '<button type="button" class="result" data-code="' + s.code + '" ' +
      'style="animation-delay:' + Math.min(i * 40, 600) + 'ms">' +
      '<span class="result-top">' +
      '<span class="result-name th">' + esc(s.name) + '</span>' +
      (s.dist != null ? '<span class="dist">' + fmtKm(s.dist) + '</span>' : '') +
      '</span>' +
      '<span class="result-meta">' +
      '<span class="code">' + s.code + '</span>' +
      '<span class="result-place th">' + place + '</span>' +
      tag +
      '</span>' +
      '</button>';
  }

  function emptyHtml() {
    var cup =
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M7 9 C7 5.5 9.5 4 12 4 C14.5 4 17 5.5 17 9" stroke="var(--text2)" stroke-width="1.4" stroke-linecap="round"/>' +
      '<path d="M7 9 L8.6 20 H15.4 L17 9 Z" fill="rgba(61,139,253,.10)" stroke="var(--text2)" stroke-width="1.4" stroke-linejoin="round"/>' +
      '<path d="M13.5 6.5 L15.5 2.5" stroke="var(--accent)" stroke-width="1.4" stroke-linecap="round"/>' +
      '<circle cx="10.2" cy="13" r="1.1" fill="var(--strawberry)"/>' +
      '<circle cx="13.6" cy="15" r="1.1" fill="var(--mango)"/>' +
      '<circle cx="11.6" cy="17.4" r="1" fill="var(--apple)"/>' +
      '</svg>';
    return '<div class="empty">' + cup +
      '<h2>Brain freeze drought</h2>' +
      '<p>Nothing matches that. Try a wider search.</p>' +
      '<button type="button" class="btn btn-secondary" id="reset-btn">Clear the filters</button>' +
      '</div>';
  }

  function renderList() {
    var list = STATE.filtered;
    STATE.listRender++;
    if (!list.length) {
      el.results.innerHTML = emptyHtml();
      var reset = document.getElementById('reset-btn');
      if (reset) reset.addEventListener('click', resetFilters);
      return;
    }
    var shown = list.slice(0, LIST_LIMIT);
    var tail = '';
    if (list.length > LIST_LIMIT) {
      tail = '<p class="list-end">Showing ' + fmtCount(LIST_LIMIT) + ' of ' +
        fmtCount(list.length) + ' &mdash; zoom the map or narrow your search.</p>';
    }

    // First screenful synchronously, the rest on idle — one innerHTML with
    // 150 rows is a long task on a phone.
    var first = shown.slice(0, LIST_FIRST);
    var rest = shown.slice(LIST_FIRST);
    el.results.innerHTML = first.map(rowHtml).join('');

    if (rest.length || tail) {
      var token = STATE.listRender;
      idle(function () {
        if (token !== STATE.listRender) return;   // a newer filter pass owns the list
        el.results.insertAdjacentHTML('beforeend',
          rest.map(function (s, i) { return rowHtml(s, i + LIST_FIRST); }).join('') + tail);
      });
    }
  }

  // ── SELECTION / DETAIL ──────────────────────────────────────────────────

  function detailHtml(s) {
    var rows = '';
    rows += '<div class="detail-row">' + svgIcon('pin') +
      '<span class="th">' + esc(s.address || (s.subdistrict + ' ' + s.district + ' ' + s.province)) + '</span></div>';

    var tel = fmtTel(s.tel);
    if (tel) {
      rows += '<div class="detail-row">' + svgIcon('phone') +
        '<a href="tel:' + esc(tel.replace(/[^0-9+]/g, '')) + '" class="mono">' + esc(tel) + '</a></div>';
    }

    rows += '<div class="detail-row">' + svgIcon(s.sp ? 'check' : 'alert') +
      '<span>' + (s.sp
        ? 'Slurpee machine confirmed by the 7-Eleven store directory.'
        : 'This branch is on the Slurpee list, but the store directory does not currently confirm a machine.') +
      '</span></div>';

    var labels = (window.SLURPEE_STORES && window.SLURPEE_STORES.products) || {};
    var pills = s.products.filter(function (p) { return p !== 'SP' && labels[p]; })
      .map(function (p, i) {
        var c = ['var(--raspberry)', 'var(--mango)', 'var(--apple)', 'var(--strawberry)', 'var(--cola)'][i % 5];
        return '<span class="pill th" style="background:color-mix(in srgb,' + c +
          ' 8%, transparent);color:' + c + '">' + esc(labels[p]) + '</span>';
      }).join('');

    if (pills) {
      rows += '<div class="detail-row">' + svgIcon('store') +
        '<span>Also in store<span class="pills">' + pills + '</span></span></div>';
    }

    return '<button type="button" class="detail-back" id="detail-back">' +
      svgIcon('chevron-left') + 'All branches</button>' +
      '<h2 class="th">' + esc(s.name) + '</h2>' +
      '<p class="detail-sub"><span class="code">' + s.code + '</span>' +
      (s.listName ? ' &middot; <span class="th">' + esc(s.listName) + '</span>' : '') +
      (s.dist != null ? ' &middot; <span class="dist">' + fmtKm(s.dist) + ' away</span>' : '') +
      '</p>' +
      rows +
      '<div class="detail-actions">' +
      '<a class="btn btn-primary" target="_blank" rel="noopener" ' +
      'href="https://www.google.com/maps/search/?api=1&query=' + s.lat + ',' + s.lng + '">' +
      svgIcon('directions') + 'Directions</a>' +
      '<a class="btn btn-secondary" target="_blank" rel="noopener" ' +
      'href="https://www.openstreetmap.org/?mlat=' + s.lat + '&mlon=' + s.lng + '#map=18/' + s.lat + '/' + s.lng + '">' +
      svgIcon('external') + 'OSM</a>' +
      '</div>';
  }

  function select(s, fromList) {
    if (STATE.selected) refreshMarkerIcon(STATE.selected, false);
    STATE.selected = s;

    // The pin may be culled (offscreen) when the pick came from the list —
    // make sure it exists and is on the map before styling it active.
    var m = STATE.markers[s.code];
    if (!m) { m = makeMarker(s); STATE.markers[s.code] = m; }
    if (!STATE.pins.hasLayer(m)) STATE.pins.addLayer(m);
    refreshMarkerIcon(s, true);

    el.detailScroll.innerHTML = detailHtml(s);
    el.detail.hidden = false;
    document.getElementById('detail-back').addEventListener('click', closeDetail);

    Array.prototype.forEach.call(el.results.querySelectorAll('.result'), function (b) {
      b.setAttribute('aria-current', b.dataset.code === s.code ? 'true' : 'false');
    });

    if (fromList) {
      // The pin is always on the map now, so just fly to it — but never zoom
      // back out, and go in far enough to actually read the street.
      var target = Math.max(STATE.map.getZoom(), 16);
      STATE.map.setView([s.lat, s.lng], target, { animate: true });
    }
    if (window.matchMedia('(max-width: 768px)').matches) setSnap('half');
  }

  function closeDetail() {
    el.detail.hidden = true;
    if (STATE.selected) refreshMarkerIcon(STATE.selected, false);
    STATE.selected = null;
    Array.prototype.forEach.call(el.results.querySelectorAll('.result'), function (b) {
      b.setAttribute('aria-current', 'false');
    });
  }

  // ── GEOLOCATION ─────────────────────────────────────────────────────────

  function showGeoError(msg) {
    el.geoError.hidden = false;
    el.geoError.querySelector('span').textContent = msg;
  }

  function locate() {
    el.geoError.hidden = true;

    if (!navigator.geolocation) {
      showGeoError('This browser will not share a location.');
      return;
    }

    el.locateLabel.textContent = 'Finding you...';
    el.locateBtn.disabled = true;

    function done() {
      el.locateLabel.textContent = 'Find my freeze';
      el.locateBtn.disabled = false;
    }

    try {
      navigator.geolocation.getCurrentPosition(function (pos) {
        done();
        var lat = pos.coords.latitude, lng = pos.coords.longitude;
        STATE.userPos = { lat: lat, lng: lng };

        STATE.all.forEach(function (s) {
          s.dist = haversine(lat, lng, s.lat, s.lng);
        });

        if (STATE.meMarker) STATE.map.removeLayer(STATE.meMarker);
        STATE.meMarker = L.marker([lat, lng], {
          icon: L.divIcon({ className: 'me-icon', html: '<div class="me"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }),
          zIndexOffset: 1000,
          alt: 'Your location'
        }).addTo(STATE.map);

        applyFilters();
        STATE.map.setView([lat, lng], 14, { animate: true });
        el.sidebarScroll.scrollTop = 0;
      }, function (err) {
        done();
        showGeoError(err.code === 1
          ? 'Machine’s napping — location access was blocked.'
          : 'Could not pin you down. Try again, or search by province.');
      }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
    } catch (e) {
      done();
      showGeoError('Location is unavailable here.');
    }
  }

  // ── BOTTOM SHEET (mobile) ───────────────────────────────────────────────

  function setSnap(snap) {
    el.sidebar.dataset.snap = snap;
  }

  function initSheet() {
    var startY = 0, startSnap = 'half', dragging = false, moved = 0;
    var order = ['peek', 'half', 'full'];

    function onDown(e) {
      if (!window.matchMedia('(max-width: 768px)').matches) return;
      dragging = true;
      moved = 0;
      startY = e.clientY;
      startSnap = el.sidebar.dataset.snap || 'half';
      el.sidebar.classList.add('is-dragging');
      el.grab.setPointerCapture(e.pointerId);
    }

    function onMove(e) {
      if (!dragging) return;
      moved = e.clientY - startY;
      var base = { peek: el.sidebar.offsetHeight - 148, half: el.sidebar.offsetHeight * 0.46, full: 0 }[startSnap];
      var y = Math.max(0, Math.min(el.sidebar.offsetHeight - 148, base + moved));
      el.sidebar.style.transform = 'translateY(' + y + 'px)';
    }

    function onUp(e) {
      if (!dragging) return;
      dragging = false;
      el.sidebar.classList.remove('is-dragging');
      el.sidebar.style.transform = '';
      var i = order.indexOf(startSnap);
      if (moved < -40) i = Math.min(i + 1, 2);
      else if (moved > 40) i = Math.max(i - 1, 0);
      setSnap(order[i]);
      if (e.pointerId != null) {
        try { el.grab.releasePointerCapture(e.pointerId); } catch (err) { /* already gone */ }
      }
    }

    el.grab.addEventListener('pointerdown', onDown);
    el.grab.addEventListener('pointermove', onMove);
    el.grab.addEventListener('pointerup', onUp);
    el.grab.addEventListener('pointercancel', onUp);
    el.grab.addEventListener('click', function () {
      if (Math.abs(moved) > 6) return;   // that was a drag, not a tap
      var i = order.indexOf(el.sidebar.dataset.snap || 'half');
      setSnap(order[i === 2 ? 0 : i + 1]);
    });
  }

  // ── FILTER CONTROLS ─────────────────────────────────────────────────────

  function buildProvinceSelect() {
    var counts = {};
    STATE.all.forEach(function (s) {
      counts[s.province] = (counts[s.province] || 0) + 1;
    });
    var names = Object.keys(counts).sort(function (a, b) {
      return a.localeCompare(b, 'th');
    });
    var html = '<option value="">All of Thailand (' + fmtCount(STATE.all.length) + ')</option>';
    names.forEach(function (n) {
      html += '<option value="' + esc(n) + '">' + esc(n) + ' (' + fmtCount(counts[n]) + ')</option>';
    });
    el.province.innerHTML = html;
  }

  function resetFilters() {
    STATE.query = '';
    STATE.province = '';
    STATE.confirmedOnly = false;
    el.search.value = '';
    el.province.value = '';
    el.confirmedOnly.checked = false;
    el.searchClear.hidden = true;
    persist();
    applyFilters();
    STATE.map.fitBounds(THAILAND, { padding: [20, 20] });
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE.province, STATE.province);
      localStorage.setItem(STORAGE.confirmed, STATE.confirmedOnly ? '1' : '0');
    } catch (e) { /* private mode — filters just won't stick */ }
  }

  function restore() {
    try {
      var p = localStorage.getItem(STORAGE.province);
      if (p && STATE.all.some(function (s) { return s.province === p; })) {
        STATE.province = p;
        el.province.value = p;
      }
      if (localStorage.getItem(STORAGE.confirmed) === '1') {
        STATE.confirmedOnly = true;
        el.confirmedOnly.checked = true;
      }
      var lay = localStorage.getItem(STORAGE.layer);
      if (lay === 'frost' || lay === 'full') STATE.layer = lay;
    } catch (e) { /* ignore */ }
  }

  // ── WIRING ──────────────────────────────────────────────────────────────

  function bind() {
    var onSearch = debounce(function () {
      STATE.query = el.search.value;
      applyFilters();
      el.sidebarScroll.scrollTop = 0;
    }, SEARCH_DEBOUNCE);

    el.search.addEventListener('input', function () {
      el.searchClear.hidden = !el.search.value;
      onSearch();
    });

    el.searchClear.addEventListener('click', function () {
      el.search.value = '';
      el.searchClear.hidden = true;
      STATE.query = '';
      applyFilters();
      el.search.focus();
    });

    el.province.addEventListener('change', function () {
      STATE.province = el.province.value;
      persist();
      applyFilters();
      el.sidebarScroll.scrollTop = 0;
      if (STATE.province) {
        var pts = STATE.filtered.map(function (s) { return [s.lat, s.lng]; });
        if (pts.length) STATE.map.fitBounds(pts, { padding: [40, 40], maxZoom: 13 });
      } else {
        STATE.map.fitBounds(THAILAND, { padding: [20, 20] });
      }
    });

    el.confirmedOnly.addEventListener('change', function () {
      STATE.confirmedOnly = el.confirmedOnly.checked;
      persist();
      applyFilters();
    });

    el.locateBtn.addEventListener('click', locate);

    el.results.addEventListener('click', function (e) {
      var btn = e.target.closest('.result');
      if (!btn) return;
      var s = STATE.all.find(function (x) { return x.code === btn.dataset.code; });
      if (s) select(s, true);
    });

    el.zoomIn.addEventListener('click', function () { STATE.map.zoomIn(); });
    el.zoomOut.addEventListener('click', function () { STATE.map.zoomOut(); });
    el.layerBtn.addEventListener('click', function () {
      if (STATE.basemapMissing) return;     // nothing to toggle between
      setTiles(STATE.layer === 'frost' ? 'full' : 'frost');
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !el.detail.hidden) closeDetail();
      if (e.key === '/' && document.activeElement !== el.search) {
        e.preventDefault();
        el.search.focus();
      }
    });
  }

  // ── BOOT ────────────────────────────────────────────────────────────────

  function fail(msg) {
    var loader = document.getElementById('loader');
    if (!loader) return;
    loader.innerHTML = '<div class="loader-card">' +
      '<svg class="icon loader-cup" aria-hidden="true"><use href="#icon-alert"></use></svg>' +
      '<p class="loader-copy">Machine’s napping</p>' +
      '<p style="margin:0;font-size:.875rem;color:var(--text2)">' + esc(msg) + '</p></div>';
  }

  function init() {
    el = {
      map: document.getElementById('map'),
      search: document.getElementById('search-input'),
      searchClear: document.getElementById('search-clear'),
      sidebar: document.getElementById('sidebar'),
      sidebarScroll: document.getElementById('sidebar-scroll'),
      grab: document.getElementById('grab'),
      province: document.getElementById('province'),
      confirmedOnly: document.getElementById('confirmed-only'),
      locateBtn: document.getElementById('locate-btn'),
      locateLabel: document.getElementById('locate-label'),
      geoError: document.getElementById('geo-error'),
      results: document.getElementById('results'),
      detail: document.getElementById('detail'),
      detailScroll: document.getElementById('detail-scroll'),
      count: document.getElementById('count'),
      countLabel: document.getElementById('count-label'),
      zoomIn: document.getElementById('zoom-in'),
      zoomOut: document.getElementById('zoom-out'),
      layerBtn: document.getElementById('layer-btn'),
      basemapNotice: document.getElementById('basemap-notice'),
      loader: document.getElementById('loader')
    };

    var raw = window.SLURPEE_STORES;
    if (!raw || !raw.stores || !raw.stores.length) {
      fail('Store data is missing. Run "python3 fetch_stores.py" to build data/stores.js, then reload.');
      return;
    }

    // The saved layer is read before the basemap probe resolves — the probe
    // can beat the deferred boot below on a fast local server.
    try {
      var lay = localStorage.getItem(STORAGE.layer);
      if (lay === 'frost' || lay === 'full') STATE.layer = lay;
    } catch (e) { /* private mode */ }

    // maxZoom must live on the map, not the layer: the vector basemap is an
    // L.GridLayer that declares no maxZoom, so without this the map would
    // inherit no upper bound and refuse to zoom past the basemap's data.
    STATE.map = L.map(el.map, {
      zoomControl: false,
      attributionControl: true,
      preferCanvas: false,
      minZoom: 5,
      maxZoom: 19
    }).fitBounds(THAILAND, { padding: [20, 20] });

    // The basemap needs a Range-capable server and cannot work over file://.
    // Probe before choosing a layer so the notice never flashes first.
    probeBasemap().then(function (ok) {
      STATE.basemapMissing = !ok;
      setTiles(STATE.layer);
    });

    STATE.pins = L.layerGroup();
    STATE.map.addLayer(STATE.pins);
    STATE.map.on('moveend', debounce(renderMarkers, CULL_DEBOUNCE));

    // Stage 2: let the shell and loader paint first, then do the heavy data
    // pass. Unpacking 2,600 branches and building the first screen in one
    // synchronous block was the boot long-task on phones.
    requestAnimationFrame(function () {
      setTimeout(function () {
        STATE.all = unpack(raw);

        buildProvinceSelect();
        restore();

        bind();
        initSheet();
        applyFilters();

        el.loader.classList.add('is-out');
        setTimeout(function () { el.loader.hidden = true; }, 400);

        // hero.js reads this to know the data is up
        document.dispatchEvent(new CustomEvent('slurpee:ready'));
      }, 0);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
