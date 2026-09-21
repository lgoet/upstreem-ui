#!/usr/bin/env python3
"""Haelt die Masse der App auf ihren Skalen -- Schriftgroesse, Schnitt, Radius, Dauer, Farbe.

WARUM ES DAS GIBT. Am 21.09. gemessen: 34 verschiedene Schriftgroessen (davon 216 Angaben auf
halben Pixeln), 57 Radien (davon 20 mit Nachkommastelle), 734 feste Farben ausserhalb von
core.css. Nichts davon war eine Entscheidung -- es sind Zwischenergebnisse von Rechnungen, die
stehengeblieben sind, weil es kein Raster gab, auf das sie einrasten konnten. Seit demselben Tag
gibt es das Raster (core.css, der Massblock an .up-root). Dieses Skript sorgt dafuer, dass es
auch benutzt wird.

DIE GRUNDLINIE IST DER GANZE TRICK. Ein Pruefer, der am ersten Tag tausend Treffer meldet, wird
weggeklickt und ist danach wertlos. Deshalb liegt in .skala_grundlinie.json, was am Tag der
Einfuehrung schon dastand -- und gemeldet wird nur, was DAZUKOMMT. Der Bestand wird abgebaut,
wenn eine Datei ohnehin angefasst wird; er blockiert nie einen Commit.

    python3 .check_skala.py                 nur geaenderte CSS, gegen die Grundlinie
    python3 .check_skala.py sidebar.css     eine bestimmte Datei
    python3 .check_skala.py --alle          der ganze Schuldenstand, nach Datei sortiert
    python3 .check_skala.py --grundlinie    Schuldenstand neu aufnehmen (nach dem Aufraeumen)

Rueckgabewert 1, sobald etwas NEUES dazugekommen ist. Der Bestand allein gibt immer 0.
"""
import re, sys, os, glob, json, collections, subprocess

HIER = os.path.dirname(os.path.abspath(__file__))
GRUNDLINIE = os.path.join(HIER, ".skala_grundlinie.json")

# Die Skalen. Sie stehen hier ein zweites Mal -- in core.css sind es CSS-Variablen, und ein
# Python-Skript kann die nicht lesen. Wer dort etwas aendert, aendert es hier mit; die Namen
# daneben sind die der Token, damit man beim Suchen beides findet.
# Die Basis der Radien. Die konzentrischen Kinder (Basis minus 1, siehe unten) kommen
# rechnerisch dazu und stehen deshalb nicht in der Liste.
RADIUS_BASIS = {4, 6, 8, 10, 12, 16}

SKALA = {
    "font-size":     ({"11px", "12px", "13px", "14px", "16px", "22px", "28px"},
                      "--up-fs-xs/s/m/l/xl/2xl/3xl"),
    # Schnitt ist ein BEREICH und keine Liste: Geist ist eine variable Schrift, also rendert
    # auch 450 oder 550 wirklich, und an 37 Stellen ist genau das gewollt -- eine halbe Stufe
    # zwischen zwei Nachbarn. Falsch ist nur, was ausserhalb des geladenen Bereichs liegt: das
    # wird still auf den Rand gezogen. Genau so sind am 21.09. 15 Stellen aufgefallen, die wie
    # 600 aussahen, obwohl 650, 700 oder 750 dastand.
    "font-weight":   (None,
                      "400..700 -- das ist der Bereich, den core.css laedt"),
    # Radius: die Basis PLUS ihre konzentrischen Kinder. Ein Element mit 1px Rahmen in einer
    # 8er-Ecke braucht innen 7 -- sonst laeuft der Spalt zwischen beiden Rundungen ungleich
    # breit. Die erste Fassung dieses Skripts kannte die Regel nicht und meldete 185 voellig
    # richtige Werte als Fehler; wer die "repariert" haette, haette die App verschlechtert.
    # (Die Regel steht im STYLEGUIDE Zeile 424 und ist in der Fachliteratur die Standardformel:
    # innen = aussen minus Abstand.)
    "border-radius": (set(), "--up-r-xs/s/m/l/xl/2xl/voll, deren konzentrische Kinder"
                             " (Basis minus 1) und --up-dd-radius (14px) fuer Menues"),
    # 1ms gehoert dazu und ist kein Ausrutscher: das ist der uebliche Kniff in
    # @media (prefers-reduced-motion: reduce) -- nicht 0, damit transitionend noch feuert.
    "dauer":         ({"0ms", "1ms", "120ms", "200ms", "260ms"},
                      "--up-t-1/2/3 (plus 1ms fuer prefers-reduced-motion)"),
}

