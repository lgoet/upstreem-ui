#!/usr/bin/env python3
"""Zieht das statische Markup von Prompt Research aus seiner Bubble-Vorlage in
prompt-research-page.js (09.10.).

Dieselbe Bauart wie .citations_markup.py: die Seite bettet die ECHTEN Komponenten ein (lokaler
Modus, data-local); abgeschrieben wuerde ihr Markup ab dem ersten Umbau abweichen.

Was ersetzt wird:
  - data-instance  -> __URS_UPR__  (prompt-research-page.js setzt die Kennung der Seite ein; die
                      Vorlage traegt den Bubble-Ausdruck "ROOTID_[dynamic id]")
  - IS_DARK        -> __URS_DARK__ (zur Laufzeit yes/no)
  - die data-*-fn-Attribute fallen weg: die Seite antwortet selbst, Bubble ist nicht dabei
  - data-local="yes" an jede Wurzel
  - die beiden JSON-Startwerte (#upr-markets-json, #upr-suggested-keywords-json) bleiben leer:
    Maerkte und Themen kommen aus den Ablagen von core (setUpstreemAllMarkets, setUpstreemTopics)

Aufruf nach jeder Aenderung an einer der drei Vorlagen:
    python3 .prompt_research_markup.py
"""
import json
import re
import sys

ZIEL = "prompt-research-page.js"

TEILE = [
    ("upr", "bubble/prompt_research_bubble.html", "__URS_UPR__"),
]

ERSATZ = {
    "CDN_PIN": "",
    "IS_DARK": "__URS_DARK__",
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
    m = m.replace('data-instance="ROOTID_[dynamic id]"', 'data-instance="%s"' % kennung)
    if kennung not in m:
        print("ABBRUCH -- keine data-instance in " + pfad)
        sys.exit(1)
    for k, v in ERSATZ.items():
        m = m.replace(k, v)
    m = m.replace('data-sticky-top="171"', 'data-sticky-top="16"')
    m = re.sub(r'\s*data-[a-z0-9-]+-fn="bubble_fn_[^"]*"', "", m)
    m = re.sub(r'(<div class="up-root [^"]*")', r'\1 data-local="yes"', m, count=1)
    rest = [x for x in re.findall(r'"[A-Z][A-Z0-9_]{3,}"', m)]
    if rest:
        print("ABBRUCH -- unersetzte Platzhalter in %s: %s" % (pfad, ", ".join(sorted(set(rest)))))
        sys.exit(1)
    m = re.sub(r'>\s+<', "><", m)
    m = re.sub(r'\s{2,}', " ", m)
    bloecke[schluessel] = m
    print("%-6s %-46s %6d Bytes" % (schluessel, pfad, len(m)))

zeilen = ["  var MARKUP = {"]
for schluessel, _, _ in TEILE:
    zeilen.append("    %s: %s," % (schluessel, json.dumps(bloecke[schluessel])))
zeilen[-1] = zeilen[-1].rstrip(",")
zeilen.append("  };")
neu = "\n".join(zeilen) + "\n"

js = open(ZIEL).read()
muster = (r'(  /\* ---- MARKUP ANFANG \(erzeugt von \.prompt_research_markup\.py -- nicht von Hand '
          r'aendern\) ---- \*/\n).*?(  /\* ---- MARKUP ENDE ---- \*/\n)')
treffer = re.findall(muster, js, re.S)
if len(treffer) != 1:
    print("ABBRUCH -- MARKUP-Block in %s nicht genau einmal gefunden" % ZIEL)
    sys.exit(1)
js = re.sub(muster, lambda mm: mm.group(1) + neu + mm.group(2), js, flags=re.S)
open(ZIEL, "w").write(js)
print("geschrieben: " + ZIEL)
