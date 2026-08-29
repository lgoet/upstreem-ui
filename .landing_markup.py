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
    # Quick Actions traegt keine data-instance -- die Kennung unten wird also nicht gesetzt und
    # steht nur da, damit die Zeile dieselbe Form hat wie die anderen.
    ("mqa", "bubble/quick_actions_bubble.html", "lh-mqa"),
    # Mira ist die zweite Szene der Sektion. Ihre CSS haengt an der KENNUNG #ask-mira (rund 370
    # Regeln), also bleibt die id im Markup stehen -- eine zweite Instanz auf der Seite gibt es
    # nicht, und damit ist der Singleton unproblematisch.
    ("mira", "bubble/ask_mira_bubble.html", "lh-mira"),
    # Dritte Szene: die Prompts-Seite, Kopf und Tabelle.
    ("pph", "page-headers/bubble/prompts_page_header_bubble.html", "lh-pph"),
    ("upt", "bubble/prompts_table_bubble.html", "lh-upt"),
    # Vierte Szene: das Opportunities-Brett.
    ("oph", "page-headers/bubble/opportunities_page_header_bubble.html", "lh-oph"),
    ("uo", "bubble/opportunities_bubble.html", "lh-uo"),
    # Die drei Nebenfenster, die beim Scrollen erscheinen: die Antwortkarte rechts kommt aus der
    # Responses-Tabelle im Kartenmodus. Die zwei anderen Fenster brauchen keine Vorlage -- das
    # Team-Dropdown und der Doughnut entstehen aus geteilten Bauteilen (sidebar.css, UC.makeTypeChart).
    ("urt", "bubble/responses_table_bubble.html", "lh-urt"),
    # Vierte Sektion: eine Domain-Detail-Seite als Beispiel. Ihre Vorlage ist nur die leere Wurzel --
    # die Komponente baut alles selbst -- und genau deshalb steht sie hier: so bleiben ihre
    # Attribute (data-brand und der Rest) in derselben Form wie in der App.
    ("udd", "bubble/domain_detail_bubble.html", "lh-udd"),
    # Fuenfte Szene: die Performance-Seite, Kopf und Heatmap.
    ("hph", "page-headers/bubble/performance_page_header_bubble.html", "lh-hph"),
    ("uhm", "bubble/performance_radar_bubble.html", "lh-uhm"),
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
    # NACH BRAND_LOGO_URL, nie davor: sonst wird aus BRAND_LOGO_URL ein "_URL".
    "BRAND_LOGO": "",
    # Die Antwortkarte rechts ist der Kartenmodus der Responses-Tabelle. Kein Sticky (das Fenster
    # scrollt nicht) und kein Spotlight (das ist die Marken-Rundschau der App).
    "DEFAULT_VIEW": "cards",
    "IS_STICKY": "no",
    "SPOTLIGHT_MODE": "no",
}


def markup(pfad):
    s = open(pfad).read()
    m = re.search(r'^<div class="up-root[^\n]*$', s, re.M)
    if not m:
        # Quick Actions ist der eine Sonderfall: ein Seiten-Singleton mit einer Kennung statt einer
        # up-root-Klasse (STYLEGUIDE 12). Deshalb hier ein zweiter Anker und nicht ein Sonderweg
        # am Aufrufort.
        m = re.search(r'^<div id="mira-quick-actions"[^\n]*$', s, re.M)
    if not m:
        return None
    rest = s[m.start():]
    # Bis zum SCHLIESSENDEN </div> der Wurzel -- GEZAEHLT und nicht geraten.
    #
    # Vorher stand hier ein Anker: "das erste </div>, hinter dem ein <script> oder <link> kommt".
    # Der ist zweimal danebengegangen, beide Male bei opportunities, und beide Male sah es aus wie
    # ein Fehler an ganz anderer Stelle:
    #   - einmal fraß eine Kommentarregel mit re.S die halbe Vorlage (.uo-stage fehlte, das Brett
    #     blieb leer),
    #   - und einmal endete das Markup EINEN Tag zu frueh, weil die Vorlage mitten im Markup ein
    #     <script class="uo-data-json"> hat. Das Ergebnis war eine Wurzel mit 24 offenen und 23
    #     geschlossenen div: alles, was in landing-hero.js DANACH kam, landete darin. Genau so ist
    #     die Performance-Seite in der Chancen-Seite gelandet und mit ihrer Deckkraft 0 unsichtbar
    #     geworden -- gemeldet als "das Performance-Chart laedt ueberhaupt nicht, alles weiss".
    # Zaehlen kann das nicht passieren: Kommentare und <script>-Bloecke werden uebersprungen (in
    # beiden stehen in diesen Vorlagen Beispiel-Markups), und geschnitten wird an dem </div>, das
    # die Wurzel wieder schliesst.
    muster = re.compile(r"<!--(?:(?!-->).)*?-->|<script\b[^>]*>.*?</script>|<(/?)div\b", re.S)
    tiefe = 0
    for t in muster.finditer(rest):
        ganz = t.group(0)
        if ganz.startswith("<!--") or ganz.startswith("<script"):
            continue
        if t.group(1):
            tiefe -= 1
            if tiefe == 0:
                return rest[:t.end() + len("iv>")].rstrip()
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
    for k, v in ERSATZ.items():
        m = m.replace(k, v)
    # Kein Sticky im Fenster. Der Kopf der Tabelle wuerde sich an den Ausschnitt haengen und ueber
    # dem Seitenkopf stehen -- gemeldet als "da ist ein weisses Element drueber". Ein Fenster, das
    # nicht scrollt, braucht keinen mitfahrenden Kopf. data-sticky VOR data-sticky-top eingesetzt,
    # damit das Attribut auch dann steht, wenn die Vorlage nur den Versatz mitbringt.
    m = m.replace('data-sticky-top=', 'data-sticky="no" data-sticky-top=')
    # Mira tippt im Schaustueck langsamer: dort schaut man dem Tippen zu, in der App will man die
    # Antwort haben. Der Faktor liegt am Root, ask-mira.js liest ihn beim Start des Tippens.
    # 1.15 und nicht mehr 1.6: bei 1.6 war der Mira-Schritt der laengste der vier Schritte und
    # blieb am Ende sichtbar stehen. Etwas langsamer als die App bleibt es -- ganz auf 1.0 tippt
    # die Antwort schneller, als man mitlesen kann.
    m = m.replace('class="up-root am-root"', 'class="up-root am-root" data-typespeed="1.15"')
    # Die Schublade der Opportunities bleibt IM Fenster. Ohne das wandert sie in die oberste Ebene
    # des Browsers und liegt ueber der ganzen Seite -- siehe opportunities.js, data-portal.
    m = m.replace('class="up-root uo-root"', 'class="up-root uo-root" data-portal="inline"')
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
