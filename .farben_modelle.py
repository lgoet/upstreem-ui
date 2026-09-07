#!/usr/bin/env python3
"""Sucht eine Farbskala fuer die MODELLE im Model Breakdown von domain-detail.

WOZU: die Modellfarben stehen in der Datenbank (model_breakdown[].color_lightmode /
.color_darkmode), nicht im Code -- der Nutzer setzt sie dort. Diese Datei rechnet die Werte aus
und begruendet sie mit Zahlen, statt sie zu waehlen.

DIE BEDINGUNG: sie duerfen nicht mit den Farben brechen, die in DERSELBEN Komponente vorkommen.
Und das sind nicht wenige:
    der Typ-Split                die sieben Zitationstyp-Farben, hell und dunkel
    die URL-Liste und die Linie  eine Familie von Abstufungen um die Zitationstyp-Farbe DIESER
                                 Domain (domain-detail: familie(), fuenf bis sieben Stufen,
                                 Helligkeit gestaffelt, Saettigung gegenlaeufig)
    die Trend-Chips              --vt-up und --vt-down
Die sieben Zitationstoene decken den ganzen Farbkreis ab. Ein Abstand ueber den FARBTON ist damit
nicht zu holen -- dieselbe Einsicht wie bei den URL-Typen am 08.09.: liegen zwei Raeder auf
derselben Helligkeit, ist der Farbton das einzige Unterscheidungsmerkmal, und dann kollidiert
irgendwo etwas. Der Abstand kommt hier also aus der HELLIGKEIT: die Modelle bekommen ihre eigene
Stufe, im Hellen tiefer als die Typen, im Dunkeln heller.

DIE SUCHE: konstantes L und C (Linears Rechnung), N Farbtoene in gleichen Schritten, und ueber
L und die Drehung wird der kleinste OKLab-Abstand zu ALLEN Farben der Komponente maximiert.
Nebenbedingung ist der Kontrast auf dem jeweiligen Grund -- eine Farbe, die niemand sieht, ist
kein Gewinn.
"""
import math, itertools

def oklch_to_srgb(L, C, Hdeg):
    h = math.radians(Hdeg); a = C*math.cos(h); b = C*math.sin(h)
    l_ = L + 0.3963377774*a + 0.2158037573*b
    m_ = L - 0.1055613458*a - 0.0638541728*b
    s_ = L - 0.0894841775*a - 1.2914855480*b
    l, m, s = l_**3, m_**3, s_**3
    return (+4.0767416621*l - 3.3077115913*m + 0.2309699292*s,
            -1.2684380046*l + 2.6097574011*m - 0.3413193965*s,
            -0.0041960863*l - 0.7034186147*m + 1.7076147010*s)
def enc(c): return 12.92*c if c <= 0.0031308 else 1.055*(c**(1/2.4)) - 0.055
def dec(c): return c/12.92 if c <= 0.04045 else ((c+0.055)/1.055)**2.4
def in_gamut(rgb, eps=1e-4): return all(-eps <= v <= 1+eps for v in rgb)
def hexof(L, C, H):
    lo, hi = 0.0, C
    if not in_gamut(oklch_to_srgb(L, C, H)):
        for _ in range(40):
            mid = (lo+hi)/2
            if in_gamut(oklch_to_srgb(L, mid, H)): lo = mid
            else: hi = mid
        C = lo
    rgb = oklch_to_srgb(L, C, H)
    return "#%02x%02x%02x" % tuple(max(0, min(255, round(enc(max(0.0, min(1.0, v)))*255))) for v in rgb)
def hex_to_oklab(hx):
    hx = hx.lstrip("#"); r,g,b = [dec(int(hx[i:i+2],16)/255) for i in (0,2,4)]
    l = 0.4122214708*r+0.5363325363*g+0.0514459929*b
    m = 0.2119034982*r+0.6806995451*g+0.1073969566*b
    s = 0.0883024619*r+0.2817188376*g+0.6299787005*b
    l_,m_,s_ = l**(1/3), m**(1/3), s**(1/3)
    return (0.2104542553*l_+0.7936177850*m_-0.0040720468*s_,
            1.9779984951*l_-2.4285922050*m_+0.4505937099*s_,
            0.0259040371*l_+0.7827717662*m_-0.8086757660*s_)
def dE(a, b): return math.sqrt(sum((x-y)**2 for x, y in zip(a, b)))
def lum(hx):
    hx = hx.lstrip("#")
    return sum(k*dec(int(hx[i:i+2],16)/255) for k, i in ((0.2126,0),(0.7152,2),(0.0722,4)))
def kontrast(a, b):
    la, lb = lum(a), lum(b)
    if la < lb: la, lb = lb, la
    return (la+0.05)/(lb+0.05)

CITE_L = ["#d35f73","#dd7e3e","#27a79b","#34a1d1","#5e7eac","#797ad8","#bc69c9"]
CITE_D = ["#d76f82","#de8c54","#5cd7c8","#62b4da","#7693bb","#8082db","#c377cf"]
TREND_L = ["#2ea84a","#b0200c"]
TREND_D = ["#60d25d","#d25d5d"]

