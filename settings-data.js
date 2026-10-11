/* upstreem settings-data.js -- der Datenteil der Seite Settings (11.10.), OHNE DOM.

   WARUM EIN EIGENER TEIL: wie brands-data.js. Was hier steht, kennt weder Elemente noch Bubble --
   nur die Funktionen, ihre Parameter und die Form, in der die eingebetteten Bausteine
   (settings-brand, team-orga, settings-billing) ihre Daten lesen.

   VERTRAGSSTAND (11.10.): VORSCHLAG. Die Namen unten sind die aus dem Auftrag an den DB-Chat
   (bubble/settings_db_auftrag.md, Abschnitt 6). Verlinkt wird SCHRITT FUER SCHRITT (Abschnitt 7):
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
    einladen: "team_invite_create_v1",
    erneut: "team_invite_resend_v1",
    zurueckziehen: "team_invite_revoke_v1",
    entfernen: "team_member_remove_v1",
    rolle: "team_member_role_v1",
    verlassen: "team_leave_v1",
    loeschen: "team_delete_v1"
  };
  /* Edge Functions. Eine Kasse gibt es heute nicht: die Tarifwahl oeffnet in Bubble dasselbe Portal
     wie "Manage Billing" (Nachtrag 1, 4). Leer heisst: die Seite geht denselben Weg. */
  var EDGE = { versand: "send-team-invite", portal: "create-billing-portal-session", kasse: "" };

  /* DER SCHALTER JE FUNKTION. Alles aus, bis der Vertrag fuer den jeweiligen Schritt steht und die
     echten Antworten geprueft sind (Auftrag 7: erst Lesen, dann Your Brand, Einladungen,
     Mitglieder, Billing, zuletzt Verlassen und Loeschen). */
  var LIVE = {
    meta: false, marke: false, mitglieder: false, einladungen: false, protokoll: false, abo: false, tarife: false,
    markeSpeichern: false, logo: false, modelle: false,
    einladen: false, versand: false, erneut: false, zurueckziehen: false,
    entfernen: false, rolle: false,
    portal: false, kasse: false,
    verlassen: false, loeschen: false
  };
  function live(art) { return LIVE[art] === true && !!(FN[art] || EDGE[art]); }

  /* Grenzen, die die Oberflaeche VORAB einhaelt, damit der Nutzer seinen Fehler sofort sieht. Die
     Werte sind der Vorschlag des Auftrags (4.2, 4.4); die DB bestimmt sie endgueltig. */
  var GRENZE = { mail: 254, branche: 48, zusammenfassung: 1000, logo: 2048, protokoll: 100 };
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
  function einladungen(team) { return anfrage("einladungen", p(team)); }
  function protokoll(team) { var q = p(team); q.p_limit = GRENZE.protokoll; q.p_before = null; return anfrage("protokoll", q); }
  function abo(team) { return anfrage("abo", p(team)); }
  function tarife() { return anfrage("tarife", {}); }

  /* ---- Schreiben ---------------------------------------------------------------------------- */
  function markeSpeichern(team, w) {
    w = w || {};
    var gm = str(w.business_model).toLowerCase();
    return anfrage("markeSpeichern", {
      p_team: str(team),
      p_market_id: str(w.market_id).trim().toLowerCase() || null,
      p_business_model: GESCHAEFT.indexOf(gm) >= 0 ? gm : null,
      p_industry: str(w.industry).trim().slice(0, GRENZE.branche) || null,
      /* Die Zusammenfassung NICHT still kuerzen: die Seite lehnt zu lange vorher mit einem Satz ab
         (zusammenfassungZuLang). Gekuerzt gesendet waere gespeichert, was niemand geschrieben hat. */
      p_summary: str(w.summary)
    });
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
  function einladen(team, mail, rolle) {
    rolle = str(rolle).toLowerCase();
    return anfrage("einladen", { p_team: str(team), p_email: mailNorm(mail), p_role: ROLLEN_EINLADEN.indexOf(rolle) >= 0 ? rolle : "member" });
  }
  function erneut(team, id) { return anfrage("erneut", { p_team: str(team), p_invite_id: str(id) }); }
  function zurueckziehen(team, id) { return anfrage("zurueckziehen", { p_team: str(team), p_invite_id: str(id) }); }
  function entfernen(team, uid) { return anfrage("entfernen", { p_team: str(team), p_user_id: str(uid) }); }
  function rolle(team, uid, r) {
    r = str(r).toLowerCase();
    return anfrage("rolle", { p_team: str(team), p_user_id: str(uid), p_role: ROLLEN.indexOf(r) >= 0 ? r : "" });
  }
  function verlassen(team, name) { return anfrage("verlassen", { p_team: str(team), p_confirm_name: str(name) }); }
  function loeschen(team, name) { return anfrage("loeschen", { p_team: str(team), p_confirm_name: str(name) }); }
  /* Edge: nur Kennungen, nie Adresse, Preis oder Text (Auftrag 4.4.1, 4.6.2). */
  function versand(team, id) { return { name: EDGE.versand, body: { team_id: str(team), invite_id: str(id) } }; }
  function portal(team) { return { name: EDGE.portal, body: { team_id: str(team) } }; }
  function kasse(team, plan, takt) {
    takt = str(takt).toLowerCase();
    return { name: EDGE.kasse, body: { team_id: str(team), plan_id: str(plan), billing_interval: takt === "year" || takt === "yearly" ? "year" : "month" } };
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
  function zuMeta(d) {
    if (!istObjekt(d)) return null;
    var m = meta(d), team = istObjekt(d.team) ? d.team : (istObjekt(m.team) ? m.team : {});
    var r = istObjekt(d.permissions) ? d.permissions : (istObjekt(m.permissions) ? m.permissions : {});
    var rolle = str(m.role || d.role).toLowerCase();
    if (ROLLEN.indexOf(rolle) < 0) return null;
    return {
      rolle: rolle,
      teamId: str(team.id || m.team_id),
      teamName: str(team.name || m.team_name),
      rechte: {
        marke: recht(r.can_edit_brand), modelle: recht(r.can_manage_models),
        einladen: recht(r.can_invite), mitglieder: recht(r.can_manage_members),
        billing: recht(r.can_manage_billing), verlassen: recht(r.can_leave), loeschen: recht(r.can_delete)
      },
      mitgliederZahl: num(m.member_count), einladungenZahl: num(m.pending_invites_count),
      zugang: str(m.access_state)
    };
  }
  /* Your Brand (6.1): die Form, die renderSettingsBrand liest. Der Teamname kommt aus der Meta. */
  function absolut(u) { u = str(u).trim(); if (/^\/\//.test(u)) u = "https:" + u; return /^https:\/\//i.test(u) ? u : ""; }
  function zuMarke(d, m) {
    if (!istObjekt(d)) return null;
    var b = istObjekt(d.brand) ? d.brand : {};
    if (!isArr(d.models)) return null;
    var lim = istObjekt(d.limits) ? d.limits : {};
    var out = {
      brand: { name: str(b.name), logo: absolut(b.logo_url) },
      company_id: UUID.test(str(b.company_id)) ? str(b.company_id) : "",
      models: d.models.filter(istObjekt),
      model_limit: num(lim.models_max),
      market: str(d.market_id).toLowerCase(),
      business_model: GESCHAEFT.indexOf(str(d.business_model).toLowerCase()) >= 0 ? str(d.business_model).toLowerCase() : "",
      industry: str(d.industry),
      summary: str(d.summary)
    };
    if (m) { out.team = { id: m.teamId, name: m.teamName }; out.user_role = m.rolle; }
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
  function zuMitglieder(d) { return istObjekt(d) && isArr(d.members) ? d : null; }
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
  function zuAbo(d) { return istObjekt(d) ? d : null; }
  function zuTarife(d) { return isArr(d) || (istObjekt(d) && (isArr(d.plans) || isArr(d.rows))) ? (istObjekt(d) && isArr(d.rows) ? { plans: d.rows } : d) : null; }
  /* Nach dem Verlassen oder Loeschen (4.5.6): wohin. */
  function zuAustritt(d) {
    var m = meta(d), x = istObjekt(d) ? d : {};
    var naechstes = str(m.next_team_id || x.next_team_id);
    return { naechstesTeam: UUID.test(naechstes) ? naechstes : "", uebrig: num(m.remaining_teams != null ? m.remaining_teams : x.remaining_teams),
             geloeschtAm: str(m.deleted_at || x.deleted_at) };
  }
  /* WEITERLEITEN NUR ZU STRIPE (Auftrag 4.6): die Adresse kommt aus einer Antwort, und ein
     Weiterleiter, der jedes Ziel nimmt, waere ein offenes Tor fuer Phishing mit unserem Namen. */
  var STRIPE = { portal: /^billing\.stripe\.com$/i, kasse: /^checkout\.stripe\.com$/i };
  function stripeUrl(d, art) {
    var u = istObjekt(d) ? str(d.url || (istObjekt(d.meta) ? d.meta.url : "")) : str(d);
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
    if (istObjekt(z) && z.ok === false) {
      var m = str(z.error || z.message || z.reason || z.code) || "failed";
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
    verlassen: verlassen, loeschen: loeschen, versand: versand, portal: portal, kasse: kasse,
    mailNorm: mailNorm, mailPruefen: mailPruefen, logoPruefen: logoPruefen,
    zuMeta: zuMeta, zuMarke: zuMarke, zuMitglieder: zuMitglieder, zuEinladungen: zuEinladungen, zuProtokoll: zuProtokoll,
    zuAbo: zuAbo, zuTarife: zuTarife, zuAustritt: zuAustritt, stripeUrl: stripeUrl,
    antwortPruefen: antwortPruefen, meldung: meldung, hinweis: hinweis, hinweisZahl: hinweisZahl, fehlerArt: fehlerArt, makeLader: makeLader
  };
})();
