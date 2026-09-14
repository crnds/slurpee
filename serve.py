#!/usr/bin/env python3
"""
Static file server for the Slurpee map, with HTTP Range support.

Why this exists instead of `python3 -m http.server`:

    data/thailand.pmtiles is a ~470 MB PMTiles archive. The browser never
    downloads it whole — protomaps-leaflet reads the header, walks the tile
    directory, and pulls individual map tiles with `Range: bytes=a-b`
    requests. Python's stdlib SimpleHTTPRequestHandler ignores Range
    entirely and answers 200 with the full body, so every tile fetch would
    try to stream 470 MB. The map never renders.

    This subclass answers those requests with 206 Partial Content.

Usage:
    python3 serve.py            # http://localhost:8080
    python3 serve.py 9000       # custom port
"""

import http.server
import os
import re
import sys

PORT = 8080
RANGE_RE = re.compile(r"^bytes=(\d*)-(\d*)$")


class RangeHandler(http.server.SimpleHTTPRequestHandler):
    """SimpleHTTPRequestHandler that honours single-range byte requests."""

    # Keep-alive matters here: rendering the map issues hundreds of small
    # range requests, and HTTP/1.0 would tear down the TCP connection after
    # every one. Every response path below sets Content-Length, which is what
    # HTTP/1.1 needs to reuse the connection.
    protocol_version = "HTTP/1.1"

    # PMTiles has no entry in the stdlib mimetypes table.
    extensions_map = dict(http.server.SimpleHTTPRequestHandler.extensions_map)
    extensions_map[".pmtiles"] = "application/octet-stream"
    extensions_map[".woff2"] = "font/woff2"

    def send_head(self):
        rng = self.headers.get("Range")
        if not rng:
            return super().send_head()

        path = self.translate_path(self.path)
        if os.path.isdir(path) or not os.path.isfile(path):
            return super().send_head()   # let the base class 404/redirect

        m = RANGE_RE.match(rng.strip())
        if not m:
            self.send_error(400, "Malformed Range header")
            return None

        size = os.path.getsize(path)
        first, last = m.group(1), m.group(2)

        if first:
            start = int(first)
            end = int(last) if last else size - 1
        elif last:
            start = max(0, size - int(last))   # suffix range: bytes=-500
            end = size - 1
        else:
            self.send_error(400, "Malformed Range header")
            return None

        end = min(end, size - 1)
        if start > end or start >= size:
            self.send_response(416, "Requested Range Not Satisfiable")
            self.send_header("Content-Range", "bytes */%d" % size)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return None

        try:
            f = open(path, "rb")
        except OSError:
            self.send_error(404, "File not found")
            return None

        f.seek(start)
        self._remaining = end - start + 1

        self.send_response(206, "Partial Content")
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Length", str(self._remaining))
        self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
        self.send_header("Accept-Ranges", "bytes")
        self.end_headers()
        return _Slice(f, self._remaining)

    def send_header(self, keyword, value):
        if keyword.lower() == "accept-ranges":
            self._sent_accept_ranges = True
        super().send_header(keyword, value)

    def end_headers(self):
        # Advertise range support on plain 200s too, so a client that checks
        # before ranging knows it may ask for slices of the archive.
        if not getattr(self, "_sent_accept_ranges", False):
            self.send_header("Accept-Ranges", "bytes")
        self._sent_accept_ranges = False
        super().end_headers()


class _Slice:
    """File wrapper that stops after `remaining` bytes, for copyfile()."""

    def __init__(self, fp, remaining):
        self._fp = fp
        self._remaining = remaining

    def read(self, n=-1):
        if self._remaining <= 0:
            return b""
        if n < 0 or n > self._remaining:
            n = self._remaining
        chunk = self._fp.read(n)
        self._remaining -= len(chunk)
        return chunk

    def close(self):
        self._fp.close()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else PORT
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    server = http.server.ThreadingHTTPServer(("", port), RangeHandler)
    print("Slurpee map  →  http://localhost:%d  (Ctrl-C to stop)" % port)
    if not os.path.exists("data/thailand.pmtiles"):
        print("note: data/thailand.pmtiles missing — the map will fall back "
              "to OpenStreetMap raster tiles.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")


if __name__ == "__main__":
    main()
