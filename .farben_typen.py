#!/usr/bin/env python3
"""Rechnet die Farbvorschlaege fuer Citation- und URL-Typen und schreibt sie als
_h_typfarben_daten.js fuer den Prueftand _h_typfarben.html.

WARUM EIN SKRIPT UND KEINE HANDVOLL HEX-WERTE: die drei Vorschlaege unterscheiden sich nicht in
einzelnen Farben, sondern in ihrer REGEL. Wer die Regel aendern will (ein Farbton mehr Abstand,
eine Stufe heller), aendert hier eine Zahl und bekommt alle 21 Farben neu -- von Hand nachgezogen
waere spaetestens beim dritten Durchgang eine davon vergessen.

Grundlage ist die Rechnung der Linear-Skala aus core.js (COLOR_SCALES.linear): OKLCh mit
KONSTANTEM L und C, der Farbton ist die einzige Variable. Genau das macht, dass keine Flaeche
heller wirkt als ihre Nachbarn -- der Fehler der heutigen Paletten (Spannen unten im Bericht).
"""
import math, json, io

# ---- OKLCh <-> sRGB (Werte 1:1 aus .farben_oklch.py) ----------------------------------------
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
def in_gamut(rgb, eps=1e-4): return all(-eps <= v <= 1+eps for v in rgb)
def hexof(L, C, H):
    """Chroma verkleinern, bis die Farbe in sRGB passt. Gamut-Clipping wuerde den Farbton drehen
       -- und ein gedrehter Farbton ist genau das, was eine Palette mit gleichen Abstaenden
       kaputt macht."""
    lo, hi = 0.0, C
    if not in_gamut(oklch_to_srgb(L, C, H)):
        for _ in range(40):
            mid = (lo+hi)/2
            if in_gamut(oklch_to_srgb(L, mid, H)): lo = mid
            else: hi = mid
        C = lo
    rgb = oklch_to_srgb(L, C, H)
    return "#%02x%02x%02x" % tuple(max(0, min(255, round(enc(max(0.0, min(1.0, v)))*255))) for v in rgb)

def dec(c): return c/12.92 if c <= 0.04045 else ((c+0.055)/1.055)**2.4
def hex_to_oklch(hx):
    hx = hx.lstrip("#"); r,g,b = [dec(int(hx[i:i+2],16)/255) for i in (0,2,4)]
    l = 0.4122214708*r+0.5363325363*g+0.0514459929*b
    m = 0.2119034982*r+0.6806995451*g+0.1073969566*b
    s = 0.0883024619*r+0.2817188376*g+0.6299787005*b
    l_,m_,s_ = l**(1/3), m**(1/3), s**(1/3)
    L = 0.2104542553*l_+0.7936177850*m_-0.0040720468*s_
    A = 1.9779984951*l_-2.4285922050*m_+0.4505937099*s_
    B = 0.0259040371*l_+0.7827717662*m_-0.8086757660*s_
    return L, math.hypot(A,B), math.degrees(math.atan2(B,A)) % 360

def lum(hx):
    hx = hx.lstrip("#")
    return sum(k*dec(int(hx[i:i+2],16)/255) for k,i in ((0.2126,0),(0.7152,2),(0.0722,4)))
def kontrast(a, b):
    la, lb = lum(a), lum(b)
    if la < lb: la, lb = lb, la
    return (la+0.05)/(lb+0.05)
def ueber(vorne, hinten, alpha):
    """Was das Auge sieht, wenn eine Farbe mit alpha auf einem Grund liegt -- die Chip-Flaeche
       ist tint(farbe, 0.12) auf Weiss, also keine eigene Farbe, sondern eine Mischung."""
    f = vorne.lstrip("#"); h = hinten.lstrip("#")
    out = []
    for i in (0,2,4):
        v = int(f[i:i+2],16)*alpha + int(h[i:i+2],16)*(1-alpha)
        out.append(max(0, min(255, round(v))))
    return "#%02x%02x%02x" % tuple(out)

WEISS, DUNKELKARTE, CHIP_BG_DARK = "#ffffff", "#1c1c1f", "#242424"

