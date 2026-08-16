/* upstreem brands-page-header.js — component logic. Requires core.js (window.UpstreemCore) loaded
   first, exactly like every other page header in this family: reuses
   UC.isYes/UC.makeFire/UC.makePageNav/UC.makeTooltips/UC.spinOnce and the shared .up-root CSS
   variables, plus the Page Header Kit's meta/heading/description/nav styling (core.css's
   ".up-ph-*" classes). This file only supplies what's genuinely specific to the Brands page: the
   PAGES list (Tracked/Discover), the heading/description text, and the event names. No server
   data to wait on here either (like prompts-page-header.js, unlike dashboard-page-header.js's KPI
   setter), so no UC.makeMount/stub-queue needed.

   watchRoots is wired into the boot sequence from the START this time -- forgetting it on
   citations-page-header.js's first pass (and prompts-page-header.js's, before that) was the exact
   same bug twice: Bubble replaces this element's whole markup block once the dynamic expressions
   behind data-brand-name/-logo resolve, and without watchRoots the freshly re-injected root never
   gets initialized -- no nav, no events, nothing but the static heading/description text. */
(function(){
  "use strict";

  function bphBoot(triesLeft){
    if (!window.UpstreemCore){
      if (triesLeft > 0){ setTimeout(function(){ bphBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    var UC = window.UpstreemCore;
    /* Laut sagen, WAS fehlt. Ein "undefined is not a function" schickt einen auf die Suche im
       falschen File; der Name des fehlenden Kits zeigt direkt auf den veralteten Pin. */
    var fehlt = ["makePageHeaderMeta", "makePageNav", "spinOnce", "makeTooltips"].filter(function(n){ return !UC[n]; });
    if (fehlt.length && window.console) console.error("upstreem: core.js ist zu alt, es fehlen: " +
      fehlt.join(", ") + ". data-cdn-pin dieses Page-Headers auf einen aktuellen Commit setzen.");
    bphRun();
    if (UC.watchRoots) UC.watchRoots("bph-root", bphRun);
    [100, 300, 800, 1800].forEach(function(ms){ setTimeout(bphRun, ms); });
  }

  /* Feather "copy" / "compass" -- Tracked reads as "the brands already in your saved set" (a
     copy/duplicate-of-your-list metaphor), Discover as "find new ones" (compass = exploration). */
  var PAGES = [
    { value: "tracked", label: "Tracked",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /> <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>' },
    { value: "discover", label: "Discover",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /> <path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z" /></svg>' }
  ];

  function bphRun(){
    var UC = window.UpstreemCore;
    var roots = document.querySelectorAll(".bph-root");
    Array.prototype.forEach.call(roots, function(root){
      if (root.__bphInit) return;
      root.__bphInit = true;
      initRoot(root, UC);
    });
  }

  function initRoot(root, UC){
    var fire = UC.makeFire(root, { label: "brands-page-header", eventPrefix: "bph" });

    /* Same data-brand-name/-logo/-isdark re-sync as every other page header in this family --
       Bubble can resolve those dynamic expressions after this root is already mounted, patching
       the attribute in place rather than replacing the node, so a one-shot read at init would
       miss it. */
    /* Fehlt das Kit, ist eine ALTE core.js geladen -- typisch bei leerem data-cdn-pin: dann zieht
       der Loader "@main", und jsDelivr/Browser liefern das aus einem bis zu tagealten Cache. Auf
       einem Rechner laeuft die neue Fassung, auf dem naechsten die alte. Frueher riss der TypeError
       hier den ganzen initRoot mit: keine Meta-Zeile, keine Nav, und weil dieses Kit auch die
       data-isdark-Nachsynchronisierung macht, beim ersten Laden auch das falsche Theme. */
    if (UC.makePageHeaderMeta) UC.makePageHeaderMeta(root);

    UC.makePageNav(root, {
      pages: PAGES,
      onSelect: function(value){ fire("data-nav-fn", "bphNav", { page: value }); }
    });

    if (UC.makeTooltips) UC.makeTooltips(root, function(){ return UC.isYes(root.getAttribute("data-isdark")); });

    var addBtn = root.querySelector(".up-ph-addbtn");
    if (addBtn){
      addBtn.addEventListener("click", function(){
        /* Gleiche Reihenfolge wie im Prompts-Seitenkopf: liegt add-brand.js auf der Seite, oeffnet
           der Knopf den Dialog; die Komponente feuert das Add-Event dann selbst. Ist die Datei
           nicht eingebunden, bleibt das alte Event -- sonst haette diese Seite einen Knopf, der
           nichts tut und in der Konsole auch nicht sagt warum. */
        if (typeof window.openAddBrand === "function"){ window.openAddBrand(); return; }
        fire("data-add-fn", "bphAdd", {});
      });
    }
    var refreshBtn = root.querySelector(".bph-refreshbtn");
    if (refreshBtn){
      refreshBtn.addEventListener("click", function(){
        UC.spinOnce(refreshBtn);
        fire("data-refresh-fn", "bphRefresh", {});
      });
    }
  }

  bphBoot(30);
})();
