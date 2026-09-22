#!/usr/bin/env python3
"""Findet HELL/DUNKEL-Paare von Farbliteralen, die zusammen genau eine Marke nachbauen.

Muster: eine Regel setzt eine Farbe als Literal, und eine zweite Regel mit demselben
Selektor unter [data-theme="dark"] setzt dieselbe Eigenschaft auf ein anderes Literal.
Stimmen die beiden Werte mit den zwei Werten EINER Marke ueberein, ist das Paar ein
handgebauter Ersatz fuer diese Marke -- und die Dunkel-Regel ist ueberfluessig.

    python3 .paar_finder.py [datei ...]
"""
import re, sys, glob, collections

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
hell = {n: v.lower() for n, v in re.findall(r'(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;', block(".up-root {"))}
dunkel = {n: v.lower() for n, v in re.findall(r'(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;', block('.up-root[data-theme="dark"] {'))}
paare = {}
for n in hell:
    if n in dunkel and hell[n] != dunkel[n]:
        paare[(hell[n], dunkel[n])] = n

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
                c = FARBE.findall(x.group(2))
                if len(c) == 1 and "var(" not in x.group(2):
                    d[x.group(1)] = c[0].lower()
        if d: yield sel, d, txt[:m.start()].count("\n") + 1

def lauf(f):
    txt = ohne_komm(open(f, encoding="utf-8").read())
    hellR, dunkelR = {}, {}
    for sel, d, nr in regeln(txt):
        ziel = dunkelR if 'data-theme="dark"' in sel else hellR
        for teil in sel.split(","):
            ziel.setdefault(norm(teil), []).append((nr, d, teil.strip()))
    treffer = []
    for k, eintraege in hellR.items():
        if k not in dunkelR: continue
        for nrH, dH, selH in eintraege:
            for nrD, dD, selD in dunkelR[k]:
                for eig in dH:
                    if eig in dD and (dH[eig], dD[eig]) in paare:
                        treffer.append((f, nrH, nrD, selH, eig, dH[eig], dD[eig], paare[(dH[eig], dD[eig])]))
    return treffer

alle = []
for f in (sys.argv[1:] or [x for x in sorted(glob.glob("*.css")) if x != "vendor-coloris.min.css"]):
    alle += lauf(f)
print("Handgebaute Marken-Paare: %d\n" % len(alle))
for t in alle:
    print("  %-24s hell %5d / dunkel %5d  %-34s %-18s %s/%s -> %s" %
          (t[0], t[1], t[2], t[3][:34], t[4], t[5], t[6], t[7]))
