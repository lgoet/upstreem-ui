"""STYLEGUIDE 28: ein literales */ in der Prosa beendet den Kommentar zu frueh, der Rest des
Absatzes wird als Code gelesen. Von aussen ist das nur an der Wirkung erkennbar, nicht am Text --
also pruefen wir die Wirkung: Kommentare so strippen, wie der Browser es tut (das erste */ gewinnt),
und dann muessen die Klammern der Datei noch aufgehen. Ein zerhackter Kommentar kippt die Bilanz,
weil Prosa fast immer unbalancierte Klammern und Anfuehrungszeichen enthaelt."""
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
print("§28:", "sauber" if not bad else "%d Treffer" % bad)
sys.exit(1 if bad else 0)
