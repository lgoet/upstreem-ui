#!/usr/bin/env python3
"""Nimmt Kommentarzeilen aus einer Datei, die der Nutzer in Bubble oder die Konsole einfuegt.

Nur GANZE Zeilen: alles, was mit /* beginnt bis zum passenden */, plus Zeilen, die nur einen
//-Kommentar tragen. Ein Kommentar am Zeilenende bleibt stehen -- ihn zu entfernen hiesse, in
einer Zeile mit Regex-Literalen (/upstreem-ui@([^/]+)//) zu raten, und genau daran zerlegt sich
so ein Skript still. Aufruf: .strip_kommentare.py <ein> <aus>
"""
import io, sys

def strip(text):
    """drin: in einem /*-Block. html: in einem <!-- -->-Block (das Preload liegt als HTML vor,
    sein Kopfkommentar ist keiner von JS und blieb im ersten Anlauf komplett stehen)."""
    aus, drin, html = [], False, False
    for z in text.split("\n"):
        t = z.strip()
        if html:
            if "-->" in t: html = False
            continue
        if drin:
            if "*/" in t: drin = False
            continue
        if t.startswith("<!--"):
            if "-->" not in t: html = True
            continue
        if t.startswith("/*"):
            if "*/" not in t: drin = True
            continue
        if t.startswith("*") or t.startswith("//"):
            continue
        if not t:
            continue
        aus.append(z)
    return "\n".join(aus) + "\n"

io.open(sys.argv[2], "w", encoding="utf-8").write(strip(io.open(sys.argv[1], encoding="utf-8").read()))
print(sys.argv[2], len(io.open(sys.argv[2], encoding="utf-8").read()), "Zeichen")
