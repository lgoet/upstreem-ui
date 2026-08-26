#!/usr/bin/env python3
"""Teilt onboarding-bg.svg fuer onboarding-page.css auf: drei Masken plus vier CSS-Verlaeufe.

WARUM getrennt und nicht eine Maske: die Vorlage traegt Gruppen mit ganz verschiedenem Gewicht --
die weichen Lichter, den Bogen, das Raster, die vier Kreuzmarken. Und das Gewicht muss je THEMA
anders sein: das Raster ist auf hellem Grund fast unsichtbar (2% Schwarz auf Weiss), die Marken
sind auf dunklem Grund zu hell. Mit EINER Maske haengen alle an derselben Deckkraft; wer die eine
hebt, hebt die anderen mit. Die Teilung kostet keine Bytes -- jeder Teil steht genau einmal.

WARUM die vier Lichter KEINE Maske sind, sondern CSS-Verlaeufe: sie sollen leise stehen (sonst
heben sie den ganzen Grund an, gemeldet am 26.08.). Leise heisst auf dunklem Grund eine Spanne von
RGB 27 bis 30 -- VIER Graustufen fuer einen Verlauf ueber achthundert Pixel. Ein Bitmap wird dabei
zu drei harten Hoehenlinien, und weil Chrome grosse Weichzeichner auf einem verkleinerten Puffer
rechnet, sind diese Linien eckig: gemessen als Zickzack und rechteckige Flecken, gemeldet als
"ganz vage viele Vierecke". Einen CSS-Verlauf dithert Skia dagegen -- dieselbe Spanne bleibt glatt.
Gemessen im Feldvergleich _h_uob_band.html: Verlauf glatt, Maske eckig, leeres Feld flach.

Aufruf nach jeder Aenderung an onboarding-bg.svg:
    python3 .bg_split.py
"""
import re, sys

QUELLE = "onboarding-bg.svg"
CSS = "onboarding-page.css"
# Die Vorlage rechnet in diesem Feld; alle Prozente der Verlaeufe beziehen sich darauf.
BREIT, HOCH = 1440.0, 890.0
# fill="none" ist hier PFLICHT und nicht Deko: die Rasterfelder und der Bogen tragen nur
# stroke. Ohne die Angabe erben sie die Vorgabe fill: black -- aus 180 Rahmen werden 180
# schwarze Kacheln und aus dem Bogen eine schwarze Kuppel. Genau so sah der erste Durchlauf
# aus: eine fast schwarze Seite mit hellem Raster.
KOPF = '<svg viewBox="0 0 1440 890" fill="none" xmlns="http://www.w3.org/2000/svg">'

# Gemessene Profile der geblurten Ellipsen, aufgenommen in Chrome mit den Sonden _h_bgP_a.svg /
# _h_bgP_b.svg (dieselbe Ellipse, derselbe Weichzeichner, Filterbereich absichtlich vier Sigma
# weit, damit nichts beschnitten ist) und ausgelesen ueber ein Canvas:
#   mitte  Alpha in der Mitte, als Anteil der Quelldeckkraft -- der Weichzeichner verteilt, also
#          bleibt in der Mitte weniger als gemalt wurde
#   ex/ey  Abstand in Vorlagenpixeln, bei dem das Alpha auf 2% der Mitte gefallen ist; das ist der
#          Rand des Verlaufs
# Der Schluessel ist (rx, ry, stdDeviation). Fuer eine unbekannte Form gibt es keine Formel hier --
# zwei Messpunkte tragen keine, also bricht das Skript ab und verlangt eine neue Messung.
MESSUNG = {
    (410.0, 211.0, 211.4): {"mitte": 0.576, "ex": 807.0, "ey": 675.0},
    (505.0, 211.0, 211.4): {"mitte": 0.616, "ex": 886.0, "ey": 652.0},
}


def kodiere(svg):
    return ("data:image/svg+xml," + svg.replace("%", "%25").replace("#", "%23")
            .replace('"', "'").replace("<", "%3C").replace(">", "%3E").replace("\n", ""))


