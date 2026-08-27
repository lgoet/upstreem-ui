#!/usr/bin/env python3
"""Zieht das statische Markup der Komponenten aus den Bubble-Vorlagen in landing-hero.js.

WARUM erzeugt und nicht abgeschrieben: die Landingpage zeigt die ECHTEN Komponenten. Das ist nur
wahr, solange ihr Markup dasselbe ist wie in der App. Abgeschriebenes Markup weicht ab dem ersten
Umbau ab, und dann zeigt die Seite eine Oberflaeche, die es nicht mehr gibt -- also genau das, was
mit dieser Bauart vermieden werden soll.

Was ersetzt wird: die Bubble-Platzhalter (INSTANCE_ID, IS_DARK, BRAND_NAME ...) durch feste Werte,
und die data-*-fn-Attribute fallen ganz weg. Auf der Landingpage gibt es kein Bubble, das antworten
koennte; ein Attribut mit einem bubble_fn_-Namen wuerde die Komponenten dazu bringen, nach einer
Funktion zu suchen, die es nie geben wird.

Aufruf nach jeder Aenderung an einer der vier Vorlagen:
    python3 .landing_markup.py
"""
import json
import re
import sys

ZIEL = "landing-hero.js"

# Reihenfolge ist die Reihenfolge im Fenster: Leiste, Seitenkopf, Chart, Zitate.
TEILE = [
    ("usn", "bubble/sidebar_bubble.html", "lh-usn"),
    ("dph", "page-headers/bubble/dashboard_page_header_bubble.html", "lh-dph"),
    ("vot", "bubble/visibility_chart_bubble.html", "lh-vot"),
    ("tcd", "bubble/topcitations_dashboard_bubble.html", "lh-tcd"),
]

# Feste Werte fuer die Platzhalter. BRAND_NAME ist eine erfundene Marke -- erfundene Zahlen unter
# einem echten Firmennamen saehen auf einer oeffentlichen Seite wie Daten ueber diese Firma aus.
ERSATZ = {
    "CDN_PIN": "",
    "IS_DARK": "no",
    "IS_PROCESSING_2": "no",
    "IS_PROCESSING": "no",
    "TEAM_ID": "t1",
    "EXPORT_INSTANCE_ID": "",
    "BRAND_NAME": "Kestrel",
    "BRAND_LOGO_URL": "",
}


def markup(pfad):
    s = open(pfad).read()
    m = re.search(r'^<div class="up-root[^\n]*$', s, re.M)
    if not m:
        return None
    rest = s[m.start():]
    # Bis zum letzten </div> vor dem ersten <script> oder <link> -- danach beginnt der Lader, und
    # der gehoert nicht ins Markup: hier laedt der Lader der Landingpage.
    end = re.search(r'</div>\s*(?=<script|<link|$)', rest)
    return (rest[:end.end()] if end else rest).rstrip()


bloecke = {}
for schluessel, pfad, kennung in TEILE:
    m = markup(pfad)
    if m is None:
        print("ABBRUCH -- kein up-root in " + pfad)
        sys.exit(1)
    m = m.replace('data-instance="INSTANCE_ID"', 'data-instance="%s"' % kennung)
    m = m.replace('data-instance="ROOTID_[dynamic id]"', 'data-instance="%s"' % kennung)
    for k, v in ERSATZ.items():
        m = m.replace(k, v)
    # Die Rueckwege nach Bubble fallen weg. Auch mehrzeilig eingerueckt geschrieben, deshalb der
    # Blick auf das ganze Attribut samt fuehrendem Leerraum.
    m = re.sub(r'\s*data-[a-z0-9-]+-fn="bubble_fn_[^"]*"', "", m)
    # Uebrige Platzhalter melden, statt sie stehen zu lassen: ein IS_SOMETHING im Markup ist ein
    # stiller Fehler -- die Komponente liest es als echten Wert.
    rest = re.findall(r'"[A-Z][A-Z0-9_]{3,}"', m)
    if rest:
        print("ABBRUCH -- unersetzte Platzhalter in %s: %s" % (pfad, ", ".join(sorted(set(rest)))))
        sys.exit(1)
    # Leerraum zwischen Elementen einsammeln: das Markup landet in einer JS-Zeichenkette, und
    # Zeilenumbrueche darin bringen nichts ausser Bytes.
    m = re.sub(r'>\s+<', "><", m)
    m = re.sub(r'\s{2,}', " ", m)
    bloecke[schluessel] = m
    print("%-4s %-52s %6d Bytes" % (schluessel, pfad, len(m)))

zeilen = ["  var MARKUP = {"]
for schluessel, _, _ in TEILE:
    zeilen.append("    %s: %s," % (schluessel, json.dumps(bloecke[schluessel])))
zeilen[-1] = zeilen[-1].rstrip(",")
zeilen.append("  };")
neu = "\n".join(zeilen) + "\n"

js = open(ZIEL).read()
muster = (r'(  /\* ---- MARKUP ANFANG \(erzeugt von \.landing_markup\.py -- nicht von Hand '
          r'aendern\) ---- \*/\n).*?(  /\* ---- MARKUP ENDE ---- \*/\n)')
if not re.search(muster, js, re.S):
    print("ABBRUCH -- die Markierungen fehlen in " + ZIEL)
    sys.exit(1)
js = re.sub(muster, lambda mm: mm.group(1) + neu + mm.group(2), js, count=1, flags=re.S)
open(ZIEL, "w").write(js)
print("%s geschrieben: %d Bytes" % (ZIEL, len(js)))
