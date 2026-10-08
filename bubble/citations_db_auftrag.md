# Auftrag an den Datenbank-Chat: Citations-Seite (Stand 08.10.2026)

Diesen ganzen Text als erste Nachricht in den Datenbank-Chat geben. Er ist in sich vollständig:
der Datenbank-Chat hat das Frontend-Repo nicht.

**Diese Runde ist eine BESTANDSAUFNAHME mit VORSCHLAG. Du änderst nichts.** Gebaut wird erst,
wenn der Vertrag (Abschnitt 5) abgestimmt ist.

---

## 0. Worum es geht

Die Citations-Seite wird **eine** Komponente, wie die Seiten Shopping, Ads und Impact Events:
Kopf, Filter, Chart und Tabellen in einem Stück, das Zustand, Filter und Ladevorgänge selbst
führt. Heute besteht sie aus fünf Bubble-Elementen mit rund 31 Bubble-Ereignissen und den
Workflows dahinter.

Das Ziel dahinter: Die Oberfläche soll irgendwann aus Bubble in eine normale Web-App (z. B.
Next.js) wechseln können. Darum gilt für alles, was hier entsteht:

- **Die Datenbank ist die einzige Quelle der Logik.** Filtern, Sortieren, Blättern, Suchen,
  Aggregieren, Zugriffsprüfung: alles in Postgres, nichts in Bubble, nichts im Browser.
- **Jede Funktion ist ein Vertrag**, versioniert (`_v1`), mit festen Feldnamen und Beispielen,
  und so gebaut, dass sie **direkt mit dem Nutzer-JWT** aufrufbar ist (PostgREST, Schema `app`)
  und nicht nur über den API Connector von Bubble. Genau so laufen schon die Shopping-Funktionen
  (`app.cached_shopping_*_v1`).
- Bubble ist in Zukunft höchstens noch Transport.

## 1. Regeln, ohne Ausnahme

1. **Nichts raten.** Wo hier `[NAME ERFRAGEN]` steht, fragst du nach. Bevor du über eine Funktion
   etwas sagst, holst du ihre Definition (`select pg_get_functiondef('app.NAME'::regproc);`).
2. **In dieser Runde keine Änderung.** Nur Leseabfragen, Ergebnisse und ein Vorschlag.
3. **Die alte Seite läuft weiter**, bis die neue sie ersetzt. Bestehende Funktionen und ihre
   Rückgabeformen bleiben also unangetastet; Neues entsteht daneben als `app.cached_citations_*_v1`.
4. Für das Spätere schon jetzt: `security definer` immer mit `set search_path`, `revoke` von
   `public`/`anon`, Zugangsprüfung über `app.require_team_access` (die Form seit 28.09.).
5. Freitext, der durch Bubble laufen kann, ohne Backtick, ohne `${`, Backslashes verdoppelt
   (wie bei Shopping).

## 2. Was die Seite zeigt und was man dort tun kann

| Bereich | Inhalt | Interaktionen (Werte, die die Komponenten heute schicken) |
|---|---|---|
| Kopf | Titel, Unterseite **Domains** oder **URLs** | Unterseite wechseln; „Aktualisieren“ |
| Filterzeile | Zeitraum, Models, Markets, Topics | Zeitraum von/bis oder Vorgabe; je Filter eine Auswahl, angewendet mit „Apply“ |
| Combo-Chart | Zeitreihe des Anteils je Domain (Unterseite Domains) bzw. je URL (Unterseite URLs), daneben die Verteilung nach Citation Type bzw. URL Type | Granularität Tag, Woche, Monat |
| Domains-Tabelle | eine Zeile je Domain | Suche `{"query","query_folded","query_de"}`; Sortierung `share_desc/asc`, `share_delta_desc/asc`, `last_used_desc/asc`; Seite `{"limit","offset","page"}`; Filter Citation Types (Liste); „Brand mentioned“ yes/no/aus; Marken-Filter `{"brands":"id1,id2"}`; Zeile öffnet das Domain-Detail |
| Domains, Drilldown | die URLs EINER Domain, aufgeklappt in der Zeile | `{"domain","query","url_types","page","page_size","offset","request_id"}`; Zeile öffnet die URL |
| URLs-Tabelle | eine Zeile je URL | wie Domains, Filter aber URL Types; Zeile öffnet das URL-Detail |

Felder, die die Komponenten **heute lesen** (aus dem Code, nicht aus den Vorlagen; die
Vorlage der URL-Tabelle nennt veraltete Felder):

- **Domains-Zeile:** `domain`, `favicon`, `share_pct`, `share_delta_pct`, `urls_count`,
  `last_used_at`, `citation_type`, `runs_with_domain` (Rückfall `used_total`/`used`/`total_used`),
  dazu `total_count` (Gesamtzahl für das Blättern, heute auf jeder Zeile).
