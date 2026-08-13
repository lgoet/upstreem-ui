/* upstreem settings-brand.js — die "Your Brand"-Seite der Einstellungen. Braucht core.js
   (window.UpstreemCore) davor, wie jede Komponente dieser Familie.

   Aus dem Core kommen: UC.makeMount (Boot-Stub-Warteschlange), UC.makeFire (ein Event = EIN
   JSON-String), UC.makePopover (Dropdowns samt Aussenklick/Escape/Gruppenschluss),
   UC.makeTooltips, UC.esc, UC.isYes, UC.parseBubbleJson, UC.widthTiers, UC.onResize,
   UC.unclipAncestors. Hier steht nur, was diese Seite eigen hat.

   ── Aufteilung der Zustaendigkeiten ──────────────────────────────────────────
   Name und Matching Aliases werden NICHT hier bearbeitet. Der Knopf feuert nur ein Event; der
   eigentliche Editor ist ein eigener Dialog auf Bubble-Seite. Alles andere auf dieser Seite wird
   hier bearbeitet und einzeln gespeichert -- pro Feld ein Event, kein gemeinsames "Save all".
   Grund: die Felder haengen nicht voneinander ab, und ein Sammel-Speichern wuerde bei einem
   fehlgeschlagenen Feld die anderen mit zurueckrollen.

   ── Warum das Logo nicht hier hochgeladen wird ───────────────────────────────
   Ein Datei-Upload braucht Bubbles eigenes Uploader-Element (Speicherort, Rechte, URL-Rueckgabe).
   Diese Komponente kann eine Datei entgegennehmen und anzeigen, aber nicht ablegen. Der
   Upload-Knopf feuert darum usbLogoUpload, damit der Bubble-Workflow den echten Uploader oeffnet;
   die fertige URL kommt ueber setSettingsBrandLogo() zurueck. Das Feld darunter ist der Weg ohne
   Upload: eine Bild-URL direkt eintragen. Beide Wege enden im selben Zustand.

   ── Danger Zone ─────────────────────────────────────────────────────────────
   Leave und Delete verlangen beide den getippten Teamnamen. Delete zusaetzlich einen zweiten
   Klick auf denselben Knopf (armed state), weil ein Team zu loeschen nicht rueckholbar ist und
   der getippte Name allein noch keine bewusste Entscheidung belegt -- er kann abgeschrieben sein.
   Der zweite Klick verfaellt nach 4s von selbst, damit kein scharfer Knopf stehen bleibt. */
