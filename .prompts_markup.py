#!/usr/bin/env python3
"""Zieht das statische Markup von Prompt-Tabelle, Response-Tabelle und Topic-Verwaltung aus den
Bubble-Vorlagen in prompts-page.js (10.10.).

WARUM erzeugt und nicht abgeschrieben: die Seite Prompt Insights bettet die ECHTEN Komponenten ein
(lokaler Modus, data-local). Ihr Markup steht in den Vorlagen; abgeschrieben wuerde es ab dem
ersten Umbau abweichen. Dieselbe Bauart wie .citations_markup.py.

Was ersetzt wird:
  - data-instance  -> __UPI_<TEIL>__   (prompts-page.js setzt die Kennung der Seite ein)
  - IS_DARK        -> __UPI_DARK__     (zur Laufzeit yes/no)
  - BRAND_NAME/BRAND_LOGO -> __UPI_BRAND__/__UPI_BRANDLOGO__ (eigene Marke aus dem Store)
  - die data-*-fn-Attribute fallen weg: die Seite antwortet selbst, Bubble ist nicht dabei
  - data-local="yes" an jede Wurzel; die Response-Tabelle merkt sich Ansicht und Seitengroesse
    (data-merken, wie auf dem Dashboard)
  - data-sticky-top="171" -> 16 (der Kopf dieser Seite klebt nicht, wie bei Citations); fehlt das
    Attribut (Topic-Verwaltung), wird es mit 16 gesetzt
  - der Knopf "Add Topic" der Topic-Verwaltung faellt weg: er sitzt auf dieser Seite im
    Seitenkopf (10.10. angeordnet). Die Komponente oeffnet denselben Dialog ueber openAdd().

Aufruf nach jeder Aenderung an einer der drei Vorlagen:
    python3 .prompts_markup.py
"""
import json
import re
import sys

ZIEL = "prompts-page.js"

TEILE = [
    ("upt", "bubble/prompts_table_bubble.html", "__UPI_UPT__"),
    ("urt", "bubble/responses_table_bubble.html", "__UPI_URT__"),
    ("utm", "bubble/topics_manager_bubble.html", "__UPI_UTM__"),
]

ERSATZ = {
    "CDN_PIN": "",
    "IS_DARK": "__UPI_DARK__",
    # NACH den laengeren Namen, nie davor: sonst wird aus IS_PROCESSING_2 ein "no_2".
    "IS_PROCESSING_2": "no",
    "IS_PROCESSING": "no",
    "EXPORT_INSTANCE_ID": "",
    "SPOTLIGHT_MODE": "no",
    "IS_STICKY": "yes",
    "DEFAULT_VIEW": "table",
    "BRAND_NAME": "__UPI_BRAND__",
    "BRAND_LOGO": "__UPI_BRANDLOGO__",
}

ADD_TOPIC = re.compile(r'<button class="up-export utm-addbtn"[^>]*data-topic-add-new>.*?</button>', re.S)


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
    m = m.replace('data-sticky-top="171"', 'data-sticky-top="16"')
    m = re.sub(r'\s*data-[a-z0-9-]+-fn="bubble_fn_[^"]*"', "", m)
    zusatz = ' data-local="yes"' + (' data-merken="yes"' if schluessel == "urt" else "")
    # Die Topic-Verwaltung traegt in ihrer Vorlage gar kein data-sticky-top -- dann klebte ihr Kopf
    # bei den 171 des alten Bubble-Kopfs, und mit seinem weissen Grund lag er ueber den Chips
    # (Pruefstand pi01, 10.10.: Kopf top 171, Chips ab 189). Hier also ausdruecklich 16.
    if 'data-sticky-top=' not in m.split(">", 1)[0]:
        zusatz += ' data-sticky-top="16"'
    m = re.sub(r'(<div class="up-root [^"]*")', lambda mm: mm.group(1) + zusatz, m, count=1)
    if schluessel == "utm":
        n = len(ADD_TOPIC.findall(m))
        if n != 1:
            print("ABBRUCH -- Add-Topic-Knopf in %s %d-mal gefunden, erwartet 1" % (pfad, n))
            sys.exit(1)
        m = ADD_TOPIC.sub("", m)
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
muster = (r'(  /\* ---- MARKUP ANFANG \(erzeugt von \.prompts_markup\.py -- nicht von Hand '
          r'aendern\) ---- \*/\n).*?(  /\* ---- MARKUP ENDE ---- \*/\n)')
treffer = re.findall(muster, js, re.S)
if len(treffer) != 1:
    print("ABBRUCH -- MARKUP-Block in %s nicht genau einmal gefunden" % ZIEL)
    sys.exit(1)
js = re.sub(muster, lambda mm: mm.group(1) + neu + mm.group(2), js, flags=re.S)
open(ZIEL, "w").write(js)
print("geschrieben: " + ZIEL)
