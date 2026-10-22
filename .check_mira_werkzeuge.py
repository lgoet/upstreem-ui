#!/usr/bin/env python3
"""Prueft mira-werkzeuge.json gegen die Funktionen, die die UI wirklich ruft.

Warum: Bis zum Umbau hatte Mira eigene Wrapper vor den UI-Funktionen. Bekam eine
UI-Funktion eine neue Version, musste jemand daran denken, den Wrapper umzustellen --
das ist regelmaessig nicht passiert, und Mira rechnete mit alten Zahlen (Mira-Audit
17.10.). Seit dem Plan vom 22.10. (Entscheidung Q4) ruft der Agent dieselben Funktionen
wie die UI, und diese Datei sorgt dafuer, dass beide nicht auseinanderlaufen:

  - jede Funktion im Manifest steht als Zeichenkette im ausgelieferten UI-Code,
  - die UI ruft keine NEUERE Version derselben Funktion (sonst: veraltet),
  - der Aufbau des Manifests ist in sich stimmig (Namen, Klassen, Filter, Parameter),
  - jedes Werkzeug, jeder Parameter und jeder gemeinsame Filter hat eine Beschreibung.

Eine neue Version wird also im selben Commit in der UI UND im Manifest nachgezogen.

Ausnahme "nur_mira" (22.10.): Funktionen, die es nur fuer Mira gibt, weil die UI keine Ansicht dafuer
hat (Nachfolger alter n8n-Werkzeuge: Marken auf Quellen, Seitenzusammenfassungen, Prompt-Katalog,
Opportunities mit Filtern). Der Aufruf traegt dann "nur_mira": "<Begruendung>"; ohne Begruendung ist
es ein Fehler, und steht die Funktion doch im UI-Code, ebenfalls (dann gilt die normale Pruefung).

Warum die Beschreibung Pflicht ist (22.10.): Das Modell sieht nur Name, Beschreibung und
Parameterbeschreibungen. Ohne Text raet es die Bedeutung aus dem Namen -- "mentioned" hielt es
fuer "die gewaehlten Marken" (gemeint ist die eigene Marke) und sagte im echten Test "keine Domain
nennt LeeUp", tatsaechlich waren es 3. Ein Parameter ohne Beschreibung ist darum ein Fehler, kein
Schoenheitsmangel.

    python3 .check_mira_werkzeuge.py            Fehler und Zahl der Werkzeuge
    python3 .check_mira_werkzeuge.py --liste    dazu je Werkzeug die Funktionen
    python3 .check_mira_werkzeuge.py --manifest <pfad>   anderes Manifest (Gegenprobe)
"""
import json, os, re, sys

MANIFEST = sys.argv[sys.argv.index("--manifest") + 1] if "--manifest" in sys.argv else "mira-werkzeuge.json"
# Was nicht ausgeliefert wird (wie werkzeug/ui_holen.mjs in upstreem-app): Arbeitsordner,
# Pruefstaende, Fremdcode. Ein Name, der nur dort steht, ruft die App nicht.
AUSSER_ORDNER = {"bubble", "testdaten", "framer", "landing-bilder", "vendor", "node_modules", ".claude", ".git"}
KLASSEN = {"lesen", "frei", "bestaetigen"}   # Q2: lesen frei, umkehrbar direkt, Kontingent/Geld per Karte
NAME = re.compile(r"^[a-z][a-z0-9_]{2,40}$")
FN = re.compile(r"^[a-z_][a-z0-9_]*$")
EDGE = re.compile(r"^[a-z0-9][a-z0-9-]*$")
VERSION = re.compile(r"^(.+)_v(\d+)$")
LOESCHT = re.compile(r"(^|[_-])(delete|remove|purge|drop|destroy|clear|undo|loeschen)([_-]|$)", re.I)

fehler = []
def f(text):
    fehler.append(text)

def beschrieben(x):
    """Nicht-leerer Text in "beschreibung" (nur Leerraum zaehlt als leer)."""
    return isinstance(x, dict) and isinstance(x.get("beschreibung"), str) and x["beschreibung"].strip() != ""

try:
    m = json.load(open(MANIFEST, encoding="utf-8"))