(function(){
  "use strict";

  function usbBoot(triesLeft){
    if (!window.UpstreemCore){
      if (triesLeft > 0){ setTimeout(function(){ usbBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    usbRun();
  }

  /* ---------------- Icons (Feather) ---------------- */
  var ICON = {
    edit:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    upload:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    brand:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
    chev:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
    search:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    logout:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    trash:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
    alert:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    close:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    check:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
  };

  var BUSINESS = [
    { value: "b2b",    label: "B2B" },
    { value: "b2c",    label: "B2C" },
    { value: "hybrid", label: "Hybrid (B2B & B2C)" }
  ];

  var UC = null;

  /* ================= controller ================= */
  function makeController(root){
    UC = window.UpstreemCore;
    var esc = UC.esc;
    var instanceId = String(root.getAttribute("data-instance") || "default").trim();
    var fire = UC.makeFire(root, { label: "settings-brand", eventPrefix: "usb" });

    var state = {
      brandName: "", brandLogo: "", teamName: "", teamId: "",
      models: [], modelLimit: 3,
      markets: [], marketId: "",
      businessModel: "", industries: [], industry: "",
      summary: "", summaryDirty: false,
      logoFileName: "",
      hasData: false, loading: false
    };

    function isDark(){ return UC.isYes(root.getAttribute("data-isdark")); }

    /* ---------------- Geruest ----------------
       Einmal geschrieben, danach nur noch abschnittsweise aktualisiert. Ein vollstaendiges
       Neuzeichnen bei jeder Aenderung wuerde den Fokus aus dem Textfeld werfen, in dem gerade
       getippt wird -- und die Zusammenfassung ist genau so ein Feld. */
    root.innerHTML =
      '<div class="usb-body">' +

        /* ---- 1. Brand Settings ---- */
        '<section class="usb-sec">' +
          '<div class="usb-sechead">' +
            '<h2 class="usb-sectitle">Brand Settings</h2>' +
            '<p class="usb-secsub">Your brand identity as it appears across the workspace.</p>' +
          '</div>' +
          '<div class="usb-card">' +
            '<div class="usb-row" data-row="name">' +
              '<div class="usb-rowtext">' +
                '<div class="usb-rowtitle">Brand Name &amp; Matching Aliases</div>' +
                '<div class="usb-rowdesc">To edit your primary tracking and display name, or to add ' +
                  'matching aliases, use the button on the right.</div>' +
              '</div>' +
              '<div class="usb-rowctl">' +
                '<button class="up-btn-sec usb-editbtn" type="button" data-edit-brand>' +
                  ICON.edit + '<span class="usb-editbtn-lbl">Edit brand</span></button>' +
              '</div>' +
            '</div>' +
            '<div class="usb-div"></div>' +
            '<div class="usb-row" data-row="logo">' +
              '<div class="usb-rowtext">' +
                '<div class="usb-rowtitle">Brand Logo</div>' +
                '<div class="usb-rowdesc">Change your logo to personalize your workspace. ' +
                  'Square images work best.</div>' +
              '</div>' +
              '<div class="usb-rowctl usb-logoctl">' +
                '<div class="usb-logoprev" data-logo-prev></div>' +
                '<div class="usb-logoforms">' +
                  '<div class="usb-uploadrow">' +
                    '<button class="up-btn-sec usb-uploadbtn" type="button" data-logo-upload>' +
                      ICON.upload + '<span>Upload</span></button>' +
                    '<span class="usb-filename" data-logo-file>No file selected</span>' +
                  '</div>' +
                  '<div class="usb-orline">or use a link to your image</div>' +
                  '<div class="usb-urlrow">' +
                    '<input class="up-field usb-urlin" type="url" spellcheck="false" autocomplete="off" ' +
                      'placeholder="https://…" aria-label="Logo image URL" data-logo-url/>' +
                    '<button class="up-btn-sec usb-urlsave" type="button" data-logo-save>Save</button>' +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</section>' +

        /* ---- 2. Model Settings ---- */
        '<section class="usb-sec">' +
          '<div class="usb-sechead">' +
            '<h2 class="usb-sectitle">Model Settings</h2>' +
            '<p class="usb-secsub">Which AI models your prompts run against.</p>' +
          '</div>' +
          '<div class="usb-card">' +
            '<div class="usb-cardhead">' +
              '<div class="usb-rowtext">' +
                '<div class="usb-rowtitle">Manage AI Models</div>' +
                '<div class="usb-rowdesc" data-model-desc></div>' +
              '</div>' +
              '<span class="usb-count" data-model-count>0/0</span>' +
            '</div>' +
            '<div class="usb-models" data-models></div>' +
          '</div>' +
        '</section>' +

        /* ---- 3. Meta Settings ---- */
        '<section class="usb-sec">' +
          '<div class="usb-sechead">' +
            '<h2 class="usb-sectitle">Meta Settings</h2>' +
            '<p class="usb-secsub">Context the system uses when it generates prompts and analyses.</p>' +
          '</div>' +
          '<div class="usb-card">' +

            '<div class="usb-row" data-row="market">' +
              '<div class="usb-rowtext">' +
                '<div class="usb-rowtitle">Default Market</div>' +
                '<div class="usb-rowdesc">Your preset primary market focus.</div>' +
              '</div>' +
              '<div class="usb-rowctl">' +
                '<div class="usb-dd" data-dd="market">' +
                  '<button class="usb-ddbtn" type="button" data-dd-btn aria-haspopup="listbox" aria-expanded="false">' +
                    '<span class="usb-ddbtn-lbl" data-dd-label>Select a market</span>' +
                    '<span class="usb-ddbtn-chev">' + ICON.chev + '</span>' +
                  '</button>' +
                  '<div class="up-menu usb-ddmenu" role="listbox" aria-hidden="true">' +
                    '<div class="usb-ddsearch">' +
                      '<span class="usb-ddsearch-ic">' + ICON.search + '</span>' +
                      '<input class="usb-ddsearch-in" type="text" placeholder="Search markets" ' +
                        'autocomplete="off" spellcheck="false" aria-label="Search markets"/>' +
                    '</div>' +
                    '<div class="usb-ddlist" data-dd-list></div>' +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</div>' +

            '<div class="usb-div"></div>' +

            '<div class="usb-row" data-row="business">' +
              '<div class="usb-rowtext">' +
                '<div class="usb-rowtitle">Business Model</div>' +
                '<div class="usb-rowdesc">Your target audience.</div>' +
              '</div>' +
              '<div class="usb-rowctl">' +
                '<div class="up-seg usb-seg" role="radiogroup" aria-label="Business model" data-business></div>' +
              '</div>' +
            '</div>' +

            '<div class="usb-div"></div>' +

            '<div class="usb-row" data-row="industry">' +
              '<div class="usb-rowtext">' +
                '<div class="usb-rowtitle">Brand Industry</div>' +
                '<div class="usb-rowdesc">Your preset primary brand industry.</div>' +
              '</div>' +
              '<div class="usb-rowctl">' +
                '<div class="usb-dd" data-dd="industry">' +
                  '<button class="usb-ddbtn" type="button" data-dd-btn aria-haspopup="listbox" aria-expanded="false">' +
                    '<span class="usb-ddbtn-lbl" data-dd-label>Select an industry</span>' +
                    '<span class="usb-ddbtn-chev">' + ICON.chev + '</span>' +
                  '</button>' +
                  '<div class="up-menu usb-ddmenu" role="listbox" aria-hidden="true">' +
                    '<div class="usb-ddsearch">' +
                      '<span class="usb-ddsearch-ic">' + ICON.search + '</span>' +
                      '<input class="usb-ddsearch-in" type="text" placeholder="Search industries" ' +
                        'autocomplete="off" spellcheck="false" aria-label="Search industries"/>' +
                    '</div>' +
                    '<div class="usb-ddlist" data-dd-list></div>' +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</div>' +

            '<div class="usb-div"></div>' +

            '<div class="usb-sumblock" data-row="summary">' +
              '<div class="usb-rowtext">' +
                '<div class="usb-rowtitle" data-sum-title>Brand Summary</div>' +
                '<div class="usb-rowdesc">Your brand summary tells the system what your company ' +
                  'does: its products, services and industry focus. It is used as an additional ' +
                  'context source when generating tailored research prompts, insights and AI ' +
                  'analyses. If your focus or product offering changes, update it here.</div>' +
              '</div>' +
              '<textarea class="up-field usb-sumin" rows="6" spellcheck="true" ' +
                'placeholder="Describe what your company does…" aria-label="Brand summary" data-summary></textarea>' +
              '<div class="usb-sumfoot">' +
                '<span class="usb-sumhint" data-sum-hint></span>' +
                '<button class="up-btn-sec usb-sumsave" type="button" data-summary-save disabled>Save summary</button>' +
              '</div>' +
            '</div>' +

          '</div>' +
        '</section>' +

        /* ---- 4. Danger Zone ---- */
        '<section class="usb-sec usb-sec-danger">' +
          '<div class="usb-sechead">' +
            '<h2 class="usb-sectitle usb-sectitle-danger">Danger Zone</h2>' +
            '<p class="usb-secsub">These actions affect the whole team and cannot be undone.</p>' +
          '</div>' +
          '<div class="usb-card usb-card-danger">' +
            '<div class="usb-row">' +
              '<div class="usb-rowtext">' +
                '<div class="usb-rowtitle">Leave Team</div>' +
                '<div class="usb-rowdesc">You lose access to this workspace. Other members keep theirs.</div>' +
              '</div>' +
              '<div class="usb-rowctl">' +
                '<button class="usb-dangerbtn" type="button" data-leave>' + ICON.logout + '<span>Leave team</span></button>' +
              '</div>' +
            '</div>' +
            '<div class="usb-div"></div>' +
            '<div class="usb-row">' +
              '<div class="usb-rowtext">' +
                '<div class="usb-rowtitle">Delete Team</div>' +
                '<div class="usb-rowdesc">Deletes the workspace and every brand, prompt and report ' +
                  'in it, for everyone. This cannot be undone.</div>' +
              '</div>' +
              '<div class="usb-rowctl">' +
                '<button class="usb-dangerbtn is-hard" type="button" data-delete>' + ICON.trash + '<span>Delete team</span></button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</section>' +

      '</div>';

    /* ---------------- Elemente ---------------- */
    var elModels    = root.querySelector("[data-models]");
    var elModelCount= root.querySelector("[data-model-count]");
    var elModelDesc = root.querySelector("[data-model-desc]");
    var elBusiness  = root.querySelector("[data-business]");
    var elSummary   = root.querySelector("[data-summary]");
    var elSumSave   = root.querySelector("[data-summary-save]");
    var elSumHint   = root.querySelector("[data-sum-hint]");
    var elSumTitle  = root.querySelector("[data-sum-title]");
    var elLogoPrev  = root.querySelector("[data-logo-prev]");
    var elLogoFile  = root.querySelector("[data-logo-file]");
    var elUrlIn     = root.querySelector("[data-logo-url]");
    var elEditBtn   = root.querySelector("[data-edit-brand]");
    var elEditLbl   = root.querySelector(".usb-editbtn-lbl");

    /* ---------------- Abschnitt: Marke ---------------- */
    function renderBrand(){
      var name = state.brandName || "your brand";
      elEditLbl.textContent = "Edit " + name;
      elEditBtn.setAttribute("data-tip", "Opens the brand name and aliases editor");
      elSumTitle.textContent = (state.brandName ? state.brandName + " Summary" : "Brand Summary");

      if (state.brandLogo){
        elLogoPrev.innerHTML = '<img src="' + esc(state.brandLogo) + '" alt="" ' +
          'onerror="this.parentNode.classList.add(&quot;is-broken&quot;);this.remove();"/>';
        elLogoPrev.classList.remove("is-empty", "is-broken");
      } else {
        elLogoPrev.innerHTML = ICON.brand;
        elLogoPrev.classList.add("is-empty");
      }
      elLogoFile.textContent = state.logoFileName || "No file selected";
      elLogoFile.classList.toggle("is-set", !!state.logoFileName);
    }

    /* ---------------- Abschnitt: Modelle ----------------
       Der Zaehler ist die eigentliche Regel dieses Abschnitts: ueber dem Limit laesst sich kein
       weiteres Modell einschalten. Die noch nicht gewaehlten Karten werden dann sichtbar
       abgeschaltet, statt den Klick still zu verschlucken -- ein Schalter, der nichts tut und auch
       nicht sagt warum, ist der schlimmere Fall. */
    function activeKeys(){
      return state.models.filter(function(m){ return m.active; }).map(function(m){ return m.key; });
    }
    function renderModels(){
      var on = activeKeys().length, lim = state.modelLimit || 0;
      var full = lim > 0 && on >= lim;
      elModelCount.textContent = on + "/" + lim;
      elModelCount.classList.toggle("is-full", full);
      elModelDesc.textContent = "Select the AI models you want to track. Your plan currently " +
        "supports up to " + lim + " active model" + (lim === 1 ? "" : "s") + ".";

      if (!state.models.length){
        elModels.innerHTML = '<div class="usb-modelsempty">No models available yet.</div>';
        return;
      }
      elModels.innerHTML = state.models.map(function(m){
        var locked = full && !m.active;
        return '<button class="usb-model' + (m.active ? " is-on" : "") + (locked ? " is-locked" : "") + '" ' +
            'type="button" role="switch" aria-checked="' + (m.active ? "true" : "false") + '" ' +
            'data-model="' + esc(m.key) + '"' + (locked ? ' aria-disabled="true"' : "") +
            (locked ? ' data-tip="Your plan allows ' + esc(String(lim)) + ' active models. Turn one off first."' : "") + '>' +
          '<span class="usb-model-logo">' +
            (m.logo_url ? '<img src="' + esc(m.logo_url) + '" alt="" onerror="this.remove();"/>' : "") +
          '</span>' +
          '<span class="usb-model-txt">' +
            '<span class="usb-model-name">' + esc(m.display_name || m.key) + '</span>' +
            (m.provider ? '<span class="usb-model-prov">' + esc(m.provider) + '</span>' : "") +
          '</span>' +
          '<span class="usb-model-check">' + ICON.check + '</span>' +
        '</button>';
      }).join("");
    }

    /* ---------------- Abschnitt: Meta ---------------- */
    function renderBusiness(){
      elBusiness.innerHTML = BUSINESS.map(function(b){
        var on = state.businessModel === b.value;
        return '<button class="up-seg-btn usb-seg-btn' + (on ? " is-on" : "") + '" type="button" ' +
          'role="radio" aria-checked="' + (on ? "true" : "false") + '" data-biz="' + b.value + '">' +
          esc(b.label) + '</button>';
      }).join("");
    }

    function marketLabel(m){ return m ? (m.name || m.id) : ""; }
    function findMarket(id){
      for (var i = 0; i < state.markets.length; i++) if (String(state.markets[i].id) === String(id)) return state.markets[i];
      return null;
    }

    /* Ein Dropdown-Bauer fuer beide Auswahlfelder (Markt und Branche). Sie unterscheiden sich nur
       in der Datenquelle und darin, ob rechts eine Zahl steht -- das rechtfertigt keine zwei
       Implementierungen. Beim ZWEITEN weiteren Verbraucher gehoert das nach core (STYLEGUIDE 25);
       hier sind es zwei Aufrufer in derselben Datei, das bleibt lokal. */
    function makeDropdown(key, cfg){
      var wrap = root.querySelector('[data-dd="' + key + '"]');
      var btn  = wrap.querySelector("[data-dd-btn]");
      var menu = wrap.querySelector(".usb-ddmenu");
      var list = wrap.querySelector("[data-dd-list]");
      var sin  = wrap.querySelector(".usb-ddsearch-in");
      var lbl  = wrap.querySelector("[data-dd-label]");
      var q = "";

      var pop = UC.makePopover({
        wrap: wrap, menu: menu, opener: btn, group: "usb-dd",
        onClose: function(){ btn.setAttribute("aria-expanded", "false"); }
      });

      function paint(){
        var items = cfg.items().filter(function(it){
          if (!q) return true;
          return String(cfg.label(it)).toLowerCase().indexOf(q.toLowerCase()) !== -1;
        });
        if (!items.length){
          list.innerHTML = '<div class="usb-ddempty">No match</div>';
          return;
        }
        list.innerHTML = items.map(function(it){
          var val = cfg.value(it), on = String(val) === String(cfg.selected());
          return '<div class="usb-ddopt' + (on ? " is-on" : "") + '" role="option" tabindex="0" ' +
              'aria-selected="' + (on ? "true" : "false") + '" data-val="' + esc(val) + '">' +
            '<span class="usb-ddopt-lbl">' + esc(cfg.label(it)) + '</span>' +
            (cfg.meta && cfg.meta(it) != null ? '<span class="usb-ddopt-meta">' + esc(cfg.meta(it)) + '</span>' : "") +
            '<span class="usb-ddopt-check">' + ICON.check + '</span>' +
          '</div>';
        }).join("");
      }
      function syncLabel(){
        var t = cfg.selectedLabel();
        lbl.textContent = t || cfg.placeholder;
        lbl.classList.toggle("is-empty", !t);
      }
      btn.addEventListener("click", function(){
        if (pop.isOpen()){ pop.close(); return; }
        q = ""; sin.value = ""; paint();
        pop.open();
        btn.setAttribute("aria-expanded", "true");
        /* Fokus erst nach dem Oeffnen, sonst scrollt Safari das Menue an eine falsche Stelle,
           solange es noch aria-hidden ist. */
        setTimeout(function(){ try { sin.focus(); } catch(e){} }, 0);
      });
      sin.addEventListener("input", function(){ q = sin.value; paint(); });
      list.addEventListener("click", function(e){
        var opt = e.target.closest(".usb-ddopt");
        if (!opt) return;
        pop.close();
        cfg.onPick(opt.getAttribute("data-val"));
      });
      list.addEventListener("keydown", function(e){
        if (e.key !== "Enter" && e.key !== " ") return;
        var opt = e.target.closest(".usb-ddopt");
        if (!opt) return;
        e.preventDefault();
        pop.close();
        cfg.onPick(opt.getAttribute("data-val"));
      });
      return { sync: function(){ syncLabel(); paint(); } };
    }

    var ddMarket = makeDropdown("market", {
      placeholder: "Select a market",
      items: function(){ return state.markets; },
      label: function(m){ return marketLabel(m); },
      value: function(m){ return m.id; },
      meta:  function(m){ return m.score == null ? null : m.score; },
      selected: function(){ return state.marketId; },
      selectedLabel: function(){ return marketLabel(findMarket(state.marketId)); },
      onPick: function(v){
        state.marketId = v; ddMarket.sync();
        fire("data-market-fn", "usbMarket", { market_id: v });
      }
    });
    var ddIndustry = makeDropdown("industry", {
      placeholder: "Select an industry",
      items: function(){ return state.industries; },
      label: function(x){ return x; },
      value: function(x){ return x; },
      selected: function(){ return state.industry; },
      selectedLabel: function(){ return state.industry; },
      onPick: function(v){
        state.industry = v; ddIndustry.sync();
        fire("data-industry-fn", "usbIndustry", { industry: v });
      }
    });

    /* ---------------- Zusammenfassung ----------------
       Zwei getrennte Funktionen, und das ist wichtig: sie hatten anfangs eine gemeinsame, und die
       hat beim Tippen den Serverstand ins Feld zurueckgeschrieben. Aufgefallen ist es nur, weil
       der Harness den Text ohne Fokus setzt -- im Browser tippt man mit Fokus, dort haette der
       Fehler monatelang schlafen koennen und waere erst aufgewacht, wenn eine Antwort vom Server
       eintrifft, waehrend das Feld nicht fokussiert ist.

       syncFromState schreibt ins Feld, aber nur wenn dort nicht gerade getippt wird.
       syncDirty fasst das Feld nie an, sondern beurteilt nur Knopf und Hinweis. */
    function syncDirty(){
      var changed = elSummary.value !== (state.summary || "");
      elSumSave.disabled = !changed;
      elSumHint.textContent = changed ? "Unsaved changes" : "";
      elSumHint.classList.toggle("is-dirty", changed);
    }
    function syncSummary(){
      if (document.activeElement !== elSummary) elSummary.value = state.summary || "";
      syncDirty();
    }

    /* ---------------- Klicks ---------------- */
    root.addEventListener("click", function(e){
      var t = e.target;

      if (t.closest("[data-edit-brand]")){ fire("data-editbrand-fn", "usbEditBrand", {}); return; }
      if (t.closest("[data-logo-upload]")){ fire("data-logoupload-fn", "usbLogoUpload", {}); return; }
      if (t.closest("[data-logo-save]")){
        var url = String(elUrlIn.value || "").trim();
        if (!url) { elUrlIn.focus(); return; }
        fire("data-logourl-fn", "usbLogoUrl", { url: url });
        return;
      }

      var mb = t.closest("[data-model]");
      if (mb){
        if (mb.classList.contains("is-locked")) return;
        var key = mb.getAttribute("data-model");
        state.models.forEach(function(m){ if (m.key === key) m.active = !m.active; });
        renderModels();
        fire("data-models-fn", "usbModels", { model_keys: activeKeys().join(",") });
        return;
      }

      var bz = t.closest("[data-biz]");
      if (bz){
        state.businessModel = bz.getAttribute("data-biz");
        renderBusiness();
        fire("data-business-fn", "usbBusiness", { business_model: state.businessModel });
        return;
      }

      if (t.closest("[data-summary-save]")){
        state.summary = elSummary.value;
        syncDirty();
        fire("data-summary-fn", "usbSummary", { summary: state.summary });
        return;
      }

      if (t.closest("[data-leave]")){ openDanger("leave"); return; }
      if (t.closest("[data-delete]")){ openDanger("delete"); return; }
    });

    elSummary.addEventListener("input", syncDirty);
    elUrlIn.addEventListener("keydown", function(e){
      if (e.key === "Enter"){ e.preventDefault(); root.querySelector("[data-logo-save]").click(); }
    });

    /* ================= Danger-Dialog =================
       Bewusst NICHT UC.makeTopicModal: das ist ein Topic-Editor mit Namensfeld, Farbe, Emoji und
       einem eigenen Speichern/Loeschen-Vertrag. Hier braucht es eine Bestaetigung mit getipptem
       Namen. Nach STYLEGUIDE 27 werden die Werte des Templates dafuer zunaechst lokal dupliziert
       und erst bei einem zweiten Verbraucher nach core extrahiert. */
    var dlg = null, dlgMode = "", armed = false, armTimer = null;

    function closeDanger(){
      if (!dlg) return;
      disarm();
      dlg.classList.remove("is-shown");
      var d = dlg;
      setTimeout(function(){ if (d && d.parentNode) d.parentNode.removeChild(d); }, 180);
      dlg = null;
      document.removeEventListener("keydown", onDlgKey, true);
    }
    function onDlgKey(e){ if (e.key === "Escape"){ e.stopPropagation(); closeDanger(); } }
    function disarm(){
      armed = false;
      if (armTimer){ clearTimeout(armTimer); armTimer = null; }
      if (!dlg) return;
      var go = dlg.querySelector("[data-dlg-go]");
      if (go){ go.classList.remove("is-armed"); go.querySelector(".usb-dlg-golbl").textContent = goLabel(); }
    }
    function goLabel(){ return dlgMode === "delete" ? "Delete team" : "Leave team"; }

    function openDanger(mode){
      closeDanger();
      /* closeDanger raeumt den Knoten erst nach 180ms weg, damit die Ausblendung noch laeuft.
         Oeffnet man in dieser Zeit den naechsten Dialog, liegen zwei Backdrops im DOM. Der alte
         ist zwar pointer-events:none und damit harmlos zu bedienen, aber querySelector findet ihn
         zuerst -- und damit greift jeder Code, der "den Dialog" sucht, auf die Leiche zu. Beim
         Testen ist mir genau das passiert. Also hier hart aufraeumen, bevor der neue entsteht. */
      Array.prototype.forEach.call(document.querySelectorAll(".usb-dlg-backdrop"), function(n){
        if (n.parentNode) n.parentNode.removeChild(n);
      });
      dlgMode = mode;
      var isDel = mode === "delete";
      var team = state.teamName || "this team";

      dlg = document.createElement("div");
      dlg.className = "usb-dlg-backdrop";
      dlg.setAttribute("data-theme", isDark() ? "dark" : "light");
      dlg.innerHTML =
        '<div class="usb-dlg" role="dialog" aria-modal="true" aria-label="' + esc(goLabel()) + '">' +
          '<div class="usb-dlg-head">' +
            '<div class="usb-dlg-heading">' +
              '<span class="usb-dlg-badge' + (isDel ? " is-hard" : "") + '">' + ICON.alert + '</span>' +
              '<div>' +
                '<h3 class="usb-dlg-title">' + (isDel ? "Delete " : "Leave ") + esc(team) + '</h3>' +
                '<p class="usb-dlg-sub">' + (isDel
                  ? "This deletes the workspace and everything in it, for every member. It cannot be undone."
                  : "You lose access to this workspace. Other members keep theirs.") + '</p>' +
              '</div>' +
            '</div>' +
            '<button class="up-popup-close usb-dlg-close" type="button" data-dlg-close aria-label="Close">' + ICON.close + '</button>' +
          '</div>' +
          '<div class="usb-dlg-field">' +
            '<label class="usb-dlg-lbl" for="usb-dlg-in">Type <b>' + esc(team) + '</b> to confirm</label>' +
            '<input class="up-field usb-dlg-in" id="usb-dlg-in" type="text" autocomplete="off" ' +
              'spellcheck="false" placeholder="' + esc(team) + '" data-dlg-in/>' +
          '</div>' +
          '<div class="usb-dlg-foot">' +
            '<button class="up-btn-sec usb-dlg-cancel" type="button" data-dlg-close>Cancel</button>' +
            '<button class="usb-dlg-go' + (isDel ? " is-hard" : "") + '" type="button" data-dlg-go disabled>' +
              '<span class="usb-dlg-golbl">' + goLabel() + '</span></button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(dlg);
      /* Zwei Frames: der Backdrop muss einmal ohne is-shown gerendert worden sein, sonst springt
         die Karte ohne Uebergang ins Bild. */
      setTimeout(function(){ if (dlg) dlg.classList.add("is-shown"); }, 10);
      document.addEventListener("keydown", onDlgKey, true);

      var input = dlg.querySelector("[data-dlg-in]");
      var go = dlg.querySelector("[data-dlg-go]");
      setTimeout(function(){ try { input.focus(); } catch(e){} }, 60);

      function matches(){ return input.value.trim() === String(team).trim(); }
      input.addEventListener("input", function(){
        go.disabled = !matches();
        if (!matches()) disarm();
      });

      dlg.addEventListener("click", function(e){
        if (e.target === dlg){ closeDanger(); return; }          /* Klick auf den Scrim */
        if (e.target.closest("[data-dlg-close]")){ closeDanger(); return; }
        if (!e.target.closest("[data-dlg-go]")) return;
        if (go.disabled || !matches()) return;

        /* Leave: ein Klick reicht, der getippte Name ist die Bestaetigung.
           Delete: der erste Klick schaerft nur, der zweite loest aus. */
        if (isDel && !armed){
          armed = true;
          go.classList.add("is-armed");
          go.querySelector(".usb-dlg-golbl").textContent = "Click again to delete";
          armTimer = setTimeout(disarm, 4000);
          return;
        }
        var payload = { team_id: state.teamId, team_name: state.teamName };
        closeDanger();
        if (isDel) fire("data-delete-fn", "usbDeleteTeam", payload);
        else       fire("data-leave-fn",  "usbLeaveTeam",  payload);
      });
    }

    /* ---------------- Rendern ---------------- */
    function render(){
      root.classList.toggle("is-loading", !!state.loading && !state.hasData);
      renderBrand();
      renderModels();
      renderBusiness();
      ddMarket.sync();
      ddIndustry.sync();
      syncSummary();
    }

    UC.widthTiers(root);
    UC.onResize(root, function(){ UC.widthTiers(root); });
    UC.unclipAncestors(root, false);
    if (UC.makeTooltips) UC.makeTooltips(root, isDark);
    if (window.MutationObserver){
      new MutationObserver(function(){
        if (dlg) dlg.setAttribute("data-theme", isDark() ? "dark" : "light");
      }).observe(root, { attributes: true, attributeFilter: ["data-isdark", "data-theme"] });
    }
    render();

    return {
      render: function(p){
        p = p || {};
        var brand = p.brand || {}, team = p.team || {};
        if (brand.name != null)  state.brandName = String(brand.name);
        if (brand.logo != null)  state.brandLogo = String(brand.logo);
        if (team.name != null)   state.teamName = String(team.name);
        if (team.id != null)     state.teamId = String(team.id);

        var models = p.models;
        if (typeof models === "string") models = UC.parseBubbleJson(models);
        if (Array.isArray(models)){
          state.models = models.map(function(m){
            return { key: String(m.key || m.model || ""), display_name: m.display_name || m.name || "",
                     logo_url: m.logo_url || "", provider: m.provider || "",
                     active: UC.isYes(m.active) || m.active === true };
          }).filter(function(m){ return !!m.key; });
        }
        if (p.model_limit != null) state.modelLimit = UC.toNum(p.model_limit) || 0;

        var markets = p.markets;
        if (typeof markets === "string") markets = UC.parseBubbleJson(markets);
        if (Array.isArray(markets)){
          state.markets = markets.map(function(m){
            return { id: String(m.id != null ? m.id : (m.market_id != null ? m.market_id : m.name)),
                     name: m.name || m.market || "", score: m.score == null ? null : m.score };
          });
        }
        if (p.market_id != null)     state.marketId = String(p.market_id);
        if (p.business_model != null)state.businessModel = String(p.business_model).toLowerCase();

        var inds = p.industries;
        if (typeof inds === "string") inds = UC.parseBubbleJson(inds);
        if (Array.isArray(inds)) state.industries = inds.map(function(x){ return typeof x === "string" ? x : (x && x.name) || ""; })
                                                       .filter(Boolean);
        if (p.industry != null) state.industry = String(p.industry);
        if (p.summary != null)  state.summary = String(p.summary);

        state.hasData = true;
        state.loading = false;
        render();
      },
      setLoading: function(on){ state.loading = UC.isYes(on); render(); },
      setLogo: function(url, fileName){
        if (url != null) state.brandLogo = String(url);
        if (fileName != null) state.logoFileName = String(fileName);
        renderBrand();
      },
      reset: function(){
        closeDanger();
        UC.closePopovers && UC.closePopovers();
        elUrlIn.value = "";
        return true;
      },
      instanceId: function(){ return instanceId; }
    };
  }

  /* ================= mount ================= */
  var mount = null;
  function usbRun(){
    var UCl = window.UpstreemCore;
    mount = UCl.makeMount({
      onMount: function(m){ mount = m; },
      rootClass: "usb-root", notPortal: true,
      ctrlProp: "__usbController",
      resolveLocal: "__usbResolveLocal",
      queue: "__usbBootQueue",
      initRoot: function(root){
        if (root.__usbController) return root.__usbController;
        var id = root.getAttribute("data-instance") || "default";
        if (id === "INSTANCE_ID") return null;
        var ctrl = makeController(root);
        root.__usbController = ctrl;
        return ctrl;
      },
      api: {
        renderSettingsBrand: doRender,
        setSettingsBrandLoading: doLoading,
        setSettingsBrandLogo: doLogo,
        resetSettingsBrand: doReset
      },
      forwardShape: {
        renderSettingsBrand: "params",
        resetSettingsBrand: "id"
      }
    });
  }
  function resolve(id){
    if (!mount) return null;
    var r = mount.rootsWithId(String(id || "").trim());
    if (!r.length) return null;
    return r[0].__usbController || null;
  }
  function doRender(params){
    var UCl = window.UpstreemCore;
    var p = UCl.normParams ? UCl.normParams(params) : params;
    if (typeof p === "string") p = UCl.parseBubbleJson(p) || {};
    p = p || {};
    var c = resolve(p.instanceId);
    if (!c){
      if (window.console) console.warn("[settings-brand] no instance for id " + p.instanceId);
      return;
    }
    c.render(p);
  }
  function doLoading(id, on){ var c = resolve(id); if (c) c.setLoading(on); }
  function doLogo(id, url, fileName){ var c = resolve(id); if (c) c.setLogo(url, fileName); }
  function doReset(id){ var c = resolve(id); return c ? c.reset() : false; }

  usbBoot(30);
})();
