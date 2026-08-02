# Diagnose-Snippets

Kein CDN-Ausgeliefertes — diese Dateien kommen nie in ein Bubble-Element. Sie sind zum manuellen
Einfügen in die Browser-Konsole der echten Seite gedacht, wenn ein Performance- oder
Timing-Verdacht konkret nachgewiesen werden muss, statt geraten zu werden (siehe
`STYLEGUIDE.md` §§41–45 — mehrfach war die erste Erklärung falsch, erst die Messung hat die
echte Ursache gezeigt).

Alle vier bleiben hier liegen, weil sie bei künftigen Perf-Fragen direkt wiederverwendbar sind —
nicht löschen, nur bei Bedarf einfügen.

| Datei | Misst | Status |
|---|---|---|
| `_diagnose_drawer_console.js` | Frames/Long-Tasks/Render-Aufrufe während eines Drawer-Open/Close | Untersuchung abgeschlossen (STYLEGUIDE §44) — Ursache war Bubble-Workflow-Arbeit im Animationsfenster, Fix ist eine "Add a pause"-Stufe im Workflow |
| `_diagnose_view_console.js` | Zeitleiste eines View-Wechsels: wann wird sichtbar, wieviel Main-Thread blockiert, wann laufen unsere Render-Aufrufe | Untersuchung abgeschlossen (STYLEGUIDE §45) — unsere Komponenten kosten ~5% der blockierten Zeit, Rest ist Bubble |
| `_diagnose_chart_console.js` | Wie oft ein Chart.js-Chart innerhalb eines Einblend-Fensters neu gebaut wird, plus Long Tasks daneben | Fix in `core.js`s `makeLine.render()` (Signatur-Vergleich verhindert Doppel-Build) gelandet; Snippet bereithalten falls die Einblend-Animation nochmal ruckelt |
| `_diagnose_rpc_to_render.js` | Lücke zwischen einer Netzwerk-Antwort (fetch/XHR) und dem nächsten `setXLoading()`/`renderX()`-Aufruf | Offen — ein Einzelfall wurde beobachtet (Prompts-Table, ~557ms zwischen Daten-da und Loading=no, augenscheinlich hinter einer zweiten, unabhängigen RPC), scheint aber eine Ausnahme gewesen zu sein, kein systemisches Muster. Tool bereithalten, falls es wieder auftritt. |

## Benutzung

In die Konsole der ECHTEN Seite einfügen (nicht in einem lokalen Harness — die eigentlichen
Ursachen bisher waren alle nur gegen echtes Bubble + jsDelivr sichtbar, siehe §41–44), dann normal
navigieren/interagieren. Jedes Snippet druckt selbst, wie es zu benutzen ist, sobald es aktiv ist.
