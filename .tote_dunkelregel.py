#!/usr/bin/env python3
"""Findet Dunkel-Regeln, die nichts mehr tun.

Muster: die helle Regel setzt eine Eigenschaft ueber eine MARKE, und die Dunkel-Regel
setzt dieselbe Eigenschaft auf ein Literal, das genau dem DUNKLEN Wert dieser Marke
entspricht. Die Dunkel-Regel schreibt damit hin, was die Marke ohnehin liefert.
"""
import re, sys, glob

def ohne_komm(t): return re.sub(r'/\*.*?\*/', lambda m: "\n" * m.group(0).count("\n"), t, flags=re.S)
FARBE = re.compile(r'#[0-9a-fA-F]{3,8}\b')
EINFACH = {"color","background","background-color","border-color","fill","stroke",
           "border-top-color","border-bottom-color","border-left-color","border-right-color"}

core = ohne_komm(open("core.css", encoding="utf-8").read())
def block(sel):
    i = core.find(sel)
    if i < 0: return ""
    j = core.find("\n    }", i)
    return core[i:j if j > 0 else i + 9000]
dunkelW = {n: v.lower() for n, v in re.findall(r'(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;', block('.up-root[data-theme="dark"] {'))}

def norm(sel):
    s = re.sub(r'\[data-theme="dark"\]', "", sel)
    s = re.sub(r'^\s*\.up-root\s+|^\s*#[a-z-]+\s+', "", s)
    return re.sub(r'\s+', " ", s).strip()

def regeln(txt):
    for m in re.finditer(r'([^{}]+)\{([^{}]*)\}', txt):
        sel, rumpf = m.group(1).strip(), m.group(2)
        if sel.startswith("@") or "{" in sel: continue
        d = {}
        for x in re.finditer(r'(?<![-a-z])([-a-z]+)\s*:\s*([^;]+)', rumpf):
            if x.group(1) in EINFACH and not x.group(1).startswith("--"):
                d[x.group(1)] = x.group(2).strip()
        if d: yield sel, d, txt[:m.start()].count("\n") + 1

alle = []
for f in (sys.argv[1:] or [x for x in sorted(glob.glob("*.css")) if x != "vendor-coloris.min.css"]):
    txt = ohne_komm(open(f, encoding="utf-8").read())
    hell, dunkel = {}, {}
    for sel, d, nr in regeln(txt):
        ziel = dunkel if 'data-theme="dark"' in sel else hell
        for teil in sel.split(","):
            ziel.setdefault(norm(teil), []).append((nr, d, teil.strip()))
    for k, eintraege in dunkel.items():
        if k not in hell: continue
        for nrD, dD, selD in eintraege:
            for nrH, dH, selH in hell[k]:
                for eig, wert in dD.items():
                    c = FARBE.findall(wert)
                    if len(c) != 1 or "var(" in wert: continue
                    m = re.search(r'var\(\s*(--[a-z0-9-]+)', dH.get(eig, ""))
                    if not m: continue
                    marke = m.group(1)
                    if dunkelW.get(marke) == c[0].lower():
                        alle.append((f, nrD, selD, eig, c[0], marke, nrH))
print("Tote Dunkel-Angaben: %d\n" % len(alle))
for t in alle:
    print("  %-26s Z%-5d %-40s %-18s %s == %s (hell Z%d)" % (t[0], t[1], t[2][:40], t[3], t[4], t[5], t[6]))
