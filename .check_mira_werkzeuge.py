#!/usr/bin/env python3
"""Prueft mira-werkzeuge.json gegen die Funktionen, die die UI wirklich ruft.

Warum: Bis zum Umbau hatte Mira eigene Wrapper vor den UI-Funktionen. Bekam eine
UI-Funktion eine neue Version, musste jemand daran denken, den Wrapper umzustellen --
das ist regelmaessig nicht passiert, und Mira rechnete mit alten Zahlen (Mira-Audit
17.10.). Seit dem Plan vom 22.10. (Entscheidung Q4) ruft der Agent dieselben Funktionen
wie die UI, und diese Datei sorgt dafuer, dass beide nicht auseinanderlaufen:

  - jede Funktion im Manifest steht als Zeichenkette im ausgelieferten UI-Code,
  - die UI ruft keine NEUERE Version derselben Funktion (sonst: veraltet),
  - der Aufbau des Manifests ist in sich stimmig (Namen, Klassen, Filter, Parameter).

Eine neue Version wird also im selben Commit in der UI UND im Manifest nachgezogen.

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
VERSION = re.compile(r"^(.+)_v(\d+)$")

fehler = []
def f(text):
    fehler.append(text)

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
    if not str(w.get("beschreibung", "")).strip():
        f(wo + ": beschreibung fehlt")
    params = w.get("parameter")
    if not isinstance(params, dict):
        f(wo + ": parameter fehlt")
        params = {}
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
    for a in aufrufe:
        fn = str(a.get("fn", ""))
        if not FN.match(fn):
            f(wo + ": Funktionsname ungueltig: " + fn)
            continue
        for o in a.get("ohne", []):
            if o not in params and o not in filt:
                f(wo + ": %s.ohne nennt unbekanntes %s" % (fn, o))
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
        fns = ", ".join(a.get("fn", "") for a in w.get("aufrufe", [])) or "(Wissen)"
        print("  %-24s %-12s %s" % (w.get("name"), w.get("klasse"), fns))

if fehler:
    print("Mira-Werkzeuge: %d Fehler" % len(fehler))
    for x in fehler:
        print("  - " + x)
    sys.exit(1)
print("Mira-Werkzeuge: %d Werkzeuge, alle Funktionen aktuell und in der UI" % len(werkzeuge))
