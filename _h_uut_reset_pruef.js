/* Pruefablauf fuer resetUrlsTable -- laeuft im Pruefstand _h_uut_reset.html, gegen alt UND neu.
   Setzt jeden Filter ueber die echte Oberflaeche, stellt Table Settings und eine Spaltenbreite
   ein, laesst ein Menue offen und eine Sucheingabe in der Warteschleife -- dann der Run-JS-Schritt
   WORTGLEICH aus bubble/runjs/urls_table_reset.js. Ergebnis: window.__resetErgebnis. */
(async function () {
  function w(ms){ return new Promise(function(x){ setTimeout(x, ms); }); }
  var root = document.querySelector(".uut-root");
  var q = function(s){ return document.querySelector(s); };
  var erg = { schritte: [] };
  function notiz(t){ erg.schritte.push(t); }

  /* Daten: 100 Treffer, damit es Seiten gibt. */
  var zeilen = [];
  for (var i = 0; i < 25; i++) zeilen.push({ url: "https://x" + i + ".de/", title: "Seite " + i, domain: "x" + i + ".de",
    favicon: "", global_share_pct: 10 - i * 0.2, share_delta_pct: 0.1, url_type: "article",
    citation_type: "Editorial", has_user_brand: "no", last_seen: "2026-09-10",
    companies_preview: [], companies_preview_totalcount: 0 });
  window.renderUrlsTable({ instanceId: "u1", totalCount: 100, rows: zeilen });
  await w(200);

  /* 1. Suche, fertig gelaufen */
  var ein = root.querySelector(".up-search-input");
  root.querySelector(".up-search-btn").click();
  await w(150);
  ein.value = "acme"; ein.dispatchEvent(new Event("input", { bubbles: true }));
  await w(900);
  notiz("suche: " + JSON.stringify(window.__ev.filter(function(e){ return e[0] === "uutSearch"; }).length) + " uutSearch");

  /* 2. Typen: eine URL-Type- und eine Citation-Type-Auswahl */
  root.querySelector(".up-filter-btn").click(); await w(250);
  q('.up-filter-menu [data-dim="url_type"]').click(); await w(120);
  q('.up-filter-menu .up-filter-item[data-type="guide"]').click(); await w(80);
  q('.up-filter-menu [data-dim="citation_type"]').click(); await w(120);
  q('.up-filter-menu .up-filter-item[data-type="Editorial"]').click(); await w(80);
  q('.up-filter-menu [data-typeapply]').click(); await w(200);

  /* 3. Brand mentioned */
  root.querySelector(".uut-brand-toggle").click(); await w(200);

  /* 4. Mentioned brands */
  root.querySelector(".up-ment-btn").click(); await w(250);
  var mb = q('.up-ment-menu .up-filter-item[data-brand="b2"]'); if (mb) mb.click(); await w(80);
  q(".up-ment-menu [data-mentapply]").click(); await w(200);

  /* 5. Sortierung */
  root.querySelector(".up-sort-btn").click(); await w(200);
  q('.up-sort-menu [data-sortfield="last_seen"]').click(); await w(200);

  /* 6. Zeilen je Seite, dann Seite 3 */
  var ps = root.querySelector('[data-pagesize="50"]'); if (ps) ps.click(); await w(200);
  var s2 = root.querySelector('[data-page="2"]'); if (s2) s2.click(); await w(200);

  /* 7. Table Settings: Spalte "type" aus, Compact an */
  root.querySelector(".up-cols-btn").click(); await w(200);
  var ct = q('.up-cols-menu [data-col="type"]'); if (ct) ct.click(); await w(120);
  var dn = q('.up-cols-menu [data-dense="1"]'); if (dn) dn.click(); await w(120);
  root.querySelector(".up-cols-btn").click(); await w(150);

  /* 8. Spaltenbreite: der URL-Griff 80px nach rechts */
  var grip = root.querySelector(".up-grip");
  if (grip){
    var r = grip.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    grip.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, buttons: 1 }));
    for (var k = 1; k <= 8; k++){
      window.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: x + k * 10, clientY: y, pointerId: 1, buttons: 1 }));
      document.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: x + k * 10, clientY: y, pointerId: 1, buttons: 1 }));
      await w(20);
    }
    window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: x + 80, clientY: y, pointerId: 1 }));
    document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: x + 80, clientY: y, pointerId: 1 }));
    await w(150);
  }

  function lage(){
    var lbl = root.querySelector(".up-filter-btn-lbl");
    var mentLbl = root.querySelector(".up-ment-lbl");
    var sortAktiv = document.querySelector('.up-sort-menu [data-sortfield].is-active');
    var aktivePs = root.querySelector(".up-pagesize-btn.is-active");
    var aktiveSeite = root.querySelector(".up-page.is-active");
    var typTh = root.querySelector(".up-th-type, [data-col-th=\"type\"]");
    return {
      suche: (ein.value || "(leer)") + (root.querySelector(".up-search").classList.contains("is-open") ? " offen" : " zu"),
      typen: lbl ? lbl.textContent : "?",
      marke: root.querySelector(".uut-brand-toggle").classList.contains("is-yes") ? "ja"
           : root.querySelector(".uut-brand-toggle").classList.contains("is-no") ? "nein" : "aus",
      marken: mentLbl ? mentLbl.textContent : "?",
      sortierung: sortAktiv ? sortAktiv.getAttribute("data-sortfield") : "?",
      zeilenJeSeite: aktivePs ? aktivePs.getAttribute("data-pagesize") : "?",
      seite: aktiveSeite ? aktiveSeite.textContent.trim() : "?",
      compact: root.classList.contains("is-dense"),
      breiten: localStorage.getItem("uut_widths__u1") || "(keine)",
      typSpalte: typTh ? getComputedStyle(typTh).display : "?",
      offenesMenue: !!document.querySelector(".up-filter-menu.is-shown, .up-ment-menu.is-shown, .up-sort-menu.is-shown, .up-cols-menu.is-shown")
    };
  }
  erg.vorher = lage();

  /* 9. Ein Menue offen lassen, eine Sucheingabe in der Warteschleife */
  root.querySelector(".up-filter-btn").click(); await w(200);
  ein.value = "acme2"; ein.dispatchEvent(new Event("input", { bubbles: true }));
  erg.vorher.offenesMenueVorReset = !!document.querySelector(".up-filter-menu.is-shown");

  /* 10. DER SCHRITT, wortgleich */
  var evVorher = window.__ev.length;
  (function () {
    try { if (window.resetUrlsTable) window.resetUrlsTable("u1"); } catch (e) {}
  })();
  await w(1200);   /* laenger als die Such-Entprellung */
  erg.nachher = lage();
  erg.ereignisseNachReset = window.__ev.slice(evVorher).map(function(e){ return e[0]; });
  erg.fehler = window.__fehler.slice();
  window.__resetErgebnis = erg;
})();