# ---- Die ZUORDNUNG, wie sie heute ist -------------------------------------------------------
# Abgelesen an den Farbtoenen der heutigen Paletten (siehe Bericht unten): jeder URL-Typ liegt im
# Farbtonband genau eines Citation-Typs. Diese Zuordnung wird NICHT angetastet -- gefragt war eine
# neue Farbgebung, keine neue Bedeutung.
FAMILIEN = [
    ("You",             11.6,  []),
    ("Competition",     52.0,  ["homepage","product_service","marketplace","company_info"]),
    ("Editorial",      185.4,  ["article"]),
    ("UGC / Community",231.8,  ["listicle"]),
    ("Institutional",  257.4,  ["guide"]),
    ("Knowledge-Base", 281.1,  ["comparison","review","documentation","video","social_post"]),
    ("Brand Platforms",322.0,  ["forum","directory"]),
]
URL_ORDER = [u for _,_,us in FAMILIEN for u in us]
CITE_ORDER = [n for n,_,_ in FAMILIEN]
LABEL = {"homepage":"Homepage","product_service":"Product / Service","marketplace":"Marketplace",
 "company_info":"Company Info","article":"Article","listicle":"Listicle","guide":"Guide",
 "comparison":"Comparison","review":"Review","documentation":"Documentation","forum":"Forum",
 "directory":"Directory","video":"Video","social_post":"Social Post"}
FAM_VON = {u:n for n,_,us in FAMILIEN for u in us}

# ---- heute, zum Vergleich --------------------------------------------------------------------
HEUTE = {
 "cite_fill_light": {"You":"#d35f73","Competition":"#dd7e3e","Editorial":"#27a79b",
   "UGC / Community":"#34a1d1","Institutional":"#5e7eac","Knowledge-Base":"#797ad8",
   "Brand Platforms":"#bc69c9"},
 "cite_fill_dark": {"You":"#d76f82","Competition":"#de8c54","Editorial":"#5cd7c8",
   "UGC / Community":"#62b4da","Institutional":"#7693bb","Knowledge-Base":"#8082db",
   "Brand Platforms":"#c377cf"},
 "url_fill_light": {"homepage":"#c3753a","product_service":"#ce8662","marketplace":"#ae7c58",
   "company_info":"#b48139","article":"#369379","listicle":"#3e90a6","guide":"#5182ef",
   "comparison":"#726bea","review":"#8a53e1","documentation":"#8a53e1","forum":"#a95cee",
   "directory":"#b549bf","video":"#9661f1","social_post":"#a27df8"},
 "url_fill_dark": {"homepage":"#fbbf24","product_service":"#fdba74","marketplace":"#fcae6f",
   "company_info":"#facc15","article":"#6ee7b7","listicle":"#67e8f9","guide":"#93c5fd",
   "comparison":"#a5b4fc","review":"#c4b5fd","documentation":"#c4b5fd","forum":"#d8b4fe",
   "directory":"#f0abfc","video":"#c4b5fd","social_post":"#ddd6fe"},
 "url_chip_light": {"homepage":"#b45309","product_service":"#c2683b","marketplace":"#9a5b2e",
   "company_info":"#a16207","article":"#047857","listicle":"#0e7490","guide":"#2563eb",
   "comparison":"#4f46e5","review":"#6d28d9","documentation":"#6d28d9","forum":"#9333ea",
   "directory":"#a21caf","video":"#7c3aed","social_post":"#8b5cf6"},
}

# ---- Die drei Regeln -------------------------------------------------------------------------
L_FILL, C_FILL = 0.685, 0.145          # genau die Werte der Linear-Skala in core.js

