/* WARUM LAEDT DAS DASHBOARD NICHTS? -- in die Konsole kleben, upDiagDashboard() aufrufen.
   Beantwortet die Kette vom gespeicherten Modus bis zum Bubble-Workflow, Glied fuer Glied. Jede
   Zeile sagt, was zu tun ist, wenn sie rot ist. Nichts wird geaendert, nur nachgesehen. */
window.upDiagDashboard = function () {
  var UC = window.UpstreemCore;
  var aus = [];
  function z(ok, was, hinweis){ aus.push({ ok: ok ? "ja" : "NEIN", was: was, hinweis: ok ? "" : (hinweis || "") }); }

  /* 1. Ist das Kit ueberhaupt da, und welches? */
  z(!!UC, "core.js geladen", "Ohne core laeuft keine Komponente. Header-Snippet pruefen.");
  aus.push({ ok: "-", was: "Pin", hinweis: String(window.__upPin || "(kein __upPin -- altes Header-Snippet)") });
  z(!!(UC && UC.getDashboardMode), "core kennt getDashboardMode",
    "Dieses core ist zu alt fuer den Modusumschalter. Pin am Header-Snippet und an den Elementen angleichen.");
  z(!!(UC && UC.makeFire && (function(){ try { return typeof UC.makeFire(document.body, {}).spaet === "function"; } catch(e){ return false; } })()),
    "core kennt fire.spaet (Meldung wartet auf ihren Empfaenger)",
    "Aelteres core: eine Meldung, deren Toolbox-Element noch fehlt, verpufft ersatzlos.");

  /* 2. Der gespeicherte Modus. */
  var gespeichert = null;
  try { gespeichert = window.localStorage.getItem("up_dashboard"); } catch(e){}
  aus.push({ ok: "-", was: "localStorage up_dashboard", hinweis: String(gespeichert) });
  aus.push({ ok: "-", was: "getDashboardMode()", hinweis: UC && UC.getDashboardMode ? UC.getDashboardMode() : "(n/a)" });
  aus.push({ ok: "-", was: "html[data-up-dashboard]", hinweis: String(document.documentElement.getAttribute("data-up-dashboard")) });

  /* 3. Der Seitenkopf und sein Umschalter. */
  var kopf = document.querySelector(".dph-root");
  z(!!kopf, "Seitenkopf (.dph-root) im DOM", "Das Element steht nicht auf der Seite oder heisst anders.");
  if (kopf){
    aus.push({ ok: "-", was: "data-instance des Kopfs", hinweis: String(kopf.getAttribute("data-instance")) });
    aus.push({ ok: "-", was: "data-mode-fn des Kopfs", hinweis: String(kopf.getAttribute("data-mode-fn")) });
    z(!!kopf.querySelector(".dph-topright"), "Kopf hat .dph-topright",
      "Ohne diesen Platz legt die Komponente den Umschalter nicht an -- und ohne Umschalter geht KEINE Modusmeldung raus.");
    z(!!kopf.querySelector(".dph-mode"), "Umschalter Standard/Power im DOM",
      "Der Umschalter fehlt. Genau dann bleibt die Modusmeldung beim Seitenaufbau aus.");
    z(!!kopf.__dphController || kopf.className.indexOf("dph-root") >= 0, "Kopf gemountet", "");
  }

  /* 4. Der Empfaenger in Bubble -- in allen erreichbaren Fenstern. */
  function wo(name){
    var orte = [], f = [["window", window]];
    try { if (window.parent && window.parent !== window) f.push(["parent", window.parent]); } catch(e){}
    try { if (window.top && window.top !== window) f.push(["top", window.top]); } catch(e){}
    f.forEach(function(pair){ try { if (typeof pair[1][name] === "function") orte.push(pair[0]); } catch(e){} });
    return orte.length ? orte.join(", ") : "";
  }
  var modeFn = (kopf && kopf.getAttribute("data-mode-fn")) || "bubble_fn_dphMode";
  z(!!wo(modeFn), "Toolbox-Element " + modeFn + " vorhanden",
    'Lege im Seitenkopf-Reusable ein "JavaScript to Bubble" mit genau diesem Function name an, "Trigger event" angehakt.');
  aus.push({ ok: "-", was: "gefunden in", hinweis: wo(modeFn) || "(nirgends)" });

  /* 5. Das Power-Dashboard. */
  var upw = document.querySelector(".upw-root");
  z(!!upw, "Power-Dashboard (.upw-root) im DOM", "Das Element steht nicht auf der Seite.");
  if (upw){
    aus.push({ ok: "-", was: "data-instance des Dashboards", hinweis: String(upw.getAttribute("data-instance")) });
    z(!!upw.querySelector(".upw-col"), "Dashboard gemountet (Markup gebaut)", "core hat es noch nicht initialisiert.");
    z(upw.getClientRects().length > 0, "Dashboard wird gezeichnet",
      "Es steht in einer versteckten Gruppe. Solange meldet es absichtlich KEINEN Datenbedarf.");
    var needsFn = upw.getAttribute("data-needs-fn") || "bubble_fn_upwNeeds";
    aus.push({ ok: "-", was: "data-needs-fn", hinweis: String(upw.getAttribute("data-needs-fn")) });
    z(!!wo(needsFn), "Toolbox-Element " + needsFn + " vorhanden",
      "Ohne Empfaenger kann kein Abschnitt nachgeladen werden.");
  }

  console.table(aus);
  console.log("%cNaechster Schritt: upstreemTrace(true) und die Seite NEU LADEN.", "font-weight:bold");
  console.log("Der Schalter bleibt jetzt ueber den Reload an. Danach steht fuer JEDES Ereignis in " +
              "der Konsole, was rausging und ob es einen Empfaenger gefunden hat. upstreemTrace(false) schaltet ihn aus.");
  return aus;
};
