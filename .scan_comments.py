"""STYLEGUIDE 28: ein literales */ in der Prosa beendet den Kommentar zu frueh, der Rest des
Absatzes wird als Code gelesen. Von aussen ist das nur an der Wirkung erkennbar, nicht am Text --
also pruefen wir die Wirkung: Kommentare so strippen, wie der Browser es tut (das erste */ gewinnt),
und dann muessen die Klammern der Datei noch aufgehen. Ein zerhackter Kommentar kippt die Bilanz,
weil Prosa fast immer unbalancierte Klammern und Anfuehrungszeichen enthaelt.

DIESE ANNAHME HAT EINMAL NICHT GEHALTEN, und der Preis war hoch: in prompts-table.css stand in
einem Kommentar ".up-cg-*/.up-cgm-*". Das */ darin schloss den Kommentar, die restlichen fuenf
Zeilen Prosa enthielten KEINE Klammer, die Bilanz blieb also gerade -- und die Pruefung sagte
sauber. Gefolgt ist der Prosa dann ".upt-root { --upt-check-size: 18px }": die Prosa wurde zum
Selektor, die Regel fiel weg, und jede Checkbox der Prompts-Tabelle war 2x2 Pixel gross.

Deshalb zwei weitere Pruefungen, die nicht auf Klammern angewiesen sind:
  1. Die Zahl der /* muss der Zahl der */ entsprechen. Ein zu frueh geschlossener Kommentar laesst
     sein eigenes */ als ueberzaehligen Schliesser stehen.
  2. Im gestrippten Code darf kein */ mehr vorkommen. Das ist derselbe Fall aus der anderen
     Richtung gesehen und nennt die Zeile."""
import glob, sys
bad = 0
for f in sorted(glob.glob("*.css") + glob.glob("*/*.css") + glob.glob("*/*/*.css")):
    s = open(f, encoding="utf-8").read()
    out, i = [], 0
    while True:
        a = s.find("/*", i)
        if a < 0: out.append(s[i:]); break
        out.append(s[i:a])
        b = s.find("*/", a + 2)
        if b < 0:
            print("%s: Kommentar ab Zeile %d wird nie geschlossen" % (f, s[:a].count("\n") + 1))
            bad += 1; break
        i = b + 2
    code = "".join(out)
    depth = code.count("{") - code.count("}")
    if depth:
        print("%s: Klammerbilanz %+d nach dem Strippen der Kommentare" % (f, depth))
        bad += 1
    # Ein Durchlauf ueber die Datei, in derselben Reihenfolge wie der Browser: ein */ in
    # CODE-Position kann nur der Rest eines Kommentars sein, der zu frueh geschlossen wurde.
    # Nicht ueber Zaehlung, denn ein /* INNERHALB eines Kommentars ist blosser Text und kippt
    # jede Zaehlung (core.css hat genau das an mehreren Stellen).
    i, drin, zeile = 0, False, 1
    while i < len(s) - 1:
        if s[i] == "\n": zeile += 1
        zwei = s[i:i+2]
        if not drin and zwei == "/*":
            drin = True; i += 2; continue
        if not drin and zwei == "*/":
            umgebung = s[max(0, i - 90):i + 12].replace("\n", " ")
            print("%s:%d: verwaistes */ -- ein Kommentar wurde zu frueh geschlossen. "
                  "Umgebung: ...%s..." % (f, zeile, umgebung))
            bad += 1
            break
        if drin and zwei == "*/":
            drin = False; i += 2; continue
        i += 1
print("§28:", "sauber" if not bad else "%d Treffer" % bad)
sys.exit(1 if bad else 0)
