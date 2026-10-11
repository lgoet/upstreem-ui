/* upstreem settings-data.js -- der Datenteil der Seite Settings (11.10.), OHNE DOM.

   WARUM EIN EIGENER TEIL: wie brands-data.js. Was hier steht, kennt weder Elemente noch Bubble --
   nur die Funktionen, ihre Parameter und die Form, in der die eingebetteten Bausteine
   (settings-brand, team-orga, settings-billing) ihre Daten lesen.

   VERTRAGSSTAND (11.10. abends): VORSCHLAG DES DB-CHATS (bubble/settings_v1_vorschlag.md, Abschnitt
   6 und 9; Abschnitt 9 geht vor), abgeglichen in bubble/settings_db_rueckmeldung.md. Gebaut ist
   davon erst der Sofort-Teil (settings_sofort.sql, create-team-checkout); die v1-Funktionen kommen
   Schritt fuer Schritt. Verlinkt wird SCHRITT FUER SCHRITT (Bauplan, Abschnitt 7):
   jede Funktion hat ihren eigenen Schalter in LIVE. Steht er auf false, ruft die Seite sie NICHT
   (ein 404 je Aufruf waere Laerm) und sagt sichtbar, dass es noch nicht geht -- beim Lesen ueber
   den Lesefehler des Bausteins, beim Schreiben mit einem Satz. Nie ein Knopf, der still nichts tut.
   Weicht der Vertrag ab, wird NUR hier nachgezogen (FN, EDGE, die zu*-Funktionen).

   SICHERHEIT: Was hier geprueft wird (Adresse, Rolle, Link, Laengen), ist Bequemlichkeit fuer den
   Nutzer, kein Schutz. Die Datenbank prueft alles selbst (Auftrag, Abschnitt 4). Was die Seite
   aber selbst tut, ist ein Weiterleiten auf eine Adresse aus einer Antwort (Portal, Kasse): das
   geht nur auf die bekannten Stripe-Hosts (stripeUrl), nie irgendwohin.

   Exportiert als window.UpstreemSettingsDaten. Braucht window.UpstreemCitationsDaten (Lader,
   Fehlerart). */
