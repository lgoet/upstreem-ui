/* upstreem landing-teile.js — das VERHALTEN von Leiste und Fuss der Landingpage (13.10.).

   WARUM es diese Datei gibt: Leiste und Fuss stehen seit dem 13.10. an zwei Stellen -- auf der
   Startseite (in landing-hero.js, als Teil der ganzen Seite) und als eigene Framer-Komponenten auf
   den anderen Seiten (Blog, Preise, Rechtliches; framer/UpstreemTopbar.tsx und
   framer/UpstreemFooter.tsx). Die Komponenten, die es dafuer vorher gab, waren Nachbauten mit
   eigenen Werten und sahen anders aus als die Startseite (13.10. abgelehnt). Jetzt kommt beides aus
   EINER Quelle:
     - das MARKUP (und damit jeder Text) aus leiste() und fuss() in landing-hero.js, von
       .landing_ssr.js in die Komponenten geschrieben,
     - die FORM aus landing-hero.css (dieselbe Datei, derselbe Pin),
     - das VERHALTEN von hier: das eine Panel, das dem Zeiger folgt, und der Bildnachweis.
   landing-hero.js ruft dieselben zwei Funktionen auf der Startseite. Eine Kopie von navLauf in
   TypeScript waere die naechste Doppelung gewesen -- dieselbe Sorte Fehler, nur im Verhalten.

   Klein mit Absicht: auf einer Blogseite soll fuer die Leiste nicht die ganze Landingpage
   (landing-hero.js, rund 540 KB) laden.

   Bindet sich selbst an jede .ulh-root mit data-ulh-teil (die eigenen Komponenten). Die Startseite
   (.ulh-root ohne das Attribut) bindet landing-hero.js. */
