/* upstreem brand-editor-drawer.js -- der Marken-Editor als Drawer aus core (13.10.). Praefix ubed.
   Braucht core.js und brand-editor.js.

   Ein Drawer der DRITTEN Ebene (#drawer-companysettings, Bubble-Name des Drawers), geoeffnet mit
   der company_id: vom Stift im Brand-Drawer, von der Brands-Seite und aus den Settings ("Your
   Brand"). Gebaut nach denselben Regeln wie die anderen Drawer: Kopf aus core ("Brand Editor /
   Name"), darunter die Komponente brand-editor.js im lokalen Modus (data-local) mit dem Kopf aus
   dem Detail-Kit.

   Der Editor SCHREIBT. Das ist der Unterschied zu allen anderen Drawern, und daraus folgen die
   Regeln hier:
   - Jede Aktion geht an ihre eigene Funktion, und jede antwortet mit dem NEUEN Stand
     (brand_edit_v1-Form). Gezeichnet wird, was die DB sagt, nicht was der Nutzer getippt hat.
   - Waehrend gespeichert wird, ist der Editor gedimmt (Schreibaktion: dimmen, kein Skelett).
   - Jeder Fehler wird zu einem Satz (Toast), der sagt, was der Nutzer tun kann. Ein Schalter,
     den die Komponente schon umgelegt hat, springt zurueck; ein abgelehnter Alias steht wieder
     im Feld, damit niemand ihn neu tippen muss.
   - Wer nicht schreiben darf (meta.can_edit), sieht den Editor zum Lesen, mit einem Satz dazu.
   - Nach einer Aenderung an Name oder Farbe zieht die App nach: der Marken-Speicher (Chips,
     Charts) bekommt die neuen Werte, und das Ereignis upstreemBrandChanged sagt es allen, die
     die Marke zwischengespeichert haben (der Brand-Drawer darunter).
   Gebaut vom DB-Chat am 13.10. (bubble/domain_editor_13_10/): brand_edit_v1 und je Aktion eine
   Funktion; Grenzen in meta.limits. Solange die Bubble-Gruppe #drawer-companysettings steht, laeuft
   hier nichts. */
