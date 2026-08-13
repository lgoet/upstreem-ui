#!/usr/bin/env python3
"""Nimmt den nach aussen sichtbaren Vertrag des Repos auf.

Alles, was Bubble sieht oder ruft: Event-Namen, data-*-fn-Attribute, globale
Funktionen, die Schluessel in gefeuerten Payloads, die gelesenen data-Attribute
und die Klassennamen, an denen fremder Code haengen koennte.

Vor einer Aenderung aufnehmen, danach erneut, dann diffen. Was hier verschwindet
oder sich umbenennt, bricht eine bestehende Bubble-Verdrahtung -- still.
"""
import re, os, json, sys

WURZEL = os.path.dirname(os.path.abspath(__file__))
QUELLEN = []
for d, _, fs in os.walk(WURZEL):
    if any(t in d for t in (".git", "to-migrate", "node_modules")): continue
    for f in fs:
        if f.endswith((".js", ".html", ".css")) and not f.startswith("_h_"):
            QUELLEN.append(os.path.join(d, f))

v = {"events": set(), "fnattrs": set(), "globals": set(), "payloadkeys": set(),
     "dataattrs": set(), "klassen": set(), "keyframes": set()}

for p in sorted(QUELLEN):
    rel = os.path.relpath(p, WURZEL)
    s = open(p, encoding="utf-8", errors="replace").read()
    # makeFire-Aufrufe: fire("data-x-fn", "eventName", {...})
    for m in re.finditer(r'fire\w*\(\s*"(data-[a-z-]+-fn)"\s*,\s*"(\w+)"', s):
        v["fnattrs"].add(m.group(1)); v["events"].add(m.group(2))
    # eventPrefix
    for m in re.finditer(r'eventPrefix:\s*"(\w+)"', s): v["events"].add("prefix:" + m.group(1))
    # data-*-fn irgendwo (Markup + Doku)
    for m in re.finditer(r'\b(data-[a-z0-9-]+-fn)\b', s): v["fnattrs"].add(m.group(1))
    # globale API
    for m in re.finditer(r'window\.(\w+)\s*=', s):
        n = m.group(1)
        if n.startswith(("__", "on")) or n in ("Chart",): continue
        v["globals"].add(n)
    for m in re.finditer(r'\bapi:\s*\{', s): pass
    for m in re.finditer(r'^\s{4,}(\w+):\s*(?:do|make|set|render|reset|get)\w*,?\s*$', s, re.M):
        pass
    # gelesene data-Attribute
    for m in re.finditer(r'getAttribute\(\s*"(data-[a-z0-9-]+)"', s): v["dataattrs"].add(m.group(1))
    # Payload-Schluessel in gefeuerten Objekten (grobe, aber stabile Naeherung)
    for m in re.finditer(r'fire\w*\([^;]{0,400}?\{([^{}]{0,600})\}', s, re.S):
        for k in re.finditer(r'(?:^|[\s,{])([a-z_][a-z0-9_]*)\s*:', m.group(1)):
            v["payloadkeys"].add(k.group(1))
    if p.endswith(".css"):
        for m in re.finditer(r'@keyframes\s+([\w-]+)', s): v["keyframes"].add(m.group(1))
        for m in re.finditer(r'\.((?:up|uut|udt|upt|urt|vot|tcd|combo|utm|udb|ubo|uo|upr|upd|umk|umf|utf|udr|uap|usb|sph|uca|mqa|am)[a-z0-9-]*)', s):
            v["klassen"].add(m.group(1))

out = {k: sorted(x) for k, x in v.items()}
out["_zaehlung"] = {k: len(x) for k, x in out.items() if k != "_zaehlung"}
json.dump(out, open(sys.argv[1] if len(sys.argv) > 1 else "contract.json", "w"),
          indent=1, ensure_ascii=False)
print(json.dumps(out["_zaehlung"], ensure_ascii=False))
