# An den Datenbank-Chat: Nachtrag 1 zu Brands v1 und Dashboard, 11.10.2026

Zwei Befunde aus dem Live-Betrieb. Bitte je Punkt: Ursache (mit Abfrage oder Definitionsstelle),
Fix mit Vorher/Nachher, Rückweg.

---

## 1. Discover: Visibility viel zu niedrig, solange Tage fehlen (hoch)

**Beobachtet** (Team `eee8727a` Allianz, kurz nach dem Einspielen, `cached_discover_brands_v1`,
Matched `yes`, sonst keine Filter):

| Zeitraum | `missing_days` | `total_responses` | CHECK24 `mentioned_runs` | CHECK24 `visibility_pct` |
|---|---|---|---|---|
| 2026-07-11 bis 2026-10-11 (93 Tage) | 87 | 14.078 | 119 | **0,85** |
| 2026-09-12 bis 2026-10-11 (30 Tage) | 24 | 4.423 | 119 | **2,69** |

Die Erwähnungen sind in **beiden** Zeiträumen gleich: Sie kommen nur aus den wenigen schon
gerechneten Tagen. Der Nenner (`total_responses` bzw. `runs_total` je Zeile) zählt aber **alle**
Läufe des Zeitraums, auch die der noch fehlenden Tage. Damit wird jede Visibility umso kleiner, je
länger der Zeitraum und je mehr Tage fehlen. Im Bild: bei langen Zeiträumen steht alles bei 0–1 %.

**Bitte:**

1. **Zähler und Nenner aus denselben Tagen.** `runs_total` und `total_responses` nur über die Tage
   zählen, die in der Tagesverdichtung schon stehen (dieselbe Tagesmenge wie die Erwähnungen).
   Dann stimmt die Visibility schon während des Nachrechnens, nur auf weniger Tagen.
2. **Nachrechnen prüfen.** Abschnitt 11.5 sagt: die letzten 30 Tage aller Teams nach etwa 15
   Minuten. Hier fehlten um 11:15 Uhr (`data_as_of` 11:10) bei Allianz noch 24 der letzten 30 Tage.
   Läuft der Job? Wie weit ist er je Team, und wann ist er fertig? Bitte eine Abfrage mit dem Stand
   je Team schicken.
3. **`meta.missing_days`** bleibt wichtig. Die Oberfläche zeigt dann schon „Some days are still
   being prepared.“ Mit Punkt 1 stimmen die Zahlen in der Zwischenzeit trotzdem.

Danach bitte für Allianz und 877c dieselben zwei Aufrufe (30 und 93 Tage) einmal vorher und
nachher, dazu `missing_days`.

## 2. Dashboard: gelegentlich XX000 „cannot find parent statement on pldbgapi2 call stack“ (mittel)

**Beobachtet:** ab und zu bei einer Dashboard-Funktion (welche genau, bitte aus den Logs; die
Oberfläche sieht nur die Antwort):

```json
{"code": "XX000", "details": null, "hint": null,
 "message": "cannot find parent statement on pldbgapi2 call stack"}
```

`pldbgapi2` ist die Schnittstelle des PL/pgSQL-Debuggers (`plugin_debugger` / Erweiterung
`pldbgapi`). Der Fehler kommt nicht aus unseren Funktionen, sondern aus dem Debugger-Haken, der um
jede PL/pgSQL-Ausführung liegt.

**Bitte:**

1. `show shared_preload_libraries;`, `select * from pg_extension where extname ilike 'pldbg%';`
   und ob gerade eine Debug-Sitzung offen ist.
2. Aus den Logs: Welche Funktionen, wie oft pro Tag, seit wann? Hängt es an einer bestimmten
   (z. B. mit verschachtelten Aufrufen oder Ausnahmeblöcken) oder an Last?
3. Fix: Wird die Erweiterung nicht gebraucht, entfernen. Lädt die Plattform `plugin_debugger` selbst
   vor, bitte sagen, wie man es abschaltet (Einstellung oder Supabase-Support).

**Oberfläche:** Der Lader wiederholt XX000 schon heute zweimal (nach 0,8 s und 2 s). Im Netzwerk
sieht man den Fehlversuch, meist kommt danach die Antwort. Scheitern alle drei Versuche, zeigt die
Seite den Lesefehler des Bausteins. Ändern muss sich dort nichts. Gelöst gehört es in der
Datenbank.
