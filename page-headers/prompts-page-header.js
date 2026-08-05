/* upstreem prompts-page-header.js — component logic. Requires core.js (window.UpstreemCore) loaded
   first, exactly like every table/chart in this repo: it reuses UC.isYes/UC.makeFire/UC.onResize
   and the shared .up-root CSS variables (--vc-text/--vc-muted/--vc-third/--vc-border) rather than
   redefining any of that locally.

   First of a new component FAMILY (see page-headers/ folder), not a new one-off: the brand/heading/
   description/nav/button structure is meant to sit at the top of every page in the app, one small
   dedicated component PER page (this file is the Prompts page's own) rather than a single generic
   component fed different config -- same reasoning the rest of this library already follows for
   "genuinely different content, not a parameterized variant." Copy this file for the next page's
   header and swap PAGES/the heading/description text; the boot/mount plumbing below needs no
   changes to do that. */
(function(){
  "use strict";

  function pphBoot(triesLeft){
    if (!window.UpstreemCore){
      if (triesLeft > 0){ setTimeout(function(){ pphBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    pphRun();
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

  function esc(v){ var d = document.createElement("div"); d.textContent = String(v == null ? "" : v); return d.innerHTML; }

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

    /* The only two genuinely dynamic inputs -- everything else on this page's header (heading,
       description, the three nav items) is fixed content that belongs to THIS component, not a
       parameter. Same data-brand-name/data-brand-logo convention prompts-table.js's own toolbar
       already uses, read directly off the root's attributes.

       Re-synced on every attribute change, not just read once at mount: Bubble frequently resolves
       the dynamic expression behind data-brand-name/-logo/-isdark (current user's company, etc.)
       AFTER this element has already been inserted and initialized, then patches the attribute in
       place rather than replacing the whole node -- a one-shot read at init misses that and the
       header is stuck showing nothing. Every other component in this repo (domains-table.js,
       urls-table.js, responses-table.js) already guards against this the same way, via a
       MutationObserver on these exact attributes. */
    var nameEl = root.querySelector(".pph-brandname");
    var logoEl = root.querySelector(".pph-brandlogo");
    function syncFromAttrs(){
      var wantDark = UC.isYes(root.getAttribute("data-isdark"));
      if (wantDark) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");

      var name = root.getAttribute("data-brand-name") || "";
      if (name === "BRAND_NAME") name = "";
      if (nameEl) nameEl.textContent = name;

      var logo = root.getAttribute("data-brand-logo") || "";
      if (logo === "BRAND_LOGO_URL") logo = "";
      if (logoEl){
        /* display:none (not just an unset src) so a not-yet-resolved/empty logo never shows the
           browser's broken-image icon -- src="" resolves to the page's own URL and fails to load. */
        if (logo){ logoEl.src = logo; logoEl.style.display = ""; }
        else { logoEl.removeAttribute("src"); logoEl.style.display = "none"; }
      }
    }
    syncFromAttrs();
    new MutationObserver(syncFromAttrs).observe(root, {
      attributes: true, attributeFilter: ["data-isdark", "data-brand-name", "data-brand-logo"]
    });

    buildNav(root);
    var addBtn = root.querySelector(".pph-addbtn");
    if (addBtn){
      addBtn.addEventListener("click", function(){ fire("data-add-fn", "pphAdd", {}); });
    }

    function buildNav(root){
      var nav = root.querySelector(".pph-nav");
      if (!nav) return;
      nav.innerHTML = PAGES.map(function(p, i){
        return '<div class="pph-navitem' + (i === 0 ? " is-selected" : "") + '" role="tab" tabindex="0" ' +
          'aria-selected="' + (i === 0 ? "true" : "false") + '" data-page="' + esc(p.value) + '">' +
          '<span class="pph-navicon">' + p.icon + '</span>' +
          '<span class="pph-navlabel">' + esc(p.label) + '</span>' +
        '</div>';
      }).join("") + '<div class="pph-navunderline"></div>';

      var underline = nav.querySelector(".pph-navunderline");

      /* transition:none for the initial placement only -- without it the indicator would visibly
         grow in from a 0-width sliver at (0,0) on first paint, since it starts with no inline
         left/width at all. Every later call (an actual click) leaves the CSS transition (200ms
         ease, in prompts-page-header.css) alone, which is what makes switching tabs slide. */
      function positionUnderline(item, animate){
        if (!item) return;
        var navRect = nav.getBoundingClientRect();
        var itemRect = item.getBoundingClientRect();
        if (!animate) underline.style.transition = "none";
        underline.style.left = (itemRect.left - navRect.left) + "px";
        underline.style.width = itemRect.width + "px";
        if (!animate){ void underline.offsetWidth; underline.style.transition = ""; }
      }

      function selectPage(value, fireEvent){
        var items = nav.querySelectorAll(".pph-navitem");
        var target = null;
        Array.prototype.forEach.call(items, function(el){
          var on = el.getAttribute("data-page") === value;
          el.classList.toggle("is-selected", on);
          el.setAttribute("aria-selected", on ? "true" : "false");
          if (on) target = el;
        });
        positionUnderline(target, true);
        if (fireEvent) fire("data-nav-fn", "pphNav", { page: value });
      }

      nav.addEventListener("click", function(e){
        var item = e.target.closest(".pph-navitem");
        if (!item) return;
        selectPage(item.getAttribute("data-page"), true);
      });
      nav.addEventListener("keydown", function(e){
        if (e.key !== "Enter" && e.key !== " ") return;
        var item = e.target.closest(".pph-navitem");
        if (!item) return;
        e.preventDefault();
        selectPage(item.getAttribute("data-page"), true);
      });

      positionUnderline(nav.querySelector(".pph-navitem.is-selected"), false);
      if (UC.onResize){
        UC.onResize(root, function(){ positionUnderline(nav.querySelector(".pph-navitem.is-selected"), false); });
      }
    }
  }

  pphBoot(30);
})();
