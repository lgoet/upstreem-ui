#!/usr/bin/env python3
"""Vergleicht zwei Vertragsaufnahmen. Entfernte Namen sind der Alarm."""
import json, sys
a = json.load(open(sys.argv[1])); b = json.load(open(sys.argv[2]))
alarm = False
for k in a:
    if k == "_zaehlung": continue
    va, vb = set(a[k]), set(b[k])
    weg, neu = sorted(va - vb), sorted(vb - va)
    if weg:
        alarm = True
        print("!! ENTFERNT aus " + k + ": " + ", ".join(weg))
    if neu:
        print("   neu in " + k + ": " + ", ".join(neu))
print("VERTRAG GEBROCHEN" if alarm else "Vertrag unveraendert (nur Zugaenge)")
