/* upstreem prompts-page-header.js — component logic. Requires core.js (window.UpstreemCore) loaded
   first, exactly like every table/chart in this repo: it reuses UC.isYes/UC.makeFire/UC.makePageNav
   and the shared .up-root CSS variables (--vc-text/--vc-muted/--vc-third/--vc-border) rather than
   redefining any of that locally.

   First of a new component FAMILY (see page-headers/ folder), not a new one-off: the meta/heading/
   description/nav/button structure -- and its styling AND its sliding-tab nav logic -- live in the
   shared Page Header Kit (core.css's ".up-ph-*" classes, core.js's UC.makePageNav), because every
   future page header needs the exact same thing. This file only supplies what's genuinely specific
   to the Prompts page: the PAGES list (labels/icons/values), the heading/description text, and the
   event names. Copy this file for the next page's header and swap those three things; the
   boot/mount plumbing and the visual/interaction kit underneath need no changes to do that. */
(function(){
  "use strict";

  function pphBoot(triesLeft){
    if (!window.UpstreemCore){
      if (triesLeft > 0){ setTimeout(function(){ pphBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    var UC = window.UpstreemCore;
    /* Laut sagen, WAS fehlt. Ein "undefined is not a function" schickt einen auf die Suche im
       falschen File; der Name des fehlenden Kits zeigt direkt auf den veralteten Pin. */
    var fehlt = ["makePageHeaderMeta", "makePageNav", "spinOnce", "makeTooltips"].filter(function(n){ return !UC[n]; });
    if (fehlt.length && window.console) console.error("upstreem: core.js ist zu alt, es fehlen: " +
      fehlt.join(", ") + ". data-cdn-pin dieses Page-Headers auf einen aktuellen Commit setzen.");
    pphRun();
    /* Bubble replaces this element's whole markup block (script tag included) once the dynamic
       expressions behind data-brand-name/-logo resolve -- which can happen moments after the very
       first paint. The replacement root is un-initialized, and this file's own <script> does NOT
       run again to catch it: the CDN loader's dedupe registry already has these asset URLs marked
       loaded, so the freshly re-injected script tag's IIFE is a no-op. Every other component in
       this repo catches that the same way -- core.js' shared watchRoots() runs a single page-wide
       MutationObserver (+ heartbeat) that notices any newly-appeared root and re-runs init on it,
       no re-fetch needed. Skipping this was the actual cause of the meta row + nav never showing
       up live, even though a static, never-replaced test harness rendered correctly. */
    if (UC.watchRoots) UC.watchRoots("pph-root", pphRun);
    [100, 300, 800, 1800].forEach(function(ms){ setTimeout(pphRun, ms); });
  }

  /* This page's three tabs -- label/icon/value. "Responses" carries the value "mentions", not
     "responses": matches the internal name that page already uses elsewhere in this app (the
     brand-mentions terminology prompts-table.js's own toolbar already carries), not the visible
     label. Feather icons, inlined (same convention every other component in this repo uses for
     its own icon constants). */
  var PAGES = [
    { value: "allprompts", label: "All Prompts",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>' },
    { value: "mentions", label: "Responses",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>' },
    { value: "topics", label: "Topics",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>' }
  ];

  function pphRun(){
    var UC = window.UpstreemCore;
    var roots = document.querySelectorAll(".pph-root");
    Array.prototype.forEach.call(roots, function(root){
      if (root.__pphInit) return;
      root.__pphInit = true;
      initRoot(root, UC);
    });
  }

  function initRoot(root, UC){
    var fire = UC.makeFire(root, { label: "prompts-page-header", eventPrefix: "pph" });

    /* Theme, brand name and brand logo, incl. the MutationObserver that catches Bubble resolving
       those attributes after mount. Shared kit -- see UC.makePageHeaderMeta in core.js. */
    /* Fehlt das Kit, ist eine ALTE core.js geladen -- typisch bei leerem data-cdn-pin: dann zieht
       der Loader "@main", und jsDelivr/Browser liefern das aus einem bis zu tagealten Cache. Auf
       einem Rechner laeuft die neue Fassung, auf dem naechsten die alte. Frueher riss der TypeError
       hier den ganzen initRoot mit: keine Meta-Zeile, keine Nav, und weil dieses Kit auch die
       data-isdark-Nachsynchronisierung macht, beim ersten Laden auch das falsche Theme. */
    if (UC.makePageHeaderMeta) UC.makePageHeaderMeta(root);

    UC.makePageNav(root, {
      pages: PAGES,
      onSelect: function(value){ fire("data-nav-fn", "pphNav", { page: value }); }
    });

    if (UC.makeTooltips) UC.makeTooltips(root, function(){ return UC.isYes(root.getAttribute("data-isdark")); });

    var addBtn = root.querySelector(".up-ph-addbtn");
    if (addBtn){
      addBtn.addEventListener("click", function(){
        /* The button used to hand the whole job to a Bubble workflow. It now opens the modal in
           add-prompts.js, which is the thing the workflow was opening anyway -- one hop fewer, and
           the dialog can be reached from Quick Actions with the same call.

           The old event stays as the fallback, and that is not belt-and-braces: a page that has
           not yet been given the add-prompts.js include would otherwise have a button that does
           nothing at all, with nothing in the console to say why. Either it opens the modal or it
           fires the event it always fired. */
        if (typeof window.openAddPrompts === "function"){
          window.openAddPrompts({ market: root.getAttribute("data-market") || "" });
          return;
        }
        fire("data-add-fn", "pphAdd", {});
      });
    }
    var refreshBtn = root.querySelector(".pph-refreshbtn");
    if (refreshBtn){
      refreshBtn.addEventListener("click", function(){
        UC.spinOnce(refreshBtn);
        fire("data-refresh-fn", "pphRefresh", {});
      });
    }
  }

  pphBoot(30);
})();