# Was immer durchgeht, egal in welcher Eigenschaft: alles, was schon ueber eine Variable laeuft,
# relative Einheiten (die skalieren mit und haben kein eigenes Raster) und die Schluesselwoerter.
FREI = re.compile(r"""^(
      var\(.*\)              # laeuft schon ueber einen Token
    | calc\(.*\)             # gerechnet -- die Bestandteile pruefen wir einzeln nicht
    | inherit | initial | unset | revert | auto | none | 0
    | -?[\d.]+(em|rem|%|ch|vh|vw|vmin|vmax|fr)   # relativ: kein Pixelraster
    | normal | bold | bolder | lighter           # Schnitt als Wort
)$""", re.X | re.I)

# Dateien, die dieses Skript nicht betreffen -- mit Grund, damit niemand sie spaeter "vergisst".
AUSNAHMEN = {
    # Fremdcode. Wir aendern ihn nicht, also melden wir ihn auch nicht.
    "vendor-coloris.min.css": "Fremdbibliothek",
    # Die Landingpage ist KEIN Dashboard. Kole Jains Regel dazu ist ausdruecklich: eine
    # Landingpage vertraegt bis zu sechs Groessen mit grosser Spreizung, ein Dashboard nicht --
    # 38px Ueberschrift ist dort richtig und hier falsch. Eine gemeinsame Skala waere fuer beide
    # die falsche.
    "landing-hero.css": "Landingpage, eigene Typoskala",
}

# core.css DARF Farben als Literal fuehren -- dort werden die Token ja definiert. Ueberall sonst
# ist ein Literal eine Farbe, die das Thema nicht wechseln kann.
FARBE_ERLAUBT = {"core.css"}
FARBE = re.compile(r"#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)")


def ohne_kommentare(t):
    """Kommentare raus, BEVOR gezaehlt wird. In dieser App stehen Messwerte und alte Fassungen
    in den Kommentaren -- ein '12.5px' in einer Begruendung ist kein Verstoss."""
    return re.sub(r"/\*.*?\*/", "", t, flags=re.S)


def einzelwerte(roh):
    """Eine Angabe wie '0 8px 0 12px' oder '8px 8px 0 0' in ihre Teile zerlegen.
    Mehrteilige Radien und Polster sind der Normalfall, nicht die Ausnahme.

    clamp() UND calc() GEHEN ABSICHTLICH DURCH, das ist keine Luecke. In clamp() stehen neun
    Ueberschriften ganzseitiger Flaechen (auth-page, onboarding, ask-mira, prompt-research), die
    mit dem Fenster mitwachsen sollen -- dieselbe Ueberlegung wie bei der Landingpage: eine ganze
    Seite ist kein Dashboard und vertraegt eine groessere Spreizung. calc() rechnet meist aus
    einem Token (der konzentrische Radius zum Beispiel) und ist damit schon auf der Skala."""
    roh = roh.strip().rstrip("!important").strip()
    if FREI.match(roh):
        return []
    # JEDER Funktionsaufruf bleibt am Stueck. Erste Fassung pruefte nur auf var( und calc( --
    # ein clamp(20px, 2.4vw, 26px) wurde dann an den Kommas zerschnitten und als DREI Verstoesse
    # gemeldet ("clamp(20px,", "2.4vw,", "26px)"). Gefunden vom Gegentest, nicht im Betrieb.
    if "(" in roh:
        return []
    teile = [t for t in re.split(r"[\s/]+", roh) if t]
    return [t for t in teile if not FREI.match(t)]


def radius_ok(w):
    """Auf der Basis, ein konzentrisches Kind davon (Basis minus 1), voll rund, oder der
    Menuetoken. Alles andere ist eine Abweichung."""
    if w.lower() in ("999px", "9999px", "50%"):
        return True
    m = re.match(r"^(\d+(?:\.\d+)?)px$", w, re.I)
    if not m:
        return False
    v = float(m.group(1))
    if v != int(v):            # Nachkommastelle: immer falsch, daher kommen 3.23 und 7.04
        return False
    v = int(v)
    return v in RADIUS_BASIS or (v + 1) in RADIUS_BASIS or v == 14   # 14 = --up-dd-radius


