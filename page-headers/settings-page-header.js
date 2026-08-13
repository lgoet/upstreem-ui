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
    sphRun();
    if (UC.watchRoots) UC.watchRoots("sph-root", sphRun);
    [100, 300, 800, 1800].forEach(function(ms){ setTimeout(sphRun, ms); });
  }

  /* Feather "users" fuer das Team, Feather "dollar-sign" fuer Billing. Fuer "Your Brand" gibt es
     ein Ersatz-Icon (Feather "box", dasselbe wie in discover-brands fuer eine Marke ohne Logo),
     das nur greift, solange keine Logo-URL da ist. */
  var ICON_BRAND_FALLBACK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>';
  var ICON_TEAM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
  var ICON_BILLING = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>';

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
    UC.makePageHeaderMeta(root);

    function brandIcon(){
      var url = String(root.getAttribute("data-brand-logo") || "").trim();
      if (!url || url === "BRAND_LOGO_URL" || url === "BRAND_LOGO") return ICON_BRAND_FALLBACK;
      return '<img class="sph-navlogo" src="' + UC.esc(url) + '" alt="" ' +
             'onerror="this.style.display=&quot;none&quot;"/>';
    }
    function pages(){
      return [
        { value: "brand",   label: "Your Brand",        icon: brandIcon() },
        { value: "team",    label: "Team Organisation", icon: ICON_TEAM },
        { value: "billing", label: "Billing",           icon: ICON_BILLING }
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
