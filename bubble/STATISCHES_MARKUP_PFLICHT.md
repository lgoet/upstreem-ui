# Komponenten-Markup MUSS statisch sein (Animations-Killer Nr. 1)

## Das Problem

Bubble behandelt ein HTML-Element, dessen Inhalt **dynamische Ausdrücke** enthält, als eine einzige
reaktive Einheit. Ändert sich *irgendeiner* dieser Ausdrücke, baut Bubble den kompletten HTML-String
neu und schreibt ihn per `$.fn.html()` ins DOM. Damit wird die Komponente **komplett abgerissen und
neu aufgebaut** — Charts, Tabellen, Event-Handler, alles.

Gemessen auf der echten Seite beim Öffnen/Schließen eines Drawers:

    Long Tasks: 209ms, 212ms, 289ms, 320ms   ← Main-Thread blockiert
    Frames:     6 statt 24                    ← Animation fällt praktisch aus

Die Long Tasks liegen laut Stacktrace vollständig in Bubbles eigenem Code (`run.js`:
`freeze_workflows_sync`, `find_element_references`, `evaluate_property`) und `$.fn.html` —
NICHT in unserem. Zum Vergleich, dieselben Operationen lokal gemessen: Markup einfügen 2ms,
Initialisierung 0 Long Tasks, `reset()` 8ms. Unser Code ist nicht das Problem, aber unser
Markup ist der Auslöser, weil es groß ist und dynamische Attribute trägt.

Der Grund, warum es exakt bei Drawer-/View-Wechseln auftritt: `data-processing` kippt bei **jedem**
Ladevorgang von "no" auf "yes" und zurück. Also zweimal pro Öffnen, zweimal pro Schließen —
mitten in der Animation.

## Die Regel

**Im Markup eines Komponenten-HTML-Elements darf KEIN dynamischer Bubble-Ausdruck stehen, der sich
zur Laufzeit ändert.** Alles Veränderliche läuft über die JS-Funktionen.

| Attribut | vorher (dynamisch) | jetzt |
|---|---|---|
| `data-processing` / `data-processing2` | Bubble-Ausdruck | **weglassen** → `set<Komponente>Loading(id, "yes"/"no")` |
| `data-isdark` | Bubble-Ausdruck | fest `"no"` → `upstreemSetTheme("yes"/"no")` |
| `data-cdn-pin` | Bubble-Konstante | Hash fest eintippen |
| `data-instance` | `"ROOTID_[dynamic id]"` | feste, pro Platzierung eindeutige Zeichenkette |
| `data-brand-name` / `data-brand-logo` | Bubble-Ausdruck | im `render…({ brand: … })`-Aufruf mitschicken |

Das Weglassen von `data-processing` ist sicher: fehlt das Attribut, liest der Code `false` und der
Ladezustand kommt ausschließlich aus `set…Loading()` (das setzt intern ein Explicit-Flag, welches
den Attribut-Pfad ohnehin dauerhaft deaktiviert, sobald es einmal gerufen wurde).

## upstreemSetTheme

    window.upstreemSetTheme("yes");   // dark
    window.upstreemSetTheme("no");    // light

Setzt `data-isdark` auf **allen** `.up-root`-Elementen der Seite per JS. Jede Komponente hat bereits
einen MutationObserver auf genau dieses Attribut und zieht von selbst nach — Bubble bekommt davon
nichts mit und rendert folglich nichts neu. In einem "Wenn Theme wechselt"-Workflow als Run-JS
aufrufen, statt `data-isdark` an einen Bubble-Ausdruck zu hängen.

## Gegenprobe

Nach der Umstellung mit `bubble/_diagnose_drawer_console.js` messen. Ziel:

    Frames: ~24, verzoegert: 0-1, Long Tasks: keine
