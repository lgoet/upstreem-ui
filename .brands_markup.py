#!/usr/bin/env python3
"""Zieht das statische Markup von Brands Overview und Explore Brands aus den Bubble-Vorlagen in
brands-page.js (11.10.). Dieselbe Bauart wie .prompts_markup.py, aus demselben Grund: die Seite
bettet die ECHTEN Komponenten ein (lokaler Modus), abgeschrieben wuerde ihr Markup abweichen.

Was ersetzt wird:
  - data-instance  -> __UBR_<TEIL>__   (brands-page.js setzt die Kennung der Seite ein). Die Vorlage
    von Explore Brands traegt "brands1" statt INSTANCE_ID -- beides wird ersetzt.
  - IS_DARK        -> __UBR_DARK__     (zur Laufzeit yes/no)
  - die data-*-fn-Attribute fallen weg: die Seite antwortet selbst, Bubble ist nicht dabei
  - data-local="yes" an jede Wurzel
  - data-sticky-top="171" -> 16 (der Kopf dieser Seite klebt nicht, wie bei Citations)

Aufruf nach jeder Aenderung an einer der zwei Vorlagen:
    python3 .brands_markup.py
"""
import json
import re
import sys

ZIEL = "brands-page.js"

TEILE = [
    ("ubo", "bubble/brands_overview_bubble.html", "__UBR_UBO__"),
    ("udb", "bubble/discover_brands_bubble.html", "__UBR_UDB__"),
]

ERSATZ = {
    "CDN_PIN": "",
    "IS_DARK": "__UBR_DARK__",
    # NACH den laengeren Namen, nie davor: sonst wird aus IS_PROCESSING_2 ein "no_2".
    "IS_PROCESSING_2": "no",
    "IS_PROCESSING": "no",
    "EXPORT_INSTANCE_ID": "",
    "SPOTLIGHT_MODE": "no",
    "IS_STICKY": "yes",
    "DEFAULT_VIEW": "table",
}

def markup(pfad):
    s = open(pfad).read()
    m = re.search(r'^<div class="up-root[^\n]*$', s, re.M)
    if not m:
        return None
    rest = s[m.start():]
    # Bis zum SCHLIESSENDEN </div> der Wurzel, gezaehlt -- Kommentare und Scripte uebersprungen
    # (Begruendung in .landing_markup.py).
    muster = re.compile(r"<!--(?:(?!-->).)*?-->|<script\b[^>]*>.*?</script>|<(/?)div\b", re.S)
    tiefe = 0
    for t in muster.finditer(rest):
        ganz = t.group(0)
        if ganz.startswith("<!--") or ganz.startswith("<script"):
            continue
        if t.group(1):
            tiefe -= 1
            if tiefe == 0:
                return rest[:t.end() + 1].rstrip()
        else:
            tiefe += 1
    return rest.rstrip()


bloecke = {}
for schluessel, pfad, kennung in TEILE:
    m = markup(pfad)
    if m is None:
        print("ABBRUCH -- kein up-root in " + pfad)
        sys.exit(1)
    m = m.replace('data-instance="INSTANCE_ID"', 'data-instance="%s"' % kennung)
    m = m.replace('data-instance="brands1"', 'data-instance="%s"' % kennung)
    for k, v in ERSATZ.items():
        m = m.replace(k, v)
    m = m.replace('data-sticky-top="171"', 'data-sticky-top="16"')
    m = re.sub(r'\s*data-[a-z0-9-]+-fn="bubble_fn_[^"]*"', "", m)
    zusatz = ' data-local="yes"'
    # Brands Overview mit der flachen Tabelle aus core (15.10., data-flach): ohne Kasten, bis an
    # die Kanten, Kopf 48. Hier und nicht in der Vorlage: dieselbe Komponente in einer
    # Bubble-Gruppe behaelt ihren Kasten. Keine feste Hoehe -- ueber der Tabelle steht der Chart.
    if schluessel == "ubo":
        zusatz += ' data-flach="yes"'
    m = re.sub(r'(<div class="up-root [^"]*")', lambda mm: mm.group(1) + zusatz, m, count=1)
    if 'data-instance="%s"' % kennung not in m:
        print("ABBRUCH -- data-instance in %s nicht ersetzt" % pfad)
        sys.exit(1)
    # HTML-Kommentare raus: sie gehoeren zur Vorlage, nicht in eine JS-Zeichenkette.
    m = re.sub(r"<!--(?:(?!-->).)*?-->", "", m, flags=re.S)
    rest = [x for x in re.findall(r'"[A-Z][A-Z0-9_]{3,}"', m)]
    if rest:
        print("ABBRUCH -- unersetzte Platzhalter in %s: %s" % (pfad, ", ".join(sorted(set(rest)))))
        sys.exit(1)
    m = re.sub(r'>\s+<', "><", m)
    m = re.sub(r'\s{2,}', " ", m)
    bloecke[schluessel] = m
    print("%-4s %-40s %6d Bytes" % (schluessel, pfad, len(m)))

zeilen = ["  var MARKUP = {"]
for schluessel, _, _ in TEILE:
    zeilen.append("    %s: %s," % (schluessel, json.dumps(bloecke[schluessel])))
zeilen[-1] = zeilen[-1].rstrip(",")
zeilen.append("  };")
neu = "\n".join(zeilen) + "\n"

js = open(ZIEL).read()
muster = (r'(  /\* ---- MARKUP ANFANG \(erzeugt von \.brands_markup\.py -- nicht von Hand '
          r'aendern\) ---- \*/\n).*?(  /\* ---- MARKUP ENDE ---- \*/\n)')
treffer = re.findall(muster, js, re.S)
if len(treffer) != 1:
    print("ABBRUCH -- MARKUP-Block in %s nicht genau einmal gefunden" % ZIEL)
    sys.exit(1)
js = re.sub(muster, lambda mm: mm.group(1) + neu + mm.group(2), js, flags=re.S)
open(ZIEL, "w").write(js)
print("geschrieben: " + ZIEL)
