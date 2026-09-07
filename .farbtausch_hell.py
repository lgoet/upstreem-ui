#!/usr/bin/env python3
"""Tauscht die HELLEN Flaechenfarben aus -- NUR in Deklarationen, nie in Kommentaren.

Die alten Werte stehen in vielen Kommentaren als Beleg ("gemessen #1b1b1b zu #151515"). Wuerde
ein stumpfes Ersetzen sie mitnehmen, staende dort eine Messung, die es nie gab -- und die naechste
Suche nach der Herkunft eines Wertes liefe ins Leere. Also werden /* ... */ und // ... uebersprungen.
"""
import io, re, sys

TAUSCH = [
    # Zweiter Lauf: EIN gedaempfter Ton fuer die ganze App. #6f737c stand noch in jeder lokalen
    # Palette der schwebenden Schichten; zwei Toene fuer eine Rolle sind genau die Drift, gegen
    # die diese Tokens da sind. Begruendung fuer den Wert steht in core.css am hellen Block.
    ("#6f737c", "#6b6f78"),
]

def tausche(text):
    raus, i, n = [], 0, len(text)
    zahl = 0
    while i < n:
        if text.startswith("/*", i):
            j = text.find("*/", i + 2); j = n if j < 0 else j + 2
            raus.append(text[i:j]); i = j; continue
        if text.startswith("//", i):
            j = text.find("\n", i); j = n if j < 0 else j
            raus.append(text[i:j]); i = j; continue
        j = i
        while j < n and not text.startswith("/*", j) and not text.startswith("//", j): j += 1
        stueck = text[i:j]
        for alt, neu in TAUSCH:
            zahl += stueck.count(alt)
            stueck = stueck.replace(alt, neu)
        raus.append(stueck); i = j
    return "".join(raus), zahl

gesamt = 0
for datei in sys.argv[1:]:
    s = io.open(datei, encoding="utf-8").read()
    neu, z = tausche(s)
    if z:
        io.open(datei, "w", encoding="utf-8").write(neu)
        print("%-28s %3d Werte" % (datei, z))
        gesamt += z
print("SUMME:", gesamt)
