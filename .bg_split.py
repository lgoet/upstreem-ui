#!/usr/bin/env python3
"""Teilt onboarding-bg.svg in drei Masken und schreibt sie in onboarding-page.css.

WARUM drei und nicht eine: die Vorlage traegt drei Gruppen mit ganz verschiedenem Gewicht --
die weichen Lichter samt Bogen, das Raster, die vier Kreuzmarken. Und das Gewicht muss je THEMA
anders sein: das Raster ist auf hellem Grund fast unsichtbar (2% Schwarz auf Weiss), die Marken
sind auf dunklem Grund zu hell. Mit EINER Maske haengen alle drei an derselben Deckkraft; wer die
eine hebt, hebt die anderen mit. Drei Ebenen kosten keine Bytes -- jeder Teil steht genau einmal.

Aufruf nach jeder Aenderung an onboarding-bg.svg:
    python3 .bg_split.py
"""
import re, sys

QUELLE = "onboarding-bg.svg"
CSS = "onboarding-page.css"
# fill="none" ist hier PFLICHT und nicht Deko: die Rasterfelder und der Bogen tragen nur
# stroke. Ohne die Angabe erben sie die Vorgabe fill: black -- aus 180 Rahmen werden 180
# schwarze Kacheln und aus dem Bogen eine schwarze Kuppel. Genau so sah der erste Durchlauf
# aus: eine fast schwarze Seite mit hellem Raster.
KOPF = '<svg viewBox="0 0 1440 890" fill="none" xmlns="http://www.w3.org/2000/svg">'

def kodiere(svg):
    return ("data:image/svg+xml," + svg.replace("%", "%25").replace("#", "%23")
            .replace('"', "'").replace("<", "%3C").replace(">", "%3E").replace("\n", ""))

s = open(QUELLE).read()

# ---- die drei Teile herausziehen -------------------------------------------------------------
lichter = re.findall(r'<g opacity="0\.1[^"]*" filter="url\(#filter\d_f_0_9475\)">.*?</g>', s)
bogen   = re.findall(r'<path d="M7[^"]*" stroke="white" stroke-opacity="0\.11"/>', s)
raster  = re.findall(r'<rect x="[\d.]+" y="[\d.]+" width="79\.5"[^>]*/>', s)
kreuze  = re.findall(r'<g opacity="0\.31">.*?</g><circle[^>]*/>', s)
fdefs   = re.findall(r'<filter id="filter\d_f_0_9475".*?</filter>', s)
vdefs   = re.findall(r'<linearGradient id="paint\d+_linear_0_9475".*?</linearGradient>', s)

# 180 Rasterfelder -- das 181. <rect> in der Datei ist der Zuschnitt in den defs.
erwartet = {"lichter": 4, "bogen": 1, "raster": 180, "kreuze": 4, "filter": 4, "verlaeufe": 16}
haben = {"lichter": len(lichter), "bogen": len(bogen), "raster": len(raster),
         "kreuze": len(kreuze), "filter": len(fdefs), "verlaeufe": len(vdefs)}
if haben != erwartet:
    print("ABBRUCH -- die Vorlage sieht anders aus als erwartet:")
    print("  erwartet", erwartet)
    print("  gefunden", haben)
    sys.exit(1)

teile = {
    # Lichter und Bogen gehoeren zusammen: beide sind die Atmosphaere, beide sind in beiden Themen
    # ungefaehr richtig.
    "licht":  KOPF + "".join(lichter) + bogen[0] + "<defs>" + "".join(fdefs) + "</defs></svg>",
    "raster": KOPF + "".join(raster) + "</svg>",
    "marken": KOPF + "".join(kreuze) + "<defs>" + "".join(vdefs) + "</defs></svg>",
}

css = open(CSS).read()
for name, svg in teile.items():
    zeile = '  --uob-bg-' + name + ': url("' + kodiere(svg) + '");\n'
    muster = r'  --uob-bg-' + name + r': url\("data:image/svg\+xml,[^\n]*\);\n'
    if re.search(muster, css):
        css = re.sub(muster, zeile, css, count=1)
    else:
        print("ABBRUCH -- keine Zeile fuer --uob-bg-" + name + " in der CSS")
        sys.exit(1)
    print("%-7s %6d Bytes SVG" % (name, len(svg)))
open(CSS, "w").write(css)
print("CSS geschrieben:", len(css), "Bytes")
