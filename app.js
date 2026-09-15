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
    lang: 'slurpee_v1_lang',
    sidebarCollapsed: 'slurpee_v1_sidebarcollapsed'
  };
  var DESKTOP_QUERY = '(min-width: 769px)';

  /* UI chrome only — never the data. Branch names, addresses and product
     labels are already authentically Thai (real 7-Eleven directory text) and
     stay exactly as they are regardless of this switch; only the interface
     copy around them changes. The "Slurpee Map Thailand" logotype in the
     header is brand name, not UI copy — it always stays English. */
  var STRINGS = {
    en: {
      description: 'An interactive OpenStreetMap of every 7-Eleven branch in Thailand that serves Slurpee.',
      searchPlaceholder: 'Where’s your nearest Slurpee?',
      searchAria: 'Search by branch name, code or address',
      searchClear: 'Clear search',
      grabAria: 'Expand or collapse the panel',
      sidebarCollapse: 'Collapse panel',
      sidebarExpand: 'Expand panel',
      province: 'Province',
      allThailand: 'All of Thailand',
      confirmedOnly: 'Confirmed machines only',
      findFreeze: 'Find my freeze',
      finding: 'Finding you...',
      zoomIn: 'Zoom in',
      zoomOut: 'Zoom out',
      loaderCopy: 'Pouring the map…',
      basemapNotice: 'The map background is served in byte ranges, which this page ' +
        'was not opened over. Run <code>python3 serve.py</code> in the slurpee ' +
        'folder and open <code>localhost:8080</code>, or use the deployed ' +
        'site. Branches and search work either way.',
      branch: 'branch',
      branches: 'branches',
      tagYes: 'Slurpee',
      tagNo: 'Unconfirmed',
      emptyTitle: 'Brain freeze drought',
      emptyBody: 'Nothing matches that. Try a wider search.',
      clearFilters: 'Clear the filters',
      listEnd: 'Showing {shown} of {total} — zoom the map or narrow your search.',
      allBranches: 'All branches',
      away: '{dist} away',
      directions: 'Directions',
      alsoInStore: 'Also in store',
      confirmedMsg: 'Slurpee machine confirmed by the 7-Eleven store directory.',
      unconfirmedMsg: 'This branch is on the Slurpee list, but the store directory does not currently confirm a machine.',
      geoUnsupported: 'This browser will not share a location.',
      geoDenied: 'Machine’s napping — location access was blocked.',
      geoFail: 'Could not pin you down. Try again, or search by province.',
      geoUnavailable: 'Location is unavailable here.',
      dataMissing: 'Store data is missing. Run "python3 fetch_stores.py" to build data/stores.js, then reload.',
      napping: 'Machine’s napping',
      yourLocation: 'Your location'
    },
    th: {
      description: 'แผนที่แบบอินเทอร์แอกทีฟของทุกสาขา 7-Eleven ในประเทศไทยที่มีเครื่องสลัร์ปี้',
      searchPlaceholder: 'ร้านสลัร์ปี้ใกล้คุณอยู่ไหน?',
      searchAria: 'ค้นหาด้วยชื่อสาขา รหัส หรือที่อยู่',
      searchClear: 'ล้างการค้นหา',
      grabAria: 'ขยายหรือย่อแผงข้อมูล',
      sidebarCollapse: 'ย่อแผงข้อมูล',
      sidebarExpand: 'ขยายแผงข้อมูล',
      province: 'จังหวัด',
      allThailand: 'ทั่วประเทศไทย',
      confirmedOnly: 'เฉพาะเครื่องที่ยืนยันแล้ว',
      findFreeze: 'หาสลัร์ปี้ใกล้ฉัน',
      finding: 'กำลังค้นหาคุณ...',
      zoomIn: 'ซูมเข้า',
      zoomOut: 'ซูมออก',
      loaderCopy: 'กำลังเทแผนที่…',
      basemapNotice: 'แผนที่พื้นหลังถูกส่งแบบ byte range ซึ่งหน้านี้ไม่ได้เปิดผ่านวิธีนั้น ' +
        'รันคำสั่ง <code>python3 serve.py</code> ในโฟลเดอร์ slurpee ' +
        'แล้วเปิด <code>localhost:8080</code> หรือใช้เว็บไซต์จริงที่เผยแพร่แล้ว ' +
        'การค้นหาและรายชื่อสาขายังใช้งานได้ปกติทั้งสองแบบ',
      branch: 'สาขา',
      branches: 'สาขา',
      tagYes: 'มีสลัร์ปี้',
      tagNo: 'ยังไม่ยืนยัน',
      emptyTitle: 'แล้งสลัร์ปี้',
      emptyBody: 'ไม่พบรายการที่ตรงกัน ลองขยายการค้นหาดูสิ',
      clearFilters: 'ล้างตัวกรอง',
      listEnd: 'แสดง {shown} จาก {total} สาขา — ลองซูมแผนที่หรือค้นหาให้แคบลง',
      allBranches: 'สาขาทั้งหมด',
      away: 'ห่าง {dist}',
      directions: 'นำทาง',
      alsoInStore: 'สินค้าอื่นในร้าน',
      confirmedMsg: 'เครื่องสลัร์ปี้ได้รับการยืนยันจากไดเรกทอรี่ร้าน 7-Eleven',
      unconfirmedMsg: 'สาขานี้อยู่ในรายชื่อสลัร์ปี้ แต่ไดเรกทอรี่ร้านยังไม่ยืนยันว่ามีเครื่อง',
      geoUnsupported: 'เบราว์เซอร์นี้ไม่รองรับการแชร์ตำแหน่ง',
      geoDenied: 'เครื่องงีบอยู่ — การเข้าถึงตำแหน่งถูกบล็อก',
      geoFail: 'หาตำแหน่งคุณไม่เจอ ลองใหม่อีกครั้ง หรือค้นหาด้วยจังหวัด',
      geoUnavailable: 'ตำแหน่งไม่พร้อมใช้งานที่นี่',
      dataMissing: 'ไม่พบข้อมูลร้านค้า รันคำสั่ง "python3 fetch_stores.py" เพื่อสร้าง data/stores.js แล้วโหลดหน้าใหม่',
      napping: 'เครื่องงีบอยู่',
      yourLocation: 'ตำแหน่งของคุณ'
    }
  };

  function t(key) {
    return (STRINGS[STATE.lang] && STRINGS[STATE.lang][key] != null)
      ? STRINGS[STATE.lang][key]
      : STRINGS.en[key];
  }

  var OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  /* The basemap is a Thailand extract of the Protomaps OpenStreetMap
     basemap, served from this project's own data/ directory. No API key, no
     rate limit, no third party in the request path at all. It is a PMTiles
     archive read with HTTP range
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

  var TILE_FLAVOR = 'white';   // pale, so the pins carry the colour

  /* One cup art asset per branch, assigned by hashing the store code so it
     is random-looking across the map but stable for a given branch (no
     colour swap on re-render). assets/cups/cup_<name>.png, sliced from the
     16-cup sprite. black/cream/white are excluded here — they blend into
     the pale basemap and dark cluster fills, so the pin becomes unreadable
     against the map itself. */
  var CUP_COLORS = [
    'lime', 'blue', 'purple', 'pink',
    'orange', 'red', 'teal',
    'lavender', 'skyblue', 'mint',
    'navy', 'magenta', 'yellow'
  ];

  /* Badge ring colour per cup — sampled from each PNG's own dominant hue, so
     the ring always matches the art exactly rather than a guessed keyword. */
  var CUP_HEX = {
    lime: '#A8D018', blue: '#0080E8', purple: '#6038B0', pink: '#F85088',
    orange: '#F88800', red: '#E01820', teal: '#00A098',
    lavender: '#B8A0E8', skyblue: '#88D0F8', mint: '#98D8A0',
    navy: '#003080', magenta: '#D81868', yellow: '#F8D020'
  };

  function cupFor(code) {
    var h = 0;
    for (var i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
    return CUP_COLORS[h % CUP_COLORS.length];
  }

  // ── STATE ───────────────────────────────────────────────────────────────

  var STATE = {
    all: [],
    filtered: [],
    province: '',
    query: '',
    confirmedOnly: true,
    lang: 'en',
    userPos: null,
    map: null,
    pins: null,
    markers: {},        // code -> L.Marker (divIcon pins, zoom >= PIN_MIN_ZOOM)
    dots: {},           // code -> L.CircleMarker (canvas, zoom < PIN_MIN_ZOOM)
    dotRenderer: null,  // shared L.canvas renderer for the dots
    onMap: {},          // code -> layer currently added to STATE.pins
    selected: null,
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

  /* Run after the next paint — lets the shell and loader show before heavy work. */
  function afterPaint(fn) {
    requestAnimationFrame(function () { setTimeout(fn, 0); });
  }

  var mqlMobile = window.matchMedia('(max-width: 768px)');
  function isMobile() { return mqlMobile.matches; }

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
        cup: cupFor(r[0]),
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

  function setTiles() {
    if (STATE.tileLayer) STATE.map.removeLayer(STATE.tileLayer);
    STATE.tileLayer = null;

    // No archive reachable: say so plainly rather than reaching for someone
    // else's tile server, which is what got the map blocked before.
    if (STATE.basemapMissing) {
      el.basemapNotice.hidden = false;
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
      flavor: TILE_FLAVOR,
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
  }

  /* The cup art in its ringed badge — shared by the map pin and the detail
     header; cls picks the CSS frame (.pin-badge / .detail-cup-badge). */
  function cupBadgeHtml(s, cls) {
    return '<span class="' + cls + '" style="border-color:' + CUP_HEX[s.cup] + '">' +
      '<img class="pin-cup" src="assets/cups/cup_' + s.cup + '.png" alt="" />' +
      '</span>';
  }

  function pinHtml(s, active) {
    return '<div class="pin' + (s.sp ? '' : ' pin--unconfirmed') +
      (active ? ' pin--active' : '') + '">' + cupBadgeHtml(s, 'pin-badge') +
      '</div>';
  }

  /* Round badge, no pointer tail — anchor is the badge's own centre rather
     than a bottom tip. */
  var PIN_ICON_SIZE = [48, 48];
  var PIN_ICON_ANCHOR = [24, 24];

  function makeMarker(s) {
    var m = L.marker([s.lat, s.lng], {
      icon: L.divIcon({
        className: 'pin-icon',
        html: pinHtml(s, STATE.selected === s),
        iconSize: PIN_ICON_SIZE,
        iconAnchor: PIN_ICON_ANCHOR
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
      iconSize: PIN_ICON_SIZE,
      iconAnchor: PIN_ICON_ANCHOR
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
     and updates are differential — panning only adds pins that entered and
     removes pins that left, never rebuilds the set. The ring encodes
     availability, so it is the lime family per DESIGN.md §2 — --lime-ink
     rather than raw --lime, because a 2px ring at 1.9:1 vanishes on the pale
     basemap. Melted Gray when unconfirmed. Hard-coded because the canvas
     renderer cannot resolve CSS custom properties. */
  function makeDot(s) {
    if (!STATE.dotRenderer) STATE.dotRenderer = L.canvas({ padding: 0.4 });
    var d = L.circleMarker([s.lat, s.lng], {
      renderer: STATE.dotRenderer,
      radius: 5,
      color: s.sp ? '#5C7A0D' : '#8B929C',
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
    var bounds = STATE.map.getBounds().pad(0.15);
    var dotsOnly = STATE.map.getZoom() < PIN_MIN_ZOOM;

    var want = {};
    for (var i = 0; i < STATE.filtered.length; i++) {
      var s = STATE.filtered[i];
      if (bounds.contains([s.lat, s.lng])) want[s.code] = s;
    }

    var code, cur;
    for (code in STATE.onMap) {
      cur = STATE.onMap[code];
      // keep the selected pin whatever the zoom — it is the feedback layer
      if (STATE.selected && STATE.selected.code === code) continue;
      if (!want[code] || ((cur instanceof L.CircleMarker) !== dotsOnly)) {
        STATE.pins.removeLayer(cur);
        delete STATE.onMap[code];
      }
    }
    for (code in want) {
      if (STATE.onMap[code]) continue;
      if (dotsOnly) {
        cur = STATE.dots[code];
        if (!cur) { cur = makeDot(want[code]); STATE.dots[code] = cur; }
      } else {
        cur = STATE.markers[code];
        if (!cur) { cur = makeMarker(want[code]); STATE.markers[code] = cur; }
      }
      STATE.pins.addLayer(cur);
      STATE.onMap[code] = cur;
    }
  }

  // ── LIST ────────────────────────────────────────────────────────────────

  function renderCount() {
    var n = STATE.filtered.length;
    el.count.textContent = fmtCount(n);
    el.countLabel.textContent = n === 1 ? t('branch') : t('branches');
  }

  function rowHtml(s, i) {
    var tag = s.sp
      ? '<span class="tag tag-yes">' + svgIcon('check') + t('tagYes') + '</span>'
      : '<span class="tag tag-no">' + svgIcon('alert') + t('tagNo') + '</span>';
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
      '<path d="M7 9 L8.6 20 H15.4 L17 9 Z" fill="rgba(15,164,226,.10)" stroke="var(--text2)" stroke-width="1.4" stroke-linejoin="round"/>' +
      '<path d="M13.5 6.5 L15.5 2.5" stroke="var(--accent)" stroke-width="1.4" stroke-linecap="round"/>' +
      '<circle cx="10.2" cy="13" r="1.1" fill="var(--accent)"/>' +
      '<circle cx="13.6" cy="15" r="1.1" fill="var(--blue)"/>' +
      '<circle cx="11.6" cy="17.4" r="1" fill="var(--lime)"/>' +
      '</svg>';
    return '<div class="empty">' + cup +
      '<h2 class="' + (STATE.lang === 'th' ? 'th' : '') + '">' + t('emptyTitle') + '</h2>' +
      '<p>' + t('emptyBody') + '</p>' +
      '<button type="button" class="btn btn-secondary" id="reset-btn">' + t('clearFilters') + '</button>' +
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
      tail = '<p class="list-end">' + t('listEnd')
        .replace('{shown}', fmtCount(LIST_LIMIT))
        .replace('{total}', fmtCount(list.length)) + '</p>';
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
      '<span>' + (s.sp ? t('confirmedMsg') : t('unconfirmedMsg')) +
      '</span></div>';

    var labels = (window.SLURPEE_STORES && window.SLURPEE_STORES.products) || {};
    var pills = s.products.filter(function (p) { return p !== 'SP' && labels[p]; })
      .map(function (p, i) {
        /* The tint carries the hue; the label stays Slush Ink. Raw --lime and
           --blue are 1.9:1 and 2.8:1 on white — surface colours, never text
           (DESIGN.md §2). */
        var c = ['var(--blue-ink)', 'var(--accent-deep)', 'var(--accent)', 'var(--lime)', 'var(--blue)'][i % 5];
        return '<span class="pill th" style="background:color-mix(in srgb,' + c +
          ' 14%, transparent);color:var(--text)">' + esc(labels[p]) + '</span>';
      }).join('');

    if (pills) {
      rows += '<div class="detail-row">' + svgIcon('store') +
        '<span>' + t('alsoInStore') + '<span class="pills">' + pills + '</span></span></div>';
    }

    return '<button type="button" class="detail-back" id="detail-back">' +
      svgIcon('chevron-left') + t('allBranches') + '</button>' +
      '<h2 class="detail-title th">' + cupBadgeHtml(s, 'detail-cup-badge') +
      esc(s.name) + '</h2>' +
      '<p class="detail-sub"><span class="code">' + s.code + '</span>' +
      (s.listName ? ' &middot; <span class="th">' + esc(s.listName) + '</span>' : '') +
      (s.dist != null ? ' &middot; <span class="dist">' + t('away').replace('{dist}', fmtKm(s.dist)) + '</span>' : '') +
      '</p>' +
      rows +
      '<div class="detail-actions">' +
      '<a class="btn btn-primary" target="_blank" rel="noopener" ' +
      'href="https://www.google.com/maps/search/?api=1&query=' + s.lat + ',' + s.lng + '">' +
      svgIcon('directions') + t('directions') + '</a>' +
      '</div>';
  }

  function select(s, fromList) {
    if (STATE.selected) refreshMarkerIcon(STATE.selected, false);
    STATE.selected = s;

    // The pin may be culled (offscreen) or the store may be showing as a
    // canvas dot at this zoom — make sure the real pin is on the map before
    // styling it active.
    var m = STATE.markers[s.code];
    if (!m) { m = makeMarker(s); STATE.markers[s.code] = m; }
    if (STATE.onMap[s.code] !== m) {
      if (STATE.onMap[s.code]) STATE.pins.removeLayer(STATE.onMap[s.code]);
      STATE.pins.addLayer(m);
      STATE.onMap[s.code] = m;
    }
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
    if (isMobile()) setSnap('half');
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

  function locate(silent) {
    el.geoError.hidden = true;

    if (!navigator.geolocation) {
      if (!silent) showGeoError(t('geoUnsupported'));
      return;
    }

    el.locateBtn.disabled = true;
    el.locateBtn.setAttribute('aria-label', t('finding'));

    function done() {
      el.locateBtn.disabled = false;
      el.locateBtn.setAttribute('aria-label', t('findFreeze'));
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
          alt: t('yourLocation')
        }).addTo(STATE.map);

        applyFilters();
        STATE.map.setView([lat, lng], 14, { animate: true });
        el.sidebarScroll.scrollTop = 0;
      }, function (err) {
        done();
        if (!silent) showGeoError(err.code === 1 ? t('geoDenied') : t('geoFail'));
      }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
    } catch (e) {
      done();
      if (!silent) showGeoError(t('geoUnavailable'));
    }
  }

  /* Auto-locate on boot only when location was already granted — a permission
     prompt on first paint is a terrible hello. Where the Permissions API is
     missing (older WebKit), simply wait for the "Find my freeze" button. */
  function maybeAutoLocate() {
    if (!navigator.permissions || !navigator.permissions.query) return;
    try {
      navigator.permissions.query({ name: 'geolocation' }).then(function (p) {
        if (p.state === 'granted') locate(true);
      }).catch(function () { /* no auto-locate */ });
    } catch (e) { /* no auto-locate */ }
  }

  // ── BOTTOM SHEET (mobile) ───────────────────────────────────────────────

  function setSnap(snap) {
    el.sidebar.dataset.snap = snap;
  }

  function initSheet() {
    var startY = 0, startSnap = 'half', dragging = false, moved = 0;
    var order = ['peek', 'half', 'full'];

    function onDown(e) {
      if (!isMobile()) return;
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

  // ── SIDEBAR COLLAPSE (desktop) ───────────────────────────────────────────

  function setSidebarCollapsed(collapsed) {
    el.sidebar.classList.toggle('is-collapsed', collapsed);
    el.sidebarToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    el.sidebarToggle.setAttribute('aria-label', t(collapsed ? 'sidebarExpand' : 'sidebarCollapse'));
    try { localStorage.setItem(STORAGE.sidebarCollapsed, collapsed ? '1' : '0'); } catch (e) { /* private mode */ }
  }

  function initSidebarCollapse() {
    if (window.matchMedia(DESKTOP_QUERY).matches) {
      try {
        if (localStorage.getItem(STORAGE.sidebarCollapsed) === '1') setSidebarCollapsed(true);
      } catch (e) { /* private mode */ }
    }

    el.sidebarToggle.addEventListener('click', function () {
      if (!window.matchMedia(DESKTOP_QUERY).matches) return;   // mobile uses the grab handle instead
      setSidebarCollapsed(!el.sidebar.classList.contains('is-collapsed'));
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
    var html = '<option value="">' + t('allThailand') + ' (' + fmtCount(STATE.all.length) + ')</option>';
    names.forEach(function (n) {
      html += '<option value="' + esc(n) + '">' + esc(n) + ' (' + fmtCount(counts[n]) + ')</option>';
    });
    el.province.innerHTML = html;
  }

  function resetFilters() {
    STATE.query = '';
    STATE.province = '';
    STATE.confirmedOnly = true;
    el.search.value = '';
    el.province.value = '';
    el.confirmedOnly.checked = true;
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
      if (localStorage.getItem(STORAGE.confirmed) === '0') {
        STATE.confirmedOnly = false;
        el.confirmedOnly.checked = false;
      }
    } catch (e) { /* ignore */ }
  }

  // ── LANGUAGE ────────────────────────────────────────────────────────────
  // UI chrome only — see the STRINGS comment above. Branch data never
  // re-translates, so switching just re-runs the same render functions the
  // filters already use; nothing here needs its own data path.

  function restoreLang() {
    try {
      var l = localStorage.getItem(STORAGE.lang);
      if (l === 'en' || l === 'th') STATE.lang = l;
    } catch (e) { /* private mode */ }
  }

  function applyStaticStrings() {
    // The page title is the brand name, not UI copy — it never switches to Thai.
    document.title = 'Slurpee Map Thailand';
    var desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', t('description'));

    var isTh = STATE.lang === 'th';
    document.documentElement.lang = STATE.lang;
    // Brand name stays "Slurpee Map Thailand" in English regardless of language.

    el.search.placeholder = t('searchPlaceholder');
    el.search.setAttribute('aria-label', t('searchAria'));
    el.searchClear.setAttribute('aria-label', t('searchClear'));
    el.grab.setAttribute('aria-label', t('grabAria'));
    el.sidebarToggle.setAttribute('aria-label',
      el.sidebar.classList.contains('is-collapsed') ? t('sidebarExpand') : t('sidebarCollapse'));
    el.provinceLabel.textContent = t('province');
    el.confirmedLabel.textContent = t('confirmedOnly');
    if (!el.locateBtn.disabled) el.locateBtn.setAttribute('aria-label', t('findFreeze'));
    el.zoomIn.setAttribute('aria-label', t('zoomIn'));
    el.zoomOut.setAttribute('aria-label', t('zoomOut'));
    el.loaderCopy.textContent = t('loaderCopy');
    el.basemapNoticeText.innerHTML = t('basemapNotice');

    el.langEn.setAttribute('aria-pressed', isTh ? 'false' : 'true');
    el.langTh.setAttribute('aria-pressed', isTh ? 'true' : 'false');
  }

  function setLang(lang) {
    if (lang === STATE.lang) return;
    STATE.lang = lang;
    try { localStorage.setItem(STORAGE.lang, lang); } catch (e) { /* private mode */ }

    applyStaticStrings();

    // Province names are real Thai place names and never translate, but the
    // "All of Thailand" option and the selection need to survive a rebuild.
    var current = STATE.province;
    buildProvinceSelect();
    el.province.value = current;

    renderList();
    renderCount();
    if (STATE.selected) el.detailScroll.innerHTML = detailHtml(STATE.selected);
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

    el.locateBtn.addEventListener('click', function () { locate(false); });

    el.results.addEventListener('click', function (e) {
      var btn = e.target.closest('.result');
      if (!btn) return;
      var s = STATE.all.find(function (x) { return x.code === btn.dataset.code; });
      if (s) select(s, true);
    });

    el.zoomIn.addEventListener('click', function () { STATE.map.zoomIn(); });
    el.zoomOut.addEventListener('click', function () { STATE.map.zoomOut(); });

    el.langEn.addEventListener('click', function () { setLang('en'); });
    el.langTh.addEventListener('click', function () { setLang('th'); });

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
      '<p class="loader-copy">' + t('napping') + '</p>' +
      '<p style="margin:0;font-size:.875rem;color:var(--text2)">' + esc(msg) + '</p></div>';
  }

  function init() {
    el = {
      map: document.getElementById('map'),
      search: document.getElementById('search-input'),
      searchClear: document.getElementById('search-clear'),
      sidebar: document.getElementById('sidebar'),
      sidebarScroll: document.getElementById('sidebar-scroll'),
      sidebarToggle: document.getElementById('sidebar-toggle'),
      grab: document.getElementById('grab'),
      province: document.getElementById('province'),
      confirmedOnly: document.getElementById('confirmed-only'),
      locateBtn: document.getElementById('locate-map-btn'),
      geoError: document.getElementById('geo-error'),
      results: document.getElementById('results'),
      detail: document.getElementById('detail'),
      detailScroll: document.getElementById('detail-scroll'),
      count: document.getElementById('count'),
      countLabel: document.getElementById('count-label'),
      zoomIn: document.getElementById('zoom-in'),
      zoomOut: document.getElementById('zoom-out'),
      basemapNotice: document.getElementById('basemap-notice'),
      basemapNoticeText: document.getElementById('basemap-notice-text'),
      loader: document.getElementById('loader'),
      loaderCopy: document.getElementById('loader-copy'),
      provinceLabel: document.getElementById('province-label'),
      confirmedLabel: document.getElementById('confirmed-label'),
      langEn: document.getElementById('lang-en'),
      langTh: document.getElementById('lang-th')
    };

    restoreLang();
    applyStaticStrings();

    var raw = window.SLURPEE_STORES;
    if (!raw || !raw.stores || !raw.stores.length) {
      fail(t('dataMissing'));
      return;
    }

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
      setTiles();
    });

    STATE.pins = L.layerGroup();
    STATE.map.addLayer(STATE.pins);
    STATE.map.on('moveend', debounce(renderMarkers, CULL_DEBOUNCE));

    // Stage 2: let the shell and loader paint first, then do the heavy data
    // pass. Unpacking 2,600 branches and building the first screen in one
    // synchronous block was the boot long-task on phones.
    afterPaint(function () {
      STATE.all = unpack(raw);

      buildProvinceSelect();
      restore();

      bind();
      initSheet();
      initSidebarCollapse();
      applyFilters();
      maybeAutoLocate();

      el.loader.classList.add('is-out');
      setTimeout(function () { el.loader.hidden = true; }, 400);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Caches PMTiles byte ranges (see sw.js) so repeat visits don't re-fetch
  // the same basemap tiles. file:// and plain `http.server` never reach this
  // (no Range support to cache in the first place); silently skip there.
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline-first is a bonus, not a requirement */ });
    });
  }
})();
