# Antwort des DB-Chats auf Nachtrag 1 (11.10.2026), Kurzfassung für das Repo

Volltext beim Nutzer (Datei-Ausgabe des DB-Chats). Hier, was für die Oberfläche zählt.

## 1. Discover: Visibility zu niedrig, solange Tage fehlen

- **Ursache A (bestätigt):** Zähler aus `discover_brand_day` (nur gerechnete Tage), Nenner aus
  `daily_runs_by_prompt_model` über den ganzen Zeitraum.
- **Ursache B (bestätigt):** `statement_timeout = 12s` auf der Datenbank brach jeden Lauf des
  Cron-Jobs nach 12 s ab (statt 60 s je 5 Minuten). Dazu scheiterten 4 Tage am `pldbgapi2`-Fehler und
  wären nie wieder versucht worden. Dieselbe Grenze traf `brand-purge-worker` und
  `prompt-purge-worker` (langsamer, aber nichts verloren).
- **Fix `brands_v1_fix_1.sql`** (mit Rückweg, in Prod im Rollback geprüft):
  1. neue Tabelle `app.discover_brand_runs_day` (Läufe je Team, Tag, Prompt, Model), geschrieben im
     selben Moment wie die Erwähnungen;
  2. `cached_discover_brands_v1` zählt Erwähnungen, Domains, Namen **und Läufe** nur über die Tage,
     die dort stehen; `today_included` und `missing_days` nach denselben Tagen. **Antwortform
     unverändert.**
  3. `brand-discover-rollup` alle 30 s mit 9 s Budget; Fehltage nach 15 Minuten neu versucht;
     Lösch-Jobs mit 7 s Budget.
- **Vorher → nachher** (Matched yes, keine Filter): Allianz 30 und 93 Tage 7,49 % bzw. 2,36 % →
  beide **17,32 %**; 877c 3,97 % bzw. 1,33 % → beide **8,51 %**. Die Visibility hängt nicht mehr an
  der Länge des Zeitraums.
- **Fertig:** letzte 30 Tage aller Teams etwa 5–10 Minuten nach dem Einspielen, alle 366 Tage etwa
  1–1,5 Stunden. Stand jederzeit mit `brands_discover_stand.sql`.
- Kontrollausgabe nach dem Einspielen: md5 `_br_discover_day_v1` = `bd35445c…`,
  `_br_discover_worker_v1` = `c6e7cd7c…`, `cached_discover_brands_v1` = `efff90a6…`;
  `brand-discover-rollup` = `30 seconds | call app._br_discover_worker_v1(9000)`, Lösch-Jobs `(7000)`.

## 2. XX000 „cannot find parent statement on pldbgapi2 call stack“

- `pldbgapi2` gehört zu **plpgsql_check**, das Supabase per `shared_preload_libraries` vorlädt (die
  Erweiterung ist nicht angelegt, wir nutzen sie nicht). Kein Debugger, keine offene Sitzung.
- Seit 08.10., 2–4 Fälle am Tag, verteilt. Ist der Aufrufstapel in einem Datenbank-Prozess einmal
  gestört, scheitert dort der nächste PL/pgSQL-Aufruf wieder. Wahrscheinlicher Auslöser: abgefangene
  Fehler in `exception when others`-Blöcken alter Funktionen (Vermutung, aus den Logs nicht
  nachweisbar).
- **In der Datenbank nicht abstellbar.** Lösung über den Supabase-Support: plpgsql_check aus
  `shared_preload_libraries` nehmen oder aktualisieren (Tickettext im Volltext).
- **Oberfläche:** unverändert. Der Lader wiederholt XX000 zweimal (0,8 s, 2 s), die Schreibwege der
  Seiten einmal. Die zweite Antwort kommt meist aus einem anderen Prozess.
