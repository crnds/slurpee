#!/usr/bin/env python3
"""
Resolve every 7-Eleven branch code in branches.md to coordinates + address
using the official 7-Eleven Thailand store locator API, and emit data/stores.js.

    python3 fetch_stores.py            # resume (skips codes already cached)
    python3 fetch_stores.py --refresh  # ignore the cache, re-fetch everything

Join key is the 5-digit store code. Branch NAMES must never be used to match:
branches.md truncates them to ~16 chars and the API's names drift from the list's.
"""

import json
import os
import re
import sys
import time
import threading
import urllib.request
import urllib.error
from datetime import date

# ── CONFIG ────────────────────────────────────────────────────────────────
ROOT = os.path.dirname(os.path.abspath(__file__))
BRANCHES = os.path.join(ROOT, "branches.md")
DATA_DIR = os.path.join(ROOT, "data")
CACHE = os.path.join(DATA_DIR, "_cache.json")
OUT_JS = os.path.join(DATA_DIR, "stores.js")
UNRESOLVED = os.path.join(DATA_DIR, "unresolved.txt")

API_SEARCH = "https://web-api-ro.7eleven.co.th/v1/Store/GetStoreBySearch"
API_PRODUCTS = "https://web-api-ro.7eleven.co.th/v1/Store/GetProductGroup"
HEADERS = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    "Origin": "https://www.7eleven.co.th",
    "Referer": "https://www.7eleven.co.th/find-store",
}

# The upstream limiter is strict and bans by IP for minutes at a time, so this
# runs serially and adapts: every 429 slows the pace down and sleeps it off;
# a long clean streak speeds it gently back up. Measured safe pace ~1.4 req/s.
WORKERS = 1
SPACING_BASE = 0.7   # seconds between requests when things are healthy
SPACING_MAX = 4.0
RETRIES = 4
COOLDOWN = 60.0      # first sleep after a 429; doubles up to COOLDOWN_MAX
COOLDOWN_MAX = 480.0
PAGE_CAP = 300       # rows the search endpoint returns before truncating
SLURPEE = "SP"       # product code for สเลอปี้ / Slurpee

_throttle_lock = threading.Lock()
_next_slot = [0.0]
_spacing = [SPACING_BASE]
_clean_streak = [0]


# ── HTTP ──────────────────────────────────────────────────────────────────
def _throttle():
    """Space request starts globally so all workers together stay gentle."""
    with _throttle_lock:
        now = time.monotonic()
        wait = max(0.0, _next_slot[0] - now)
        _next_slot[0] = max(now, _next_slot[0]) + _spacing[0]
    if wait:
        time.sleep(wait)


def _slow_down():
    """A 429 landed: widen the gap between requests."""
    with _throttle_lock:
        _spacing[0] = min(_spacing[0] * 1.5, SPACING_MAX)
        _clean_streak[0] = 0
    return _spacing[0]


def _speed_up():
    """Long clean run: ease back toward the base pace."""
    with _throttle_lock:
        _clean_streak[0] += 1
        if _clean_streak[0] >= 150 and _spacing[0] > SPACING_BASE:
            _spacing[0] = max(_spacing[0] / 1.25, SPACING_BASE)
            _clean_streak[0] = 0


def request(url, payload=None, timeout=30):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.load(resp)


def fetch_code(code):
    """Return the single store row for a code, or None. Retries with backoff."""
    delay = 1.0
    cooldown = COOLDOWN
    for attempt in range(RETRIES):
        _throttle()
        try:
            body = request(API_SEARCH, {"keyword": code, "products": []})
            rows = body.get("data") or []
            _speed_up()
            exact = [r for r in rows if r.get("code") == code]
            if exact:
                return exact[0]
            return None                      # genuinely unknown code, don't retry
        except urllib.error.HTTPError as exc:
            if exc.code == 429:
                gap = _slow_down()
                print(f"  ~ rate limited, sleeping {cooldown:.0f}s "
                      f"(pace now {1/gap:.1f}/s)", file=sys.stderr)
                time.sleep(cooldown)
                cooldown = min(cooldown * 2, COOLDOWN_MAX)
                continue
            if attempt == RETRIES - 1:
                print(f"  ! {code}: {exc}", file=sys.stderr)
                return None
            time.sleep(delay)
            delay = min(delay * 2, 16.0)
        except Exception as exc:             # network / timeout / bad JSON
            if attempt == RETRIES - 1:
                print(f"  ! {code}: {exc}", file=sys.stderr)
                return None
            time.sleep(delay)
            delay = min(delay * 2, 16.0)
    return None


