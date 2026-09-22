#!/usr/bin/env python3
"""Findet verschattete Eintraege im Sprachkatalog von core.js.

Der Katalog entsteht aus mehreren addMessages("de", {...})-Bloecken, die der Reihe
nach in EIN Objekt gemischt werden (core.js, function addMessages). Steht derselbe
Schluessel in zwei Bloecken, gewinnt der SPAETERE -- der fruehere ist tot, und wer ihn
aendert, aendert nichts. Genau so am 22.09. aufgefallen: ein neuer Eintrag fuer
"Please reload the page and try again." wirkte nicht, weil derselbe Schluessel
achthundert Zeilen weiter unten schon stand.

Meldet nur, was wirklich verschattet ist, mit beiden Zeilennummern und beiden Werten --
unterscheiden sich die Werte, ist es ausserdem ein Widerspruch im Wortlaut.

    python3 .check_woerterbuch.py            nur die Zahl und die Widersprueche
    python3 .check_woerterbuch.py --alle     jede verschattete Zeile
"""
import re, sys, collections

QUELLE = "core.js"
zeilen = open(QUELLE, encoding="utf-8").read().split("\n")

# Die Bloecke, und zwar mit ihrem ENDE. Ohne das lief der Prueflauf ueber die ganze
# Datei und meldete CITE_COLOR als Woerterbuch ("Brand Platforms" -> "#bc69c9").
# MSG_DE ist ein eigener Block: es wird durch addMessages("de", MSG_DE) eingemischt,
# steht aber weiter oben als eigene Zuweisung.
def bereich(start):
    """Von der oeffnenden Klammer ab Zeile start bis zu ihrer schliessenden."""
    tiefe = 0
    for j in range(start, len(zeilen)):
        tiefe += zeilen[j].count("{") - zeilen[j].count("}")
        if tiefe <= 0 and j > start:
            return (start, j)
    return (start, len(zeilen) - 1)

anfaenge = [i for i, z in enumerate(zeilen)
            if re.search(r'addMessages\(\s*"[a-z]{2}"\s*,\s*\{', z)
            or re.match(r'\s*var MSG_[A-Z]{2}\s*=\s*\{', z)]
if not anfaenge:
    sys.exit("Keine Katalog-Bloecke gefunden -- hat sich die Form geaendert?")
BEREICHE = [bereich(a) for a in anfaenge]
def im_katalog(i):
    for a, b in BEREICHE:
        if a <= i <= b:
            return True
    return False

# Ein Eintrag ist  "schluessel": "wert"  -- der Wert darf in der naechsten Zeile stehen.
EINTRAG = re.compile(r'^\s*"((?:[^"\\]|\\.)+)"\s*:\s*(?:"((?:[^"\\]|\\.)*)"|$)')
gefunden = collections.OrderedDict()
doppelt = []
for i, z in enumerate(zeilen):
    if not im_katalog(i):
        continue
    m = EINTRAG.match(z)
    if not m:
        continue
    schl = m.group(1)
    wert = m.group(2)
    if wert is None:                       # Wert steht in der Folgezeile
        nx = zeilen[i + 1] if i + 1 < len(zeilen) else ""
        w = re.match(r'\s*"((?:[^"\\]|\\.)*)"', nx)
        wert = w.group(1) if w else ""
    if schl in gefunden:
        doppelt.append((schl, gefunden[schl], (i + 1, wert)))
    gefunden[schl] = (i + 1, wert)

widerspruch = [d for d in doppelt if d[1][1] != d[2][1]]
print("Katalog: %d Schluessel, %d verschattet, davon %d mit ABWEICHENDEM Wortlaut."
      % (len(gefunden), len(doppelt), len(widerspruch)))

def zeig(liste, titel):
    if not liste:
        return
    print("\n" + titel)
    for schl, (z1, w1), (z2, w2) in liste:
        print('  "%s"' % schl[:74])
        print("      Zeile %-5d tot : %s" % (z1, w1[:70]))
        print("      Zeile %-5d gilt: %s" % (z2, w2[:70]))

zeig(widerspruch, "WIDERSPRUCH -- zwei verschiedene Uebersetzungen fuer denselben Satz:")
if "--alle" in sys.argv:
    zeig([d for d in doppelt if d not in widerspruch], "Verschattet, aber wortgleich (nur Ballast):")
elif doppelt and not widerspruch:
    print("\nAlle verschatteten Eintraege sind wortgleich -- Ballast, kein Fehler.")
    print("'--alle' zeigt sie.")