def variante_rad():
    """A -- EIN RAD. Linears Rechnung unveraendert: L und C konstant, der Farbton ist das
       einzige, was sich aendert. Die 7 Citation-Toene bleiben, wo sie heute liegen (sie sind
       schon gut verteilt); die 14 URL-Typen laufen in GLEICHEN Schritten ueber das ganze Rad,
       in der Reihenfolge ihrer Familien.
       Der Preis, offen benannt: die Zuordnung liest sich als NACHBARSCHAFT auf dem Rad, nicht
       mehr als "derselbe Farbton wie die Familie". Der Gewinn: 26 Grad zwischen zwei URL-Typen
       statt heute 0 (review und documentation sind heute derselbe Hex)."""
    cite = {n: hexof(L_FILL, C_FILL, h) for n,h,_ in FAMILIEN}
    # DAS BAND UM "YOU" GEHOERT IHM ALLEIN, und das ist keine Geschmacksfrage: You ist der
    # einzige Citation-Typ OHNE URL-Typen. Jeder andere Farbton auf dem Rad hat einen Nachbarn
    # aus derselben Familie und darf ihm aehnlich sein -- der von You hat keinen, also bedeutet
    # Aehnlichkeit dort eine Verwandtschaft, die es nicht gibt.
    # Der erste Anlauf liess die Rampe ueber 340 Grad laufen und damit ueber die 360 hinaus:
    # Directory landete bei 20 Grad, also 8 Grad neben You (11.6) -- gemeldet als "Directory ist
    # mir zu nah an You, die Verbindung waere erklaerungsbeduerftig". Genau richtig, es gibt
    # keine. Jetzt endet die Rampe bei 340, das sind 31.6 Grad Abstand zu You -- mehr als der
    # Abstand zweier URL-Typen untereinander (23.1).
    start, spanne = 40.0, 300.0
    url = {}
    for i, u in enumerate(URL_ORDER):
        url[u] = hexof(L_FILL, C_FILL, (start + spanne*i/(len(URL_ORDER)-1)) % 360)
    return cite, url

L_URL_TIEF = 0.630   # zweite Helligkeitsstufe fuer die URL-Typen, siehe variante_rad_zwei()

def variante_rad_zwei():
    """A' -- WIE A, ABER MIT ZWEI HELLIGKEITSSTUFEN. Gemeldet an A: "Directory ist mir etwas zu
       nah an You, die Verbindung waere erklaerungsbeduerftig." Das Band um You ist daraufhin
       freigeraeumt (siehe variante_rad) -- und beim Nachmessen kamen drei weitere Paare derselben
       Sorte heraus: Guide neben Editorial (7.7 Grad), Review neben UGC (7.6), Documentation neben
       Institutional (10.1). Alle vier sind derselbe Fehler: ein URL-Typ, der aussieht wie ein
       Citation-Typ, mit dem er nichts zu tun hat.

       Einen Farbton nach dem anderen zu verschieben hilft nicht -- gemessen: bei 14 Toenen im
       Abstand von 23 Grad und 7 festen Citation-Toenen bleibt in JEDER Drehung irgendwo ein Paar
       unter 12 Grad (bestes Ergebnis der Suche ueber alle Drehungen und Spannen: 11.0 Grad).
       Die Ursache ist nicht die Drehung, sondern dass beide Raeder auf derselben Helligkeit
       liegen: dann ist der Farbton das EINZIGE Unterscheidungsmerkmal.

       Also bekommen die URL-Typen ihre eigene Stufe: L 0.630 statt 0.685, C unveraendert. Damit
       ist kein URL-Ton mehr mit einem Citation-Ton verwechselbar, egal wie nah der Farbton liegt
       -- und innerhalb des URL-Rades aendert sich NICHTS an der Unterscheidbarkeit (die haengt
       am Farbtonabstand, und der bleibt).
       Gemessen (OKLab-Abstand, kleinster ueber alle 98 Paare URL x Citation):
           eine Stufe   0.0128   (forum ~ Brand Platforms -- praktisch dieselbe Farbe)
           zwei Stufen  0.0565   (viereinhalbmal so weit)
       Innerhalb des URL-Rades bleibt der kleinste Abstand in beiden Faellen 0.0580."""
    cite, url_hues = variante_rad()
    url = {}
    for i, u in enumerate(URL_ORDER):
        H = (40.0 + 300.0*i/(len(URL_ORDER)-1)) % 360
        url[u] = hexof(L_URL_TIEF, C_FILL, H)
    return cite, url

