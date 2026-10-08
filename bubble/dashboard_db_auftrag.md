# Auftrag an den Datenbank-Chat: Dashboard-Seite (Stand 08.10.2026)

Diesen ganzen Text als erste Nachricht in den Datenbank-Chat geben. Er ist in sich vollständig.

**Diese Runde ist eine BESTANDSAUFNAHME mit VORSCHLAG. Du änderst nichts.** Gebaut wird erst,
wenn der Vertrag (Abschnitt 6) abgestimmt ist. Vorbild ist der fertige Citations-Vertrag
(`cached_citations_*_v1`, Stand 08.10.): genau diese Bauart, diese Regeln, dieser Detailgrad.

---

## 0. Worum es geht

Die Dashboard-Seite wird **eine** Komponente, so wie es die Citations-Seite seit dem 08.10. ist:
Kopf, Filter, beide Ansichten und alle Teile in einem Stück. Die Komponente ruft ihre Funktionen
**selbst** auf (PostgREST, `POST /rest/v1/rpc/<funktion>`, Schema `app`, Nutzer-JWT,
`Content-Profile: app`). Bubble ist nicht mehr dazwischen.

Ziel dahinter wie bei Citations: Die Oberfläche soll später ohne Bubble laufen können
(z. B. Next.js). Also gilt:

- **Die Datenbank ist die einzige Quelle der Logik.** Filtern, Sortieren, Blättern, Suchen,
  Aggregieren, Zugriffsprüfung: alles in Postgres.
- **Jede Funktion ist ein Vertrag**, versioniert (`_v1`), mit festen Feldnamen und Beispielen.
- **Antwort als reines `jsonb`**, ohne Umschlag `{"json": …}`.

Die Seite hat zwei Ansichten, umgeschaltet im Kopf (Werte `power` / `standard`, sichtbar als
„Agentic“ / „Analytic“). Beide gehören in diesen Vertrag.

## 1. Regeln, ohne Ausnahme

1. **Nichts raten.** Wo hier `[NAME ERFRAGEN]` steht, fragst du nach. Bevor du über eine Funktion
   etwas sagst, holst du ihre Definition (`select pg_get_functiondef('app.NAME'::regproc);`).
2. **In dieser Runde keine Änderung.** Nur Leseabfragen, Ergebnisse und ein Vorschlag.
3. **Die alte Seite läuft weiter**, bis die neue sie ersetzt. Bestehende Funktionen bleiben
   unverändert, Neues entsteht daneben (`_v1`).
4. `security definer` immer mit `set search_path`, `revoke` von `public`/`anon`, Zugang über
   `app.require_team_access(p_team)`.
5. **Gleiche Zahl, eine Quelle.** Was es schon in einem `_v1`-Vertrag gibt, wird
   WIEDERVERWENDET, nicht neu gerechnet. Zwei Wege zu derselben Zahl laufen auseinander.

## 2. Was die Seite zeigt

### 2a. Kopf (beide Ansichten)
Umschalter Agentic/Analytic, Aktualisieren-Knopf, Kalender (Zeitraum, „Apply to all“ gilt
app-weit), Filter Models, Markets, Topics (gelten für diese Seite).

**Aktualisieren** heißt in jeder Komponente dieser App: **den DB-Cache des Bereichs leeren, dann
frisch laden** (Regel seit 08.10.). Die Seite braucht dafür eine `clear_dashboard_cache_v1`
(oder du schlägst vor, wie ein Aufruf alle Caches leert, aus denen das Dashboard liest).

### 2b. Agentic (heute `renderPowerDashboard`, ein „Power-Dashboard-RPC“ ohne festen Namen)
Felder, die die Oberfläche heute LIEST:

- **overview:** `visibility_pct`, `visibility_delta_pct`, `visibility_position`, `brand_count`,
  `avg_rank`, `avg_rank_delta`, `best_rank`, `sentiment`, `sentiment_delta`, `field_avg_sentiment`
- **brands[]** (5 Zeilen, die eigene Marke zusätzlich mit ihrer echten Position, falls nicht
  unter den ersten 5): `company_id`, `position` (Rang in der VOLLEN Rangliste), `name`, `logo_url`,
  `visibility_pct`, `visibility_delta_pct`, `is_own`
