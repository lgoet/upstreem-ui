# Auftrag an den Datenbank-Chat: Brands als Seiten-Komponente (Stand 11.10.2026)

Diesen ganzen Text als erste Nachricht in den Datenbank-Chat geben. Er ist in sich vollständig:
der Datenbank-Chat hat das Frontend-Repo nicht.

**Diese Runde ist eine BESTANDSAUFNAHME mit FEHLERSUCHE, MISSBRAUCHSPRÜFUNG und VORSCHLAG. Du
änderst nichts.** Gebaut wird erst, wenn der Vertrag abgestimmt ist. Vorbilder sind die fertigen
Verträge Citations v1, Dashboard v1, die Seiten-Verträge A–E und **Prompt Insights v1** (zuletzt,
mit Audit und `prompt_insights_v1_fix_1.sql`): genau diese Bauart, diese Regeln, dieser Detailgrad.

---

## 0. Worum es geht

Die Ansicht **Brands** wird **eine** Komponente, die ihre Funktionen **selbst** aufruft:
PostgREST, `POST /rest/v1/rpc/<funktion>`, Schema `app`, Nutzer-JWT, `Content-Profile: app`.
Bubble ist nicht mehr dazwischen. Heute sind es mehrere Bubble-Elemente (Seitenkopf, Kalender,
Filter, Brands Overview, Explore Brands, Add-Brand-Dialog) mit ihren Ereignissen und den Workflows
dahinter.

Aufbau der neuen Seite:

| Teil | Inhalt |
|---|---|
| Kopf | Titel „Brands“, zwei Unterseiten **Tracked** und **Discover**, oben rechts „Add Brand“ und „Aktualisieren“ |
| Darunter | Kalender (Zeitraum) und Filter (Models, Markets, Topics) |
| Unterseite **Tracked** | „Brands Overview“: Linienchart bzw. Landscape-Matrix der Marken über die Zeit, darunter die Markentabelle mit Status **Active** / **Inactive** |
| Unterseite **Discover** | „Explore Brands“: Marken, die in den AI-Antworten des Teams vorkommen, aber **nicht** getrackt werden, mit „Track“-Knopf je Zeile |

Drawer bleiben, wie sie sind: der Marken-Drawer (`brand`, `company_id`) und der Marken-Editor
(Umbenennen, Aliase, Farbe). Die Seite öffnet sie nur. Sie sind **nicht** Teil dieses Auftrags,
außer in Abschnitt 4.6, wo sie dieselben Tabellen schreiben.

Der Export bleibt das Export-Element der App (`export_brands_v1` ist bekannt). Er steht nur in 4.5.

---

## 1. Regeln, ohne Ausnahme

1. **Nichts raten.** Bevor du über eine Funktion etwas sagst, holst du ihre Definition:
   `select pg_get_functiondef('app.NAME'::regproc);`. Wo ein Name fehlt, ermittelst du ihn selbst
   (Abschnitt 3) oder fragst nach.
2. **In dieser Runde keine Änderung.** Nur Leseabfragen, Ergebnisse und ein Vorschlag. Keine
   Schreibaufrufe gegen echte Teams; Verhalten beim Schreiben liest du aus der Definition.
3. **Der Bestand läuft weiter.** Bubble ruft die alten Funktionen, bis die Seite umgestellt ist.
   Neues entsteht daneben als `_v1`.
4. `security definer` immer mit `set search_path`, `revoke` von `public`/`anon`, Zugang über
   `app.require_team_access(p_team)`. Der Nutzer kommt immer aus dem JWT.
5. **Gleiche Zahl, eine Quelle.** Visibility, Rang und Sentiment einer Marke entstehen nach
   denselben Regeln wie im Dashboard v1 (Berliner Kalendertag, Gewichtung über Runs, Sentiment
   höchstens 30 Tage, nur innerhalb der Tracking-Zeiträume). Was es in einem `_v1`-Vertrag schon
   gibt, wird wiederverwendet, nicht neu gerechnet.
6. **Form wie Dashboard v1 und Prompt Insights v1:** reines `jsonb` mit `meta` und `rows`;
   stabile Fehler-`message` (`brands_invalid_param`, `brands_rate_limited` mit `PT429`,
   `brands_not_found` mit `PT404`, `brands_limit_reached` mit `PT409`, `brands_forbidden` mit
   `PT403`, `brands_duplicate` usw.); leer heißt `[]` mit `total_count: 0`, nie ein Fehler; Logos
   und Favicons absolut.
