#!/usr/bin/env python3
"""Sucht in den Komponenten-CSS nach zwei Mustern, die diese App wiederholt kaputtgemacht haben:

  A) GESPRENGT   eine Regel greift in ein Core-Bauteil hinein und aendert nur EINEN Wert eines
                 Pakets, das nur als Ganzes stimmt (Schrift ohne Hoehe, Punkt ohne Radius, ...).
  B) NACHGEBAUT  eine eigene Klasse definiert dieselbe Kombination von Eigenschaften wie ein
                 vorhandenes Core-Bauteil -- also vermutlich ein Zwilling davon.

Verdachtsmeldungen, keine Gewissheiten. Jeden Treffer beheben ODER mit einem Satz begruenden.

    python3 .check_reinvention.py            alle Komponenten
    python3 .check_reinvention.py brand-detail.css
"""
import re, sys, os, glob

HIER = os.path.dirname(os.path.abspath(__file__))

# Bauteile, deren Werte nur zusammen stimmen: {Klasse: (Paket, Begruendung)}
PAKETE = {
    "up-sent":     ({"font-size", "height", "padding", "border-radius", "gap"},
                    "Pille mit fester Hoehe -- Schrift ohne height/padding/radius sprengt sie"),
    "up-sent-val": ({"font-size"},
                    "gehoert zu .up-sent: Schriftgroesse nur zusammen mit der Pille aendern"),
    "up-sent-dot": ({"width", "height", "border-radius"},
                    "abgerundetes Quadrat -- Groesse ohne Radius macht daraus einen Kreis"),
    "up-seg-btn":  ({"height", "border", "border-radius", "background"},
                    "fertiger Segmented-Control -- nur positionieren, nicht umstylen"),
    "vc-gran-btn": ({"height", "border", "border-radius", "background"},
                    "fertiger Granularitaets-Schalter -- nur positionieren"),
    # .up-trend bewusst NICHT im Paket: der Chip hat keine feste Hoehe, eine groessere
    # Schrift sprengt dort nichts. Nur Bauteile mit fester Geometrie gehoeren hierher.
    "up-td":       ({"padding"},
                    "Zellpolsterung ist appweit gleich -- Abstaende ueber das Raster loesen"),
    "up-row":      ({"display", "grid-template-columns"},
                    "GRID mit var(--up-cols) -- eigenes Raster braucht eine eigene flex-Regel"),
    "up-varring":  ({"width", "height"},
                    "Ring ist auf die Zeilenhoehe abgestimmt"),
}

# Signaturen der Core-Bauteile fuer die Nachbau-Erkennung
SIGNATUREN = {
    "up-seg-btn":  ({"height", "border", "border-radius", "background", "transition", "cursor"},
                    "Segmented-Control-Knopf (.up-seg-btn)"),
    "up-sent":     ({"height", "border-radius", "gap", "border"}, "Sentiment-Pille (.up-sent)"),
    "up-search":   ({"width", "transition", "overflow"}, "Slide-out-Suche (.up-search)"),
    "up-iconbtn":  ({"width", "height", "border-radius", "cursor", "background"},
                    "Icon-Knopf (.up-iconbtn)"),
}

# Diese Praefixe sind Core selbst -- dort duerfen die Regeln stehen.
CORE_DATEIEN = {"core.css"}


def regeln(pfad):
    txt = open(pfad, encoding="utf-8").read()
    txt = re.sub(r"/\*.*?\*/", "", txt, flags=re.S)
    for m in re.finditer(r"([^{}]+)\{([^{}]*)\}", txt):
        sel = " ".join(m.group(1).split())
        if not sel or sel.startswith("@"):
            continue
        eig = {p.split(":")[0].strip() for p in m.group(2).split(";") if ":" in p}
        eig = {e for e in eig if e and not e.startswith("--")}
        if eig:
            zeile = txt[:m.start()].count("\n") + 1
            yield zeile, sel, eig


# Bauteile, die als Familie zusammen bewertet werden: wer eines anfasst, muss die Geschwister
# mitziehen. Der Check summiert dafuer alle Regeln EINER Datei, die zur Familie gehoeren.
FAMILIEN = {
    "up-sent": ["up-sent", "up-sent-val", "up-sent-dot"],
}


