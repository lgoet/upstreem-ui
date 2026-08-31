/* upstreem opportunities-page-header.js — component logic. Requires core.js (window.UpstreemCore)
   loaded first, same family as prompts/dashboard/citations/brands/performance page headers: reuses
   UC.isYes/UC.makeFire and the shared .up-root CSS variables plus the Page Header Kit's meta/
   heading/description styling (core.css's ".up-ph-*" classes). Same bare layout as
   performance-page-header.js otherwise -- no subpage nav, no separator row -- except for the one
   top-right "Look for new Opportunities" button, which reuses the SAME primary-button classes
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
    /* Laut sagen, WAS fehlt. Ein "undefined is not a function" schickt einen auf die Suche im
       falschen File; der Name des fehlenden Kits zeigt direkt auf den veralteten Pin. */
    var fehlt = ["makePageHeaderMeta", "makePageNav", "spinOnce", "makeTooltips"].filter(function(n){ return !UC[n]; });
    if (fehlt.length && window.console) console.error("upstreem: core.js ist zu alt, es fehlen: " +
      fehlt.join(", ") + ". data-cdn-pin dieses Page-Headers auf einen aktuellen Commit setzen.");
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
    /* No page nav here, so nothing else would set the responsive tier classes -- and without
       is-vnarrow the 32px top clearance for Bubble's mobile sidebar toggle never applies. */
    if (UC.widthTiers) UC.widthTiers(root);
    var fire = UC.makeFire(root, { label: "opportunities-page-header", eventPrefix: "oph" });

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

    var searchBtn = root.querySelector(".up-ph-addbtn");
    if (searchBtn){
      /* Beschriftung und Zeichen aus JS und nicht aus der Vorlage: page-headers/bubble/*.html ist
         eine Vorlage fuer NEUINSTALLATIONEN, ein bereits eingebautes Element erreicht sie nie
         mehr. Also kommt beides mit dem CDN-Pin. Die Vorlage ist gleichzeitig nachgezogen.
         "Look for new Opportunities" statt "Generate new Opportunities": die Seite sucht, sie
         erfindet nichts. Zeichen scan-square statt der drei Kreise -- die lasen sich als
         "zielen", und gezielt wird hier nicht.
         Der Kurzname bleibt der erste Teil, .up-ph-addbtn-full faellt auf schmalen Seiten weg
         (core.css) -- also "Look for" allein, was als Anfang eines Satzes noch traegt.
         Idempotent: initRoot kann mehrfach laufen. */
      if (!searchBtn.getAttribute("data-oph-btn")){
        searchBtn.setAttribute("data-oph-btn", "1");
        searchBtn.innerHTML = (UC.icon ? UC.icon("scanSquare", 2) : "") +
          '<span>Look for<span class="up-ph-addbtn-full"> new Opportunities</span></span>';
      }
      searchBtn.addEventListener("click", function(){ fire("data-search-fn", "ophSearch", {}); });
    }
  }

  ophBoot(30);
})();