def variante_familien():
    """B -- FAMILIEN. Der Farbton sagt die FAMILIE, die Helligkeit sagt das Mitglied. Jeder
       URL-Typ traegt genau den Farbton seines Citation-Typs; innerhalb der Familie faechern die
       Mitglieder in L auf, symmetrisch um den Grundwert.
       Die Saettigung wandert gegenlaeufig (C sinkt, wo L steigt) -- dieselbe Regel, die
       domain-detail fuer seine Familien schon benutzt: eine sehr helle Flaeche mit voller
       Saettigung wirkt grell.
       Der Preis: innerhalb einer Familie sind die Mitglieder NICHT gleich schwer -- das ist hier
       die Aussage und kein Fehler. Der Gewinn: man sieht, welcher URL-Typ zu welchem
       Citation-Typ gehoert, ohne es zu wissen."""
    cite = {n: hexof(L_FILL, C_FILL, h) for n,h,_ in FAMILIEN}
    url = {}
    for name, h, us in FAMILIEN:
        n = len(us)
        if not n: continue
        # Stufen symmetrisch um L_FILL, Abstand 0.055 -- bei fuenf Mitgliedern also 0.575..0.795
        for i, u in enumerate(us):
            d = (i - (n-1)/2) * 0.055
            L = max(0.50, min(0.84, L_FILL + d))
            C = max(0.06, C_FILL - abs(d)*0.25)
            url[u] = hexof(L, C, h)
    return cite, url

def variante_rampe():
    """C -- LINEAR PUR. Die sieben Farben der Linien-Skala, Wert fuer Wert, fuer die sieben
       Citation-Typen; die 14 URL-Typen als 14 Schritte auf genau derselben Rampe (255 Grad Blau
       bis 62 Grad Orange, gleiches L und C).
       Das ist die groesste Naehe zu den Linecharts -- es IST deren Palette. Und es hat einen
       Preis, der genannt gehoert: eine Rampe ist kein Rad. Zwischen 62 und 255 Grad liegt kein
       Violett und kein Magenta, also verlieren "You" und "Brand Platforms" ihr Pink, und die
       ganze Palette wird waermer. Die Reihenfolge folgt der Familienordnung, damit die
       Nachbarschaft erhalten bleibt."""
    HOCH, TIEF, n = 255.0, 62.0, 7
    # WARM ZUERST. Die Rampe der Linien-Skala laeuft von Blau nach Orange; hier laeuft sie
    # andersherum, damit "You" und "Competition" warm bleiben -- das ist ihre heutige Lesart
    # (Rot und Orange), und die Reihenfolge der Typen soll die Farbe tragen, nicht umdrehen.
    cite = {}
    for i, name in enumerate(CITE_ORDER):
        cite[name] = hexof(L_FILL, C_FILL, TIEF + (HOCH-TIEF)*i/(n-1))
    url = {}
    m = len(URL_ORDER)
    for i, u in enumerate(URL_ORDER):
        url[u] = hexof(L_FILL, C_FILL, TIEF + (HOCH-TIEF)*i/(m-1))
    return cite, url

def chip_ton(fill, grund, ziel=4.5, hoch=False):
    """Die Chipschrift aus der Fuellfarbe ableiten statt sie zu erfinden: gleicher Farbton,
       gleiche Saettigung, nur L wandert, bis der Kontrast auf dem Chipgrund reicht. Gibt es die
       Zahl nicht (sehr gelbe Toene auf Weiss), kommt der beste erreichte Wert zurueck -- und der
       Bericht nennt ihn, statt ihn zu verschweigen."""
    L, C, H = hex_to_oklch(fill)
    best, bestk = None, 0
    schritte = [x/1000 for x in range(200, 1000, 5)]
    if not hoch: schritte = list(reversed(schritte))
    for Lx in schritte:
        hx = hexof(Lx, C, H)
        k = kontrast(hx, grund)
        if k > bestk: best, bestk = hx, k
        if k >= ziel: return hx, k
    return best, bestk