- **top_domains[]** (5): `domain`, `favicon`, `share_pct`, `share_delta_pct`
- **top_urls[]** (5): `url`, `title`, `favicon`, `global_share_pct`, `share_delta_pct`
- Chats kommen aus Ask Mira (bleibt so), Opportunities aus deren eigenem Weg (bleibt so).

### 2c. Analytic
- **Visibility-Chart** (heute `renderVisibilityChart`, RPC ohne Namen):
  - Zeitreihe: je Marke und Bucket `company_id`, `day`, `visibility_pct`
  - Marken: `company_id`, `name`, `color`, `favicon_url`, `visibility_window_pct`
  - Tabelle darunter: `company_id`, `name`, `logo_url`, `position`, `visibility_pct`,
    `visibility_delta_pct`, `avg_rank`, `avg_rank_delta`, `sentiment`, `sentiment_delta`,
    dazu `total_count`
  - Bedienung: Stufe Tag/Woche/Monat; Sortierung `visibility|rank|sentiment` × `asc|desc`;
    Auswahl, welche Marken im Chart stehen (Liste von `company_id`)
- **Top Citations** (heute `renderTopCitations`, RPC ohne Namen): Umschalter Domains/URLs, je die
  ersten 7 mit `share_pct`, `share_delta_pct`, `used_total`, `citation_type` bzw. `url_type`, dazu
  die Typ-Verteilung und `citations_total`. Filter: Citation Types, URL Types, „Brand mentioned“.
  → **Bitte prüfen, ob das vollständig aus `cached_citations_overview_v1` und
  `cached_citations_domains_v1`/`_urls_v1` kommen kann** (gleiche Zahlen wie die Citations-Seite).
  Ebenso **Agentic `top_domains`/`top_urls`**.
- **Responses-Tabelle** (heute `renderResponsesTable`): nach meinem Stand
  `app.cached_mentions_overview_v1` (Wrapper um `get_mentions_overview_v21`, Events-Vertrag).
  Felder je Zeile: `prompt_run_id`, `run_at`, `model`, `prompt_id`, `prompt_text`, `user_rank`,
  `user_sentiment`, `has_user_brand`, `companies_preview[]` (`company_id`, `name`, `favicon_url`,
  `rank`), `companies_preview_totalcount`, `sources_preview[]` (`pos`, `url`, `title`, `domain`,
  `favicon`), `sources_totalcount`, `response_preview`; Gesamtzahl.
  Bedienung: Suche, Sortierung `run_at_desc|asc`, `sentiment_desc|asc`, `rank_asc|desc`, Seite
  (`limit`, `offset`), Rang von–bis (20 heißt „20+“), Sentiment von–bis, „Brand mentioned“,
  erwähnte Marken (Liste von `company_id`).
  → **Bitte prüfen, ob die Funktion direkt mit dem Nutzer-JWT aufrufbar ist** (Rechte,
  Team-Prüfung) und ob ihre Antwort schon die Form aus Abschnitt 5 hat.

## 3. Bestandsaufnahme (bitte die Ergebnisse schicken)

```sql
-- A) Funktionen, die nach Dashboard klingen: Argumente, Rückgabe, Sicherheit
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       pg_get_function_result(p.oid)            as returns,
       p.prosecdef                              as security_definer,
       position('require_team_access' in pg_get_functiondef(p.oid)) > 0 as prueft_team
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'app'
  and p.proname ~* '(dashboard|power|visibility|competition|overview|mentions|brand|kpi)'
order by p.proname;

-- B) Rechte darauf
select p.proname, r.rolname, has_function_privilege(r.oid, p.oid, 'execute') as darf
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
cross join (select oid, rolname from pg_roles where rolname in ('anon','authenticated','service_role')) r
where n.nspname = 'app' and p.proname ~* '(dashboard|power|visibility|competition|overview|mentions|brand|kpi)'
order by p.proname, r.rolname;
```

