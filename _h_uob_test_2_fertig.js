/* ONBOARDING -- TESTDATEN 2: Hintergrundlauf fertig -- Marken, Themen, Phase 5

   Wortgleich die Beispieldaten aus onboarding-page.js. Zum Ausprobieren OHNE Bubble-Daten:
   in einen Run-JavaScript-Schritt kopieren, INSTANCE_ID anpassen, fertig.
   Fuer den Echtbetrieb dann _h_uob_runjs_*.js nehmen -- die tragen die Bubble-Ausdruecke.

   Die REIHENFOLGE ist der Punkt: erst die Listen, dann die 5. Gemessen landet eine 5 ohne
   vorherige Listen auf Competitors mit null Eintraegen, und der Nutzer sieht einen leeren
   Schritt, bis die Liste nachkommt. Alles drei im selben Schritt, dann gibt es dieses Fenster
   nicht. */
(function () {
  var INSTANCE_ID = "onboarding";

  var MARKEN = `[
     {
      "id": "f6450b61-b104-44b8-a9f9-c9cd30f53c58",
      "name": "d&b audiotechnik",
      "domain": "dbaudio.com",
      "url": "https://dbaudio.com",
      "favicon_url": "https://www.google.com/s2/favicons?domain=dbaudio.com&sz=64",
      "selected": false
     },
     {
      "id": "56f0910d-a8dc-4f48-8f52-1d5bc86ba038",
      "name": "L-Acoustics",
      "domain": "l-acoustics.com",
      "url": "https://l-acoustics.com",
      "favicon_url": "https://www.google.com/s2/favicons?domain=l-acoustics.com&sz=64",
      "selected": false
     },
     {
      "id": "3d0c0160-25a0-475b-bab3-29b4f5cd120b",
      "name": "Meyer Sound",
      "domain": "meyersound.com",
      "url": "https://meyersound.com",
      "favicon_url": "https://www.google.com/s2/favicons?domain=meyersound.com&sz=64",
      "selected": false
     },
     {
      "id": "ae8e82b0-fb4f-4b56-a052-00cc730a97e2",
      "name": "KV2 Audio",
      "domain": "kv2audio.com",
      "url": "https://kv2audio.com",
      "favicon_url": "https://www.google.com/s2/favicons?domain=kv2audio.com&sz=64",
      "selected": false
     },
     {
      "id": "1ddc14fd-f7e1-4c83-98a6-4433b7b9222a",
      "name": "CODA Audio",
      "domain": "codaaudio.com",
      "url": "https://codaaudio.com",
      "favicon_url": "https://www.google.com/s2/favicons?domain=codaaudio.com&sz=64",
      "selected": false
     },
     {
      "id": "9a2fad22-cb7b-4acc-919f-da37972d6bcd",
      "name": "NEXO",
      "domain": "nexo-sa.com",
      "url": "https://nexo-sa.com",
      "favicon_url": "https://www.google.com/s2/favicons?domain=nexo-sa.com&sz=64",
      "selected": false
     },
     {
      "id": "1fff4526-d922-4305-820b-6ef33d607c7d",
      "name": "RCF",
      "domain": "rcf.it",
      "url": "https://rcf.it",
      "favicon_url": "https://www.google.com/s2/favicons?domain=rcf.it&sz=64",
      "selected": false
     },
     {
      "id": "422b43a8-ec22-49d3-ae0f-7c893b22b4e0",
      "name": "Electro-Voice",
      "domain": "electrovoice.com",
      "url": "https://electrovoice.com",
      "favicon_url": "https://www.google.com/s2/favicons?domain=electrovoice.com&sz=64",
      "selected": false
     }
    ]`;

  var THEMEN = `[
     {
      "id": "t-line-array",
      "name": "Line Array Systems",
      "description": "Vertikal arraybare Systeme fuer grosse Flaechen"
     },
     {
      "id": "t-touring",
      "name": "Festival & Touring Sound",
      "description": "Open Air, Tourneen, wechselnde Spielstaetten"
     },
     {
      "id": "t-club",
      "name": "Club & Nightlife",
      "description": "Feste Installationen in Clubs und Bars"
     },
     {
      "id": "t-spatial",
      "name": "Spatial & Immersive Audio",
      "description": "Objektbasiertes Mischen, raeumliche Wiedergabe"
     },
     {
      "id": "t-amps",
      "name": "Amplifiers & Rigging",
      "description": "Endstufenracks, Traversen, Transporthardware"
     },
     {
      "id": "t-efficiency",
      "name": "Energy Efficiency",
      "description": "Wirkungsgrad, Leistungsbedarf, Nachhaltigkeit"
     },
     {
      "id": "t-venues",
      "name": "Arenas & Venues",
      "description": "Mehrzweckhallen, Theater, Arenen"
     }
    ]`;

  var t = 0;
  (function go () {
    if (typeof window.setOnboardingBrands === "function") {
      window.setOnboardingBrands(INSTANCE_ID, MARKEN);   // 1. Marken
      window.setOnboardingTopics(INSTANCE_ID, THEMEN);   // 2. Themen
      window.setOnboardingStatus(INSTANCE_ID, "5");      // 3. erst jetzt fertig
      return;
    }
    if (t++ < 60) setTimeout(go, 100);
  })();
})();