7. **Schreibende Funktionen** prüfen alles selbst (Team, Besitz jeder ID, Grenzen, Planlimit),
   geben den neuen Stand zurück, schreiben ihren Protokolleintrag selbst und leeren die betroffenen
   Caches selbst. Kein `exception when others`.
8. **Die Oberfläche ist kein Schutz.** Jeder angemeldete Nutzer kann jede Funktion mit seinem
   Token und jeder Nutzlast direkt aufrufen. Gezählt wird nur, was die Datenbank selbst abweist.

---

## 2. Was die Seite zeigt und was man dort tun kann

Gemeinsame Filter (Kalender und Filterleiste): Zeitraum `date_from`/`date_to`, Models (Liste),
Markets (Liste), Topics (Liste plus Modus `or`/`and`) – dieselbe Filtertabelle wie Dashboard v1.

### 2.1 Tracked: Chart und Tabelle

**Was schon trägt (bitte bestätigen):** Die Seite nimmt für Chart und Tabelle die beiden
Dashboard-Funktionen, so wie das Dashboard sie schon direkt ruft:

| Teil | Funktion | Parameter |
|---|---|---|
| Linienchart | `cached_dashboard_visibility_v1` | gemeinsame Filter, `p_granularity` (`day`/`week`/`month`), `p_companies` (höchstens 10, eigene Auswahl im Chart) **oder** `p_series_limit` 7 (Vorgabe: die Top 7, eigene Marke immer dabei) |
| Tabelle und Landscape-Matrix | `cached_dashboard_overview_v1` | gemeinsame Filter, `p_order` (`visibility_desc/asc`, `rank_asc/desc`, `sentiment_desc/asc`), `p_limit` 100, `p_offset` |

Die Tabelle zeigt **alle** getrackten Marken auf einmal; die Suche filtert im Browser. Die
Landscape-Matrix setzt jede Marke nach Visibility und Sentiment bzw. Rang. Gelesen werden je
Zeile: `company_id`, `name`, `logo_url`, `position`, `visibility_pct`, `visibility_delta_pct`,
`avg_rank`, `avg_rank_delta`, `sentiment`, `sentiment_delta`; dazu `meta.total_count`.

Bitte prüfen:

1. Wie viele **aktive** Marken hat ein Team höchstens (Planlimit, tatsächlich max/p95)? Reicht
   `p_limit` 100, oder muss die Seite blättern?
2. Liefert `cached_dashboard_overview_v1` nur **aktive** (getrackte) Marken? Die eigene Marke
   immer?
3. Stimmen die Zahlen mit dem, was die heutige Brands-Ansicht zeigt (Funktion siehe Abschnitt 3)?
   Abweichungen bitte mit Beispiel.

**Status Inactive (fehlt):** Ein Reiter **Inactive** zeigt die deaktivierten Marken: je Zeile
`company_id`, `name`, `logo_url` bzw. `favicon_url`, `domain`, `deactivated_at`. Keine Kennzahlen.
Dazu braucht der Kopf die Zahl der aktiven **und** der inaktiven Marken (`total_count`,
`total_count_inactive`), unter denselben Filtern? (bitte sagen, ob Filter hier Sinn ergeben).

**Schreiben (fehlt bzw. heute Bubble):**

| Aktion | Wo | Nutzlast heute | Hinweise |
|---|---|---|---|
| Marke deaktivieren | Menü „Set inactive“ je Zeile (Reiter Active) | `company_id` | beendet den Tracking-Zeitraum? Historie bleibt? Eigene Marke darf **nicht** |
| Marke aktivieren | Menü „Activate“ (Reiter Inactive) | `company_id` | Planlimit! Neuer Tracking-Zeitraum? |
| Bearbeiten | Menü „Edit“ und Stift am Zeilenende | `company_id` | öffnet nur den Editor-Drawer, kein Aufruf |
| Zeilenklick | Zeile, Legende, Logo in der Matrix | `company_id` | öffnet nur den Marken-Drawer |

### 2.2 Discover: Explore Brands