def hsl(hx):
    hx = hx.lstrip("#"); r,g,b = [int(hx[i:i+2],16)/255 for i in (0,2,4)]
    mx, mn = max(r,g,b), min(r,g,b); l = (mx+mn)/2; d = mx-mn
    s = 0 if d == 0 else d/(1-abs(2*l-1))
    if d == 0: h = 0
    elif mx == r: h = ((g-b)/d) % 6
    elif mx == g: h = (b-r)/d + 2
    else: h = (r-g)/d + 4
    return h*60 % 360, s, l
def hsl_hex(h, s, l):
    def f(n):
        k = (n + h/30) % 12
        a = s*min(l, 1-l)
        return l - a*max(-1, min(k-3, 9-k, 1))
    return "#%02x%02x%02x" % tuple(round(255*max(0, min(1, f(n)))) for n in (0, 8, 4))

RAMPE_HELL   = [0, -0.10, 0.10, -0.20, 0.18, -0.28, 0.26]
RAMPE_DUNKEL = [0, 0.10, -0.10, 0.20, -0.18, 0.28, -0.26]
def familie(basis, n, dunkel):
    """Wortgleich die Rechnung aus domain-detail.js -- sonst meidet die Suche etwas anderes,
       als in der Komponente wirklich auf dem Schirm steht."""
    h, s, l = hsl(basis); out = []
    rampe = RAMPE_DUNKEL if dunkel else RAMPE_HELL
    for i in range(n):
        d = rampe[i % len(rampe)]
        ll = min(0.82, max(0.22, l + d))
        ss = min(0.85, max(0.28, s - abs(d)*0.25))
        out.append(hsl_hex(h, ss, ll))
    return out

def meiden(dunkel):
    basis = CITE_D if dunkel else CITE_L
    aus = list(basis) + (TREND_D if dunkel else TREND_L)
    for b in basis: aus += familie(b, 7, dunkel)
    return sorted(set(aus))

def suche(n, dunkel, Lspanne, C, grund, kmin):
    aus = [hex_to_oklab(x) for x in meiden(dunkel)]
    best = None
    L = Lspanne[0]
    while L <= Lspanne[1] + 1e-9:
        for start in [x/2 for x in range(0, 720)]:
            hues = [(start + 360.0*i/n) % 360 for i in range(n)]
            hexe = [hexof(L, C, h) for h in hues]
            ks = [kontrast(x, grund) for x in hexe]
            if min(ks) < kmin: continue
            labs = [hex_to_oklab(x) for x in hexe]
            fremd = min(dE(a, b) for a in labs for b in aus)
            eigen = min(dE(labs[i], labs[j]) for i in range(n) for j in range(i+1, n))
            wert = min(fremd, eigen*0.85)
            if best is None or wert > best[0]:
                best = (wert, L, start, hexe, fremd, eigen, min(ks), max(ks))
        L = round(L + 0.01, 4)
    return best

N = 8
print("== Was in domain-detail sonst vorkommt (die Meidemenge) ==")
print("   hell  %d Farben" % len(meiden(False)))
print("   dunkel %d Farben" % len(meiden(True)))
print()
for name, dunkel, Lsp, grund, kmin in (
    ("HELL   (auf Weiss)",  False, (0.42, 0.66), "#ffffff", 3.0),
    ("DUNKEL (auf #1c1c1f)", True, (0.62, 0.86), "#1c1c1f", 4.0)):
    b = suche(N, dunkel, Lsp, 0.13, grund, kmin)
    if not b:
        print(name, "-- keine Loesung unter diesen Bedingungen"); continue
    wert, L, start, hexe, fremd, eigen, k1, k2 = b
    print("== %s ==" % name)
    print("   L=%.2f  C=0.13  Start %.1f Grad, Schritt %.1f Grad" % (L, start, 360.0/N))
    print("   kleinster Abstand zu den Farben der Komponente: %.4f" % fremd)
    print("   kleinster Abstand untereinander:                %.4f" % eigen)
    print("   Kontrast auf dem Grund: %.2f bis %.2f" % (k1, k2))
    print("   " + " ".join(hexe))
    print()

print("== Je Modellfarbe: die naechste Farbe der Komponente ==")
print("   (kein Paar darf sich so nahe sein, dass die zwei Ringe nebeneinander dasselbe meinen)")
for name, dunkel, Lsp, grund, kmin in (
    ("hell",  False, (0.42, 0.66), "#ffffff", 3.0),
    ("dunkel", True, (0.62, 0.86), "#1c1c1f", 4.0)):
    b = suche(N, dunkel, Lsp, 0.13, grund, kmin)
    if not b: continue
    aus = meiden(dunkel)
    print("   " + name + ":")
    for hx in b[3]:
        nah = min(((dE(hex_to_oklab(hx), hex_to_oklab(x)), x) for x in aus))
        print("      %s  naechste: %s  Abstand %.4f" % (hx, nah[1], nah[0]))
    print()
