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

   Seit dem 14.10. auch der Kalender der zwei Terminseiten (/demo, /contact; kalenderBinden unten):
   dieselbe Datei, damit eine Terminseite mit Leiste und Fuss nur EIN Skript des Pins laedt.

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
    /* Mit der Tastatur ging das Panel beim Fokus auf, aber nie wieder zu (14.10., Audit): wer
       weitertabbte, hatte es offen ueber der Seite stehen. Jetzt schliesst es, sobald der Fokus die
       Leiste verlaesst, und mit Escape. */
    nav.addEventListener("focusout", function(e){
      if (!e.relatedTarget || !nav.contains(e.relatedTarget)) schliessen();
    });
    nav.addEventListener("keydown", function(e){
      if (e.key === "Escape" && offen){ schliessen(); }
    });
    pop.addEventListener("mouseenter", function(){ clearTimeout(uhr); });

    /* Die Punkte unter "Platform" fuehren zu Sektionen der Startseite. Steht die Sektion auf DIESER
       Seite, wird weich dorthin gescrollt; sonst (Blog, Preise ...) laeuft der Link ganz normal auf
       die Startseite mit dem Anker (#overview, #sources, #mira) -- vor dem 13.10. stand dort
       href="#", und der Klick tat auf jeder anderen Seite nichts. */
    function springen(a, e, danach){
      var ziel = document.querySelector(".ulh-root:not([data-ulh-teil]) " + a.getAttribute("data-ziel"));
      if (!ziel) return;
      e.preventDefault();
      danach();
      var weg = oben(ziel) - 90;              /* 90px: die Leiste steht im Weg */
      /* Wer weniger Bewegung will, springt (14.10., Audit). */
      var art = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      try {
        var rahmen = window.frameElement;
        var w = rahmen ? rahmen.ownerDocument.defaultView : window;
        w.scrollBy({ top: weg, behavior: art });
      } catch (err){
        window.scrollBy({ top: weg, behavior: art });
      }
    }
    [].forEach.call(pop.querySelectorAll("[data-ziel]"), function(a){
      a.addEventListener("click", function(e){ springen(a, e, schliessen); });
    });
    mobilLauf(nav, springen);
  }

  /* ---- Das Menue auf dem Telefon (14.10., im Audit gefunden: unter 900px gab es keinen Weg zu
     Platform, Resources und Pricing ausser dem Fuss). Knopf und Blatt stehen im Markup der Leiste
     (landing-hero.js, navMobil); hier nur auf und zu. Ein Blatt unter der Leiste, das von oben
     einblendet (opacity + transform, die Expo-Kurve der Seite) -- sichtbar wird es ueber
     visibility, damit es geschlossen auch fuer Tastatur und Vorleser nicht da ist.
     Zu geht es: mit dem Knopf, mit Escape, mit einem Klick daneben, mit jedem Eintrag, und wenn das
     Fenster breiter als 1199px wird (dort steht die Mitte wieder da; bis 23.10. 900, siehe
     landing-hero.css "Das Menue auf dem Telefon"). */
  function mobilLauf(nav, springen){
    var knopf = nav.querySelector(".ulh-nav-menue"), blatt = nav.querySelector(".ulh-nav-mobil");
    if (!knopf || !blatt || knopf.__ulhMobil) return;
    knopf.__ulhMobil = true;
    var de = (document.documentElement.getAttribute("lang") || "").indexOf("de") === 0;
    function setzen(auf){
      blatt.classList.toggle("is-offen", auf);
      nav.classList.toggle("is-mobil", auf);
      knopf.setAttribute("aria-expanded", auf ? "true" : "false");
      knopf.setAttribute("aria-label", auf ? (de ? "Menü schließen" : "Close menu") : (de ? "Menü" : "Menu"));
    }
    function offen(){ return blatt.classList.contains("is-offen"); }
    knopf.addEventListener("click", function(){ setzen(!offen()); });
    document.addEventListener("keydown", function(e){
      if (e.key === "Escape" && offen()){ setzen(false); knopf.focus(); }
    });
    document.addEventListener("click", function(e){
      if (offen() && !nav.contains(e.target)) setzen(false);
    });
    [].forEach.call(blatt.querySelectorAll("a"), function(a){
      a.addEventListener("click", function(e){
        if (a.hasAttribute("data-ziel")) springen(a, e, function(){ setzen(false); });
        else setzen(false);
      });
    });
    if (window.matchMedia){
      var breit = window.matchMedia("(min-width: 1200px)");
      var weg = function(){ if (breit.matches) setzen(false); };
      if (breit.addEventListener) breit.addEventListener("change", weg); else if (breit.addListener) breit.addListener(weg);
    }
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
      /* Ins Bild holen (15.10. gemeldet: "der Knopf macht nichts"). Er tat es -- aber der Nachweis
         klappt UNTER dem Knopf auf, und der steht am Ende der Seite: gemessen lag die Oberkante bei
         846px in einem 860px hohen Fenster, zu sehen war nichts. Jetzt faehrt die Seite so weit,
         dass er ganz dasteht; eingeblendet wird er in der CSS (.ulh-fuss-nachweis). */
      if (auf) requestAnimationFrame(function(){
        var ruhig = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        try { feld.scrollIntoView({ behavior: ruhig ? "auto" : "smooth", block: "end" }); } catch (e){ feld.scrollIntoView(false); }
      });
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

  /* ---- Der Kalender der Terminseiten (14.10., /demo und /contact) ----
     Cal.com, Inline. Name und Link stehen im Markup (data-ulh-cal, data-ulh-cal-ns), damit sie wie
     jeder Text nur in landing-hero.js stehen. Drei Zustaende am Feld:
       (keiner)   er laedt (ohne Ladebalken, 14.10. auf Wunsch weg; die Karte haelt den Platz)
       is-wartet  auf der eigenen Website: noch keine Einwilligung fuer Cal.com (siehe unten)
       is-da      Cal.com meldet linkReady -- der Kalender steht
       is-fehler  das Skript von Cal.com kam nicht (Werbeblocker, Netz), Cal.com meldet linkFailed,
                  oder nach 20s steht noch nichts. Dann der Satz mit dem direkten Link.
     Nie still: ohne einen dieser Zustaende stuende ein leerer Kasten da, der wie "gleich da" aussieht. */
  var CAL_SKRIPT = "https://app.cal.com/embed/embed.js";
  var CAL_FRIST = 20000;
  var calNr = 0;

  /* Der Vorspann aus dem Embed-Code von Cal.com, Wort fuer Wort (nur let/const zu var, wie der Rest
     der Datei). Er legt window.Cal als Warteschlange an und haengt beim ersten Aufruf das Skript
     an; was bis dahin aufgerufen wird, arbeitet Cal.com danach der Reihe nach ab. */
  function calVorspann(){
    (function (C, A, L) { var p = function (a, ar) { a.q.push(ar); }; var d = C.document; C.Cal = C.Cal || function () { var cal = C.Cal; var ar = arguments; if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement("script")).src = A; cal.loaded = true; } if (ar[0] === L) { var api = function () { p(api, arguments); }; var namespace = ar[1]; api.q = api.q || []; if(typeof namespace === "string"){cal.ns[namespace] = cal.ns[namespace] || api;p(cal.ns[namespace], ar);p(cal, ["initNamespace", namespace]);} else p(cal, ar); return;} p(cal, ar); }; })(window, CAL_SKRIPT, "init");
  }

  /* Alle Felder dieses Namens, die noch warten. Gesucht im Dokument und nicht ueber eine
     gemerkte Liste: Framer baut beim Seitenwechsel neue Wurzeln, die alten haengen dann nirgends. */
  function calFelder(ns, sel){
    return document.querySelectorAll('.ulh-termin-kal[data-ulh-cal-ns="' + ns + '"]' + sel);
  }
  function calFehler(ns){
    [].forEach.call(calFelder(ns, ":not(.is-da)"), function(f){ f.classList.add("is-fehler"); });
  }

  /* ERST NACH EINWILLIGUNG (14.10.). Der Kalender ist ein Rahmen von Cal.com; ihn zu laden schickt
     IP-Adresse und Browserdaten dorthin. Die eigene Website stellt dafuer window.upstreemConsent
     bereit (erlaubt(art), setzen({art: true}), Ereignis "upstreem:consent" am Dokument). Fehlt die
     Schnittstelle -- in Framer --, laedt er wie bisher sofort.
     Bis zur Zustimmung steht im Feld ein Hinweis mit zwei Wegen: hier laden (das ist zugleich die
     Einwilligung und wird gemerkt) oder direkt auf cal.com buchen. */
  function kalenderBinden(root){
    var feld = root.querySelector(".ulh-termin-kal[data-ulh-cal]");
    if (!feld || feld.__ulhKal) return;
    feld.__ulhKal = true;
    var zs = window.upstreemConsent;
    if (zs && typeof zs.erlaubt === "function" && !zs.erlaubt("extern")){
      var hinweis = feld.querySelector(".ulh-termin-zustimmung");
      feld.classList.add("is-wartet");
      if (hinweis) hinweis.hidden = false;
      var los = function(){
        if (!feld.classList.contains("is-wartet")) return;
        feld.classList.remove("is-wartet");
        if (hinweis) hinweis.hidden = true;
        document.removeEventListener("upstreem:consent", nachgefragt);
        kalenderLaden(feld);
      };
      var nachgefragt = function(){ if (zs.erlaubt("extern")) los(); };
      document.addEventListener("upstreem:consent", nachgefragt);
      var knopf = feld.querySelector("[data-ulh-cal-erlauben]");
      if (knopf) knopf.addEventListener("click", function(){
        if (typeof zs.setzen === "function") zs.setzen({ extern: true });
        los();
      });
      return;
    }
    kalenderLaden(feld);
  }

  function kalenderLaden(feld){
    var link = feld.getAttribute("data-ulh-cal"), ns = feld.getAttribute("data-ulh-cal-ns");
    var ziel = feld.querySelector(".ulh-termin-ziel");
    if (!link || !ns || !ziel){ feld.classList.add("is-fehler"); return; }
    if (!ziel.id) ziel.id = "ulh-cal-" + (++calNr);

    var w = window;
    calVorspann();
    var neu = !(w.__ulhCalNs || (w.__ulhCalNs = {}))[ns];
    if (neu){
      w.__ulhCalNs[ns] = true;
      w.Cal("init", ns, { origin: "https://app.cal.com" });
      /* Das Skript haengt erst jetzt im Kopf (der erste Aufruf oben hat es angelegt). Kommt es
         nicht, meldet Cal.com nie etwas -- also hier hinhoeren. */
      var s = document.querySelector('script[src="' + CAL_SKRIPT + '"]');
      if (s) s.addEventListener("error", function(){ calFehler(ns); });
      /* Hell, auch wenn das System dunkel steht: die Seite ist immer hell, und ein dunkler
         Kalender darin saehe aus wie ein fremdes Fenster. Im Embed-Code des Nutzers stand kein
         Thema, Cal.com folgt dann dem System. */
      w.Cal.ns[ns]("ui", { theme: "light", hideEventTypeDetails: false, layout: "month_view" });
      w.Cal.ns[ns]("on", { action: "linkReady", callback: function(){
        [].forEach.call(calFelder(ns, ""), function(f){
          if (f.querySelector("iframe")){ f.classList.add("is-da"); f.classList.remove("is-fehler"); }
        });
      }});
      w.Cal.ns[ns]("on", { action: "linkFailed", callback: function(){ calFehler(ns); } });
    }
    w.Cal.ns[ns]("inline", {
      elementOrSelector: "#" + ziel.id,
      config: { layout: "month_view", useSlotsViewOnSmallScreen: "true", theme: "light" },
      calLink: link
    });
    setTimeout(function(){
      if (!feld.classList.contains("is-da")) feld.classList.add("is-fehler");
    }, CAL_FRIST);
  }

  /* Der Sprach-Toggle der Leiste (14.10.): die Ziele zeigen auf DIESELBE Seite in der anderen
     Sprache (/blog <-> /de/blog), samt Suche in der Adresse. Ein Klick merkt sich die Wahl ein Jahr
     lang (Cookie upstreem_lang) -- die Website leitet danach nicht mehr nach der Browsersprache um.
     Das Cookie ist eine vom Besucher selbst getroffene Einstellung und braucht keine Einwilligung. */
  function spracheBinden(root){
    var links = root.querySelectorAll("[data-sprache]");
    if (!links.length) return;
    var pfad = location.pathname.replace(/^\/de(?=\/|$)/, "") || "/";
    var such = location.search || "";
    [].forEach.call(links, function(a){
      var de = a.getAttribute("data-sprache") === "de";
      a.setAttribute("href", (de ? "/de" + (pfad === "/" ? "" : pfad) : pfad) + such);
      if (a.__ulhSprache) return;
      a.__ulhSprache = true;
      a.addEventListener("click", function(){
        try { document.cookie = "upstreem_lang=" + (de ? "de" : "en") + "; path=/; max-age=31536000; SameSite=Lax"; } catch (e){}
      });
    });
  }

  /* Das Thema der Website (23.10. abends: "kein lightmode mehr. immer darkmode bitte"). Bis dahin
     stand hier ein Schalter in der Leiste; jetzt ist die Seite immer dunkel, gesetzt als dasselbe
     Attribut, das core fuehrt (html[data-up-pagetheme]). upstreem-web schreibt es schon ins
     ausgelieferte HTML; hier nur fuer Einbettungen ohne diesen Kopf (Framer). */
  function themaBinden(){
    document.documentElement.setAttribute("data-up-pagetheme", "dark");
  }

  /* ---- Anker auf derselben Seite (15.10. gemeldet: "der Klick auf Neu Customer Journey Tracking
     scrollt eher zu Domain Detail") ----
     Der Browser rechnet das Ziel eines weichen Sprungs EINMAL, am Anfang. Auf der Startseite aendern
     sich waehrend der 3.600px Fahrt aber noch Hoehen darueber (Bilder laden, Vorschauen werden
     gebaut) -- das Ziel wandert, und die Fahrt endet daneben. Hier wird nach dem Ende der Fahrt
     nachgemessen und, wenn das Ziel nicht mehr unter der Leiste steht, nachgefahren (hoechstens
     dreimal). Links mit eigenem Handler (die Panels der Leiste) haben preventDefault schon gesetzt
     und bleiben unberuehrt. */
  function ankerBinden(){
    if (document.__ulhAnker) return;
    document.__ulhAnker = true;
    var ruhig = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function abstand(ziel){
      var m = parseFloat(getComputedStyle(ziel).scrollMarginTop) || 0;
      return ziel.getBoundingClientRect().top - m;
    }
    function fahren(ziel, runde){
      window.scrollBy({ top: abstand(ziel), behavior: ruhig ? "auto" : "smooth" });
      if (runde >= 3) return;
      var fertig = false, uhr = null;
      function pruefen(){
        if (fertig) return;
        fertig = true;
        window.removeEventListener("scrollend", pruefen);
        clearTimeout(uhr);
        if (Math.abs(abstand(ziel)) > 4) fahren(ziel, runde + 1);
      }
      /* scrollend wo es das gibt; sonst eine Frist, die eine lange Fahrt abdeckt. */
      if ("onscrollend" in window) window.addEventListener("scrollend", pruefen);
      uhr = setTimeout(pruefen, 1600);
    }
    document.addEventListener("click", function(e){
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target && e.target.closest ? e.target.closest("a[href*='#']") : null;
      if (!a || a.target === "_blank") return;
      var url;
      try { url = new URL(a.getAttribute("href"), location.href); } catch (err){ return; }
      if (url.origin !== location.origin || url.pathname.replace(/\/$/, "") !== location.pathname.replace(/\/$/, "")) return;
      var id = decodeURIComponent(url.hash.slice(1));
      var ziel = id && document.getElementById(id);
      if (!ziel) return;
      e.preventDefault();
      try { history.pushState(null, "", url.hash); } catch (err){}
      fahren(ziel, 1);
    });
  }

  /* ---- Der Preisschalter (15.10. aus landing-hero.js hierher) ----
     Startseite UND eigene Preisseite (/pricing). Markup bleibt stehen, der Schalter stellt um, die
     Ersparnis klappt auf oder zu, und der Betrag ZAEHLT auf die neue Zahl: ein Preis, der umspringt,
     liest sich wie ein anderer Preis, ein zaehlender wie derselbe Tarif zu anderen Bedingungen.
     Die Betraege stehen am Element (data-mon, data-jahr), die Sprache an der Sektion (data-lang). */
  function geld(v, de){
    var g = Math.round(v * 10) / 10;
    var t = g % 1 === 0 ? String(g) : g.toFixed(1);
    return de ? t.replace(".", ",") + " \u20ac" : t + "\u20ac";
  }
  function zaehlen(el, ziel, de){
    var von = parseFloat(String(el.textContent || "").replace(",", ".").replace(/[^0-9.]/g, ""));
    if (!isFinite(von)) von = ziel;
    if (el.__uhr) cancelAnimationFrame(el.__uhr);
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches){
      el.textContent = geld(ziel, de); return;
    }
    var t0 = 0, DAUER = 380;
    (function lauf(ts){
      if (!t0) t0 = ts || 0;
      var p = Math.min(1, ((ts || 0) - t0) / DAUER), e = 1 - Math.pow(1 - p, 3);
      el.textContent = geld(von + (ziel - von) * e, de);
      if (p < 1) el.__uhr = requestAnimationFrame(lauf);
      else { el.__uhr = 0; el.textContent = geld(ziel, de); }
    })(0);
  }
  function preiseBinden(root){
    [].forEach.call(root.querySelectorAll(".ulh-preis"), function(sek){
      if (sek.__ulhPreis) return;
      sek.__ulhPreis = true;
      var de = sek.getAttribute("data-lang") === "de";
      sek.addEventListener("click", function(e){
        var b = e.target.closest ? e.target.closest("[data-interval]") : null;
        if (!b || !sek.contains(b)) return;
        var jaehrlich = b.getAttribute("data-interval") === "yearly";
        [].forEach.call(sek.querySelectorAll("[data-interval]"), function(x){
          var an = (x.getAttribute("data-interval") === "yearly") === jaehrlich;
          x.classList.toggle("is-active", an);
          x.setAttribute("aria-selected", an ? "true" : "false");
        });
        [].forEach.call(sek.querySelectorAll(".ulh-preis-karte"), function(k){
          var z = k.querySelector(".ulh-preis-zahl");
          var ziel = z && parseFloat(z.getAttribute(jaehrlich ? "data-jahr" : "data-mon"));
          if (z && isFinite(ziel)) zaehlen(z, ziel, de);
          var n = k.querySelector(".ulh-preis-notiz");
          if (n) n.classList.toggle("is-on", jaehrlich);
        });
      });
    });
  }
  /* Die Haekchen der Preisliste. Auf der Startseite setzt sie landing-hero.js aus core
     (zeichenSetzen, UC.icon); auf der eigenen Preisseite laeuft core nicht -- dort steht hier
     derselbe Feather-Pfad ("check"), mit der Strichstaerke aus data-ic-w. */
  function haekchen(root){
    [].forEach.call(root.querySelectorAll('[data-ic="check"]'), function(el){
      if (el.firstChild) return;
      var w = el.getAttribute("data-ic-w") || "2";
      el.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + w +
        '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>';
    });
  }

  function binden(){
    ankerBinden();
    themaBinden();
    /* Die Leiste der STARTSEITE ist keine eigene Wurzel (data-ulh-teil fehlt) -- ihr Toggle wird
       trotzdem gebunden. */
    spracheBinden(document);
    [].forEach.call(document.querySelectorAll(".ulh-root[data-ulh-teil]"), function(root){
      navLauf(root);
      nachweisBinden(root);
      jahrSetzen(root);
      kalenderBinden(root);
      preiseBinden(root);
      haekchen(root);
    });
  }

  window.UpstreemLandingTeile = { navLauf: navLauf, nachweisBinden: nachweisBinden,
                                  jahrSetzen: jahrSetzen, kalenderBinden: kalenderBinden, spracheBinden: spracheBinden,
                                  preiseBinden: preiseBinden,
                                  binden: binden };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", binden);
  else binden();
})();
