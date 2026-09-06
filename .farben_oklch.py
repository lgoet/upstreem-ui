import math

def oklch_to_srgb(L, C, Hdeg):
    h = math.radians(Hdeg)
    a = C*math.cos(h); b = C*math.sin(h)
    l_ = L + 0.3963377774*a + 0.2158037573*b
    m_ = L - 0.1055613458*a - 0.0638541728*b
    s_ = L - 0.0894841775*a - 1.2914855480*b
    l, m, s = l_**3, m_**3, s_**3
    r = +4.0767416621*l - 3.3077115913*m + 0.2309699292*s
    g = -1.2684380046*l + 2.6097574011*m - 0.3413193965*s
    bl= -0.0041960863*l - 0.7034186147*m + 1.7076147010*s
    return r, g, bl

def enc(c):
    return 12.92*c if c <= 0.0031308 else 1.055*(c**(1/2.4)) - 0.055

def in_gamut(rgb, eps=1e-4):
    return all(-eps <= v <= 1+eps for v in rgb)

def hexof(L, C, H):
    # Chroma verkleinern, bis die Farbe in sRGB passt (Gamut-Clipping wuerde den Farbton drehen)
    lo, hi = 0.0, C
    if not in_gamut(oklch_to_srgb(L, C, H)):
        for _ in range(40):
            mid = (lo+hi)/2
            if in_gamut(oklch_to_srgb(L, mid, H)): lo = mid
            else: hi = mid
        C = lo
    rgb = oklch_to_srgb(L, C, H)
    out = []
    for v in rgb:
        v = enc(max(0.0, min(1.0, v)))
        out.append(max(0, min(255, round(v*255))))
    return "#%02x%02x%02x" % tuple(out), C

def wcag_lum(hx):
    hx = hx.lstrip("#")
    def lin(x):
        x = int(x,16)/255
        return x/12.92 if x <= 0.03928 else ((x+0.055)/1.055)**2.4
    return 0.2126*lin(hx[0:2]) + 0.7152*lin(hx[2:4]) + 0.0722*lin(hx[4:6])

def kontrast(a, b):
    la, lb = wcag_lum(a), wcag_lum(b)
    if la < lb: la, lb = lb, la
    return (la+0.05)/(lb+0.05)

HUES  = [25, 55, 92, 145, 195, 255, 300, 350]
NAMEN = ["rot","orange","gelb","gruen","tuerkis","blau","violett","pink"]
REIHEN = [("vibrant", 0.62, 0.165), ("muted", 0.70, 0.070), ("deep", 0.50, 0.135)]
GRAU   = {"vibrant": (0.62, 0.0), "muted": (0.70, 0.0), "deep": (0.50, 0.0)}

print("== TOPIC_COLOR_PALETTE (OKLCh) ==")
for name, L, C in REIHEN:
    zeile = []
    for H in HUES:
        hx, cc = hexof(L, C, H)
        zeile.append(hx)
    gL, gC = GRAU[name]
    g1, _ = hexof(gL, gC, 0)
    g2, _ = hexof(min(0.98, gL+0.08), gC, 0)
    zeile += [g1, g2]
    print('    /* %-8s L=%.2f C=%.3f */ %s' % (name, L, C, ", ".join('"%s"' % h for h in zeile)))

print()
print("== Linear-Skala: Blau -> Tuerkis -> Gruen -> Orange, gleiche L und C ==")
L, C = 0.685, 0.145
n = 7
for i in range(n):
    H = 255 - (255-62)*i/(n-1)
    hx, cc = hexof(L, C, H)
    print('  %d  H=%5.1f  %s   C_wirklich=%.3f  Kontrast auf #1c1c1f %.2f  auf #ffffff %.2f'
          % (i, H, hx, cc, kontrast(hx, "#1c1c1f"), kontrast(hx, "#ffffff")))
print("  hex:", ",".join('"%s"' % hexof(L, C, 255-(255-62)*i/(n-1))[0] for i in range(n)))
