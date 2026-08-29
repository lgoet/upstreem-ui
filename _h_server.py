#!/usr/bin/env python3
"""Messserver fuer die Harnesses.

python3 -m http.server erlaubt dem Browser das Zwischenspeichern, und genau daran sind in dieser
Sitzung mehrere Messrunden gescheitert: die Datei war geaendert, geladen wurde die alte, und der
Fehler sah wie ein kaputter Fix aus. Dieser Server schickt zu JEDER Antwort no-store -- damit ist
jede Messung eine Messung der Datei auf der Platte.

    python3 _h_server.py 8120
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class OhneSpeicher(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("Pragma", "no-cache")
        super().end_headers()

    def log_message(self, *_):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8120
    ThreadingHTTPServer(("127.0.0.1", port), OhneSpeicher).serve_forever()