Zeigt die wichtigsten Marken, die in den AI-Antworten des Teams vorkommen, aber nicht getrackt
werden, absteigend nach Visibility, **nur die Spitze** (heute 30 Zeilen). Kein Blättern, keine
Sortierung, kein Zeilenklick. Je Zeile liest die Oberfläche:

`name`, `visibility_pct`, `mentioned_count`, `runs_total`, `recognized_urls[]` (`domain`,
`root_url`, `favicon_url`; nur der erste Eintrag wird gezeigt), dazu `total_responses` (wie viele
Antworten durchsucht wurden).

Bedienung:

| Bedienung | Wirkung heute |
|---|---|
| Schalter **Matched Brands** (`yes`/`no`, Vorgabe `yes`) | `yes`: nur Marken, denen eine zitierte Domain zugeordnet werden konnte. `no`: Abgleich nur über den Namen (mehr Treffer, auch Verwechslungen). Der Schalter ändert die **Serverauswahl**, die Liste wird neu geholt |
| Suche (Text) | geht heute als Ereignis an Bubble. Bitte nachsehen, ob die Funktion einen Suchparameter hat oder ob nur im Browser gefiltert wird |
| **Track** je Zeile | öffnet den Add-Brand-Dialog vorausgefüllt (Name, Domain). Angelegt wird erst dort (2.3). Danach fällt die Zeile aus der Liste |

**Laufzeit:** Die Funktion dahinter braucht bei großen Teams **20–30 Sekunden**. Bitte messen und
einen Weg vorschlagen, der das Zeitlimit eines Aufrufs (60 s) sicher nie erreicht und nicht bei
jedem Öffnen neu rechnet. Zum Beispiel ein Ergebnis je Team und Tag, das ein Job rechnet, und eine
schnelle Lesefunktion darauf, oder ein Auftrag mit Status wie Prompt Research. Bitte begründen.

Gelten Zeitraum, Models, Markets, Topics für Discover? Heute vermutlich nicht. Die Oberfläche
blendet die Filterzeile dort aus, wenn die Funktion sie nicht kennt.

### 2.3 Dialog „Add Brand“

Ein Aufruf je Speichern, heute über einen Bubble-Workflow. Nutzlast:

```json
{"team_id": "877c…", "name": "Apple", "domain": "apple.com"}
```

- Name: 1–75 Zeichen, nur im Browser geprüft.
- Domain: bis 300 Zeichen, im Browser normalisiert (ohne `https://`, `www.`, Pfad), darf leer sein?
  (bitte nachsehen, was die Datenbank heute mit leerer Domain macht).
- Geöffnet aus dem Kopf (leer) und aus Discover über „Track“ (vorausgefüllt).

Bitte klären, was in der **Datenbank** beim Anlegen passiert: neue Firma oder Zuordnung zu einer
bestehenden (gleiche Domain, gleicher Name), Tracking-Zeitraum, Farbe, Aliase, Nachberechnung der
Erwähnungen in alten Antworten (Trigger, n8n?), Caches. Was passiert bei einer Marke, die es im Team
schon inaktiv gibt? Bei einer Domain, die einer schon getrackten Marke gehört?

### 2.4 Kopf, Aktualisieren, Ablagen

- **Aktualisieren:** Regel der App: jeder Aktualisieren-Knopf leert den DB-Cache seines Bereichs und
  lädt frisch. Reicht `clear_dashboard_cache_v1` für Tracked? Für Discover: eine eigene Fassung?
- **Marken-Ablage der App:** Die Seitenleiste, Filter und viele Bausteine lesen die Markenliste aus
  einer Ablage, die Bubble beim Seitenaufbau füllt (`setUpstreemBrands`: `company_id`, `name`,
  `logo_url`, `role` own/competitor). Nach Anlegen, Aktivieren und Deaktivieren muss sie neu
  geladen werden. Gibt es eine Lesefunktion dafür, die die Seite direkt rufen darf?
- **Rolle:** Wie bei Prompt Insights (`prompts_page_meta_v1.meta.role`) braucht die Seite die Rolle
  des Nutzers, falls Aktionen auf `owner`/`admin` beschränkt werden (Vorschlag 4.2).

---

## 3. Bestandsaufnahme (bitte die Ergebnisse schicken)

Die Namen der heutigen Bubble-Aufrufe sind im Frontend nicht dokumentiert. Bitte selbst ermitteln,
welche Funktionen die Brands-Ansicht heute benutzt.