def bericht(titel, cite, url):
    Ls = [hex_to_oklch(v)[0] for v in list(cite.values())+list(url.values())]
    Cs = [hex_to_oklch(v)[1] for v in list(cite.values())+list(url.values())]
    hs = sorted(hex_to_oklch(v)[2] for v in url.values())
    dmin = min((hs[i+1]-hs[i]) for i in range(len(hs)-1)) if len(hs) > 1 else 0
    doppelt = len(set(list(url.values()))) != len(url)
    return {"L_min": round(min(Ls),3), "L_max": round(max(Ls),3), "L_spanne": round(max(Ls)-min(Ls),3),
            "C_min": round(min(Cs),3), "C_max": round(max(Cs),3), "C_spanne": round(max(Cs)-min(Cs),3),
            "hue_min_abstand": round(dmin,1), "doppelte_farben": doppelt}

def bau(key, titel, satz, warum, preis, fn):
    cite, url = fn()
    daten = {"key": key, "titel": titel, "satz": satz, "warum": warum, "preis": preis,
             "cite": [], "url": []}
    for name in CITE_ORDER:
        f = cite[name]
        cl, kl = chip_ton(f, ueber(f, WEISS, 0.12), 4.5, False)
        cd, kd = chip_ton(f, CHIP_BG_DARK, 4.5, True)
        daten["cite"].append({"key": name, "label": name, "fill": f,
            "chip_light": cl, "chip_light_k": round(kl,2),
            "chip_dark": cd, "chip_dark_k": round(kd,2),
            "k_weiss": round(kontrast(f, WEISS),2), "k_dunkel": round(kontrast(f, DUNKELKARTE),2)})
    for u in URL_ORDER:
        f = url[u]
        cl, kl = chip_ton(f, ueber(f, WEISS, 0.12), 4.5, False)
        cd, kd = chip_ton(f, CHIP_BG_DARK, 4.5, True)
        daten["url"].append({"key": u, "label": LABEL[u], "familie": FAM_VON[u], "fill": f,
            "chip_light": cl, "chip_light_k": round(kl,2),
            "chip_dark": cd, "chip_dark_k": round(kd,2),
            "k_weiss": round(kontrast(f, WEISS),2), "k_dunkel": round(kontrast(f, DUNKELKARTE),2)})
    daten["mass"] = bericht(titel, cite, url)
    return daten

# ---- heute als Vergleichsfall, mit denselben Massen ------------------------------------------
def heute_daten():
    cite, url = HEUTE["cite_fill_light"], HEUTE["url_fill_light"]
    d = {"key":"heute", "titel":"Heute (zum Vergleich)",
         "satz":"Vier Paletten von Hand: Chart hell, Chart dunkel, Chip hell, Chip dunkel.",
         "warum":"Gewachsen, nicht gerechnet -- jede Farbe einzeln gewaehlt.",
         "preis":"Ungleiche Gewichte und vier Farben, die praktisch dieselbe sind.",
         "cite":[], "url":[]}
    for name in CITE_ORDER:
        f = cite[name]
        d["cite"].append({"key":name, "label":name, "fill":f,
            "chip_light":f, "chip_light_k":round(kontrast(f, ueber(f,WEISS,0.12)),2),
            "chip_dark":HEUTE["cite_fill_dark"][name],
            "chip_dark_k":round(kontrast(HEUTE["cite_fill_dark"][name], CHIP_BG_DARK),2),
            "fill_dark":HEUTE["cite_fill_dark"][name],
            "k_weiss":round(kontrast(f,WEISS),2), "k_dunkel":round(kontrast(HEUTE["cite_fill_dark"][name],DUNKELKARTE),2)})
    for u in URL_ORDER:
        f = url[u]
        d["url"].append({"key":u, "label":LABEL[u], "familie":FAM_VON[u], "fill":f,
            "chip_light":HEUTE["url_chip_light"][u],
            "chip_light_k":round(kontrast(HEUTE["url_chip_light"][u], ueber(f,WEISS,0.12)),2),
            "chip_dark":HEUTE["url_fill_dark"][u],
            "chip_dark_k":round(kontrast(HEUTE["url_fill_dark"][u], CHIP_BG_DARK),2),
            "fill_dark":HEUTE["url_fill_dark"][u],
            "k_weiss":round(kontrast(f,WEISS),2), "k_dunkel":round(kontrast(HEUTE["url_fill_dark"][u],DUNKELKARTE),2)})
    d["mass"] = bericht("heute", cite, url)
    return d