def fetch_keyword(keyword):
    """Return every row the search endpoint gives for a keyword, or None."""
    delay = 1.0
    cooldown = COOLDOWN
    for attempt in range(RETRIES):
        _throttle()
        try:
            body = request(API_SEARCH, {"keyword": keyword, "products": []})
            _speed_up()
            return body.get("data") or []
        except urllib.error.HTTPError as exc:
            if exc.code == 429:
                gap = _slow_down()
                print(f"  ~ rate limited, sleeping {cooldown:.0f}s "
                      f"(pace now {1/gap:.1f}/s)", file=sys.stderr, flush=True)
                time.sleep(cooldown)
                cooldown = min(cooldown * 2, COOLDOWN_MAX)
                continue
            if attempt == RETRIES - 1:
                print(f"  ! {keyword!r}: {exc}", file=sys.stderr)
                return None
            time.sleep(delay)
            delay = min(delay * 2, 16.0)
        except Exception as exc:
            if attempt == RETRIES - 1:
                print(f"  ! {keyword!r}: {exc}", file=sys.stderr)
                return None
            time.sleep(delay)
            delay = min(delay * 2, 16.0)
    return None


def sweep_prefixes(wanted, cache):
    """
    Harvest stores in bulk instead of one code at a time.

    The search endpoint matches a keyword as a SUBSTRING of the store code, so
    one query for "003" returns every store whose code contains "003" — up to a
    server-side cap of PAGE_CAP rows. Sweeping the 3-digit prefixes of the codes
    we still need replaces ~2,400 requests with ~190, which matters a great deal
    against a limiter this strict. Any prefix that comes back at the cap is
    subdivided a digit deeper; whatever is still missing afterwards falls back
    to exact per-code lookups.
    """
    def harvest(keyword):
        rows = fetch_keyword(keyword)
        if rows is None:
            return None
        for r in rows:
            c = r.get("code")
            if c and c not in cache:
                cache[c] = r
        return len(rows)

    queue = sorted({c[:3] for c in wanted})
    print(f"sweeping {len(queue)} code prefixes "
          f"(instead of {len(wanted)} single lookups)")

    done = 0
    while queue:
        pre = queue.pop(0)
        n = harvest(pre)
        done += 1
        if n == PAGE_CAP:
            # Truncated — go a digit deeper so nothing is silently dropped.
            deeper = [pre + d for d in "0123456789"]
            queue = deeper + queue
            print(f"  {pre}: hit the {PAGE_CAP}-row cap, subdividing", flush=True)
        if done % 20 == 0:
            missing = sum(1 for c in wanted if c not in cache)
            print(f"  {done} queries, {len(queue)} queued, {missing} codes still missing",
                  flush=True)
            save_cache(cache)
    save_cache(cache)


def wait_for_clear(probe_code):
    """Block until the API answers again, in case a previous run got us banned."""
    wait = 30.0
    while True:
        try:
            request(API_SEARCH, {"keyword": probe_code, "products": []})
            return
        except urllib.error.HTTPError as exc:
            if exc.code != 429:
                return
            print(f"  ~ still rate limited, retrying in {wait:.0f}s", flush=True)
            time.sleep(wait)
            wait = min(wait * 1.5, 300.0)
        except Exception:
            time.sleep(wait)


