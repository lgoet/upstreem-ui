#!/usr/bin/env python3
"""Baut aus einer CSS-Datei Proben fuer den Regressions-Prueftand.

Fuer JEDE Regel, die ein Farbliteral in einer Farb-Eigenschaft traegt, entsteht ein
Eintrag {datei, zeile, selektor, markup, eigenschaften}. Der Prueftand rendert das
Markup in beiden Themen und schreibt die berechneten Werte auf. Vorher und nachher
verglichen zeigt das, ob eine Ersetzung wirklich neutral war.

    python3 .farb_sonde.py > sonden.json
"""
import re, json, glob, sys

FARBE = re.compile(r'#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)')
EIGEN = ["color", "background-color", "border-top-color", "border-left-color",
         "border-right-color", "border-bottom-color", "fill", "stroke", "box-shadow", "opacity"]
KURZ = {"color", "background", "background-color", "border-color", "fill", "stroke", "border",
        "border-top", "border-bottom", "border-left", "border-right", "box-shadow",
        "border-top-color", "border-left-color", "border-right-color", "border-bottom-color"}

def ohne_komm(t):
    return re.sub(r'/\*.*?\*/', lambda m: "\n" * m.group(0).count("\n"), t, flags=re.S)

def markup_aus(sel):
    """Aus einem Selektor ein Element samt Vorfahren bauen. Nur was sich sicher bauen laesst."""
    sel = sel.strip()
    if any(c in sel for c in "*>~+") or "::" in sel or sel.startswith("@"):
        return None
    teile = [t for t in re.split(r'\s+', sel) if t]
    if not teile or len(teile) > 4:
        return None
    knoten = []
    for t in teile:
        # :hover/:focus usw. abstreifen -- der Prueftand kann sie nicht ausloesen,
        # die FARBWERTE der Regel lassen sich aber trotzdem vergleichen, weil wir die
        # Klassen ohne Pseudo setzen und die Regel dann eben nicht greift. Solche
        # Proben sind als "pseudo" markiert und zaehlen nur, wenn sich VORHER und
        # NACHHER unterscheiden -- dann hat die Ersetzung etwas anderes getroffen.
        pseudo = ":" in t
        t2 = t.split(":")[0]
        if not t2:
            return None
        klassen = re.findall(r'\.([A-Za-z0-9_-]+)', t2)
        ids = re.findall(r'#([A-Za-z0-9_-]+)', t2)
        attr = re.findall(r'\[([a-zA-Z-]+)="([^"]*)"\]', t2)
        tag = re.match(r'^([a-zA-Z]+)', t2)
        knoten.append({"tag": (tag.group(1) if tag else "div"),
                       "klassen": klassen, "ids": ids, "attr": attr, "pseudo": pseudo})
    return knoten

def sonden(dateien):
    raus = []
    for f in dateien:
        txt = ohne_komm(open(f, encoding="utf-8").read())
        for m in re.finditer(r'([^{}]+)\{([^{}]*)\}', txt):
            sel_roh, rumpf = m.group(1).strip(), m.group(2)
            if sel_roh.startswith("@") or "{" in sel_roh:
                continue
            hat = False
            for d in re.finditer(r'(?<![-a-z])([-a-z]+)\s*:\s*([^;]+)', rumpf):
                if d.group(1) in KURZ and FARBE.search(d.group(2)) and not d.group(1).startswith("--"):
                    hat = True
            if not hat:
                continue
            zeile = txt[:m.start()].count("\n") + 1
            for teil in sel_roh.split(","):
                k = markup_aus(teil)
                if not k:
                    continue
                raus.append({"datei": f, "zeile": zeile, "sel": teil.strip(), "knoten": k})
    return raus

if __name__ == "__main__":
    dateien = sys.argv[1:] or [f for f in sorted(glob.glob("*.css")) if f != "vendor-coloris.min.css"]
    s = sonden(dateien)
    json.dump({"eigenschaften": EIGEN, "sonden": s}, sys.stdout, ensure_ascii=False)
