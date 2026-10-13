#!/usr/bin/env node
/* Schreibt das vorgerenderte Markup der Landingpage in die drei Framer-Komponenten (13.10.).

   WARUM erzeugt und nicht abgeschrieben: die Texte der Startseite stehen in landing-hero.js, und
   nur dort. Die Framer-Komponenten brauchen dasselbe Markup als HTML, damit Framer es vorrendert
   und Crawler ohne JavaScript es lesen (GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot). Eine
   zweite, von Hand gepflegte Fassung waere ab der ersten Textaenderung eine andere Seite -- dieselbe
   Ueberlegung wie bei .landing_markup.py.

   Wie: landing-hero.js laeuft hier in einer leeren Node-Umgebung (kein Dokument) mit dem Schalter
   window.__ulhNurHtml. Statt zu starten, legt die Datei ihr Markup in window.__ulhHtml ab:
     seite   seiteHtml(true) -- die ganze Seite, die App-Komponenten im Fenster als <template>
     stand   die Pruefsumme dazu; landing-hero.js uebernimmt das Markup nur, wenn sie passt
     leiste  leiste()   -> framer/UpstreemTopbar.tsx
     fuss    fuss()     -> framer/UpstreemFooter.tsx
   Laeuft die Datei dabei auf ein Dokument, bricht das hier ab -- dann ist ein Teil des Aufbaus
   nicht mehr ohne Browser lauffaehig, und genau das muss er fuer diesen Weg bleiben.

   Aufruf nach jeder Aenderung an Texten oder Aufbau in landing-hero.js (und nach
   .landing_markup.py):
       node .landing_ssr.js
   Danach die geaenderten .tsx in Framer einsetzen (siehe Kopf der Dateien). */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const R = __dirname;
const QUELLE = path.join(R, "landing-hero.js");

function abbruch(t) { console.error("ABBRUCH -- " + t); process.exit(1); }

/* Ein Fenster ohne Dokument. Jeder Zugriff auf document wirft hier mit Namen, statt still
   undefined zu liefern. */
const fenster = { __ulhNurHtml: true, console };
fenster.window = fenster;
Object.defineProperty(fenster, "document", { get() { abbruch("landing-hero.js greift beim Erzeugen auf document zu"); } });
vm.createContext(fenster);
vm.runInContext(fs.readFileSync(QUELLE, "utf8"), fenster, { filename: "landing-hero.js" });
const h = fenster.__ulhHtml;
if (!h || !h.seite || !h.stand || !h.leiste || !h.fuss) abbruch("landing-hero.js hat kein Markup geliefert (__ulhHtml)");

/* Drei Wurzeln, je mit dem, was ihre Komponente ausmacht:
   data-ulh-ssr     die Pruefsumme -- landing-hero.js vergleicht und uebernimmt nur bei Gleichheit
   data-ulh-inline  die Seite steht in der Framer-Seite selbst, nicht in einem Rahmen (CSS: die
                    Leiste liegt ueber dem Hero)
   data-ulh-teil    Leiste oder Fuss als eigene Komponente; landing-hero.js laesst sie aus,
                    landing-teile.js bindet sie */
const TEILE = {
  "framer/UpstreemLanding.tsx": { name: "SEITE",
    html: '<div class="ulh-root" data-ulh-ssr="' + h.stand + '" data-ulh-inline="">' + h.seite + "</div>" },
  "framer/UpstreemTopbar.tsx": { name: "LEISTE",
    html: '<div class="ulh-root ulh-teil" data-ulh-teil="leiste">' + h.leiste + "</div>" },
  "framer/UpstreemFooter.tsx": { name: "FUSS",
    html: '<div class="ulh-root ulh-teil" data-ulh-teil="fuss">' + h.fuss + "</div>" },
};

const ANFANG = "/* ---- SSR ANFANG (erzeugt von .landing_ssr.js -- nicht von Hand aendern) ---- */\n";
const ENDE = "/* ---- SSR ENDE ---- */\n";

for (const [datei, t] of Object.entries(TEILE)) {
  const p = path.join(R, datei);
  if (/<\/?script/i.test(t.html)) abbruch(datei + ": Markup enthaelt ein <script>");
  const src = fs.readFileSync(p, "utf8");
  const a = src.indexOf(ANFANG), e = src.indexOf(ENDE);
  if (a < 0 || e < a || src.indexOf(ANFANG, a + 1) >= 0) abbruch("die Markierungen fehlen oder stehen doppelt in " + datei);
  /* Als JSON-Zeichenkette: gueltiges TypeScript, und kein Zeichen im Markup kann sie beenden. */
  const block = ANFANG + "const " + t.name + " = " + JSON.stringify(t.html) + "\n" +
    (t.name === "SEITE" ? "const STAND = " + JSON.stringify(h.stand) + "\n" : "") + ENDE;
  fs.writeFileSync(p, src.slice(0, a) + block + src.slice(e + ENDE.length));
  console.log(datei.padEnd(30) + String(t.html.length).padStart(8) + " Zeichen" + (t.name === "SEITE" ? "   Stand " + h.stand : ""));
}