def zahl(text, name):
    m = re.search(name + r'="([-\d.]+)"', text)
    return float(m.group(1)) if m else None


s = open(QUELLE).read()

# ---- die Teile herausziehen ------------------------------------------------------------------
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

# ---- aus den vier Lichtern werden vier CSS-Verlaeufe ------------------------------------------
sigma = {}
for f in fdefs:
    fid = re.search(r'id="(filter\d)_f_0_9475"', f).group(1)
    sigma[fid] = zahl(f, "stdDeviation")

verlaeufe = []
for g in lichter:
    fid = re.search(r'url\(#(filter\d)_f_0_9475\)', g).group(1)
    deck = zahl(g, "opacity")
    cx, cy = zahl(g, "cx"), zahl(g, "cy")
    rx, ry = zahl(g, "rx"), zahl(g, "ry")
    # Figma dreht Ellipsen ueber eine Matrix statt sie neu zu setzen. Nur Spiegeln und Schieben
    # kommt hier vor; alles andere wuerde die Radien veraendern und darf nicht stillschweigend
    # durchlaufen.
    mt = re.search(r'transform="matrix\(([-\d.\s]+)\)"', g)
    if mt:
        a, b, c, d, e, f6 = [float(v) for v in mt.group(1).split()]
        if abs(a) != 1 or abs(d) != 1 or b != 0 or c != 0:
            print("ABBRUCH -- unerwartete Matrix an einem Licht:", mt.group(1))
            sys.exit(1)
        cx, cy = a * cx + e, d * cy + f6
    key = (rx, ry, sigma[fid])
    if key not in MESSUNG:
        print("ABBRUCH -- fuer die Form rx=%s ry=%s sigma=%s gibt es keine Messung." % key)
        print("  Neu messen: _h_bgP_*.svg mit diesen Werten erzeugen, in Chrome ins Canvas")
        print("  zeichnen, Mittenalpha und den 2%-Abstand ablesen, hier eintragen.")
        sys.exit(1)
    m = MESSUNG[key]
    spitze = deck * m["mitte"] * 100.0
    verlaeufe.append(
        # Das Wort ellipse waere aus zwei Groessenwerten ableitbar und ist in Chrome nicht
        # noetig -- es steht hier, weil Safari in dieser Sitzung nicht geprueft werden konnte
        # und die ausdrueckliche Form dort keine Frage offen laesst.
        "radial-gradient(ellipse %.2f%% %.2f%% at %.2f%% %.2f%%, "
        "color-mix(in srgb, var(--vc-muted) %.3f%%, transparent), "
        "color-mix(in srgb, var(--vc-muted) 0%%, transparent))"
        % (m["ex"] / BREIT * 100, m["ey"] / HOCH * 100, cx / BREIT * 100, cy / HOCH * 100, spitze))

# Der Endpunkt ist mit Absicht nicht das Schluesselwort transparent, sondern dieselbe Farbe mit
# 0%: transparent ist rgba(0,0,0,0), und wer in einem Modell ohne Vormultiplikation dorthin
# verlaeuft, zieht den Verlauf durch Schwarz.
# In der CSS liegt die ERSTE Ebene oben, die Vorlage malt die erste unten -- also umgekehrt.
verlauf_zeile = ",\n    ".join(reversed(verlaeufe))

teile = {
    "bogen":  KOPF + bogen[0] + "</svg>",
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

# Die Lichter: eine Eigenschaft mit vier Verlaeufen, mehrzeilig eingerueckt.
zeile = "  --uob-bg-licht:\n    " + verlauf_zeile + ";\n"
muster = r'  --uob-bg-licht:\n(?:    [^\n]*\n)+'
if not re.search(muster, css):
    print("ABBRUCH -- keine Zeile fuer --uob-bg-licht in der CSS")
    sys.exit(1)
css = re.sub(muster, zeile, css, count=1)
print("%-7s %6d Bytes CSS, %d Verlaeufe" % ("licht", len(zeile), len(verlaeufe)))

open(CSS, "w").write(css)
print("CSS geschrieben:", len(css), "Bytes")