def pruefe(pfad):
    """Gibt {eigenschaft: Counter{wert: anzahl}} der Werte zurueck, die NICHT auf der Skala sind."""
    name = os.path.basename(pfad)
    text = ohne_kommentare(open(pfad, encoding="utf-8").read())
    raus = collections.defaultdict(collections.Counter)

    for m in re.finditer(r"(?<![-\w])font-size\s*:\s*([^;{}]+)", text):
        for w in einzelwerte(m.group(1)):
            if w.lower() not in SKALA["font-size"][0]:
                raus["font-size"][w] += 1

    for m in re.finditer(r"(?<![-\w])border-radius\s*:\s*([^;{}]+)", text):
        for w in einzelwerte(m.group(1)):
            if not radius_ok(w):
                raus["border-radius"][w] += 1

    # Schnitt: Bereichspruefung statt Liste -- siehe die Begruendung oben an SKALA.
    for m in re.finditer(r"(?<![-\w])font-weight\s*:\s*([^;{}]+)", text):
        for w in einzelwerte(m.group(1)):
            if re.match(r"^\d+$", w) and not (400 <= int(w) <= 700):
                raus["font-weight"][w] += 1

    # Dauern nur da, wo sie wirklich eine Uebergangsdauer sind. Ein animation-delay darf jede
    # Zahl tragen -- Staffelungen sind genau dafuer da und haben kein Raster.
    for m in re.finditer(r"(?<![-\w])transition(?:-duration)?\s*:\s*([^;{}]+)", text):
        # (?<![\w]) und NICHT (?<![\w.]): sonst bricht der Lookbehind beim Punkt von ".5s" ab
        # und der Wert wird gar nicht gesehen. Genau so ist die halbe Sekunde in
        # prompts-table.css:1317 durch die erste Fassung geschluepft.
        for w in re.findall(r"(?<![\w])(\.?\d+(?:\.\d+)?m?s)", m.group(1)):
            w = w if w.endswith("ms") else str(int(float(w[:-1]) * 1000)) + "ms"
            if w not in SKALA["dauer"][0]:
                raus["dauer"][w] += 1

    if name not in FARBE_ERLAUBT:
        # Masken und durchsichtige Farbstopps sind KEINE Themenfarben. In
        # `-webkit-mask: linear-gradient(#000 0 0)` ist das Schwarz nur "voll deckend" und
        # waere in jedem Thema dasselbe; `rgba(0,0,0,0)` ist schlicht durchsichtig. Beides
        # hat die erste Fassung als Verstoss gemeldet -- wer das "behebt", baut eine Maske
        # kaputt, die richtig war.
        ohne_maske = re.sub(r"(?<![-\w])(?:-webkit-)?mask[a-z-]*\s*:[^;{}]+", "", text)
        for t in FARBE.findall(ohne_maske):
            t = t.lower().replace(" ", "")
            if t in ("rgba(0,0,0,0)", "rgba(255,255,255,0)"):
                continue
            raus["farbe"][t] += 1

    return {k: v for k, v in raus.items() if v}


def lade_grundlinie():
    if not os.path.exists(GRUNDLINIE):
        return None
    with open(GRUNDLINIE, encoding="utf-8") as f:
        return json.load(f)


def geaendert():
    """Nur was gerade angefasst wurde -- dieselbe Ueberlegung wie in .check_reinvention.py."""
    try:
        r = subprocess.run(["git", "diff", "--name-only", "HEAD", "--", "*.css"],
                           cwd=HIER, capture_output=True, text=True, timeout=10)
        u = subprocess.run(["git", "ls-files", "--others", "--exclude-standard", "*.css"],
                           cwd=HIER, capture_output=True, text=True, timeout=10)
        namen = [x for x in (r.stdout + u.stdout).split("\n") if x.strip().endswith(".css")]
        return sorted({os.path.join(HIER, n) for n in namen})
    except Exception:
        return []


