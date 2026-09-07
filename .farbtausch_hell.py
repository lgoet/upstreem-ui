#!/usr/bin/env python3
"""Tauscht die HELLEN Flaechenfarben aus -- NUR in Deklarationen, nie in Kommentaren.

Die alten Werte stehen in vielen Kommentaren als Beleg ("gemessen #1b1b1b zu #151515"). Wuerde
ein stumpfes Ersetzen sie mitnehmen, staende dort eine Messung, die es nie gab -- und die naechste
Suche nach der Herkunft eines Wertes liefe ins Leere. Also werden /* ... */ und // ... uebersprungen.
"""
import io, re, sys

TAUSCH = [
    # Dritter Lauf, 07.09.: JEDE ROLLE EINE STUFE HOEHER. Gemeldet als "die Tabellen / Cards /
    # Kopfzeilen sind mir etwas zu dunkel". In Linears hellem Spektrum gibt es dafuer genau eine
    # Stufe, und zwar die jeweils naechste nach oben -- zwischen bg-secondary und Weiss liegt
    # nichts mehr. Die Reihenfolge dieser drei Paare ist wichtig: erst tertiary hoch, dann
    # quaternary auf den frei gewordenen Platz, dann quinary. Andersherum wuerde ein Wert zweimal
    # wandern. Die Karte selbst steht schon von Hand auf #ffffff, sonst waere sie mitgelaufen.
    ("#f4f2f4", "#f9f8f9"),                 # Kopfzeile, Feld, Umschalter, Tabellenkopf, Zeilenhover
    ("#eeedef", "#f4f2f4"),                 # Auswahl
    ("#e9e8ea", "#eeedef"),                 # Skelett
    ("rgba(244,242,244,0.6)", "rgba(249,248,249,0.6)"),
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