except (OSError, ValueError) as e:
    sys.exit(MANIFEST + " nicht lesbar: " + str(e))

# ---- Der ausgelieferte UI-Code als ein Text ------------------------------------------------
teile = []
for wurzel, ordner, dateien in os.walk("."):
    ordner[:] = [o for o in ordner if o not in AUSSER_ORDNER and not o.startswith(".")]
    for d in dateien:
        if not d.endswith(".js") or d.endswith(".min.js") or d.startswith("_") or d.startswith("."):
            continue
        teile.append(open(os.path.join(wurzel, d), encoding="utf-8", errors="replace").read())
code = "\n".join(teile)
if len(teile) < 20:
    sys.exit("Nur %d JS-Dateien gefunden -- aus dem Wurzelordner von upstreem-ui aufrufen." % len(teile))

def zitiert(name):
    """Steht der Name als Zeichenkette im Code (nicht nur in Prosa)?"""
    return re.search(r"[\"']" + re.escape(name) + r"[\"']", code) is not None

def hoechste_version(basis):
    vs = [int(v) for v in re.findall(r"[\"']" + re.escape(basis) + r"_v(\d+)[\"']", code)]
    return max(vs) if vs else None

# ---- Gemeinsame Filter --------------------------------------------------------------------
filter_def = m.get("filter")
if not isinstance(filter_def, dict) or not filter_def:
    f("filter fehlt oder ist leer")
    filter_def = {}
for name, fd in filter_def.items():
    if not isinstance(fd, dict) or not FN.match(str(fd.get("rpc", ""))) or not isinstance(fd.get("schema"), dict):
        f("filter %s: rpc oder schema fehlt" % name)
    if not beschrieben(fd):
        f("filter %s: beschreibung fehlt" % name)

# ---- Werkzeuge ------------------------------------------------------------------------------
werkzeuge = m.get("werkzeuge")
if not isinstance(werkzeuge, list) or not werkzeuge:
    sys.exit("werkzeuge fehlt oder ist leer")