def alle_css():
    return sorted(glob.glob(os.path.join(HIER, "*.css")) +
                  glob.glob(os.path.join(HIER, "page-headers", "*.css")))


def schreibe_grundlinie():
    stand = {}
    for pfad in alle_css():
        name = os.path.relpath(pfad, HIER)
        if os.path.basename(pfad) in AUSNAHMEN:
            continue
        treffer = pruefe(pfad)
        if treffer:
            stand[name] = {eig: dict(c) for eig, c in treffer.items()}
    with open(GRUNDLINIE, "w", encoding="utf-8") as f:
        json.dump(stand, f, indent=1, sort_keys=True, ensure_ascii=False)
    summe = sum(n for d in stand.values() for c in d.values() for n in c.values())
    print("Grundlinie geschrieben: %d Dateien, %d Angaben als Bestand vermerkt."
          % (len(stand), summe))
    print("Ab jetzt meldet das Skript nur noch, was DAZUKOMMT.")


def main():
    if "--grundlinie" in sys.argv:
        schreibe_grundlinie()
        return 0

    grund = lade_grundlinie()
    if grund is None:
        print("Keine Grundlinie da. Einmal 'python3 .check_skala.py --grundlinie' laufen lassen --")
        print("sonst meldet dieser Lauf den ganzen Altbestand und ist nicht zu gebrauchen.")
        return 0

    voll = "--alle" in sys.argv
    if voll:
        ziele = alle_css()
    else:
        ziele = [a for a in sys.argv[1:] if a.endswith(".css")] or geaendert()
    ziele = [z if os.path.isabs(z) else os.path.join(HIER, z) for z in ziele]

    if not ziele:
        print("Skalen: keine geaenderte CSS -- nichts zu pruefen ('--alle' zeigt den Bestand)")
        return 0

    neu_gesamt = 0
    bestand_gesamt = 0
    for pfad in ziele:
        if not os.path.exists(pfad):
            continue
        name = os.path.relpath(pfad, HIER)
        basis = os.path.basename(pfad)
        if basis in AUSNAHMEN:
            if voll:
                print("  %-34s uebersprungen (%s)" % (name, AUSNAHMEN[basis]))
            continue

        treffer = pruefe(pfad)
        bekannt = grund.get(name, {})
        zeilen = []
        for eig in sorted(treffer):
            erlaubt_txt = SKALA[eig][1] if eig in SKALA else "Farben kommen aus --vc-*/--up-*"
            bek = bekannt.get(eig, {})
            neu_hier, best_hier = [], 0
            for wert, anzahl in sorted(treffer[eig].items(), key=lambda x: -x[1]):
                vorher = bek.get(wert, 0)
                best_hier += min(anzahl, vorher)
                if anzahl > vorher:
                    neu_hier.append((wert, anzahl - vorher, vorher))
            bestand_gesamt += best_hier
            if neu_hier:
                zeilen.append((eig, erlaubt_txt, neu_hier, best_hier))
                neu_gesamt += sum(n for _, n, _ in neu_hier)
            elif voll and best_hier:
                zeilen.append((eig, erlaubt_txt, [], best_hier))

        if zeilen:
            print("\n" + name)
            for eig, erlaubt_txt, neu_hier, best_hier in zeilen:
                for wert, wieviel, vorher in neu_hier:
                    wie = "NEU" if not vorher else "MEHR"
                    print("  %-5s %-14s %-10s %dx%s"
                          % (wie, eig, wert, wieviel,
                             "" if not vorher else "  (Bestand war %d)" % vorher))
                if neu_hier:
                    print("        erlaubt: %s" % erlaubt_txt)
                if voll and best_hier:
                    print("  best. %-14s %d Angaben" % (eig, best_hier))

    print("")
    if neu_gesamt:
        print("%d NEUE Angabe(n) ausserhalb der Skala. Entweder auf die Skala ziehen --" % neu_gesamt)
        print("oder, wenn es hier wirklich richtig ist, mit einem Satz im Kommentar begruenden")
        print("und die Grundlinie neu aufnehmen (--grundlinie).")
        return 1
    if voll:
        print("Schuldenstand: %d Angaben ausserhalb der Skala, alle als Bestand bekannt."
              % bestand_gesamt)
    else:
        print("Skalen: sauber -- nichts Neues ausserhalb der Skala.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
