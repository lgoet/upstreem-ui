#!/usr/bin/env python3
"""Zieht das statische Markup von Visibility-Chart, Top Citations und Responses-Tabelle aus den
Bubble-Vorlagen in dashboard-page.js (08.10.). Das Agentic-Dashboard (power-dashboard.js) baut
sein Markup selbst und braucht keins.

WARUM erzeugt und nicht abgeschrieben: die Dashboard-Seite bettet die ECHTEN Komponenten ein (im
lokalen Modus, data-local). Deren Markup steht in den Vorlagen; abgeschrieben wuerde es ab dem
ersten Umbau abweichen. Dieselbe Bauart wie .citations_markup.py, von dort uebernommen.

Was ersetzt wird:
  - data-instance  -> __UDS_<TEIL>__   (dashboard-page.js setzt die Kennung der Seite ein)
  - IS_DARK        -> __UDS_DARK__     (zur Laufzeit yes/no)
  - BRAND_NAME/BRAND_LOGO -> __UDS_BRAND__/__UDS_BRANDLOGO__ (eigene Marke aus dem Store)
  - SPOTLIGHT_MODE -> no, IS_STICKY -> yes, DEFAULT_VIEW -> table (Responses wie bisher im
    Dashboard: Tabelle, Werkzeugleiste klebt)
  - die data-*-fn-Attribute fallen weg: die Seite antwortet selbst, Bubble ist nicht dabei
  - data-local="yes" an jede Wurzel
  - data-sticky-top="171" -> 16: die 171 waren der Kopf der alten Bubble-Ansicht ueber der Tabelle.
    Der Kopf dieser Seite klebt nicht, also klebt die Leiste 16 unter der Oberkante -- derselbe
    Wert wie auf Dashboard und Opportunities (core: stickyTopSetzen). 0 lag direkt am Rand
    (08.10. gemeldet).

Aufruf nach jeder Aenderung an einer der drei Vorlagen:
    python3 .dashboard_markup.py
"""
import json
import re
import sys

ZIEL = "dashboard-page.js"

TEILE = [
    ("vot", "bubble/visibility_chart_bubble.html", "__UDS_VOT__"),
    ("tcd", "bubble/topcitations_dashboard_bubble.html", "__UDS_TCD__"),
    ("urt", "bubble/responses_table_bubble.html", "__UDS_URT__"),
]

ERSATZ = {
    "CDN_PIN": "",
    "IS_DARK": "__UDS_DARK__",
    # NACH den laengeren Namen, nie davor: sonst wird aus IS_PROCESSING_2 ein "no_2".
    "IS_PROCESSING_2": "no",
    "IS_PROCESSING": "no",
    "EXPORT_INSTANCE_ID": "",
    "DOMAIN_MODE": "no",
    # BRAND_LOGO_URL vor BRAND_LOGO, aus demselben Grund wie IS_PROCESSING_2.
    "BRAND_LOGO_URL": "__UDS_BRANDLOGO__",
    "BRAND_NAME": "__UDS_BRAND__",
    "BRAND_LOGO": "__UDS_BRANDLOGO__",
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
    for k, v in ERSATZ.items():
        m = m.replace(k, v)
    # 171 war der Kopf der alten Bubble-Ansicht; hier klebt die Leiste 16 unter der Oberkante wie
    # auf der Citations-Seite (dort 08.10. gemessen).
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
muster = (r'(  /\* ---- MARKUP ANFANG \(erzeugt von \.dashboard_markup\.py -- nicht von Hand '
          r'aendern\) ---- \*/\n).*?(  /\* ---- MARKUP ENDE ---- \*/\n)')
treffer = re.findall(muster, js, re.S)
if len(treffer) != 1:
    print("ABBRUCH -- MARKUP-Block in %s nicht genau einmal gefunden" % ZIEL)
    sys.exit(1)
js = re.sub(muster, lambda mm: mm.group(1) + neu + mm.group(2), js, flags=re.S)
open(ZIEL, "w").write(js)
print("geschrieben: " + ZIEL)
