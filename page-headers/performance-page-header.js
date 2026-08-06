/* upstreem performance-page-header.js — component logic. Requires core.js (window.UpstreemCore)
   loaded first, same family as prompts/dashboard/citations/brands page headers: reuses UC.isYes
   and the shared .up-root CSS variables plus the Page Header Kit's meta/heading/description
   styling (core.css's ".up-ph-*" classes). Unlike every other header in this family, the
   Performance page has no top-right buttons and no subpage nav -- just the meta row, heading, and
   description -- so there is nothing here to wire up beyond the brand-name/-logo/-isdark re-sync
   every header needs. No events, no UC.makeFire.

   watchRoots is still wired into the boot sequence: Bubble replaces this element's whole markup
   block once the dynamic expressions behind data-brand-name/-logo resolve, same as every other
   page header in this repo (see citations-page-header.js's history for the bug this avoids). */
(function(){
  "use strict";

  function pfphBoot(triesLeft){
    if (!window.UpstreemCore){
      if (triesLeft > 0){ setTimeout(function(){ pfphBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    var UC = window.UpstreemCore;
    pfphRun();
    if (UC.watchRoots) UC.watchRoots("pfph-root", pfphRun);
    [100, 300, 800, 1800].forEach(function(ms){ setTimeout(pfphRun, ms); });
  }

  function pfphRun(){
    var roots = document.querySelectorAll(".pfph-root");
    Array.prototype.forEach.call(roots, function(root){
      if (root.__pfphInit) return;
      root.__pfphInit = true;
      initRoot(root);
    });
  }

  function initRoot(root){
    var UC = window.UpstreemCore;

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
  }

  pfphBoot(30);
})();