ALLE = [
    heute_daten(),
    bau("rad", "A -- Ein Rad",
        "Ein L, ein C, der Farbton ist die einzige Variable -- Linears Rechnung, unveraendert.",
        "Keine Flaeche draengt sich vor: alle 21 Farben sind gleich hell und gleich saturiert. "
        "Die 14 URL-Typen liegen in gleichen Schritten (26 Grad) auf dem Rad, in ihrer "
        "Familienreihenfolge.",
        "Die Zuordnung liest sich als Nachbarschaft auf dem Rad, nicht mehr als derselbe Farbton "
        "wie die Familie.",
        variante_rad),
    bau("rad2", "A' -- Ein Rad, zwei Helligkeitsstufen",
        "Wie A, aber die URL-Typen liegen eine Stufe tiefer (L 0.630 statt 0.685).",
        "Damit kann kein URL-Ton mehr mit einem Citation-Ton verwechselbar sein, egal wie nah der "
        "Farbton liegt -- und innerhalb des URL-Rades aendert sich an der Unterscheidbarkeit "
        "nichts, die haengt am Farbtonabstand.",
        "Das URL-Rad ist als Gruppe etwas dunkler als das Citation-Rad. In seinem eigenen Chart "
        "faellt das nicht auf; nebeneinander sieht man zwei Stufen -- und genau das ist die "
        "Absicht.",
        variante_rad_zwei),
    bau("familien", "B -- Familien",
        "Der Farbton sagt die Familie, die Helligkeit sagt das Mitglied.",
        "Jeder URL-Typ traegt genau den Farbton seines Citation-Typs. Man sieht die Zuordnung, "
        "ohne sie zu kennen -- und innerhalb der Familie unterscheidet die Helligkeit.",
        "Innerhalb einer Familie sind die Mitglieder nicht gleich schwer. Bei fuenf Mitgliedern "
        "(Knowledge-Base) reicht die Leiter von sehr dunkel bis sehr hell.",
        variante_familien),
    bau("rampe", "C -- Linear pur",
        "Die sieben Farben der Linien-Skala, Wert fuer Wert -- und die URL-Typen als 14 Schritte "
        "auf derselben Rampe.",
        "Groesste Naehe zu den Linecharts: es IST deren Palette. Eine Farbwelt fuer die ganze App.",
        "Eine Rampe ist kein Rad: zwischen Orange und Blau liegt kein Violett und kein Magenta. "
        "You und Brand Platforms verlieren ihr Pink, die Palette wird insgesamt waermer.",
        variante_rampe),
]

io.open("_h_typfarben_daten.js","w",encoding="utf-8").write(
    "/* ERZEUGT von .farben_typen.py -- nicht von Hand aendern. */\nwindow.TYPFARBEN = " +
    json.dumps(ALLE, ensure_ascii=False, indent=1) + ";\n")

print("== Masse je Vorschlag (Fuellfarben) ==")
for d in ALLE:
    m = d["mass"]
    print("  %-22s L %.3f..%.3f (Spanne %.3f)  C %.3f..%.3f (Spanne %.3f)  kleinster Farbtonabstand %5.1f Grad  doppelte Farben: %s"
          % (d["titel"], m["L_min"], m["L_max"], m["L_spanne"], m["C_min"], m["C_max"],
             m["C_spanne"], m["hue_min_abstand"], "JA" if m["doppelte_farben"] else "nein"))
print()
print("== Kontrast der Fuellfarbe: auf Weiss / auf der dunklen Karte #1c1c1f ==")
for d in ALLE:
    ks = [(x["k_weiss"], x["k_dunkel"]) for x in d["cite"]+d["url"]]
    print("  %-22s Weiss %.2f..%.2f   dunkel %.2f..%.2f"
          % (d["titel"], min(k[0] for k in ks), max(k[0] for k in ks),
             min(k[1] for k in ks), max(k[1] for k in ks)))