(function () {
  "use strict";

  function ubedBoot(n) {
    if (!window.UpstreemCore) {
      if (n > 0) { setTimeout(function () { ubedBoot(n - 1); }, 100); return; }
      if (window.console) console.error("[brand-editor-drawer] core.js nicht geladen");
      return;
    }
    ubedStart();
  }

  function ubedStart() {
  var UC = window.UpstreemCore;
  var esc = UC.esc, t = UC.t || function (x) { return x; };
  if (!UC.kernDrawer) return;

  function isArr(v) { return Object.prototype.toString.call(v) === "[object Array]"; }
  function str(v) { return v == null || typeof v === "object" ? "" : String(v); }
  function num(v) { if (v == null || v === "" || typeof v === "boolean") return null; var n = Number(v); return isFinite(n) ? n : null; }
  function setter(name) { return typeof window[name] === "function" ? window[name] : function () {}; }
  function dunkel() { try { return (window.getUpstreemTheme ? window.getUpstreemTheme() : "") === "dark"; } catch (e) { return false; } }
  function teamWarten() { return UC.teamWarten ? UC.teamWarten(10000) : Promise.resolve(UC.getTeam ? UC.getTeam() : ""); }

  var FN = { lesen: "brand_edit_v1", rename: "brand_rename_v1", aliasAdd: "brand_alias_add_v1",
             aliasSet: "brand_alias_set_v1", aliasDelete: "brand_alias_delete_v1", farbe: "brand_color_set_v1" };
  var ID = "drawer-companysettings-editor";

  var E = { slot: null, root: null, kopf: null, id: "", antwort: null, nr: 0, ab: null, laeuft: false, fehler: "", fehlerWiederholbar: false };

  /* brand_edit_v1 -> die Form, die brand-editor.js liest (setBrandEditor: company, aliases,
     tracking_periods). Gelesen wird nur, was die Komponente kennt. */
  function zeileVon(roh) {
    if (isArr(roh)) roh = roh.length ? roh[0] : null;
    return roh && roh.row && typeof roh.row === "object" ? roh : null;
  }
  function zuEditor(antwort) {
    var r = antwort.row;
    return {
      company: { company_id: str(r.company_id), name: str(r.name), domain: str(r.domain), favicon_url: str(r.favicon_url),
                 color_override: r.color_override || null, effective_color: r.effective_color || null, default_color: r.default_color || null },
      aliases: isArr(r.aliases) ? r.aliases : [],
      tracking_periods: isArr(r.tracking_periods) ? r.tracking_periods : []
    };
  }
  function grenzen() { var m = E.antwort && E.antwort.meta; return m && m.limits && typeof m.limits === "object" ? m.limits : {}; }
  function darfSchreiben() { var m = E.antwort && E.antwort.meta; return !(m && m.can_edit === false); }

  /* Zeichnen: die Komponente bekommt den Stand, der Drawer-Kopf den Namen, und die Felder die
     Grenzen der DB (meta.limits) -- dieselben Laengen hier wie dort, sonst laesst das Feld zu,
     was die DB ablehnt. */
  function zeichnen() {
    var r = E.root;
    if (!r) return;
    r.classList.toggle("is-fehler", !!E.fehler);
    var fehlerEl = r.querySelector(".ubed-fehler");
    fehlerEl.hidden = !E.fehler;
    if (E.fehler) {
      fehlerEl.innerHTML = UC.leerHtml({ icon: "info", titel: "Brand not available", text: E.fehler,
        knopf: E.fehlerWiederholbar ? "Try again" : "", knopfAttr: "data-ubed-retry" });
      if (E.kopf) E.kopf.name("");
      return;
    }
    if (!E.antwort) { if (E.kopf) E.kopf.name(null); return; }
    setter("setBrandEditor")(ID, zuEditor(E.antwort));
    setter("setBrandEditorLoading")(ID, "no");
    if (E.kopf) E.kopf.name(str(E.antwort.row.name));
    var g = grenzen();
    var nameIn = r.querySelector(".ube-namein"), aliasIn = r.querySelector(".ube-aliasin");
    if (nameIn && num(g.name_max)) nameIn.setAttribute("maxlength", String(num(g.name_max)));
    if (aliasIn && num(g.alias_max)) aliasIn.setAttribute("maxlength", String(num(g.alias_max)));
    var lesend = !darfSchreiben();
    r.classList.toggle("is-lesend", lesend);
    var hinweis = r.querySelector(".ubed-lesehinweis");
    hinweis.hidden = !lesend;
    /* Zwei Gruende, zwei Saetze (Vertrag 13.10.): keine Rolle owner/admin, oder eine archivierte
       Marke -- die bleibt fuer alle nur lesbar. */
    if (lesend) hinweis.textContent = str(E.antwort.row.status) === "inactive"
      ? t("This brand is no longer tracked. You can view its settings.")
      : t("Only owners and admins can edit brands. You can view the settings.");
  }

  function fehlerText(code) {
    var c = String(code || "").trim();
    if (c === "brand_not_found" || c === "team_invalid_param") return "This brand doesn't exist in this team.";
    if (c === "settings_not_authenticated" || c === "not authenticated") return "Your session has expired. Please sign in again.";
    if (c === "team_deleted") return "This team has been deleted.";
    if (/^team_access_/.test(c) || c === "forbidden" || c === "team_forbidden") return "Your team doesn't have access right now.";
    if (/_rate_limited$/.test(c)) return "Too many requests in a short time. Please wait a moment.";
    return "This brand could not be loaded. Please try again.";
  }
  function wiederholbar(code) {
    var c = String(code || "").trim();
    return !(c === "brand_not_found" || c === "team_invalid_param" || /^team_access_/.test(c) || c === "forbidden" ||
      c === "team_forbidden" || c === "team_deleted" || c === "not authenticated" || c === "settings_not_authenticated");
  }
  function laden() {
    var id = E.id;
    E.antwort = null; E.fehler = "";
    setter("setBrandEditorLoading")(ID, "yes");
    zeichnen();
    if (E.ab) { try { E.ab.abort(); } catch (e) {} }
    var ab = typeof AbortController !== "undefined" ? new AbortController() : null;
    E.ab = ab;
    var nr = ++E.nr;
    teamWarten().then(function (team) {
      if (nr !== E.nr) return null;
      if (!team) return { ok: false, status: 0, fehler: { message: "not authenticated" } };
      return UC.rpc(FN.lesen, { p_team: team, p_company: id }, { timeoutMs: 60000, signal: ab ? ab.signal : undefined });
    }).then(function (erg) {
      if (!erg || nr !== E.nr) return;
      var a = erg.ok ? zeileVon(erg.daten) : null;
      if (a) { E.antwort = a; E.fehler = ""; zeichnen(); return; }
      var code = erg.ok ? "" : str((erg.fehler && (erg.fehler.message || erg.fehler.code)) || "");
      if (window.console) console.warn("[brand-editor-drawer] " + FN.lesen + " fuer " + id + ": " + (code || "Antwort nicht lesbar") +
        (erg.status ? " (HTTP " + erg.status + ")" : ""));
      E.fehler = t(fehlerText(code)); E.fehlerWiederholbar = wiederholbar(code);
      setter("setBrandEditorLoading")(ID, "no");
      zeichnen();
    });
  }

  /* ---- Schreiben ---------------------------------------------------------------------------- */
  /* Der Satz zu einem Fehler der Schreibfunktionen (Vorschlag B4: message = Code, hint = Grund).
     Nur, was der Nutzer tun kann -- ohne Diagnose, ohne interne Namen. */
  function schreibFehler(code, hint, wer) {
    var c = String(code || "").trim(), h = String(hint || "").trim(), g = grenzen();
    wer = String(wer || "").trim();
    if (c === "brand_edit_forbidden") return h === "inactive" ? t("This brand is no longer tracked, so it can't be edited.") : t("Only owners and admins can edit brands.");
    if (/_rate_limited$/.test(c)) return t("Too many changes in a short time. Please wait a moment.");
    if (c === "brand_not_found") return t("This brand doesn't exist in this team.");
    if (c === "brand_alias_not_found") return t("This alias no longer exists.");
    if (c === "brand_alias_limit") return t("This brand already has the maximum number of aliases.");
    if (c === "brand_color_invalid") return t("Please enter a color like #1f6feb.");
    if (c === "brand_name_invalid") {
      if (h === "empty") return t("Please enter a name.");
      if (h === "too_long") return num(g.name_max) ? t("Names can have up to {n} characters.").replace("{n}", num(g.name_max)) : t("This name is too long.");
      if (h === "taken") return wer ? t("{brand} in your team already has this name.").replace("{brand}", wer) : t("Another brand in your team already has this name.");
      return t("This name contains characters that can't be used.");
    }
    if (c === "brand_alias_invalid") {
      if (h === "too_short") return num(g.alias_min) ? t("Aliases need at least {n} characters.").replace("{n}", num(g.alias_min)) : t("This alias is too short.");
      if (h === "too_long") return num(g.alias_max) ? t("Aliases can have up to {n} characters.").replace("{n}", num(g.alias_max)) : t("This alias is too long.");
      if (h === "generic") return t("This word is too common to identify a brand. Use a more specific name.");
      /* Vertrag 13.10.: duplicate = der Alias ist der Name der Marke selbst (derselbe Alias noch
         einmal ist kein Fehler); collides traegt in detail die Marke, der er gehoert. */
      if (h === "duplicate") return t("This is already the brand's name.");
      if (h.indexOf("collides") === 0) return wer ? t("This name already belongs to {brand}.").replace("{brand}", wer) : t("Another brand in your team already uses this name or alias.");
      return t("This alias contains characters that can't be used.");
    }
    if (/^team_access_/.test(c) || c === "team_forbidden") return t("Your team doesn't have access right now.");
    return t("This change could not be saved. Please try again.");
  }
  /* Nach Name oder Farbe zieht die App nach: der Marken-Speicher bekommt die neuen Werte (Chips,
     Legenden, Charts lesen ihn), und wer die Marke zwischengespeichert hat, erfaehrt es. */
  function appNachziehen(alt, neu) {
    var a = alt && alt.row, n = neu && neu.row;
    if (!n) return;
    var nameNeu = a && str(a.name) !== str(n.name), farbeNeu = a && str(a.effective_color) !== str(n.effective_color);
    if (!nameNeu && !farbeNeu) return;
    try {
      var liste = UC.getBrands ? UC.getBrands() : null;
      if (isArr(liste) && typeof window.setUpstreemBrands === "function") {
        var geaendert = false;
        var kopie = liste.map(function (b) {
          if (!b || str(b.company_id || b.id).toLowerCase() !== str(n.company_id).toLowerCase()) return b;
          var o = {}, k; for (k in b) o[k] = b[k];
          if (nameNeu) o.name = str(n.name);
          if (farbeNeu) o.color = n.effective_color || null;
          geaendert = true;
          return o;
        });
        if (geaendert) window.setUpstreemBrands(kopie);
      }
    } catch (e) {}
    try { window.dispatchEvent(new CustomEvent("upstreemBrandChanged", { detail: { company_id: str(n.company_id) } })); } catch (e) {}
  }
  /* Eine Schreibaktion: dimmen, rufen, mit der Antwort zeichnen -- oder den Satz zeigen und den
     vorigen Stand wiederherstellen. nachFehler(code, hint) fuer das, was die Komponente schon
     vorweggenommen hat (Schalter, geleertes Feld). */
  function schreiben(fn, params, erfolg, nachFehler) {
    if (E.laeuft || !E.antwort) return;
    if (!darfSchreiben()) { if (UC.toast) UC.toast(t("Only owners and admins can edit brands."), { kind: "error" }); zeichnen(); return; }
    E.laeuft = true;
    E.root.classList.add("is-speichert");
    var id = E.id, alt = E.antwort;
    teamWarten().then(function (team) {
      var p = { p_team: team, p_company: id }, k;
      for (k in params) p[k] = params[k];
      return UC.rpc(fn, p, { timeoutMs: 30000 });
    }).then(function (erg) {
      E.laeuft = false;
      E.root.classList.remove("is-speichert");
      if (id !== E.id) return;
      var neu = erg && erg.ok ? zeileVon(erg.daten) : null;
      if (neu) {
        E.antwort = neu; zeichnen();
        appNachziehen(alt, neu);
        if (erfolg && UC.toast) UC.toast(t(erfolg), { kind: "success" });
        return;
      }
      var code = erg && !erg.ok ? str(erg.fehler && (erg.fehler.message || erg.fehler.code)) : "";
      var hint = erg && !erg.ok ? str(erg.fehler && erg.fehler.hint) : "";
      var wer = erg && !erg.ok ? str(erg.fehler && (erg.fehler.details || erg.fehler.detail)) : "";
      if (window.console) console.warn("[brand-editor-drawer] " + fn + ": " + (code || "Antwort nicht lesbar") + (hint ? " (" + hint + ")" : ""));
      zeichnen();
      if (nachFehler) { try { nachFehler(code, hint); } catch (e) {} }
      if (UC.toast) UC.toast(schreibFehler(code, hint, wer), { kind: "error" });
    });
  }

  /* Ein abgelehnter Wert kommt ins Feld zurueck: zeichnen() fuellt die Felder aus dem Stand der DB,
     und das Getippte waere sonst weg. */
  function feldZurueck(sel, wert) {
    var feld = E.root && E.root.querySelector(sel);
    if (!feld) return;
    feld.value = wert;
    try { feld.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) {}
  }

  /* ---- Aufbau ---- */
  function aufbauen(ctx) {
    var dk = dunkel() ? "yes" : "no";
    ctx.slot.innerHTML =
      '<div class="up-root ubed-root">' +
        /* Fuer Mitglieder ohne Schreibrecht: ein Satz statt Knoepfen, die abgelehnt wuerden. */
        '<p class="up-dk-unter ubed-lesehinweis" hidden>' + esc(t("Only owners and admins can edit brands. You can view the settings.")) + '</p>' +
        '<div class="up-root ube-root" data-local="yes" data-instance="' + esc(ID) + '" data-isdark="' + dk + '"></div>' +
        '<div class="ubed-fehler" hidden></div>' +
      '</div>';
    E.slot = ctx.slot; E.kopf = ctx; E.root = ctx.slot.querySelector(".ubed-root");
    var s = ctx.slot;
    s.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("[data-ubed-retry]")) laden();
    });
    function an(name, fn) { s.addEventListener(name, function (e) { fn(e.detail || {}); }); }
    /* Die Ereignisse, die brand-editor.js im lokalen Modus schickt (Praefix "ube" vor dem nackten
       Namen, wie bei udd und uvw). */
    an("ubeubeRename", function (d) {
      var name = str(d.name).trim();
      schreiben(FN.rename, { p_name: name || null }, "Name saved.", function () { feldZurueck(".ube-namein", name); });
    });
    an("ubeubeAliasAdd", function (d) {
      var muster = str(d.pattern).trim();
      if (!muster) return;
      /* Die Komponente hat das Feld schon geleert -- der abgelehnte Alias kommt zurueck. */
      schreiben(FN.aliasAdd, { p_pattern: muster }, "Alias added.", function () { feldZurueck(".ube-aliasin", muster); });
    });
    /* Der Schalter ist schon umgelegt (die Komponente nimmt ihn vorweg); scheitert das Speichern,
       zeichnet zeichnen() den letzten Stand der DB -- er springt zurueck. */
    an("ubeubeAliasToggle", function (d) {
      schreiben(FN.aliasSet, { p_alias_id: str(d.alias_id), p_active: d.is_active === true || d.is_active === "true" }, null);
    });
    an("ubeubeAliasDelete", function (d) { schreiben(FN.aliasDelete, { p_alias_id: str(d.alias_id) }, "Alias removed."); });
    an("ubeubeColor", function (d) {
      var c = str(d.color).trim().toLowerCase();
      if (!/^#[0-9a-f]{6}$/.test(c)) { if (UC.toast) UC.toast(t("Please enter a color like #1f6feb."), { kind: "error" }); return; }
      schreiben(FN.farbe, { p_color: c }, "Color saved.", function () { feldZurueck(".ube-farbin", c); });
    });
    an("ubeubeColorReset", function () { schreiben(FN.farbe, { p_color: null }, "Color reset."); });
  }

  UC.kernDrawer("companysettings", {
    aufbauen: aufbauen,
    zeigen: function (id) {
      id = str(id).trim();
      if (!id) return;
      if (id !== E.id) {
        E.id = id;
        try { setter("resetBrandEditor")(ID); } catch (e) {}
      }
      /* Immer frisch: ein Editor zeigt den Stand der DB, nicht den vom letzten Oeffnen -- jemand
         anderes im Team kann inzwischen etwas geaendert haben. */
      laden();
    },
    zu: function () {}
  });
  }

  ubedBoot(50);
})();