- **URL-Zeile:** `url`, `title`, `domain`, `favicon`, `global_share_pct` (Rückfall `share_pct`),
  `domainshare_pct` (im Drilldown), `share_delta_pct`, `url_type`, `is_mentioned`, `mentions`
  (Markenliste), `mentions_totalcount`, `last_seen`.
- **Combo-Chart:** `series[]` mit `day`, `share_pct` und `domain` bzw. `url`; `types[]` mit `type`,
  `count`; `domains[]` mit `domain`, `favicon_url`; im URL-Modus je URL `title`, `url_type`.

## 3. Bestandsaufnahme (bitte die Ergebnisse dieser Abfragen schicken)

```sql
-- A) Alle Funktionen, die nach Citations/Domains/URLs klingen: Argumente, Rückgabe, Sicherheit
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       pg_get_function_result(p.oid)            as returns,
       p.prosecdef                              as security_definer,
       position('require_team_access' in pg_get_functiondef(p.oid)) > 0 as prueft_team
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'app'
  and p.proname ~* '(citation|domain|url|combo|source)'
order by p.proname;

-- B) Rechte auf diesen Funktionen (wer darf sie aufrufen?)
select p.proname, r.rolname, has_function_privilege(r.oid, p.oid, 'execute') as darf
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
cross join (select oid, rolname from pg_roles where rolname in ('anon','authenticated','service_role')) r
where n.nspname = 'app' and p.proname ~* '(citation|domain|url|combo|source)'
order by p.proname, r.rolname;

-- C) Gibt es schon Cache-Tabellen oder -Funktionen für Citations (wie bei Shopping)?
select table_name from information_schema.tables
where table_schema = 'app' and table_name ~* '(cache|citation)';
```

Dazu bitte, für jede Funktion, die die Citations-Seite heute benutzt `[NAMEN ERFRAGEN, falls aus A
nicht eindeutig]`:

1. Die vollständige Definition.
2. **Ein echtes Beispiel**, aufgerufen mit einem echten Team und dem Standardzeitraum (letzte 30 Tage):
   - die ersten 3 Zeilen der Antwort;
   - die Laufzeit (`explain (analyze, buffers)` reicht als Zahl).
3. Wie Filter ankommen: Zeitraum, Models, Markets, Topics, Suche, Sortierung, Blättern, Typ-Filter,
   „Brand mentioned“, Marken-Filter. Name des Parameters, Typ, Default, und was „leer“ bedeutet.
4. Prüft die Funktion, dass `p_team` zum angemeldeten Nutzer gehört? Wenn nein: wer ruft sie heute
   mit welchem Schlüssel auf (Nutzer-JWT oder `service_role` aus Bubble)?
5. Was berechnet sie, das woanders noch einmal berechnet wird? (Zwei Wege zu derselben Zahl laufen
   irgendwann auseinander.)

## 4. Fragen, auf die ich eine klare Antwort brauche

1. Liefern Chart und Tabelle für dieselben Filter **dieselben** Anteile? (Gleicher Nenner, gleiche
   Definition von „Share“.)
2. Was ist `share_delta_pct` genau: Vergleich mit dem gleich langen Zeitraum davor?
3. Wie teuer sind die Abfragen bei 90 Tagen und vielen Prompts? Lohnt ein Cache wie bei Shopping?
4. Woher kommen die Typen (Citation Type, URL Type) und die Favicons?
5. Was tut „Aktualisieren“ heute in der Datenbank (Cache leeren, neu rechnen, nichts)?

## 5. Dein Vorschlag (noch nicht bauen)

Schlag einen Vertrag in der Form von `shopping_backend_vertrag.md` vor:

1. Welche `app.cached_citations_*_v1` es braucht. Vorschlag zum Prüfen:
   - eine für Kopf und Chart (ändert sich mit Filtern und Granularität);
   - je eine für die Domains- und die URL-Tabelle (ändern sich zusätzlich mit Suche, Sortierung, Seite);
   - eine für den Drilldown einer Domain.

   Begründe, wenn du es anders schneiden würdest.
2. Gemeinsame Filterparameter (eine Tabelle, für alle gleich).
3. Antwortform wie bei Shopping: Umschlag `{"json": "<Text>"}`, ein `meta`-Block, Gesamtzahl für das
   Blättern einmal in `meta` statt auf jeder Zeile, stabile Fehler-`message`s.
4. Zu jeder Funktion ein vollständiges Beispiel mit echten Werten.

Ich prüfe den Vorschlag gegen die Oberfläche und gebe ihn dir abgestimmt zurück. Erst dann baust du.
