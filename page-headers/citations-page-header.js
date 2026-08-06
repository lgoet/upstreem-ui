/* upstreem citations-page-header.js — component logic. Requires core.js (window.UpstreemCore)
   loaded first, exactly like every other page header in this family: reuses
   UC.isYes/UC.makeFire/UC.makePageNav/UC.makeTooltips/UC.spinOnce and the shared .up-root CSS
   variables, plus the Page Header Kit's meta/heading/description/nav styling (core.css's
   ".up-ph-*" classes). This file only supplies what's genuinely specific to the Citations page:
   the PAGES list (Domains/URLs), the heading/description text, and the event names -- same
   boot/mount shape as prompts-page-header.js (no server data to wait on here either, so no
   UC.makeMount/stub-queue needed -- unlike dashboard-page-header.js, which has the KPI setter). */
(function(){
  "use strict";

  function cphBoot(triesLeft){
    if (!window.UpstreemCore){
      if (triesLeft > 0){ setTimeout(function(){ cphBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    var UC = window.UpstreemCore;
    cphRun();
    /* Bubble replaces this element's whole markup block (script tag included) once the dynamic
       expressions behind data-brand-name/-logo resolve -- which can happen moments after the very
       first paint. The replacement root is un-initialized, and this file's own <script> does NOT
       run again to catch it: the CDN loader's dedupe registry already has these asset URLs marked
       loaded, so the freshly re-injected script tag's IIFE is a no-op. Every other page header in
       this repo catches that the same way -- core.js' shared watchRoots() runs a single page-wide
       MutationObserver (+ heartbeat) that notices any newly-appeared root and re-runs init on it,
       no re-fetch needed. (See prompts-page-header.js's own history: forgetting this was the exact
       cause of "brand row + nav never show up, no events fire" there too.) */
    if (UC.watchRoots) UC.watchRoots("cph-root", cphRun);
    [100, 300, 800, 1800].forEach(function(ms){ setTimeout(cphRun, ms); });
  }

  /* Feather "globe" / "link-2" -- no existing icon for either concept elsewhere in this repo to
     reuse, so these are the standard Feather glyphs for "a domain" and "a URL/link". */
  var PAGES = [
    { value: "domains", label: "Domains",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>' },
    { value: "urls", label: "URLs",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 7h3a5 5 0 0 1 5 5 5 5 0 0 1-5 5h-3m-6 0H6a5 5 0 0 1-5-5 5 5 0 0 1 5-5h3"/><line x1="8" y1="12" x2="16" y2="12"/></svg>' }
  ];

  function cphRun(){
    var UC = window.UpstreemCore;
    var roots = document.querySelectorAll(".cph-root");
    Array.prototype.forEach.call(roots, function(root){
      if (root.__cphInit) return;
      root.__cphInit = true;
      initRoot(root, UC);
    });
  }

  function initRoot(root, UC){
    var fire = UC.makeFire(root, { label: "citations-page-header", eventPrefix: "cph" });

    /* Same data-brand-name/-logo/-isdark re-sync as every other page header in this family --
       Bubble can resolve those dynamic expressions after this root is already mounted, patching
       the attribute in place rather than replacing the node, so a one-shot read at init would
       miss it. */
    var nameEl = root.querySelector(".pph-metaname");
    var logoEl = root.querySelector(".up-ph-metalogo");
    function syncFromAttrs(){
      var wantDark = UC.isYes(root.getAttribute("data-isdark"));
      if (wantDark) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");

      var name = root.getAttribute("data-brand-name") || "";
      if (name === "BRAND_NAME") name = "";
      if (nameEl) nameEl.textContent = name;

      var logo = root.getAttribute("data-brand-logo") || "";
      if (logo === "BRAND_LOGO_URL") logo = "";
      if (logoEl){
        if (logo){ logoEl.src = logo; logoEl.style.display = ""; }
        else { logoEl.removeAttribute("src"); logoEl.style.display = "none"; }
      }
    }
    syncFromAttrs();
    new MutationObserver(syncFromAttrs).observe(root, {
      attributes: true, attributeFilter: ["data-isdark", "data-brand-name", "data-brand-logo"]
    });

    UC.makePageNav(root, {
      pages: PAGES,
      onSelect: function(value){ fire("data-nav-fn", "cphNav", { page: value }); }
    });

    if (UC.makeTooltips) UC.makeTooltips(root, function(){ return UC.isYes(root.getAttribute("data-isdark")); });

    var refreshBtn = root.querySelector(".cph-refreshbtn");
    if (refreshBtn){
      refreshBtn.addEventListener("click", function(){
        UC.spinOnce(refreshBtn);
        fire("data-refresh-fn", "cphRefresh", {});
      });
    }
  }

  cphBoot(30);
})();
