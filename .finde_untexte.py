#!/usr/bin/env python3
"""Findet sichtbare englische Texte, die im deutschen Katalog fehlen.

Der Prueftand, der eine Komponente zweimal rendert (englisch und deutsch) und Text fuer Text
vergleicht, ist das genauere Werkzeug -- aber er braucht je Komponente einen eigenen Aufbau mit
echten Daten. Fuer eine Bestandsaufnahme ueber zwanzig Dateien ist das der falsche Tausch.

Also andersherum: aus dem Quelltext jede Zeichenkette holen, die als Text im DOM landen KANN
(zwischen Tags, als Beschriftung, als title/aria-label/data-tip), und gegen den Katalog halten.
Was fehlt, kommt auf die Liste. Falsche Treffer sind eingeplant -- eine Liste, die zu viel zeigt,
kostet Lesezeit; eine, die zu wenig zeigt, laesst englische Texte stehen.
"""
import io, re, sys, os

def katalog(text):
    """Die Schluessel des deutschen Katalogs aus core.js."""
    raus = set()
    for m in re.finditer(r'\n\s*"((?:[^"\\]|\\.)+)"\s*:\s*"', text):
        raus.add(m.group(1))
    return raus

def kandidaten(quelle):
    """Zeichenketten, die wie sichtbarer Text aussehen."""
    raus = {}
    # a) Text zwischen zwei Tags: >Text<
    for m in re.finditer(r">([A-Z][A-Za-z0-9 ,.:;!?'()\-/&%]{2,90})<", quelle):
        raus.setdefault(m.group(1).strip(), 0)
    # b) haeufige Attribute
    for m in re.finditer(r'(?:title|aria-label|data-tip|data-tiplabel|placeholder)="([^"]{3,90})"', quelle):
        raus.setdefault(m.group(1).strip(), 0)
    # c) label:/head:/title:/desc:/hint:/body: "..."
    for m in re.finditer(r'(?:label|head|title|desc|hint|body|sub|note|text|msg|caption)\s*:\s*"([^"]{3,140})"', quelle):
        raus.setdefault(m.group(1).strip(), 0)
    return raus

RAUS = re.compile(r'^[a-z0-9_\-]+$|^[#.]|^\d|^[A-Z]{2,6}$|^\{|^<|^https?:|^/|^&|^%s$|^[A-Za-z]$')
def sichtbar(s):
    if RAUS.match(s): return False
    if not re.search(r"[A-Za-z]{3}", s): return False
    if re.search(r"[{}<>$]", s): return False
    if s.count(" ") == 0 and s.islower(): return False
    return True

kern = io.open("core.js", encoding="utf-8").read()
KAT = katalog(kern)
gesamt = {}
for datei in sys.argv[1:]:
    if not os.path.exists(datei): print("fehlt:", datei); continue
    q = io.open(datei, encoding="utf-8").read()
    fehlt = [s for s in kandidaten(q) if sichtbar(s) and s not in KAT]
    if fehlt:
        gesamt[datei] = sorted(set(fehlt))
for datei, liste in gesamt.items():
    print("\n=== " + datei + "  (" + str(len(liste)) + ")")
    for s in liste: print("   " + s)
print("\nSUMME:", sum(len(v) for v in gesamt.values()), "Texte ohne Katalogeintrag")
