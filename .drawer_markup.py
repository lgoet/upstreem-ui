#!/usr/bin/env python3
"""Zieht das statische Markup der eingebetteten Bausteine aus den Bubble-Vorlagen in die Drawer aus
core (12.10.): prompt-detail.js (Visibility-Chart, Top Citations, Responses) und brand-drawer.js
(Top Citations, Responses). Nachbau von .dashboard_markup.py; Unterschiede: Platzhalter
__<PRAEFIX>_*__, die Leiste klebt unter dem Glaskopf (IS_STICKY yes, seit 13.10.), Responses als Tabelle.
Bis zum Marken-Drawer hiess die Datei .prompt_detail_markup.py -- eine zweite Kopie fuer den
zweiten Drawer waere ab dem ersten Umbau auseinandergelaufen.

WARUM erzeugt und nicht abgeschrieben: die Dashboard-Seite bettet die ECHTEN Komponenten ein (im
lokalen Modus, data-local). Deren Markup steht in den Vorlagen; abgeschrieben wuerde es ab dem
ersten Umbau abweichen. Dieselbe Bauart wie .citations_markup.py, von dort uebernommen.

Was ersetzt wird:
  - data-instance  -> __UDS_<TEIL>__   (dashboard-page.js setzt die Kennung der Seite ein)
  - IS_DARK        -> __UPRD_DARK__     (zur Laufzeit yes/no)
  - BRAND_NAME/BRAND_LOGO -> __UPRD_BRAND__/__UPRD_BRANDLOGO__ (eigene Marke aus dem Store)
  - SPOTLIGHT_MODE -> no, IS_STICKY -> yes, DEFAULT_VIEW -> cards (Responses auf dem Dashboard als
    Karten, Werkzeugleiste klebt), dazu data-merken="yes" an den Responses (ZUSATZ)
  - die data-*-fn-Attribute fallen weg: die Seite antwortet selbst, Bubble ist nicht dabei
  - data-local="yes" an jede Wurzel
  - data-sticky-top="171" -> 16: die 171 waren der Kopf der alten Bubble-Ansicht ueber der Tabelle.
    Der Kopf dieser Seite klebt nicht, also klebt die Leiste 16 unter der Oberkante -- derselbe
    Wert wie auf Dashboard und Opportunities (core: stickyTopSetzen). 0 lag direkt am Rand
    (08.10. gemeldet).

Aufruf nach jeder Aenderung an einer der Vorlagen (ohne Argument: beide Drawer):
    python3 .drawer_markup.py [prompt|brand]
"""
import json
import re
import sys

VORLAGE = {
    "vot": "bubble/visibility_chart_bubble.html",
    "tcd": "bubble/topcitations_dashboard_bubble.html",
    "urt": "bubble/responses_table_bubble.html",
    "uut": "bubble/urls_table_bubble.html",
}
DRAWER = {
    "prompt": ("prompt-detail.js", "UPRD", ["vot", "tcd", "urt"]),
    "brand": ("brand-drawer.js", "UBDR", ["tcd", "urt"]),
    # Domain: die URL-Tabelle im Domain-Modus (Anteil innerhalb der Domain, domainshare_*).
    "domain": ("domain-drawer.js", "UDDR", ["uut", "urt"], {"DOMAIN_MODE": "yes"}),
}

ERSATZ_MUSTER = {
    "CDN_PIN": "",
    "IS_DARK": "__P_DARK__",
    # NACH den laengeren Namen, nie davor: sonst wird aus IS_PROCESSING_2 ein "no_2".
    "IS_PROCESSING_2": "no",
    "IS_PROCESSING": "no",
    "EXPORT_INSTANCE_ID": "",
    "DOMAIN_MODE": "no",
    # BRAND_LOGO_URL vor BRAND_LOGO, aus demselben Grund wie IS_PROCESSING_2.
    "BRAND_LOGO_URL": "__P_BRANDLOGO__",
    "BRAND_NAME": "__P_BRAND__",
    "BRAND_LOGO": "__P_BRANDLOGO__",
    "SPOTLIGHT_MODE": "no",
    # Die Werkzeugleiste klebt auch im Drawer (13.10. angefordert: "wie ueberall anders"). Der
    # Drawer-Koerper ist der Scroller und hat oben das Polster des Glaskopfs (56): core klebt die
    # Leiste an dessen Kante plus data-sticky-top (16, wie auf den Seiten) und zieht den
    # Deckstreifen bis ganz oben (syncDeckstreifen).
    "IS_STICKY": "yes",
    # Responses auf dem Dashboard als Karten, 6 je Seite (09.10. angefordert); was der Nutzer
    # umstellt, merkt sich die Tabelle (data-merken, siehe ZUSATZ).
    "DEFAULT_VIEW": "table",
}

