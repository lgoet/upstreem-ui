/* upstreem opportunities-page-header.js — component logic. Requires core.js (window.UpstreemCore)
   loaded first, same family as prompts/dashboard/citations/brands/performance page headers: reuses
   UC.isYes/UC.makeFire and the shared .up-root CSS variables plus the Page Header Kit's meta/
   heading/description styling (core.css's ".up-ph-*" classes). Same bare layout as
   performance-page-header.js otherwise -- no subpage nav, no separator row -- except for the one
   top-right "Generate new Opportunities" button, which reuses the SAME primary-button classes
   brands-page-header.js's "+ Add Brand" button uses (".up-ph-addbtn.up-export" -- filled), just
   with a different icon/label -- and at core's own top offset, so this component ships no
   stylesheet of its own.

   The button's event is still named ophSearch. It was a "Search for Opportunities" button first;
   renaming the event to match the new label would break the Bubble workflow already bound to it,
   which is not worth a cosmetic rename.

   watchRoots is still wired into the boot sequence: Bubble replaces this element's whole markup
   block once the dynamic expressions behind data-brand-name/-logo resolve, same as every other
   page header in this repo (see citations-page-header.js's history for the bug this avoids). */
(function(){
  "use strict";

  function ophBoot(triesLeft){
    if (!window.UpstreemCore){
      if (triesLeft > 0){ setTimeout(function(){ ophBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    var UC = window.UpstreemCore;
    ophRun();
    if (UC.watchRoots) UC.watchRoots("oph-root", ophRun);
    [100, 300, 800, 1800].forEach(function(ms){ setTimeout(ophRun, ms); });
  }

  function ophRun(){
    var roots = document.querySelectorAll(".oph-root");
    Array.prototype.forEach.call(roots, function(root){
      if (root.__ophInit) return;
      root.__ophInit = true;
      initRoot(root);
    });
  }

  function initRoot(root){
    var UC = window.UpstreemCore;
    var fire = UC.makeFire(root, { label: "opportunities-page-header", eventPrefix: "oph" });

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

    var searchBtn = root.querySelector(".up-ph-addbtn");
    if (searchBtn){
      searchBtn.addEventListener("click", function(){ fire("data-search-fn", "ophSearch", {}); });
    }
  }

  ophBoot(30);
})();