print()
print("== Chipschrift: kleinster erreichter Kontrast auf dem Chipgrund (Ziel 4.5) ==")
for d in ALLE:
    hc = min(x["chip_light_k"] for x in d["cite"]); hu = min(x["chip_light_k"] for x in d["url"])
    dc = min(x["chip_dark_k"] for x in d["cite"]);  du = min(x["chip_dark_k"] for x in d["url"])
    print("  %-22s hell: Citation %.2f, URL %.2f   dunkel: Citation %.2f, URL %.2f"
          % (d["titel"], hc, hu, dc, du))
print()
print("== Wie viele Chips liegen HEUTE unter 4.5? ==")
h = ALLE[0]
unter = [x["label"] for x in h["cite"]+h["url"] if x["chip_light_k"] < 4.5]
print("  hell:   %d von %d  (%s)" % (len(unter), len(h["cite"])+len(h["url"]), ", ".join(unter)))
unter2 = [x["label"] for x in h["cite"]+h["url"] if x["chip_dark_k"] < 4.5]
print("  dunkel: %d von %d  (%s)" % (len(unter2), len(h["cite"])+len(h["url"]), ", ".join(unter2) or "keiner"))
print()
print("== Kann ein URL-Ton mit einem Citation-Ton verwechselt werden? (OKLab-Abstand) ==")
print("   kleinster Abstand ueber alle 98 Paare URL x Citation, und zum Vergleich der kleinste")
print("   Abstand INNERHALB des URL-Rades -- der sagt, wie fein das Rad selbst noch ist.")
def oklab(hx):
    L, C, H = hex_to_oklch(hx); h = math.radians(H)
    return (L, C*math.cos(h), C*math.sin(h))
def dE(a, b):
    return math.sqrt(sum((x-y)**2 for x, y in zip(a, b)))
for d in ALLE:
    uc = min((dE(oklab(u["fill"]), oklab(c["fill"])), u["label"], c["label"])
             for u in d["url"] for c in d["cite"])
    uu = min(dE(oklab(a["fill"]), oklab(b["fill"]))
             for i, a in enumerate(d["url"]) for b in d["url"][i+1:])
    print("  %-34s URL~Citation %.4f  (%s ~ %s)   im URL-Rad %.4f"
          % (d["titel"], uc[0], uc[1], uc[2], uu))
print()
print("== Wo liegt ein URL-Typ nah an einem Citation-Typ, der NICHT seine Familie ist? ==")
print("   (unter 12 Grad waere die Naehe eine Aussage, die es nicht gibt)")
print("   ACHTUNG, die Spalte gilt nur, wo beide Raeder AUF DERSELBEN Helligkeit liegen. Wo sie")
print("   das nicht tun (A'), entscheidet nicht der Farbton, sondern der Abstand darueber.")
for d in ALLE:
    if d["key"] == "heute": continue
    schlimm = []
    for u in d["url"]:
        hu = hex_to_oklch(u["fill"])[2]
        for c in d["cite"]:
            if c["key"] == u["familie"]: continue
            hc = hex_to_oklch(c["fill"])[2]
            ab = abs((hc - hu + 180) % 360 - 180)
            if ab < 12: schlimm.append("%s ~ %s (%.1f Grad)" % (u["label"], c["label"], ab))
    print("  %-22s %s" % (d["titel"], ", ".join(schlimm) if schlimm else "keine"))
print()
print("== Abstand jedes URL-Typs zu You (der Citation-Typ ohne URL-Typen) ==")
for d in ALLE:
    if d["key"] == "heute": continue
    hy = hex_to_oklch([c for c in d["cite"] if c["key"] == "You"][0]["fill"])[2]
    ab = [(abs((hy - hex_to_oklch(u["fill"])[2] + 180) % 360 - 180), u["label"]) for u in d["url"]]
    ab.sort()
    print("  %-22s naechster: %s (%.1f Grad)" % (d["titel"], ab[0][1], ab[0][0]))
print()
print("_h_typfarben_daten.js geschrieben.")
