# Slurpee Map Thailand

**[crnds.github.io/slurpee](https://crnds.github.io/slurpee/)**

Every 7-Eleven branch in Thailand that sells Slurpee, on an interactive map.
**2,655 branches** across 77 provinces, 2,404 of them confirmed Slurpee sellers
by 7-Eleven's own store directory.

No build step, no package manager, no framework — plain HTML, CSS and
JavaScript. **No third-party services at runtime**: the basemap, the store
data, the fonts and every library are served from this repository.

---

## Running it

```sh
python3 serve.py        # http://localhost:8080
```

**Use `serve.py`, not `python3 -m http.server`.** The basemap is a PMTiles
archive read entirely through HTTP range requests; the stdlib server ignores
`Range` and answers with the full 77 MB body, so no tile ever renders. GitHub
Pages does honour `Range`, which is why the deployed site needs no server code.

Opening `index.html` directly over `file://` works for branches, search and
filters, but the browser blocks both the basemap and the webfonts as
cross-origin. The app says so on screen rather than showing a broken map.

## Rebuilding the basemap

`data/basemap.pmtiles` is committed, so it has to stay under GitHub's 100 MB
per-file limit. That is what caps it at zoom 12 — the same extract is 168 MB at
z13 and 469 MB at z14. The cost is buildings, POIs and minor streets: zoom in on
a branch and the background is overzoomed z12 data.

```sh
brew install pmtiles

# 1. full-detail source — gitignored, stays on your machine
pmtiles extract https://build.protomaps.com/YYYYMMDD.pmtiles \
  data/thailand.pmtiles --bbox=97.2,5.5,105.8,20.6 --maxzoom=14

# 2. the committed archive, clipped to Thailand's border
pmtiles extract data/thailand.pmtiles data/basemap.pmtiles \
  --region=tha.geojson --maxzoom=12
```

Protomaps keeps planet builds for roughly two weeks, so use a recent date —
older ones return 404. `tha.geojson` is Thailand's ADM0 boundary as a bare
MultiPolygon ([geoBoundaries](https://www.geoboundaries.org/) gbOpen THA ADM0,
unwrapped from its FeatureCollection); clipping to the border instead of the
bounding box saves about a third of the bytes. Add `--dry-run` to size an
extract before writing it.

## How the data was built

`branches.md` is a list of 2,678 store codes and truncated Thai branch names —
no coordinates. `fetch_stores.py` resolves each code against 7-Eleven's public
store-locator API and writes `data/stores.js`.

OpenStreetMap cannot do this matching: 4,706 of Thailand's 4,725 7-Eleven POIs
are named simply "7-Eleven". So OSM supplies the map and 7-Eleven's directory
supplies the identity, joined **on the 5-digit store code, never the name** —
names drift between the two sources, and 834 branches keep the `branches.md`
spelling because it differs from the API's.

23 codes resolve to nothing. They are provably delisted rather than fetch
failures: sweeping each code's prefix returns 44–85 sibling codes but not the
code itself. They are listed in `data/unresolved.txt`.

Re-run `python3 fetch_stores.py` to refresh. It is resumable and rate-limit
aware — the API blocks aggressive clients hard.

## Layout

| Path | |
|---|---|
| `index.html`, `style.css`, `app.js` | the app |
| `hero.js` | three.js slush cup in the sidebar |
| `serve.py` | static server with HTTP range support |
| `fetch_stores.py` | builds `data/stores.js` from `branches.md` |
| `DESIGN.md` | the visual system |
| `data/basemap.pmtiles` | the map background (z12, clipped to Thailand) |
| `assets/`, `vendor/` | icons, self-hosted fonts, vendored libraries |

Deliberately not committed (both rebuildable, see `.gitignore`):
`data/thailand.pmtiles` (469 MB full-detail basemap source) and
`data/_cache.json` (19 MB fetch cache).

## Credits

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright)
contributors, ODbL. Basemap tiles built by [Protomaps](https://protomaps.com).
Store details from 7-Eleven Thailand's public store directory.

Bundled: [Leaflet](https://leafletjs.com) (BSD-2-Clause),
[protomaps-leaflet](https://github.com/protomaps/protomaps-leaflet)
(BSD-3-Clause), [three.js](https://threejs.org) (MIT). Fonts — Fredoka, Outfit,
Geist Mono and IBM Plex Sans Thai — are SIL Open Font License 1.1.