Welche dieser Funktionen das Dashboard heute nutzt, steht nur in Bubble
`[NAMEN ERFRAGEN, falls aus A nicht eindeutig: Agentic-RPC, Visibility-Chart-RPC, Top-Citations-RPC]`.
Für jede davon:

1. die vollständige Definition;
2. ein echtes Beispiel (Hauptteam, letzte 30 Tage): die ersten 3 Zeilen und die Laufzeit
   (`explain (analyze, buffers)`, kalt und warm);
3. wie Filter ankommen (Name, Typ, Default, was „leer“ heißt);
4. prüft sie `p_team` gegen den angemeldeten Nutzer?
5. was sie rechnet, das ein `cached_citations_*_v1` oder eine andere Funktion schon rechnet.

## 4. Fragen, auf die ich eine klare Antwort brauche

1. **Sichtbarkeit:** Ist `visibility_pct` im Agentic-Überblick, in der Markenliste und in der
   Visibility-Tabelle dieselbe Zahl mit demselben Nenner? Wie ist `visibility_window_pct` definiert?
2. **Position:** Gegen welche Rangliste (alle Marken des Teams, nur getrackte)?
3. **Deltas:** Gilt dieselbe Vorperiode wie bei Citations (`greatest(least(Tage / 2, 30), 1)` Tage
   direkt davor)? Das soll in der ganzen App gleich sein.
4. **Sentiment und Rang:** Wie werden sie über den Zeitraum gemittelt (je Run, je Antwort)?
5. **Laufzeit:** Was davon ist teuer bei 90 Tagen im Hauptteam? Lohnt ein Cache wie bei Citations
   (eigene Tabelle, versioniert, stale-while-revalidate, Hintergrund-Job)?

## 5. Form, die jede neue Funktion haben soll (wie Citations v1)

- Gemeinsame Parameter wie Citations: `p_team`, `p_date_from`, `p_date_to` (Berliner Kalendertag),
  `p_models`, `p_markets`, `p_tag_ids`, `p_tagmode`; leer heißt alle.
- Zeitreihen: Buckets wie Citations (ISO-Woche, Kalendermonat, `bucket`, `bucket_from`,
  `bucket_to`, `partial`), Zeitzone `Europe/Berlin`.
- Ein `meta`-Block in jeder Antwort (`date_from`, `date_to`, `prev_from`, `prev_to`, `filters`,
  `ignored_filters`, `generated_at`, `cached`, `stale`, bei Tabellen `total_count`, `limit`,
  `offset`, `order`).
- Leere Ergebnisse als `[]` mit `total_count: 0`, nie als Fehler.
- Fehler mit stabiler `message` (wie `citations_invalid_param` …). **Rate-Limit mit Fehlercode
  `PT429`**, dann antwortet PostgREST mit HTTP 429 (bei Citations kam `P0429` als HTTP 500).
- Pflichtparameter mit `default null` und eigener Fehlermeldung (bei Citations ergab ein fehlender
  `p_domain` sonst ein 404 von PostgREST statt der eigenen Meldung).
- Logos und Favicons immer absolut (`https://…`).
- Versionsregel: Felder dürfen dazukommen; Umbenennen, Entfernen oder geänderte Bedeutung heißt `_v2`.

## 6. Dein Vorschlag (noch nicht bauen)

1. Welche Funktionen es braucht, mit Begründung. Mein Vorschlag zum Prüfen:
   - `cached_dashboard_agentic_v1`: overview + brands (Top 5 + eigene Marke) in einem Aufruf;
   - `cached_dashboard_visibility_v1`: Zeitreihe + Marken + Tabelle (mit Sortierung, Markenauswahl);
   - Top Citations und Agentic-Top-Listen: **aus Citations v1**, wenn es passt;
   - Responses: **`cached_mentions_overview_v1`**, wenn direkt aufrufbar, sonst ein `_v1`-Wrapper;
   - `clear_dashboard_cache_v1` für den Aktualisieren-Knopf.
2. Die Parameter je Funktion (eine Tabelle).
3. Die Antwortform je Funktion mit einem vollständigen Beispiel aus echten Werten.

Ich prüfe den Vorschlag gegen die Oberfläche und gebe ihn dir abgestimmt zurück. Erst dann baust du.