(function () {
  "use strict";
  if (window.UpstreemSettingsDaten) return;

  function isArr(v) { return Object.prototype.toString.call(v) === "[object Array]"; }
  function str(v) { return v == null || typeof v === "object" ? "" : String(v); }
  function num(v) { if (v == null || v === "" || typeof v === "boolean") return null; var n = Number(v); return isFinite(n) ? n : null; }
  function istObjekt(d) { return !!d && typeof d === "object" && !isArr(d); }
  function meta(d) { return istObjekt(d) && istObjekt(d.meta) ? d.meta : {}; }
  function C() { return window.UpstreemCitationsDaten; }
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  var FN = {
    meta: "settings_page_meta_v1",
    marke: "settings_brand_v1",
    mitglieder: "team_members_v1",
    einladungen: "team_invites_v1",
    protokoll: "team_log_v1",
    abo: "billing_status_v1",
    tarife: "billing_plans_v1",
    markeSpeichern: "settings_brand_save_v1",
    logo: "settings_brand_logo_v1",
    modelle: "team_models_set_v1",
    zurueckziehen: "team_invite_revoke_v1",
    entfernen: "team_member_remove_v1",
    rolle: "team_member_role_v1",
    verlassen: "team_leave_v1",
    loeschen: "team_delete_v1"
  };
  /* Edge Functions (Vorschlag 6.4, 9.3). Einladen und erneut senden laufen ueber EINE Funktion, die
     den Versandstand an der Einladung fuehrt (3.2): die Seite ruft keine Anlage-RPC mehr und zieht
     nach einem gescheiterten Versand nichts mehr zurueck. Die Kasse ist seit dem 11.10. deployt
     (create-team-checkout); das Portal bleibt die bisherige Funktion. */
  var EDGE = { einladen: "team-invite-send", erneut: "team-invite-send", portal: "team-billing-portal", kasse: "create-team-checkout" };

  /* DER SCHALTER JE FUNKTION. Alles aus, bis der Vertrag fuer den jeweiligen Schritt steht und die
     echten Antworten geprueft sind (Auftrag 7: erst Lesen, dann Your Brand, Einladungen,
     Mitglieder, Billing, zuletzt Verlassen und Loeschen). */
  var LIVE = {
    /* Schritt 1 (Lesen) gebaut am 11.10. (settings_v1_lesen.sql, Vertrag Abschnitt 11), geprueft
       gegen testdaten/settings_v1/v1_lesen_echte_antworten.json. */
    meta: true, marke: true, mitglieder: true, einladungen: true, protokoll: true, abo: true, tarife: true,
    /* Schritt 2 (Your Brand speichern) gebaut am 11.10. (settings_v1_brand.sql, Vertrag 12). */
    markeSpeichern: true, logo: true, modelle: true,
    /* Schritte 3 bis 6 gebaut am 11.10. (settings_v1_rest.sql, Vertrag 13; Kasse 9.2/10.5). */
    einladen: true, erneut: true, zurueckziehen: true,
    entfernen: true, rolle: true,
    portal: true, kasse: true,
    verlassen: true, loeschen: true
  };
  function live(art) { return LIVE[art] === true && !!(FN[art] || EDGE[art]); }

  /* Grenzen, die die Oberflaeche VORAB einhaelt, damit der Nutzer seinen Fehler sofort sieht. Die
     Werte sind der Vorschlag des Auftrags (4.2, 4.4); die DB bestimmt sie endgueltig. */
  /* Branche: die DB erlaubt 80 (Vorschlag 6.1 limits), der Baustein bleibt bei seinen 48 -- strenger
     schadet nicht, der Wert passt ins Dropdown. Logo 500 wie in der DB. */
  var GRENZE = { mail: 254, branche: 48, zusammenfassung: 1000, logo: 500, protokoll: 100 };
  var ROLLEN_EINLADEN = ["member", "admin"];
  var ROLLEN = ["member", "admin", "owner"];
  var GESCHAEFT = ["b2b", "b2c", "hybrid"];

  function anfrage(art, params) { return { art: art, fn: FN[art], params: params, sig: FN[art] + "|" + JSON.stringify(params) }; }
  function p(team) { return { p_team: str(team) }; }

  /* ---- Pruefen vor dem Senden ------------------------------------------------------------------
     Die drei Gifte (Backtick, "${", Backslash) toeten jeden Bubble-Schritt, durch den der Wert
     spaeter laeuft (CLAUDE.md 2a). In einer E-Mail-Adresse sind sie laut RFC erlaubt, aber
     praktisch nie echt -- also gar nicht erst schicken. */
  function gift(s) { return /`|\$\{|\\/.test(s); }
  /* Die Adresse so, wie die DB sie normalisieren soll (4.4.5): getrimmt, klein, NFKC. */
  function mailNorm(s) {
    s = str(s).trim();
    try { s = s.normalize("NFKC"); } catch (e) {}
    return s.toLowerCase();
  }
  /* Ergebnis: "" heisst gut, sonst der Grund (die Seite macht den Satz daraus). */
  function mailPruefen(s, mailOk) {
    s = mailNorm(s);
    if (!s) return "leer";
    if (s.length > GRENZE.mail) return "lang";
    if (gift(s) || /[\s"'<>()\[\],;:]/.test(s) || /[\u0000-\u001f\u007f]/.test(s)) return "zeichen";
    if (typeof mailOk === "function" && !mailOk(s)) return "form";
    if ((s.match(/@/g) || []).length !== 1) return "form";
    return "";
  }
  /* Logo nur ueber https (4.2.4). Kein Konto im Link, kein IP-Literal, kein localhost -- das
     prueft die DB endgueltig, hier nur, damit der Nutzer es sofort sieht. */
  function logoPruefen(u) {
    u = str(u).trim();
    if (!u) return "leer";
    if (u.length > GRENZE.logo) return "lang";
    var x;
    try { x = new URL(u); } catch (e) { return "form"; }
    if (x.protocol !== "https:") return "https";
    if (x.username || x.password) return "form";
    var h = x.hostname.toLowerCase();
    if (!h || h === "localhost" || /\.localhost$/.test(h) || /^[\d.]+$/.test(h) || h.indexOf(":") >= 0 || h.indexOf(".") < 0) return "form";
    return "";
  }

  /* ---- Lesen -------------------------------------------------------------------------------- */
  function seite(team) { return anfrage("meta", p(team)); }
  function marke(team) { return anfrage("marke", p(team)); }
  function mitglieder(team) { return anfrage("mitglieder", p(team)); }
  /* Nur offene (p_status 'open', Vertrag 11): team-orga zeigt ohnehin nur sie, und ohne Filter
     kaemen alle angenommenen und zurueckgezogenen mit -- bei 877c 16 statt 0. */
  function einladungen(team) { var q = p(team); q.p_status = "open"; return anfrage("einladungen", q); }
  function protokoll(team) { var q = p(team); q.p_limit = GRENZE.protokoll; q.p_before = null; return anfrage("protokoll", q); }
  function abo(team) { return anfrage("abo", p(team)); }
  /* Mit p_team: dann kommen is_current und trial_available fuer DIESES Team (Vertrag 11). */
  function tarife(team) { return anfrage("tarife", p(team)); }

  /* ---- Schreiben ---------------------------------------------------------------------------- */
  /* NUR GEAENDERTE FELDER (Vertrag 12): null = unveraendert, '' = leeren. Verglichen wird mit dem
     zuletzt gelesenen Stand (alt = die flache Zeile von settings_brand_v1). Ohne alt gehen alle
     vier hinaus -- dann leert ein leeres Feld, statt still unveraendert zu bleiben.
     Markt in Grossschrift (app.markets.alpha2), Geschaeftsmodell als Schluessel. */
  function markeSpeichern(team, w, alt) {
    w = w || {}; alt = istObjekt(alt) ? alt : null;
    function neu(v) { return str(v).trim(); }
    function feld(jetzt, vorher, gleich) {
      if (alt && gleich(jetzt, vorher)) return null;
      return jetzt;
    }
    var gm = neu(w.business_model).toLowerCase();
    if (gm && GESCHAEFT.indexOf(gm) < 0) gm = "";
    var markt = neu(w.market_id).toUpperCase();
    var q = {
      p_team: str(team),
      p_market_id: feld(markt, alt && str(alt.market), function (a, b) { return a === str(b).toUpperCase(); }),
      p_business_model: feld(gm, alt && str(alt.business_model_key != null ? alt.business_model_key : alt.business_model).toLowerCase(), function (a, b) { return a === b; }),
      p_industry: feld(neu(w.industry).slice(0, GRENZE.branche), alt && str(alt.industry), function (a, b) { return a === str(b).trim(); }),
      /* Die Zusammenfassung NICHT still kuerzen: die Seite lehnt zu lange vorher mit einem Satz ab
         (zusammenfassungZuLang). Gekuerzt gesendet waere gespeichert, was niemand geschrieben hat. */
      p_summary: feld(str(w.summary), alt && str(alt.summary), function (a, b) { return a === b; })
    };
    return anfrage("markeSpeichern", q);
  }
  function zusammenfassungZuLang(s) { return str(s).length > GRENZE.zusammenfassung; }
  function logo(team, url) { return anfrage("logo", { p_team: str(team), p_logo_url: str(url).trim() || null }); }
  function modelle(team, schluessel) {
    var l = (isArr(schluessel) ? schluessel : str(schluessel).split(","))
      .map(function (x) { return str(x).trim(); }).filter(Boolean);
    var gesehen = {};
    l = l.filter(function (x) { if (gesehen[x]) return false; gesehen[x] = true; return true; });
    return anfrage("modelle", { p_team: str(team), p_model_keys: l });
  }
  /* Einladen und erneut senden: Edge team-invite-send (6.4). Nur Kennungen und Adresse -- Link,
     Token und Text baut die Funktion selbst. */
  /* base_url: wohin der Link der Mail zeigt (Vertrag 13.1). Die Funktion nimmt nur eigene Adressen
     (app.upstreem.ai, auch /version-test) und faellt sonst auf ihren Standard zurueck -- also darf
     die Seite ihre eigene schicken: auf der Testfassung fuehrt der Link dann in die Testfassung. */
  function einladen(team, mail, rolle, basis) {
    rolle = str(rolle).toLowerCase();
    var b = { team_id: str(team), email: mailNorm(mail), role: ROLLEN_EINLADEN.indexOf(rolle) >= 0 ? rolle : "member" };
    if (str(basis)) b.base_url = str(basis);
    return { art: "einladen", name: EDGE.einladen, body: b };
  }
  function erneut(team, id, basis) {
    var b = { team_id: str(team), invite_id: str(id) };
    if (str(basis)) b.base_url = str(basis);
    return { art: "erneut", name: EDGE.erneut, body: b };
  }
  function zurueckziehen(team, id) { return anfrage("zurueckziehen", { p_team: str(team), p_invite_id: str(id) }); }
  function entfernen(team, uid) { return anfrage("entfernen", { p_team: str(team), p_user_id: str(uid) }); }
  function rolle(team, uid, r) {
    r = str(r).toLowerCase();
    return anfrage("rolle", { p_team: str(team), p_user_id: str(uid), p_role: ROLLEN.indexOf(r) >= 0 ? r : "" });
  }
  function verlassen(team, name) { return anfrage("verlassen", { p_team: str(team), p_confirm_name: str(name) }); }
  function loeschen(team, name) { return anfrage("loeschen", { p_team: str(team), p_confirm_name: str(name) }); }
  /* Edge: nur Kennungen, nie Adresse, Preis oder Text (Auftrag 4.4.1, 4.6.2). */
  /* Portal (Vertrag 13.3): return_path nach denselben Regeln wie die Kasse. */
  function portal(team, rueckweg) {
    var b = { team_id: str(team) };
    rueckweg = str(rueckweg);
    if (/^\/(?!\/)/.test(rueckweg) && rueckweg.length <= 300) b.return_path = rueckweg;
    return { name: EDGE.portal, body: b };
  }
  /* Kasse (9.2): billing_plan_id und 'monthly'|'yearly', NIE ein Preis. return_path ist ein Pfad
     der App (die Funktion setzt APP_URL davor); die Seite schickt den, auf dem sie gerade steht. */
  function kasse(team, plan, takt, rueckweg) {
    takt = str(takt).toLowerCase();
    var b = { team_id: str(team), billing_plan_id: str(plan), billing_interval: /^year/.test(takt) ? "yearly" : "monthly" };
    rueckweg = str(rueckweg);
    if (/^\/(?!\/)/.test(rueckweg) && rueckweg.length <= 300) b.return_path = rueckweg;
    return { name: EDGE.kasse, body: b };
  }

  /* ---- Antwortformen -------------------------------------------------------------------------
     Seiten-Meta (6.1): Rolle und die vom SERVER abgeleiteten Rechte. Die Oberflaeche blendet
     danach aus; erzwingen tut es die DB. Ein fehlendes Recht heisst NEIN, nie ja (anders als der
     Rueckfall von settings-brand, der user_can_manage ohne Angabe als true las). */
  function recht(r) {
    if (r === true) return { darf: true, grund: "" };
    if (istObjekt(r)) return { darf: r.allowed === true || r.can === true || r.value === true, grund: str(r.reason) };
    return { darf: false, grund: "" };
  }
  /* Seiten-Meta (Vorschlag 6.1): {meta:{team_id, team_name, viewer_role, …, has_access,
     access_state, is_deleted}, row:{can_*, reasons:{<flag>: grund}}}. Die fruehere Form (role,
     permissions) bleibt als Rueckfall. */
  function zuMeta(d) {
    if (!istObjekt(d)) return null;
    var m = meta(d), row = istObjekt(d.row) ? d.row : {}, team = istObjekt(d.team) ? d.team : (istObjekt(m.team) ? m.team : {});
    var r = istObjekt(d.permissions) ? d.permissions : (istObjekt(m.permissions) ? m.permissions : row);
    var gruende = istObjekt(row.reasons) ? row.reasons : {};
    var rolle = str(m.viewer_role || m.role || d.role).toLowerCase();
    if (ROLLEN.indexOf(rolle) < 0) return null;
    function rr(k) { var x = recht(r[k]); if (!x.darf && !x.grund) x.grund = str(gruende[k]); return x; }
    return {
      rolle: rolle,
      teamId: str(team.id || m.team_id),
      teamName: str(team.name || m.team_name),
      rechte: {
        marke: rr("can_edit_brand"), modelle: rr("can_manage_models"),
        einladen: rr("can_invite"), adminEinladen: rr("can_invite_admin"), mitglieder: rr("can_manage_members"),
        einladungenSehen: rr("can_view_invites"), protokollSehen: rr("can_view_log"),
        rollen: rr("can_change_roles"), ownerUebergeben: rr("can_transfer_owner"),
        billing: rr("can_manage_billing"), verlassen: rr("can_leave"), loeschen: rr("can_delete")
      },
      mitgliederZahl: num(m.member_count), einladungenZahl: num(m.pending_invites_count),
      zugang: str(m.access_state), geloescht: m.is_deleted === true
    };
  }
  /* Your Brand (6.1): die Form, die renderSettingsBrand liest. Der Teamname kommt aus der Meta. */
  function absolut(u) { u = str(u).trim(); if (/^\/\//.test(u)) u = "https:" + u; return /^https:\/\//i.test(u) ? u : ""; }
  /* Vorschlag 6.1: {meta, row:{company_id, name, logo_url, market, business_model, industry, summary,
     limits, markets}}, flach statt unter brand. Die Modelle fehlen dort (Rueckmeldung 2): erwartet
     als row.models in der Zeilenform von get_team_model_settings_v1. Die fruehere Form ({brand,
     models}) bleibt als Rueckfall. */
  function zuMarke(d, m) {
    if (!istObjekt(d)) return null;
    if (istObjekt(d.row)) d = d.row;
    var b = istObjekt(d.brand) ? d.brand : d;
    if (!isArr(d.models)) return null;
    var lim = istObjekt(d.limits) ? d.limits : {};
    /* Geschaeftsmodell: business_model ist der Anzeigetext ("B2C", auch Altbestand wie "Hybrid
       (B2B & B2C)"), business_model_key der Schluessel -- der Schluessel zuerst. */
    var gm = str(d.business_model_key != null ? d.business_model_key : d.business_model).toLowerCase();
    var out = {
      /* Ohne eigenes Logo das Favicon der Marke (logo_default), wie im Kopf der App. */
      brand: { name: str(b.name), logo: absolut(b.logo_url) || absolut(d.logo_default) },
      company_id: UUID.test(str(b.company_id)) ? str(b.company_id) : "",
      models: d.models.filter(istObjekt),
      model_limit: num(lim.models_max),
      market: str(d.market != null ? d.market : d.market_id).toLowerCase(),
      business_model: GESCHAEFT.indexOf(gm) >= 0 ? gm : "",
      industry: str(d.industry),
      summary: str(d.summary)
    };
    /* Die Marktliste der Antwort ist der Rueckfall des Bausteins (zuerst gilt die App-Ablage). */
    if (isArr(d.markets) && d.markets.length) out.markets = d.markets.filter(istObjekt);
    if (m) {
      out.team = { id: m.teamId, name: m.teamName }; out.user_role = m.rolle;
      /* Nur lesen, mit dem Grund (Vertrag 11: reasons role | no_access). */
      var rm = m.rechte && m.rechte.marke;
      out.nur_lesen = !rm || rm.darf ? ""
        : (rm.grund === "no_access" ? "Choose a plan in Billing to change these settings." : "Only owners and admins can change these settings.");
    }
    /* Rechte der Modelle vom Server: ohne Angabe NEIN (siehe recht). In jede Zeile, weil
       settings-brand den Planrahmen aus der ersten Zeile liest. */
    if (m && out.models.length) {
      out.models = out.models.map(function (x) {
        var y = {}, k; for (k in x) y[k] = x[k];
        y.user_can_manage = !!(m.rechte && m.rechte.modelle.darf);
        if (out.model_limit != null && y.active_models_limit == null) y.active_models_limit = out.model_limit;
        return y;
      });
    }
    return out;
  }
  /* Team (6.3-6.5): die Formen, die team-orga schon liest. Nur pruefen, nicht umbauen. */
  /* Vorschlag 6.1: {meta:{viewer_role, viewer_user_id, viewer_email, permissions}, rows:[…]} --
     team-orga liest {members, viewer_role, …} oben. Hier umgehaengt, die alte Form geht durch. */
  function zuMitglieder(d) {
    if (!istObjekt(d)) return null;
    if (isArr(d.members)) return d;
    if (!isArr(d.rows)) return null;
    var m = meta(d);
    return { members: d.rows, viewer_role: m.viewer_role, viewer_user_id: m.viewer_user_id, viewer_email: m.viewer_email,
             permissions: istObjekt(m.permissions) ? m.permissions : {} };
  }
  function zuEinladungen(d) {
    if (isArr(d)) return { invites: d };
    if (istObjekt(d) && (isArr(d.invites) || isArr(d.rows))) return { count: num(d.count), invites: isArr(d.invites) ? d.invites : d.rows };
    return null;
  }
  function zuProtokoll(d) {
    if (isArr(d)) return { logs: d };
    if (istObjekt(d) && (isArr(d.logs) || isArr(d.rows))) return { logs: isArr(d.logs) ? d.logs : d.rows };
    return null;
  }
  /* Billing: settings-billing liest die Antwort selbst (UC.aboLesen, UC.plaeneLesen) -- hier nur,
     ob es ueberhaupt ein Objekt bzw. eine Liste ist. */
  /* billing_status_v1 (Vertrag 11) liefert {meta, row} flach; settings-billing liest ueber
     UC.aboLesen die Form der bisherigen Funktion ({ok, team_id, billing:{…}}). Hier umgehaengt,
     Feld fuer Feld, damit der Baustein unveraendert bleibt.
     - has_billing: auch ohne Stripe-Abo hat ein Team mit Tarif einen Plan (8 Teams, Vorschlag
       1.4); has_billing false hiesse "No active plan", obwohl der Zugang laeuft.
     - Verwalten nur, wenn das Portal auch aufgeht (can_open_portal): ohne Stripe-Kunden antwortet
       es 404, der Knopf waere ein Versprechen ohne Deckung.
     Die alte Form geht unveraendert durch. */
  function zuAbo(d) {
    if (!istObjekt(d)) return null;
    if (!istObjekt(d.row)) return d;
    var r = d.row, m = meta(d);
    return {
      ok: true, team_id: str(m.team_id), team_name: str(m.team_name),
      billing: {
        billing_plan_id: r.plan_id, plan_name: r.plan_name, billing_interval: r.billing_interval,
        current_price_eur: r.current_price_eur, monthly_price_eur: r.monthly_price_eur, yearly_price_eur: r.yearly_price_eur,
        next_billing_at: r.next_billing_at, canceled_at: r.canceled_at, access_ends_at: r.access_ended_at,
        trial_ends_at: r.trial_ends_at, has_active_access: r.has_active_access,
        can_manage_billing: r.can_manage_billing === true && r.can_open_portal !== false,
        status: r.status, status_label: r.status_label, is_active: r.subscription_live,
        has_billing: !!(r.has_subscription || r.plan_id), cancel_at_period_end: r.cancel_at_period_end,
        current_period_end: r.current_period_end, ended_at: r.ended_at, is_trialing: r.is_trialing, is_past_due: r.is_past_due,
        prompts_per_day: r.prompts_per_day, competitors_max_active: r.competitors_max_active
      }
    };
  }
  function zuTarife(d) { return isArr(d) || (istObjekt(d) && (isArr(d.plans) || isArr(d.rows))) ? (istObjekt(d) && isArr(d.rows) ? { plans: d.rows } : d) : null; }
  /* Nach dem Verlassen oder Loeschen (4.5.6): wohin. */
  function zuAustritt(d) {
    var m = meta(d), x = istObjekt(d) ? (istObjekt(d.row) ? d.row : d) : {};
    var naechstes = str(m.next_team_id || x.next_team_id);
    return { naechstesTeam: UUID.test(naechstes) ? naechstes : "", uebrig: num(m.remaining_teams != null ? m.remaining_teams : x.remaining_teams),
             geloeschtAm: str(m.deleted_at || x.deleted_at), endgueltigAm: str(x.purge_after || m.purge_after) };
  }
  /* WEITERLEITEN NUR ZU STRIPE (Auftrag 4.6): die Adresse kommt aus einer Antwort, und ein
     Weiterleiter, der jedes Ziel nimmt, waere ein offenes Tor fuer Phishing mit unserem Namen. */
  var STRIPE = { portal: /^billing\.stripe\.com$/i, kasse: /^checkout\.stripe\.com$/i };
  function stripeUrl(d, art) {
    /* Portal: portal_url (Vorschlag 3.5), Kasse: url bzw. checkout_url (9.2). */
    var u = istObjekt(d) ? str(d.url || d.portal_url || d.checkout_url || (istObjekt(d.meta) ? d.meta.url : "")) : str(d);
    var x;
    try { x = new URL(u); } catch (e) { return ""; }
    if (x.protocol !== "https:" || x.username || x.password) return "";
    return (STRIPE[art] || /^$/).test(x.hostname) ? x.href : "";
  }

  /* ANTWORT EINER SCHREIBFUNKTION PRUEFEN (11.10., aus den Bubble-Workflows der Team-Orga). Die
     heutigen Funktionen melden Erfolg nicht nur ueber den HTTP-Status: revoke_team_invite und
     resend_team_invite liefern Zeilen mit ok (Bubble prueft "first item's ok"), bei
     set_team_member_role und kick_team_member prueft Bubble nur "count > 0". Wird ein Schritt mit
     der alten Funktion verlinkt, waere eine Zeile {ok:false} hier sonst ein Erfolg -- genau der
     Fehler, den der Bubble-Workflow heute bei Rolle und Entfernen hat. Darum gilt fuer jede
     Schreibantwort: {ok:false} oder [{ok:false}] ist ein Fehlschlag (mit dem Text der Zeile als
     message), eine LEERE Liste ebenso (Bubble: "count is 0"). Alles andere bleibt, wie es war. */
  function antwortPruefen(erg) {
    if (!erg || !erg.ok) return erg;
    var d = erg.daten, z = isArr(d) ? d[0] : d;
    if (isArr(d) && !d.length) return { ok: false, status: erg.status, fehler: { code: "", message: "empty_response", hint: "", details: "" } };
    /* success:false: die Modell-Funktionen (HTTP 200, Vorschlag 3.1) und die Edge Functions. */
    if (istObjekt(z) && (z.ok === false || z.success === false)) {
      /* Der stabile Code zuerst: die Edge Functions schreiben ihn in error, die Modell-Funktionen
         in code (message ist dort ein Satz fuer Bubble). */
      var code = /^[a-z][a-z0-9_]+$/.test(str(z.code)) ? str(z.code) : "";
      var m = str(z.error || code || z.message || z.reason) || "failed";
      if (str(z.error) && str(z.code) && z.code !== z.error) return { ok: false, status: erg.status, fehler: { code: str(z.code), message: str(z.error), hint: str(z.hint), details: "" } };
      return { ok: false, status: erg.status, fehler: { code: str(z.code), message: m, hint: str(z.hint), details: "" } };
    }
    return erg;
  }
  function meldung(erg) { return erg && erg.fehler ? str(erg.fehler.message) : ""; }
  function hinweis(erg) { return erg && erg.fehler ? str(erg.fehler.hint) : ""; }
  function hinweisZahl(erg) { var m = /-?\d+/.exec(hinweis(erg)); return m ? Number(m[0]) : null; }
  function fehlerArt(erg) { return C() && C().fehlerArt ? C().fehlerArt(erg) : "x"; }
  function makeLader(o) { return C().makeLader(o); }

  window.UpstreemSettingsDaten = {
    FN: FN, EDGE: EDGE, LIVE: LIVE, live: live, GRENZE: GRENZE, UUID: UUID,
    seite: seite, marke: marke, mitglieder: mitglieder, einladungen: einladungen, protokoll: protokoll, abo: abo, tarife: tarife,
    markeSpeichern: markeSpeichern, zusammenfassungZuLang: zusammenfassungZuLang, logo: logo, modelle: modelle,
    einladen: einladen, erneut: erneut, zurueckziehen: zurueckziehen, entfernen: entfernen, rolle: rolle,
    verlassen: verlassen, loeschen: loeschen, portal: portal, kasse: kasse,
    mailNorm: mailNorm, mailPruefen: mailPruefen, logoPruefen: logoPruefen,
    zuMeta: zuMeta, zuMarke: zuMarke, zuMitglieder: zuMitglieder, zuEinladungen: zuEinladungen, zuProtokoll: zuProtokoll,
    zuAbo: zuAbo, zuTarife: zuTarife, zuAustritt: zuAustritt, stripeUrl: stripeUrl,
    antwortPruefen: antwortPruefen, meldung: meldung, hinweis: hinweis, hinweisZahl: hinweisZahl, fehlerArt: fehlerArt, makeLader: makeLader
  };
})();
