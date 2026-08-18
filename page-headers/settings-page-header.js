/* upstreem settings-page-header.js — component logic. Requires core.js (window.UpstreemCore)
   loaded first, exactly like every other page header in this family: reuses
   UC.isYes/UC.makeFire/UC.makePageNav/UC.makePageHeaderMeta/UC.makeTooltips and the shared
   .up-root CSS variables, plus the Page Header Kit's meta/heading/description/nav styling
   (core.css's ".up-ph-*" classes). This file only supplies what is specific to the Settings page:
   the PAGES list, the heading/description text and the event name.

   Eine Besonderheit gegenueber den anderen Seitenkoepfen: der erste Reiter zeigt statt eines
   Icons das LOGO der Marke. UC.makePageNav setzt p.icon roh in .up-ph-navicon, ein <img> ist dort
   also ohne Kit-Aenderung moeglich. Die Liste wird darum pro Root gebaut, nicht einmal auf
   Modulebene -- die Logo-URL steht in data-brand-logo und ist bei mehreren Instanzen (oder nach
   einem Bubble-Rerender) nicht dieselbe.

   Und weil Bubble diese Attribute NACH dem Mount aufloest, wird die Nav neu gebaut, sobald sich
   data-brand-logo aendert. Ohne das zeigt der Reiter dauerhaft das Ersatz-Icon: beim ersten
   Rendern ist das Attribut noch leer, und makePageNav schreibt sein Markup nur einmal.

   watchRoots ist von Anfang an verdrahtet -- es auf citations-page-header.js und
   prompts-page-header.js zunaechst zu vergessen war zweimal derselbe Fehler: Bubble ersetzt den
   ganzen Markup-Block, sobald die dynamischen Ausdruecke aufloesen, und ohne watchRoots wird der
   frisch eingehaengte Root nie initialisiert. */
(function(){
  "use strict";

  function sphBoot(triesLeft){
    if (!window.UpstreemCore){
      if (triesLeft > 0){ setTimeout(function(){ sphBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    var UC = window.UpstreemCore;
    /* Laut sagen, WAS fehlt. Ein "undefined is not a function" schickt einen auf die Suche im
       falschen File; der Name des fehlenden Kits zeigt direkt auf den veralteten Pin. */
    var fehlt = ["makePageHeaderMeta", "makePageNav", "spinOnce", "makeTooltips"].filter(function(n){ return !UC[n]; });
    if (fehlt.length && window.console) console.error("upstreem: core.js ist zu alt, es fehlen: " +
      fehlt.join(", ") + ". data-cdn-pin dieses Page-Headers auf einen aktuellen Commit setzen.");
    sphRun();
    if (UC.watchRoots) UC.watchRoots("sph-root", sphRun);
    [100, 300, 800, 1800].forEach(function(ms){ setTimeout(sphRun, ms); });
  }

  /* Fuer "Your Brand" gibt es ein Ersatz-Icon (Feather "box", dasselbe wie in discover-brands
     fuer eine Marke ohne Logo), das nur greift, solange keine Logo-URL da ist. Team und Billing
     kommen aus core, siehe darunter. */
  var ICON_BRAND_FALLBACK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /> <path d="m3.3 7 8.7 5 8.7-5" /> <path d="M12 22V12" /></svg>';
  /* Die beiden Zeichen stehen jetzt in core (users, dollarSign): das Konto-Menue der Leiste zeigt
     dieselben Unterseiten und braucht sie ebenso; zwei Kopien liefen beim naechsten Nachziehen
     auseinander. Als FUNKTION und nicht als Konstante: hier oben, auf Modulebene, gibt es noch
     kein UC -- core wird erst in sphBoot erwartet. */
  function iconTeam(){ return window.UpstreemCore.icon("users", 2); }
  function iconBilling(){ return window.UpstreemCore.icon("dollarSign", 2); }

  function sphRun(){
    var UC = window.UpstreemCore;
    var roots = document.querySelectorAll(".sph-root");
    Array.prototype.forEach.call(roots, function(root){
      if (root.__sphInit) return;
      root.__sphInit = true;
      initRoot(root, UC);
    });
  }

  function initRoot(root, UC){
    var fire = UC.makeFire(root, { label: "settings-page-header", eventPrefix: "sph" });

    /* Gleiche data-brand-name/-logo/-isdark-Nachsynchronisierung wie in jedem Seitenkopf dieser
       Familie -- Bubble loest die Ausdruecke teils erst auf, wenn dieser Root schon steht, und
       patcht dann das Attribut am Knoten, statt ihn zu ersetzen. Ein einmaliges Lesen beim Init
       wuerde das verpassen. */
    /* Fehlt das Kit, ist eine ALTE core.js geladen -- typisch bei leerem data-cdn-pin: dann zieht
       der Loader "@main", und jsDelivr/Browser liefern das aus einem bis zu tagealten Cache. Auf
       einem Rechner laeuft die neue Fassung, auf dem naechsten die alte. Frueher riss der TypeError
       hier den ganzen initRoot mit: keine Meta-Zeile, keine Nav, und weil dieses Kit auch die
       data-isdark-Nachsynchronisierung macht, beim ersten Laden auch das falsche Theme. */
    if (UC.makePageHeaderMeta) UC.makePageHeaderMeta(root);

    function brandIcon(){
      var url = String(root.getAttribute("data-brand-logo") || "").trim();
      if (!url || url === "BRAND_LOGO_URL" || url === "BRAND_LOGO") return ICON_BRAND_FALLBACK;
      return '<img class="sph-navlogo" src="' + UC.esc(url) + '" alt="" ' +
             'onerror="this.style.display=&quot;none&quot;"/>';
    }
    function pages(){
      return [
        { value: "brand",   label: "Your Brand",        icon: brandIcon() },
        { value: "team",    label: "Team Organisation", icon: iconTeam() },
        { value: "billing", label: "Billing",           icon: iconBilling() }
      ];
    }

    var nav = UC.makePageNav(root, {
      pages: pages(),
      selected: String(root.getAttribute("data-page") || "brand").trim() || "brand",
      onSelect: function(value){ fire("data-nav-fn", "sphNav", { page: value }); }
    });

    /* Die Logo-URL kommt oft erst nach dem ersten Rendern. makePageNav schreibt sein Markup nur
       einmal, also wird hier neu gebaut, sobald sich das Attribut aendert -- sonst bliebe das
       Ersatz-Icon stehen, obwohl das Logo laengst da ist. Der ausgewaehlte Reiter wird dabei
       mitgenommen, damit der Neuaufbau die Auswahl des Nutzers nicht zurueckwirft. */
    if (window.MutationObserver){
      new MutationObserver(function(){
        var cur = root.querySelector(".up-ph-navitem.is-selected");
        var keep = cur ? cur.getAttribute("data-page") : null;
        nav = UC.makePageNav(root, {
          pages: pages(),
          selected: keep || "brand",
          onSelect: function(value){ fire("data-nav-fn", "sphNav", { page: value }); }
        });
      }).observe(root, { attributes: true, attributeFilter: ["data-brand-logo"] });
    }

    if (UC.makeTooltips) UC.makeTooltips(root, function(){ return UC.isYes(root.getAttribute("data-isdark")); });
  }

  sphBoot(30);
})();