gesehen = set()
for w in werkzeuge:
    n = str(w.get("name", ""))
    wo = "Werkzeug " + (n or "?")
    if not NAME.match(n):
        f(wo + ": Name ungueltig")
    if n in gesehen:
        f(wo + ": Name doppelt")
    gesehen.add(n)
    if w.get("klasse") not in KLASSEN:
        f(wo + ": klasse muss eine von %s sein" % sorted(KLASSEN))
    if not beschrieben(w):
        f(wo + ": beschreibung fehlt")
    params = w.get("parameter")
    if not isinstance(params, dict):
        f(wo + ": parameter fehlt")
        params = {}
    # Vor dem Wissens-Zweig: auch get_knowledge hat Parameter, die das Modell lesen muss.
    for pn, p in params.items():
        if not beschrieben(p):
            f(wo + ": Parameter %s: beschreibung fehlt" % pn)
    filt = w.get("filter", [])
    for x in filt:
        if x not in filter_def:
            f(wo + ": unbekannter Filter " + str(x))
    aufrufe = w.get("aufrufe", [])
    if w.get("wissen"):
        if aufrufe:
            f(wo + ": Wissens-Werkzeug ruft keine Funktion")
        continue
    if not aufrufe:
        f(wo + ": aufrufe fehlt")
    # Zwei Namen fuer denselben RPC-Parameter waeren zwei Wahrheiten.
    ziele = {}
    for pn, p in params.items():
        if not isinstance(p, dict) or not FN.match(str(p.get("rpc", ""))) or not isinstance(p.get("schema"), dict):
            f(wo + ": Parameter %s braucht rpc und schema" % pn)
            continue
        if p["rpc"] in ziele:
            f(wo + ": %s und %s gehen beide an %s" % (ziele[p["rpc"]], pn, p["rpc"]))
        ziele[p["rpc"]] = pn
    for x in filt:
        r = filter_def.get(x, {}).get("rpc")
        if r in ziele:
            f(wo + ": Filter %s und Parameter %s gehen beide an %s" % (x, ziele[r], r))
    # Aktionen (P3, Plan Q2): Loeschen ist fuer den Agenten tabu; Klasse frei (direkt) nur mit Rueckweg fuer
    # das Fenster, Klasse bestaetigen nur mit einer Startfunktion (rolle start bzw. anlegen). Dieselben Regeln
    # setzt upstreem-app lib/mira/aktionen.ts beim Bau der Werkzeuge durch; hier fallen sie schon im Manifest auf.
    if w.get("klasse") in ("frei", "bestaetigen"):
        for a in aufrufe:
            if LOESCHT.search(str(a.get("fn") or a.get("edge") or "")):
                f(wo + ": Aktion ruft eine loeschende Funktion (%s) -- Loeschen ist fuer den Agenten tabu" % (a.get("fn") or a.get("edge")))
        rw = w.get("rueckweg")
        if w.get("klasse") == "frei" and not (isinstance(rw, dict) and FN.match(str(rw.get("fn", "")))):
            f(wo + ": Klasse frei braucht rueckweg.fn (Rueckgaengig im Fenster)")
        if w.get("klasse") == "bestaetigen" and not any(a.get("rolle") in ("start", "anlegen") for a in aufrufe):
            f(wo + ": Klasse bestaetigen braucht einen Aufruf mit rolle start bzw. anlegen")
    for a in aufrufe:
        # Edge Function statt RPC (P3: start-job fuer Prompt Research), sonst dieselbe Pruefung: die UI ruft sie.
        if a.get("edge"):
            e = str(a["edge"])
            if not EDGE.match(e) or a.get("fn"):
                f(wo + ": edge ungueltig oder zusammen mit fn: " + e)
            elif not zitiert(e):
                f(wo + ": Edge Function %s steht nicht im UI-Code" % e)
            continue
        fn = str(a.get("fn", ""))
        if not FN.match(fn):
            f(wo + ": Funktionsname ungueltig: " + fn)
            continue
        for o in a.get("ohne", []):
            if o not in params and o not in filt:
                f(wo + ": %s.ohne nennt unbekanntes %s" % (fn, o))
        # Feste Werte je Aufruf (z. B. p_fields der Gesamtzeilen: ohne sie rechnet die Funktion
        # nichts, "von Haus aus keine Berechnung"). Ein fester Wert darf kein Modell-Parameter sein.
        fest = a.get("fest", {})
        if not isinstance(fest, dict):
            f(wo + ": %s.fest muss ein Objekt sein" % fn)
            fest = {}
        for k in fest:
            if not FN.match(k) or not k.startswith("p_"):
                f(wo + ": %s.fest hat ungueltigen Parameter %s" % (fn, k))
            if k in ziele or k in [filter_def.get(x, {}).get("rpc") for x in filt]:
                f(wo + ": %s.fest setzt %s, das auch das Modell setzt" % (fn, k))
        nur = a.get("nur_mira")
        if nur is not None:
            if not isinstance(nur, str) or len(nur.strip()) < 15:
                f(wo + ": %s.nur_mira braucht eine Begruendung" % fn)
            if zitiert(fn):
                f(wo + ": %s steht im UI-Code -- nur_mira entfernen" % fn)
            continue
        if not zitiert(fn):
            f(wo + ": %s steht nicht im UI-Code -- ruft die UI sie nicht (mehr)?" % fn)
            continue
        v = VERSION.match(fn)
        if v:
            hoch = hoechste_version(v.group(1))
            if hoch is not None and hoch > int(v.group(2)):
                f(wo + ": %s ist veraltet, die UI ruft %s_v%d" % (fn, v.group(1), hoch))

if "--liste" in sys.argv:
    for w in werkzeuge:
        fns = ", ".join(a.get("fn") or ("edge " + str(a.get("edge", ""))) for a in w.get("aufrufe", [])) or "(Wissen)"
        print("  %-24s %-12s %s" % (w.get("name"), w.get("klasse"), fns))

if fehler:
    print("Mira-Werkzeuge: %d Fehler" % len(fehler))
    for x in fehler:
        print("  - " + x)
    sys.exit(1)
print("Mira-Werkzeuge: %d Werkzeuge, alle Funktionen aktuell und in der UI" % len(werkzeuge))
