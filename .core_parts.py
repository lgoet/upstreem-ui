#!/usr/bin/env python3
"""Inventar der Core-Bauteile. Aufruf VOR dem Schreiben von CSS oder Markup.

    python3 .core_parts.py sentiment
    python3 .core_parts.py switcher tabelle
    python3 .core_parts.py --list          alle Bauteilgruppen

Gibt die vorhandenen Klassen mit ihren Maßen aus, plus die Kit-Funktionen aus core.js.
Zweck: die Frage "gibt es das schon und wie sieht es aus" beantworten, statt sie zu raten.
"""
import re, sys, os

HIER = os.path.dirname(os.path.abspath(__file__))

# Stichwoerter -> Klassenpraefixe. Deutsch und englisch, weil beides in den Anfragen vorkommt.
THEMEN = {
    "sentiment":  ["up-sent"],
    "rang":       ["up-rank", "up-hash"], "rank": ["up-rank", "up-hash"],
    "trend":      ["up-trend"],
    "zahl":       ["up-num"], "number": ["up-num"],
    "switcher":   ["up-seg", "vc-gran"], "segment": ["up-seg"], "granular": ["vc-gran"],
    "tabelle":    ["up-table", "up-row", "up-td", "up-th", "up-thead", "up-tbody"],
    "table":      ["up-table", "up-row", "up-td", "up-th", "up-thead", "up-tbody"],
    "variation":  ["up-var", "up-vartable", "up-vrow", "up-vbody", "up-sec"],
    "suche":      ["up-search"], "search": ["up-search"],
    "knopf":      ["up-btn", "up-iconbtn"], "button": ["up-btn", "up-iconbtn"],
    "dropdown":   ["up-menu", "up-filter", "up-popover"], "menu": ["up-menu", "up-filter"],
    "tooltip":    ["up-tip", "up-explain"],
    "marke":      ["up-ment", "up-stack"], "brand": ["up-ment", "up-stack"],
    "leer":       ["up-empty", "up-dash"], "empty": ["up-empty", "up-dash"],
    "skelett":    ["up-skel"], "skeleton": ["up-skel"],
    "kopf":       ["up-head", "up-heading", "up-sec"], "heading": ["up-head", "up-heading"],
    "scroll":     ["up-scroll"],
    "chart":      ["up-chart", "vc-"],
    "seite":      ["up-pager", "up-page"], "pager": ["up-pager", "up-page"],
}

# Was einem beim Ueberschreiben um die Ohren fliegt.
WARNUNG = {
    "up-sent":  "Pille mit FESTER Hoehe. Schrift aendern heisst height/padding/radius/gap/dot\n"
                "  im selben Verhaeltnis mitziehen -- sonst stoesst der Text an den Rahmen.\n"
                "  Der Punkt ist ein abgerundetes QUADRAT (radius 2 bei 6px), kein Kreis.",
    "up-row":   "GRID mit var(--up-cols), kein Flex. Eine Tabelle ohne dieses Raster braucht eine\n"
                "  eigene display:flex-Regel, sonst erbt sie fremde Spaltenbreiten.",
    "up-seg":   "Fertiger Segmented-Control samt Hoehe, Rahmen und aktivem Zustand.\n"
                "  Nur Positionierung und ggf. Innenabstand ergaenzen, nie nachbauen.",
    "vc-gran":  "Fertiger Granularitaets-Schalter. Wie .up-seg: nur positionieren.",
    "up-trend": "Fertiger Trend-Chip aus UC.trendChip(delta, opts).\n"
                "  opts: inverted (weniger ist besser), decimals, suffix.",
    "up-td":    "Traegt Polsterung (0 16px 0 12px) und die Trennkante links. Abstaende zum\n"
                "  Zellenrand kommen von hier, nicht aus einem zweiten Wert.",
}


def css_regeln(praefixe):
    txt = open(os.path.join(HIER, "core.css"), encoding="utf-8").read()
    txt = re.sub(r"/\*.*?\*/", "", txt, flags=re.S)          # Kommentare raus
    out = []
    for m in re.finditer(r"([^{}]+)\{([^{}]*)\}", txt):
        sel, body = m.group(1).strip(), " ".join(m.group(2).split())
        if not body:
            continue
        if any(("." + p) in sel for p in praefixe):
            out.append((" ".join(sel.split()), body))
    return out


def kits(praefixe):
    txt = open(os.path.join(HIER, "core.js"), encoding="utf-8").read()
    namen = re.findall(r"^\s{4}(\w+):\s*\w+,?\s*$", txt, re.M)
    stamm = [p.split("-", 1)[-1] for p in praefixe]
    return sorted({n for n in namen if any(s and s.lower() in n.lower() for s in stamm)})


def main():
    args = [a for a in sys.argv[1:] if a != "--list"]
    if "--list" in sys.argv or not args:
        print("Bauteilgruppen (Stichwort -> Klassen):\n")
        for k in sorted(THEMEN):
            print("  %-12s %s" % (k, ", ".join("." + p for p in THEMEN[k])))
        print("\nAufruf: python3 .core_parts.py <stichwort> [<stichwort> ...]")
        print("Freitext geht auch: jedes Wort wird als Klassenteil gesucht.")
        return

    praefixe, unbekannt = [], []
    for a in args:
        t = THEMEN.get(a.lower())
        if t:
            praefixe += t
        else:
            unbekannt.append(a.lower())
            praefixe.append(a.lower())          # Freitextsuche im Klassennamen

    regeln = css_regeln(praefixe)
    funktionen = kits(praefixe)

    if not regeln and not funktionen:
        print("Kein Core-Bauteil zu %s gefunden." % ", ".join(args))
        print("-> Wahrscheinlich wirklich neu. Trotzdem einmal '--list' ansehen,")
        print("   das Bauteil koennte anders heissen als der Begriff in der Anfrage.")
        return

    if funktionen:
        print("KIT-FUNKTIONEN (core.js):")
        for f in funktionen:
            print("  UC.%s()" % f)
        print()

    if regeln:
        print("CSS-BAUTEILE (core.css):")
        for sel, body in regeln:
            print("  %s" % sel)
            print("      %s" % body)
        print()

    getroffen = {p for p in praefixe for sel, _ in regeln if ("." + p) in sel}
    hinweise = [(p, WARNUNG[p]) for p in sorted(getroffen) if p in WARNUNG]
    if hinweise:
        print("ACHTUNG:")
        for p, w in hinweise:
            print("  .%s: %s" % (p, w))
        print()

    print("Regel: verwenden statt nachbauen. Wer einen Wert aendert, zieht alle mit.")
    if unbekannt:
        print("(Freitextsuche fuer: %s -- kann unvollstaendig sein)" % ", ".join(unbekannt))


if __name__ == "__main__":
    main()
