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
    bphRun();
    if (UC.watchRoots) UC.watchRoots("bph-root", bphRun);
    [100, 300, 800, 1800].forEach(function(ms){ setTimeout(bphRun, ms); });
  }

  /* Feather "copy" / "compass" -- Tracked reads as "the brands already in your saved set" (a
     copy/duplicate-of-your-list metaphor), Discover as "find new ones" (compass = exploration). */
  var PAGES = [
    { value: "tracked", label: "Tracked",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' },
    { value: "discover", label: "Discover",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>' }
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
    UC.makePageHeaderMeta(root);

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