def familie_von(klasse):
    for stamm, glieder in FAMILIEN.items():
        if klasse in glieder:
            return stamm
    return klasse


def pruefe(pfad):
    name = os.path.basename(pfad)
    if name in CORE_DATEIEN:
        return []
    treffer = []
    # Erst alles einsammeln: pro (Kontext, Familie) die Vereinigung der gesetzten Eigenschaften.
    gruppen = {}
    for zeile, sel, eig in regeln(pfad):
        for klasse in PAKETE:
            if ("." + klasse) in sel:
                stamm = familie_von(klasse)
                # Kontext = der Selektor ohne den Bauteilnamen, damit zwei Orte getrennt bleiben
                ktx = re.sub(r"\.(%s)\b" % "|".join(sorted(PAKETE, key=len, reverse=True)),
                             "", sel).strip()
                sl = gruppen.setdefault((ktx, stamm), {"zeile": zeile, "sel": [], "eig": set()})
                sl["eig"] |= eig
                sl["sel"].append(sel)
                break
    for (ktx, stamm), d in sorted(gruppen.items(), key=lambda x: x[1]["zeile"]):
        paket, warum = PAKETE[stamm] if stamm in PAKETE else PAKETE[FAMILIEN[stamm][0]]
        if stamm in FAMILIEN:
            paket = set()
            for g in FAMILIEN[stamm]:
                paket |= PAKETE[g][0]
        beruehrt, fehlt = d["eig"] & paket, paket - d["eig"]
        if beruehrt and fehlt:
            treffer.append((d["zeile"], "GESPRENGT", " + ".join(d["sel"]),
                            "setzt %s, laesst %s unveraendert -- %s"
                            % (", ".join(sorted(beruehrt)), ", ".join(sorted(fehlt)), warum)))
    for zeile, sel, eig in regeln(pfad):
        if True:
            # B) eigene Klasse, die wie ein Core-Bauteil aussieht?
            if ".up-" in sel or ".vc-" in sel:
                continue                        # nutzt bereits Core-Klassen
            for klasse, (sig, was) in SIGNATUREN.items():
                if sig <= eig:
                    treffer.append((zeile, "NACHGEBAUT", sel,
                                    "definiert %s -- sieht aus wie %s"
                                    % (", ".join(sorted(sig)), was)))
                    break
    return treffer


def geaendert():
    """Nur was gerade angefasst wurde. Der Bestand hat gewachsene Ausnahmen; wer die alle
    meldet, produziert Rauschen, und Rauschen wird weggeklickt. --alle prueft trotzdem alles."""
    import subprocess
    try:
        r = subprocess.run(["git", "diff", "--name-only", "HEAD", "--", "*.css"],
                           cwd=HIER, capture_output=True, text=True, timeout=10)
        u = subprocess.run(["git", "ls-files", "--others", "--exclude-standard", "*.css"],
                           cwd=HIER, capture_output=True, text=True, timeout=10)
        namen = [x for x in (r.stdout + u.stdout).split("\n") if x.strip().endswith(".css")]
        return [os.path.join(HIER, n) for n in namen]
    except Exception:
        return []


def main():
    if "--alle" in sys.argv:
        ziele = sorted(glob.glob(os.path.join(HIER, "*.css")))
    else:
        ziele = [a for a in sys.argv[1:] if a.endswith(".css")] or geaendert()
    if not ziele:
        print("Nachbauten: keine geaenderte CSS -- nichts zu pruefen ('--alle' prueft den Bestand)")
        return
    gesamt = 0
    for pfad in ziele:
        if not os.path.isabs(pfad):
            pfad = os.path.join(HIER, pfad)
        t = pruefe(pfad)
        if t:
            print("\n%s" % os.path.basename(pfad))
            for zeile, art, sel, warum in t:
                print("  %-11s Zeile %-5d %s" % (art, zeile, sel))
                print("              %s" % warum)
            gesamt += len(t)
    if gesamt:
        print("\n%d Verdachtsfall%s. Jeden beheben ODER im Kommentar begruenden, warum er hier"
              % (gesamt, "" if gesamt == 1 else "e"))
        print("richtig ist. 'Sieht so besser aus' ist keine Begruendung -- das Bauteil sieht dann")
        print("an zwei Orten verschieden aus.")
        sys.exit(1)
    print("Nachbauten: sauber")


if __name__ == "__main__":
    main()