```sql
-- A) Kandidaten: Funktionen rund um Marken, mit Argumenten, Rückgabe, Sicherheit, Team-Prüfung
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       pg_get_function_result(p.oid)            as returns,
       p.prosecdef                              as security_definer,
       position('require_team_access' in pg_get_functiondef(p.oid)) > 0 as prueft_team,
       position('auth.uid()' in pg_get_functiondef(p.oid)) > 0           as nutzt_uid,
       position('exception' in lower(pg_get_functiondef(p.oid))) > 0     as faengt_fehler
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'app' and p.prokind = 'f'
  and p.proname ~* '(brand|compan|competit|discover|untrack|track|alias|variation|logo|favicon)'
order by p.proname;

-- B) Welche davon werden WIRKLICH gerufen (letzte Tage), wie oft, wie lange?
--    (pg_stat_statements; falls nicht verfügbar, bitte sagen, woher du es sonst weißt)
select calls, round(mean_exec_time) as ms_mittel, round(max_exec_time) as ms_max, left(query, 160)
from pg_stat_statements
where query ~* '(brand|compan|competit|discover|untrack|track)'
order by calls desc limit 60;

-- C) Rechte darauf (anon / authenticated / service_role)
select p.proname, r.rolname, has_function_privilege(r.oid, p.oid, 'execute') as darf
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
cross join (select oid, rolname from pg_roles where rolname in ('anon','authenticated','service_role')) r
where n.nspname = 'app'
  and p.proname ~* '(brand|compan|competit|discover|untrack|track|alias|variation)'
order by p.proname, r.rolname;

-- D) Tabellen mit Spalten (Firmen, Team-Marken, Tracking-Zeiträume, Aliase, Erwähnungen)
select table_schema, table_name,
       string_agg(column_name || ' ' || data_type, ', ' order by ordinal_position)
from information_schema.columns
where table_schema in ('app','public')
  and table_name ~* '(compan|brand|competit|track|alias|mention|variation)'
group by table_schema, table_name order by 1, 2;

-- E) Fremdschlüssel mit ON DELETE, Trigger, RLS-Policies auf diesen Tabellen
--    (dieselben drei Abfragen wie im Prompt-Insights-Auftrag, Abschnitt 3 D-F, mit dem Muster aus D)

-- F) Datenlage (nur Zähler): aktive und inaktive Marken je Team (max, p95), Planlimit für Marken
--    je Plan, Firmen ohne Domain, Firmen mit gleicher Domain, Markennamen mit Backtick, '${',
--    Backslash, Zeilenumbruch oder unsichtbaren Zeichen, Aliase je Marke (max).
```

Für jede Funktion, die die heutige Ansicht benutzt (Overview, Inaktiv-Liste, Aktivieren,
Deaktivieren, Anlegen, Discover):

1. die Definition;
2. ein echtes Beispiel (Hauptteam 877c, letzte 30 Tage): die ersten 3 Zeilen und die Laufzeit,
   kalt und warm. Für Discover beide Stellungen von Matched;
3. ob sie `p_team` gegen den Nutzer prüft und ob **jede übergebene ID** zum Team gehört;
4. was sie rechnet, das Dashboard v1 schon rechnet.

---

## 4. Fehlersuche und Missbrauchsprüfung (das volle Paket)

Zu jedem Punkt: **Befund** (mit Abfrage oder Definitionsstelle), **Schwere**, **Vorschlag**.

### 4.1 Rechenfehler und Widersprüche

1. Stimmen Visibility, Rang und Sentiment einer Marke zwischen Brands, Dashboard v1 und
   Performance für denselben Zeitraum und dieselben Filter?
2. Wird eine Marke nur innerhalb ihrer Tracking-Zeiträume gezählt? Was zeigt der Chart für die Tage
   außerhalb (kein Punkt statt 0)? Was passiert bei Deaktivieren und erneutem Aktivieren?
3. Discover: Kann eine **getrackte** Marke dort auftauchen (anderer Name, Alias, andere Domain)?
   Taucht die eigene Marke auf? Wie wird „gleich“ festgestellt?
4. `visibility_pct` in Discover: dieselbe Definition wie für getrackte Marken?
5. Stabile Reihenfolge bei Gleichstand (zweiter Schlüssel), auch in Discover.
6. Zeitzone: alle Tagesgrenzen Europe/Berlin?