# Zusaetzliche Attribute je Teil, an die Wurzel gehaengt.
ZUSATZ = {
    "urt": ' data-merken="yes"',
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


def schreiben(ziel, praefix, teile, extra=None):
    ersatz = dict((k, v.replace("__P_", "__" + praefix + "_")) for k, v in ERSATZ_MUSTER.items())
    # Abweichungen je Drawer, vorne eingesetzt: die Reihenfolge der Ersetzung bleibt die des Musters.
    for k, v in (extra or {}).items():
        ersatz[k] = v
    bloecke = {}
    for schluessel in teile:
        pfad = VORLAGE[schluessel]
        kennung = "__%s_%s__" % (praefix, schluessel.upper())
        m = markup(pfad)
        if m is None:
            print("ABBRUCH -- kein up-root in " + pfad)
            sys.exit(1)
        m = m.replace('data-instance="INSTANCE_ID"', 'data-instance="%s"' % kennung)
        for k, v in ersatz.items():
            m = m.replace(k, v)
        # 171 war der Kopf der alten Bubble-Ansicht; hier klebt die Leiste 16 unter der Oberkante wie
        # auf der Citations-Seite (dort 08.10. gemessen).
        m = m.replace('data-sticky-top="171"', 'data-sticky-top="16"')
        m = re.sub(r'\s*data-[a-z0-9-]+-fn="bubble_fn_[^"]*"', "", m)
        m = re.sub(r'(<div class="up-root [^"]*")', lambda t: t.group(1) + ' data-local="yes"' + ZUSATZ.get(schluessel, ""), m, count=1)
        rest = [x for x in re.findall(r'"[A-Z][A-Z0-9_]{3,}"', m)]
        if rest:
            print("ABBRUCH -- unersetzte Platzhalter in %s: %s" % (pfad, ", ".join(sorted(set(rest)))))
            sys.exit(1)
        m = re.sub(r'>\s+<', "><", m)
        m = re.sub(r'\s{2,}', " ", m)
        bloecke[schluessel] = m
        print("%-6s %-46s %6d Bytes" % (schluessel, pfad, len(m)))

    zeilen = ["  var MARKUP = {"]
    for schluessel in teile:
        zeilen.append("    %s: %s," % (schluessel, json.dumps(bloecke[schluessel])))
    zeilen[-1] = zeilen[-1].rstrip(",")
    zeilen.append("  };")
    neu = "\n".join(zeilen) + "\n"

    js = open(ziel).read()
    muster = (r'(  /\* ---- MARKUP ANFANG \(erzeugt von \.drawer_markup\.py -- nicht von Hand '
              r'aendern\) ---- \*/\n).*?(  /\* ---- MARKUP ENDE ---- \*/\n)')
    treffer = re.findall(muster, js, re.S)
    if len(treffer) != 1:
        print("ABBRUCH -- MARKUP-Block in %s nicht genau einmal gefunden" % ziel)
        sys.exit(1)
    js = re.sub(muster, lambda mm: mm.group(1) + neu + mm.group(2), js, flags=re.S)
    open(ziel, "w").write(js)
    print("geschrieben: " + ziel)


wahl = sys.argv[1:] or list(DRAWER.keys())
for w in wahl:
    if w not in DRAWER:
        print("ABBRUCH -- unbekannter Drawer %s (bekannt: %s)" % (w, ", ".join(DRAWER)))
        sys.exit(1)
    schreiben(*DRAWER[w])
