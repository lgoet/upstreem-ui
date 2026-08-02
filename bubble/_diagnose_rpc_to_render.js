/* UPSTREEM — RPC-zu-Render-Diagnose. In die Konsole der ECHTEN Seite einfuegen, dann normal
   navigieren/laden. Beantwortet die konkrete Frage: die Daten sind laut Netzwerk-Tab da — WO
   geht die Zeit bis die Komponente sie zeigt wirklich hin?

   Zwei grundverschiedene Ursachen sehen fuer den Nutzer gleich aus ("es dauert"), sind aber
   komplett unterschiedliche Baustellen:

     Luecke zwischen 🌐 (Netzwerk fertig) und dem naechsten JS-Aufruf
       -> Bubble wertet die Antwort noch aus (Text-Ausdruck bauen, Workflow-Schritt einreihen).
          Das ist NICHT unser Code — der wird erst aktiv, wenn window.setXLoading()/renderX()
          tatsaechlich aufgerufen wird. Fix gehoert auf die Bubble-Seite (siehe STYLEGUIDE §45:
          Set-Loading als ersten Schritt, Payload verkleinern, unnoetige Felder/Schritte raus).

     Luecke zwischen unserem JS-Aufruf und dem naechsten
       -> das koennte tatsaechlich unser Code sein. Jeder eigene Aufruf zeigt seine eigene
          Sync-Dauer (⏱); ist die klein, aber die Luecke DAHINTER trotzdem gross, ist es wieder
          Bubble (der naechste Workflow-Schritt kommt erst spaeter).

   Automatischer Report ~1.5s nach jedem Set-Loading/Render-Aufruf — einfach normal die Seite
   benutzen, dann in der Konsole schauen. window.rpcCheck() dumpt die Zeitleiste auch manuell. */
(function(){
  if (window.__upRpcDiag){ console.log('[rpc-diag] laeuft bereits'); return; }
  window.__upRpcDiag = true;

  var t0 = performance.now();
  function now(){ return Math.round(performance.now() - t0); }
  var LOG = [];
  function log(kind, label){
    LOG.push({ t: now(), kind: kind, label: label });
    if (LOG.length > 500) LOG.shift();
  }
  function shortUrl(u){ u = String(u == null ? '' : u); return u.length > 70 ? u.slice(0, 70) + '…' : u; }

  /* ---- Netzwerk: fetch + XHR, beides patchen — Bubble nutzt je nach Aufrufart unterschiedliches.
     Laeuft nur im Frame, in dem dieses Snippet eingefuegt wurde; macht ein Reusable seinen
     RPC-Call aus einem eigenen iframe heraus, muss die Konsole auf DIESEN Frame umgeschaltet
     werden (Chrome DevTools: Kontext-Dropdown oben in der Konsole). */
  var origFetch = window.fetch;
  if (origFetch){
    window.fetch = function(){
      var url = (arguments[0] && arguments[0].url) ? arguments[0].url : arguments[0];
      var s = performance.now();
      return origFetch.apply(this, arguments).then(function(res){
        log('net', 'fetch ' + shortUrl(url) + '  (' + Math.round(performance.now() - s) + 'ms)');
        return res;
      }, function(err){
        log('net-err', 'fetch ' + shortUrl(url) + '  FEHLER');
        throw err;
      });
    };
  }
  var OrigXHR = window.XMLHttpRequest;
  if (OrigXHR){
    var origOpen = OrigXHR.prototype.open, origSend = OrigXHR.prototype.send;
    OrigXHR.prototype.open = function(method, url){
      this.__diagUrl = url; this.__diagStart = performance.now();
      return origOpen.apply(this, arguments);
    };
    OrigXHR.prototype.send = function(){
      var xhr = this;
      xhr.addEventListener('loadend', function(){
        log(xhr.status >= 400 ? 'net-err' : 'net',
          'xhr ' + shortUrl(xhr.__diagUrl) + '  (' + Math.round(performance.now() - xhr.__diagStart) + 'ms)'
          + (xhr.status ? '  [' + xhr.status + ']' : ''));
      });
      return origSend.apply(this, arguments);
    };
  }

  /* ---- unsere eigenen render/setLoading-Funktionen, mit eigener Sync-Dauer ---- */
  var WATCH = [
    'renderPromptsTable', 'setPromptsTableLoading', 'resetPromptsTable', 'setPromptsTableTopics',
    'renderUrlsTable', 'setUrlsTableLoading', 'resetUrlsTable',
    'renderDomainsTable', 'setDomainsTableLoading', 'resetDomainsTable',
    'renderVisibilityChart', 'setVisibilityChartLoading', 'resetVisibilityChart',
    'renderTopCitations', 'setTopCitationsLoading', 'resetTopCitations',
    'renderComboChart', 'setComboChartLoading', 'resetComboChart',
    'renderTopicsManager', 'setTopicsManagerLoading', 'resetTopicsManager'
  ];
  var reportTimer = null;
  WATCH.forEach(function(n){
    var orig = window[n];
    if (typeof orig !== 'function') return;
    window[n] = function(){
      var s = performance.now();
      var res = orig.apply(this, arguments);
      var d = Math.round(performance.now() - s);
      var extra = /Loading$/.test(n) ? ' -> "' + arguments[1] + '"' : '';
      log('js', n + '()' + extra + (d >= 2 ? '   ⏱ ' + d + 'ms synchron' : ''));
      if (/Loading$/.test(n) || /^render/.test(n)){
        clearTimeout(reportTimer);
        reportTimer = setTimeout(report, 1500);
      }
      return res;
    };
  });

  function report(){
    var recent = LOG.slice(-40);
    console.log('%c[rpc-diag] Netzwerk vs. unsere JS-Aufrufe — letzte Aktivitaet',
      'color:#fff;background:#1b6eda;padding:2px 6px;border-radius:3px');
    if (!recent.length){ console.log('   (noch nichts aufgezeichnet)'); return; }
    var lastNet = null;
    recent.forEach(function(e){
      var tag = e.kind === 'net' ? '🌐' : e.kind === 'net-err' ? '⚠️' : '·';
      var gapNote = '';
      if (e.kind === 'js' && lastNet != null && (e.t - lastNet) >= 300){
        gapNote = '   ← ' + (e.t - lastNet) + 'ms nach dem letzten 🌐, VOR unserem Aufruf (Bubble wertet noch aus)';
      }
      if (e.kind === 'net' || e.kind === 'net-err') lastNet = e.t;
      console.log('   +' + e.t + 'ms  ' + tag + '  ' + e.label + gapNote);
    });
    console.log('%c   "← ... Bubble wertet noch aus" markiert genau die Luecke, um die es hier geht: '
      + 'die Antwort war da, aber window.setXLoading()/renderX() wurde noch nicht aufgerufen.',
      'color:#666');
  }

  window.rpcCheck = report;
  console.log('%c[rpc-diag] aktiv — normal navigieren/laden. Nach jedem Set-Loading/Render-Aufruf kommt '
    + 'automatisch ~1.5s spaeter ein Report. Manuell: rpcCheck()',
    'color:#fff;background:#1b6eda;padding:2px 6px;border-radius:3px');
})();