# ── INPUT ─────────────────────────────────────────────────────────────────
def read_branches():
    """[(code, listName)] from branches.md, 'SE ' prefix stripped."""
    out = []
    with open(BRANCHES, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            m = re.match(r"^(\d{5})\s+(.*)$", line)
            if not m:
                print(f"  ? skipping unparsable line: {line!r}", file=sys.stderr)
                continue
            code, name = m.group(1), m.group(2).strip()
            name = re.sub(r"^SE\s+", "", name).strip()
            out.append((code, name))
    return out


def load_cache():
    if os.path.exists(CACHE):
        try:
            with open(CACHE, encoding="utf-8") as fh:
                return json.load(fh)
        except (json.JSONDecodeError, OSError):
            print("  ? cache unreadable, starting fresh", file=sys.stderr)
    return {}


def save_cache(cache):
    tmp = CACHE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(cache, fh, ensure_ascii=False)
    os.replace(tmp, CACHE)


# ── OUTPUT ────────────────────────────────────────────────────────────────
def norm(s):
    return (s or "").strip()


def build_payload(branches, cache, products):
    provinces, districts, subdistricts = [], [], []
    pi, di, si = {}, {}, {}

    def intern(value, table, index):
        value = norm(value)
        if value not in index:
            index[value] = len(table)
            table.append(value)
        return index[value]

    stores, unresolved = [], []
    for code, list_name in branches:
        row = cache.get(code)
        if not row:
            unresolved.append(code)
            continue
        pg = norm(row.get("productGroup"))
        api_name = norm(row.get("name"))
        stores.append([
            code,
            api_name,
            round(float(row["lat"]), 5),
            round(float(row["lng"]), 5),
            intern(row.get("province"), provinces, pi),
            intern(row.get("district"), districts, di),
            intern(row.get("subdistrict"), subdistricts, si),
            norm(row.get("address")),
            norm(row.get("tel")),
            pg,
            1 if SLURPEE in pg.split(",") else 0,
            # keep the branches.md name only when it adds information
            "" if list_name == api_name else list_name,
        ])

    return {
        "generated": date.today().isoformat(),
        "source": "branches.md + web-api-ro.7eleven.co.th (GetStoreBySearch)",
        "fields": ["code", "name", "lat", "lng", "provIdx", "distIdx",
                   "subIdx", "address", "tel", "productGroup", "sp", "listName"],
        "provinces": provinces,
        "districts": districts,
        "subdistricts": subdistricts,
        "products": products,
        "stores": stores,
    }, unresolved


def write_js(payload):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(OUT_JS, "w", encoding="utf-8") as fh:
        fh.write("/* Generated by fetch_stores.py — do not edit by hand. */\n")
        fh.write("window.SLURPEE_STORES = ")
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write(";\n")


# ── MAIN ──────────────────────────────────────────────────────────────────
def main():
    refresh = "--refresh" in sys.argv
    os.makedirs(DATA_DIR, exist_ok=True)

    branches = read_branches()
    print(f"branches.md: {len(branches)} codes")

    cache = {} if refresh else load_cache()
    todo = [c for c, _ in branches if c not in cache]
    print(f"cached: {len(cache)}   to fetch: {len(todo)}")

    if todo:
        print("checking the API is answering...")
        wait_for_clear(todo[0])

        # Bulk sweep first — far fewer requests against a strict limiter.
        sweep_prefixes(todo, cache)

        # Anything the sweep missed gets an exact lookup.
        todo = [c for c, _ in branches if c not in cache]
        if todo:
            print(f"{len(todo)} codes left after the sweep; fetching individually")
            t0 = time.time()
            for n, code in enumerate(todo, 1):
                row = fetch_code(code)
                if row:
                    cache[code] = row
                if n % 50 == 0 or n == len(todo):
                    rate = n / max(time.time() - t0, 0.001)
                    left = (len(todo) - n) / max(rate, 0.001)
                    print(f"  {n}/{len(todo)}  {rate:.2f}/s  ~{left/60:.0f} min left",
                          flush=True)
                    save_cache(cache)
            save_cache(cache)

    print("fetching product groups...")
    products = {}
    try:
        for p in request(API_PRODUCTS).get("data") or []:
            products[p["code"]] = p["name"]
    except Exception as exc:
        print(f"  ! product groups failed ({exc}) — continuing without labels",
              file=sys.stderr)

    payload, unresolved = build_payload(branches, cache, products)
    write_js(payload)

    confirmed = sum(s[10] for s in payload["stores"])
    total = len(payload["stores"])
    size = os.path.getsize(OUT_JS) / 1024
    print("\n── summary ──────────────────────────────")
    print(f"  resolved          {total} / {len(branches)}")
    print(f"  unresolved        {len(unresolved)}")
    print(f"  Slurpee confirmed {confirmed} ({confirmed*100//max(total,1)}%)")
    print(f"  provinces         {len(payload['provinces'])}")
    print(f"  data/stores.js    {size:.0f} KB")

    if unresolved:
        with open(UNRESOLVED, "w", encoding="utf-8") as fh:
            fh.write("\n".join(unresolved) + "\n")
        print(f"  -> wrote {UNRESOLVED} (re-run to retry these)")
    elif os.path.exists(UNRESOLVED):
        os.remove(UNRESOLVED)


if __name__ == "__main__":
    main()