(function(){
  "use strict";

  /* Zweimal geladen (Framer baut beim Seitenwechsel neu ein): nur neu binden. */
  if (window.UpstreemLandingTeile){ window.UpstreemLandingTeile.binden(); return; }

  /* Wo steht ein Element im Fenster, das WIRKLICH scrollt? In einem Embed-Rahmen ist das das
     Fenster darueber (siehe lage() in landing-hero.js, dort ausfuehrlich). Hier nur die Oberkante,
     mehr braucht das Springen zu einer Sektion nicht. */
  function oben(el){
    var y = el.getBoundingClientRect().top;
    try { var r = window.frameElement; if (r) y += r.getBoundingClientRect().top; } catch (e){}
    return y;
  }

  /* Das Panel folgt dem Zeiger. Gemessen wird am Inhalt, der schon dasteht -- deshalb kennt es
     seine Zielgroesse, bevor es faehrt.
     Geschlossen wird beim Verlassen der GANZEN Leiste und mit einer kurzen Nachfrist: der Weg von
     einem Punkt zum Panel fuehrt ueber ein paar Pixel Nichts, und ohne Frist faellt es genau dort
     zu. (Bis zum 13.10. stand diese Funktion in landing-hero.js; Wort fuer Wort uebernommen bis auf
     den Sprung zu einer Sektion, siehe unten.) */
  function navLauf(root){
    var nav = root.querySelector(".ulh-nav");
    var pop = root.querySelector(".ulh-nav-pop");
    if (!nav || !pop || nav.__ulhNavLauf) return;
    nav.__ulhNavLauf = true;
    var karten = {};
    [].forEach.call(pop.querySelectorAll(".ulh-nav-karte"), function(k){
      karten[k.getAttribute("data-menue")] = k;
    });
    var offen = null, uhr = null;

    function zeigen(k, knopf){
      clearTimeout(uhr);
      if (offen === k) return;
      offen = k;
      var karte = karten[k];
      if (!karte) return;
      /* Beim ERSTEN Oeffnen springt das Panel an seine Stelle, ohne Uebergang: sonst faehrt es von
         der linken Kante (Lage 0) herueber, waehrend es aufblendet -- gemeldet als "es fliegt von
         oben links herein". Von da an sind Lage und Groesse Uebergaenge.
         Der Sprung braucht ein erzwungenes Neuberechnen dazwischen, sonst fasst der Browser beide
         Schreibvorgaenge zu einem zusammen und der Uebergang laeuft doch. */
      var zu = !pop.classList.contains("is-offen");
      if (zu) pop.style.transition = "none";
      for (var name in karten) karten[name].classList.toggle("is-da", name === k);
      /* Die Groesse KOMMT VOM INHALT und wird nicht geschaetzt. */
      pop.style.width = karte.offsetWidth + "px";
      pop.style.height = karte.offsetHeight + "px";
      /* Die Lage folgt dem Punkt, bleibt aber in der Spur. Gesucht an der LEISTE und nicht an der
         Wurzel: haengt sie in der Seite darueber (leisteAuslagern), steht sie nicht mehr darin. */
      var flaeche = nav.querySelector(".ulh-nav-in");
      if (!flaeche) return;
      var innen = flaeche.getBoundingClientRect();
      var r = knopf.getBoundingClientRect();
      /* Im Framer-Editor ist die Flaeche gezoomt: Bildschirm-Pixel durch den Massstab, sonst
         stuende das Panel bei 50% Zoom um die Haelfte daneben. Auf der Seite ist der Faktor 1. */
      var mass = flaeche.offsetWidth ? innen.width / flaeche.offsetWidth : 1;
      var x = (r.left - innen.left) / (mass || 1) - 20;
      var max = flaeche.offsetWidth - karte.offsetWidth;
      if (x > max) x = max;
      if (x < 0) x = 0;
      pop.style.transform = "translateX(" + Math.round(x) + "px)";
      if (zu){
        void pop.offsetWidth;               /* Neuberechnen erzwingen */
        pop.style.transition = "";
      }
      pop.classList.add("is-offen");
      nav.classList.add("is-offen");
    }
    function schliessen(){
      clearTimeout(uhr);
      uhr = setTimeout(function(){
        offen = null;
        pop.classList.remove("is-offen");
        nav.classList.remove("is-offen");
      }, 140);
    }

    [].forEach.call(nav.querySelectorAll(".ulh-nav-punkt[data-menue]"), function(b){
      b.addEventListener("mouseenter", function(){ zeigen(b.getAttribute("data-menue"), b); });
      b.addEventListener("focus", function(){ zeigen(b.getAttribute("data-menue"), b); });
    });
    /* Ein Punkt OHNE Menue schliesst es -- sonst bliebe es offen, waehrend man auf Pricing steht. */
    [].forEach.call(nav.querySelectorAll(".ulh-nav-punkt:not([data-menue])"), function(b){
      b.addEventListener("mouseenter", schliessen);
    });
    nav.addEventListener("mouseleave", schliessen);
    pop.addEventListener("mouseenter", function(){ clearTimeout(uhr); });

    /* Die Punkte unter "Platform" fuehren zu Sektionen der Startseite. Steht die Sektion auf DIESER
       Seite, wird weich dorthin gescrollt; sonst (Blog, Preise ...) laeuft der Link ganz normal auf
       die Startseite mit dem Anker (#overview, #sources, #mira) -- vor dem 13.10. stand dort
       href="#", und der Klick tat auf jeder anderen Seite nichts. */
    [].forEach.call(pop.querySelectorAll("[data-ziel]"), function(a){
      a.addEventListener("click", function(e){
        var ziel = document.querySelector(".ulh-root:not([data-ulh-teil]) " + a.getAttribute("data-ziel"));
        if (!ziel) return;
        e.preventDefault();
        schliessen();
        var weg = oben(ziel) - 90;              /* 90px: die Leiste steht im Weg */
        try {
          var rahmen = window.frameElement;
          var w = rahmen ? rahmen.ownerDocument.defaultView : window;
          w.scrollBy({ top: weg, behavior: "smooth" });
        } catch (err){
          window.scrollBy({ top: weg, behavior: "smooth" });
        }
      });
    });
  }

  /* Der Bildnachweis im Fuss: auf- und zuklappen, mit aria-expanded fuer Vorleser. */
  function nachweisBinden(root){
    var knopf = root.querySelector("[data-ulh-nachweis]"), feld = root.querySelector("#ulh-bildnachweis");
    if (!knopf || !feld || knopf.__ulhNachweis) return;
    knopf.__ulhNachweis = true;
    knopf.addEventListener("click", function(){
      var auf = feld.hasAttribute("hidden");
      if (auf) feld.removeAttribute("hidden"); else feld.setAttribute("hidden", "");
      knopf.setAttribute("aria-expanded", auf ? "true" : "false");
    });
  }

  /* Das Jahr im Fuss. Das vorgerenderte Markup traegt das Jahr, in dem es erzeugt wurde -- hier
     wird es auf das laufende gestellt. */
  function jahrSetzen(root){
    var j = String(new Date().getFullYear());
    [].forEach.call(root.querySelectorAll("[data-ulh-jahr]"), function(e){
      if (e.textContent !== j) e.textContent = j;
    });
  }

  function binden(){
    [].forEach.call(document.querySelectorAll(".ulh-root[data-ulh-teil]"), function(root){
      navLauf(root);
      nachweisBinden(root);
      jahrSetzen(root);
    });
  }

  window.UpstreemLandingTeile = { navLauf: navLauf, nachweisBinden: nachweisBinden,
                                  jahrSetzen: jahrSetzen, binden: binden };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", binden);
  else binden();
})();
