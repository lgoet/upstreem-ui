#!/usr/bin/env python3
"""Baut _h_landing_pin.html aus framer/landing_hero.html.

WARUM ein Skript und kein Kopieren von Hand: das Harness soll GENAU das pruefen, was in Framer
steht. Beim letzten Mal wurde nur der Pin darin ersetzt, das Schnipsel selbst aber nicht neu
uebernommen -- das Harness lud daraufhin die alte Dateiliste und zeigte eine Quick-Actions-Palette
ohne CSS. Der Fehler steckte im Messaufbau, nicht im Produkt, und hat eine Runde gekostet.

Aufruf nach jeder Aenderung am Schnipsel:
    python3 .landing_pin_harness.py
"""
import re
import sys

schnipsel = open("framer/landing_hero.html").read()
pin = re.search(r'data-cdn-pin="([^"]*)"', schnipsel)
if not pin:
    print("ABBRUCH -- kein data-cdn-pin im Schnipsel")
    sys.exit(1)

KOPF = '''<meta charset="utf-8">
<title>landing hero am Pin %s (genau das Framer-Schnipsel)</title>
<!-- ERZEUGT von .landing_pin_harness.py -- nicht von Hand aendern, sonst weicht der Messaufbau
     wieder von dem ab, was in Framer steht.
     Wozu: pruefen, ob das, was in Framer eingesetzt wird, am PIN wirklich laeuft -- also gegen
     cdn.jsdelivr.net und nicht gegen die Dateien auf der Platte. -->
<style>body{margin:0;font:12px ui-monospace,monospace;background:#fff}
#out{position:fixed;right:0;top:0;z-index:99;max-width:340px;background:#f6f6f6;padding:6px;
     white-space:pre-wrap;font:10px/1.4 ui-monospace,monospace}</style>
<body>
<pre id="out">laedt vom CDN</pre>
''' % pin.group(1)

FUSS = '''<script>
function messen(){
  var r = document.querySelector(".ulh-root");
  var v = r.querySelector(".ulh-view"), f = r.querySelector(".ulh-frame");
  var qa = r.querySelector("#mira-quick-actions");
  var trig = qa ? qa.querySelector(".mqa-trigger") : null;
  var o = {
    pin: r.getAttribute("data-cdn-pin"),
    core_da: !!window.UpstreemCore,
    rahmen: f ? Math.round(f.getBoundingClientRect().width) : null,
    fenster: v ? Math.round(v.clientWidth) : null,
    mass: getComputedStyle(r).getPropertyValue("--ulh-mass").trim(),
    blende: f ? getComputedStyle(f).backgroundColor : null,
    themen: [].map.call(r.querySelectorAll(".up-root"), function(e){ return e.getAttribute("data-theme"); }),
    leiste: r.querySelectorAll(".usn-item").length,
    leiste_breite: (function(){ var b = r.querySelector(".usn-bar"); return b ? b.offsetWidth : null; })(),
    kennzahlen: r.querySelectorAll(".dph-kpis > *").length,
    chart_zeilen: r.querySelectorAll(".vot-unit-right .vt-row").length,
    gran: (r.querySelector(".vc-gran-btn.is-active") || {}).textContent,
    zitate: r.querySelectorAll(".tct-row").length,
    /* Quick Actions: nicht ob das Markup da ist, sondern ob seine CSS greift. Ohne sie ist der
       Ausloeser ein nackter Knopf ohne Radius und ohne Hoehe. */
    qa_hoehe: trig ? Math.round(trig.getBoundingClientRect().height) : null,
    qa_radius: trig ? getComputedStyle(trig).borderRadius : null,
    stylesheets: [].map.call(document.querySelectorAll("link[rel=stylesheet]"), function(l){
      return l.href.split("/").pop(); }),
    fehler: window.__fehler || null
  };
  document.getElementById("out").textContent = JSON.stringify(o, null, 1);
  window.__fertig = o;
  return o;
}
window.addEventListener("error", function(e){
  window.__fehler = (window.__fehler || []).concat([String(e.message).slice(0, 100)]);
});
setTimeout(messen, 6000);
</script>
'''

open("_h_landing_pin.html", "w").write(KOPF + schnipsel + FUSS)
print("_h_landing_pin.html neu gebaut, Pin %s" % pin.group(1))