### 4.2 Zugriff und Rollen

1. Jede Funktion: Zugang nur über `require_team_access`, nichts mit `anon` ausführbar.
   Bitte einmal mit `curl` und dem öffentlichen Schlüssel **ohne** Nutzertoken prüfen.
2. Fremde IDs: `company_id` einer Marke, die zu einem anderen Team gehört (oder gar keinem), darf
   weder aktiviert noch deaktiviert noch gelesen werden, auch nicht gemischt mit eigenen.
   Firmen sind vermutlich **teamübergreifend** geteilt (eine Firma, viele Teams): bitte genau
   beschreiben, was ein Team an einer geteilten Firma ändern kann (Name, Domain, Logo, Farbe,
   Aliase) und ob das andere Teams trifft.
3. Rollen: Wer darf Marken anlegen, aktivieren, deaktivieren? Vorschlag: Anlegen und Aktivieren
   alle Mitglieder (Planlimit schützt), Deaktivieren alle, die eigene Marke niemand.
4. RLS auf den Tabellen: reicht sie allein, falls eine Funktion `security invoker` ist?

### 4.3 Grenzen und Planlimit (alles serverseitig)

| Was | Heute (nur Browser) | Bitte festlegen |
|---|---|---|
| Aktive Marken je Team | ? | Planlimit, atomar beim Anlegen **und** Aktivieren (zwei gleichzeitige Aufrufe dürfen es nicht gemeinsam überschreiten) |
| Inaktive Marken je Team | keine | Obergrenze? |
| Name | 1–75 | 1–75 nach Trimmen, NFKC, unsichtbare Zeichen weg, mindestens ein Buchstabe oder eine Ziffer |
| Domain | bis 300, im Browser normalisiert | gültiger Hostname (Punycode), Normalisierung in der DB, Länge |
| Dubletten | keine | gleiche Domain oder gleicher Name (normalisiert) im Team: Fehler `brands_duplicate` mit `hint` = vorhandene `company_id`, oder Reaktivieren? |
| Eigene Marke | – | nicht deaktivierbar, nicht doppelt |
| Discover Matched | `yes`/`no` | nur diese zwei Werte |
| Discover Suche | Text | Länge begrenzen, `%`/`_`/`\` sicher |

### 4.4 Text, der Bubble noch erreicht

Markennamen laufen weiterhin durch Bubble-Schritte anderer Ansichten (Run-JS mit Backticks,
`setUpstreemBrands` auf **jeder** Seite). Ein Backtick, ein `${` oder ein Backslash am Ende tötet
dort den ganzen Schritt, auf jeder Seite der App.

- Bitte zählen, wie viele Firmen- und Markennamen und Domains solche Zeichen tragen (Abfrage F).
- Vorschlag wie bei Prompt Insights: beim Anlegen und Umbenennen **umschreiben und melden**
  (`rewritten: true`), Backtick und Backslash weg, `${` wird `$ {`, Zeilenumbrüche und
  Steuerzeichen werden ein Leerzeichen. Die Entscheidung trifft der Nutzer.
- Namen, die Discover aus **Modelltext** gewinnt (`name` in Discover kommt aus AI-Antworten): wie
  sauber sind sie? Gleiche Regel?

### 4.5 Spam, Last, Kosten

1. **Discover ist teuer** (20–30 s). Wie oft darf ein Nutzer ihn auslösen? Heute: jedes Öffnen,
   jeder Klick auf Matched und womöglich jede Suche. Vorschlag mit Zahlen (Ergebnis je Team und Tag,
   Ratenlimit, Auftrag mit Status).
2. **Anlegen in Masse:** Ein Skript legt 1.000 Marken an oder wechselt Aktivieren/Deaktivieren im
   Kreis. Was kostet jede Anlage (Nachberechnung, n8n, Logos holen)? Tagesgrenze wie bei Prompt
   Insights (`brands_daily_limit_reached`)?
3. **Ratenlimits** je Nutzer und Funktion wie Dashboard v1 (Lesen 60 pro Minute, Aktualisieren 10
   pro Minute), Schreiben eigene Zahlen.
4. **Doppelklick und Wiederholung:** Dieselbe Anlage zweimal (Netzfehler, Doppelklick, Track und
   Kopf-Knopf gleichzeitig) darf keine zwei Marken ergeben.
5. **Logos und Favicons:** Woher kommen sie? Kann ein Nutzer über die Domain eine beliebige Adresse
   als Bild in die Seiten **anderer** Teams bringen (geteilte Firma)? Werden nur `https`-Adressen
   ausgeliefert?
6. **CSV-Export** (`export_brands_v1`): Formelschutz aktiv (Prompt Insights v1 sagt ja, bitte
   bestätigen)?

### 4.6 Konsistenz beim Schreiben

1. Deaktivieren: Was ändert sich in Dashboard, Performance, Citations, Prompt Insights (Spalte
   „Top Mentions“), Mira-Kontext, Exporte? Sofort oder erst nach Cache-Ablauf? Welche Caches leert
   die Schreibfunktion?
2. Aktivieren nach langer Pause: Werden alte Antworten nachgezählt (Erwähnungen außerhalb des
   Zeitraums)?
3. Der Editor-Drawer schreibt Name, Aliase und Farbe derselben Marke. Gibt es dort dieselben
   Lücken (Fremd-ID, Backtick, Länge, geteilte Firma)? Nur Befund, der Drawer ist ein eigener
   Auftrag.

---

## 5. Was nicht in diesen Auftrag gehört (zur Abgrenzung)

- **Drawer** Marke und Marken-Editor: bleiben (4.6.3 nur als Befund).
- **Export:** eigenes Element. 4.5.6 ist nur der Hinweis.
- **Seitenleiste und Marken-Ablage:** nur die Frage 2.4, ob die Seite sie nach Änderungen neu laden
  kann.

---

## 6. Dein Vorschlag (noch nicht bauen)

Schlag einen Vertrag in der Form der Seiten-Verträge vor. Zum Prüfen, nicht als Vorgabe; die
Oberfläche ist schon mit diesen Namen vorbereitet und zieht jede Abweichung nach:

| Funktion | Zweck |
|---|---|
| `cached_dashboard_visibility_v1` (besteht) | Linienchart |
| `cached_dashboard_overview_v1` (besteht) | Tabelle und Landscape-Matrix (aktive Marken) |
| `brands_page_meta_v1` | Rolle, Zähler aktiv/inaktiv, Kontingent der Marken (`used`, `total`, `plan`), inaktive Marken (`company_id`, `name`, `logo_url`, `domain`, `deactivated_at`) |
| `brands_set_status_v1` | aktivieren/deaktivieren: `p_company_ids` (1–50), `p_status` `active`/`inactive`; Planlimit; eigene Marke nie; Antwort mit neuem Kontingent |
| `brand_add_v1` | anlegen: `p_name`, `p_domain`; Normalisierung, Dubletten, Umschreiben, Planlimit; Antwort mit `company_id`, `rewritten`, Kontingent |
| `cached_discover_brands_v1` | Discover lesen: `p_matched`, ggf. `p_search`; schnell, aus einem vorbereiteten Ergebnis |
| `discover_brands_refresh_v1` (falls nötig) | Neuberechnung anstoßen, mit Status bzw. Realtime wie Prompt Research |
| `clear_dashboard_cache_v1` (besteht) | Aktualisieren auf Tracked |

Dazu:

1. die **gemeinsame Filtertabelle** (wie Dashboard v1; was davon für Discover gilt);
2. zu jeder Funktion Parameter, Antwortform und ein **echtes Beispiel**;
3. die **Grenzen aus 4.3** als Tabelle mit Fehler-`message` und `hint`;
4. die **Ratenlimits** und Tagesgrenzen;
5. die **Befunde aus Abschnitt 4**, sortiert nach Schwere;
6. **offene Fragen**, die nur der Nutzer beantworten kann (Rollen, Dubletten: Fehler oder
   Reaktivieren, Umgang mit Sonderzeichen, Discover-Aktualität).

Ich prüfe den Vorschlag gegen die Oberfläche und gebe ihn dir abgestimmt zurück. Erst dann baust du.
Nach dem Bau brauche ich wie immer eine Datei mit **echten, ungekürzten Antworten** (Team 877c,
30 Tage; Schreibaufrufe in zurückgerollten Transaktionen), jede Fehlerform einmal.
