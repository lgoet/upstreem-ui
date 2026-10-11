# An Claude Code: URL Detail v1 ist gebaut (12.10.2026)

Lukas spielt `url_detail_v1.sql` ein, danach `url_alt_absichern.sql`. Echte, ungekürzte Antworten liegen in `url_detail_v1_echte_antworten.json`: viel zitiert mit Zusammenfassung und Conversion, YouTube, ohne Zusammenfassung, `http://`, nicht im Zeitraum, andere Schreibweise, Responses mit `p_url` (erste Seite und Suche), Export mit `p_url` und jede Fehlerform.

## 1. Kopf und Inhalt: `url_detail_v1`
`POST /rest/v1/rpc/url_detail_v1` (Header `Content-Profile: app`, Nutzer-JWT)
```
{ p_team, p_url, p_date_from?, p_date_to?, p_models?, p_markets?, p_tag_ids?, p_tagmode? }
```
Die Filter sind dieselben wie beim Dashboard. Mitgeben, damit die Kennzahlen zur Tabelle passen; ohne Angabe gelten die letzten 30 Tage.

```
{ meta: { team_id, url, url_requested, date_from, date_to, filters, in_range, data_as_of },
  row:  { url, title, domain, favicon, url_type, citation_type,
          first_cited_at, last_cited_at, last_scraped_at,
          in_range, cited_runs, domain_share, global_share, global_rank,
          description, summary,
          brands[]:     { company_id, name, role, logo_url, favicon_url },   // eigene Marke zuerst
          conversion[]: { company_id, company_name, logo_url, role, cited_runs, mentioned_runs,
                          citation_conversion_pct, url, domain, title } } }
```

**Wichtig:**
- **`meta.url`** ist die Schreibweise, in der das Team die Adresse zitiert hat. Ein Link mit anderer Schreibweise (`http`/`https`, `www.`, `/` am Ende, `#…`) wird gefunden. Für alle weiteren Aufrufe `meta.url` nehmen, auch für die Tabelle, den Export und Pins.
- **Zuletzt gesehen:**
  - `last_cited_at` ist der Zeitpunkt, an dem das Team die Adresse zuletzt zitiert hat. Das ist der Wert für „zuletzt gesehen“.
  - `first_cited_at` ist das erste Zitat.
  - `last_scraped_at` sagt nur, wann die Seite zuletzt gelesen wurde; nicht als „zuletzt gesehen“ anzeigen.
- **Nicht im Zeitraum** (`in_range: false`): Das Team hat die Adresse zitiert, nur nicht im gewählten Zeitraum. Kopf, Zusammenfassung, Beschreibung und Marken kommen trotzdem. Die Kennzahlen sind 0, `global_rank` ist `null` und `conversion` ist leer. So zeigen, wie es Analytics-Tools tun:
  - Hinweis statt leerer Zahlen: „Im gewählten Zeitraum nicht zitiert. Zuletzt am {last_cited_at}.“
  - Ein Knopf „Zeitraum anpassen“ setzt den Zeitraum auf die 30 Tage bis `last_cited_at` und lädt neu.
  - Die Responses-Tabelle zeigt in diesem Fall ihren Leerzustand mit demselben Hinweis.
- **`summary`** ist Klartext (vorher `{"summary": …}`) oder `null`. Bei `null` den Abschnitt „AI Summary“ ausblenden.
- **`description`** ist Klartext; HTML-Entities wie `&amp;` sind aufgelöst. Trotzdem maskieren.
- **`brands[]`:**
  - Nur getrackte Marken, die auf der Seite erwähnt werden.
  - `logo_url` folgt der Logo-Regel (eigene Marke: Override, Wettbewerber: Favicon).
  - `role` ist 'own' oder 'competitor'.
- **`conversion[]`:** wie bisher, dazu `logo_url` nach der Regel. `role` war schon da.
- **Kennzahlen:** Definitionen in `URL_DETAIL_V1_VORSCHLAG.md` Abschnitt 2.

## 2. Responses-Tabelle: `cached_dashboard_responses_v1`
- Neu sind `p_url` und `p_domain` (optional, am Ende). `p_url = meta.url` setzen, sonst alles wie im Dashboard.
- Ausgabe, Filter, Sortierung und Seiten sind gleich. `meta.filters.url` zeigt die gefundene Adresse.
- `meta.total_count` ist gleich `row.cited_runs` aus `url_detail_v1`; das ist geprüft (adac.de 30 Tage: 523 = 523).

## 3. Export: `export_responses_v1`
- Neu sind ebenfalls `p_url` und `p_domain`. Geprüft: Mit `p_url` exportiert er dieselben 523 Antworten wie die Tabelle.
- Der Export-Knopf im Drawer kann wieder erscheinen.

## Fehler (`message` = Code)
| SQLSTATE | message | hint | Drawer |
|---|---|---|---|
| 28000 | `settings_not_authenticated` | – | Anmeldung |
| 42501 | `team_forbidden` | – | kein Zugriff |
| PT404 | `team_deleted` | – | Team gelöscht |
| PT402 | `team_access_<state>` | Zustand | Hinweis auf Abo |
| 22023 | `team_invalid_param` | `p_url` | – |
| 22023 | `dashboard_invalid_date` | Regel | Zeitraum prüfen |
| PT404 | `url_not_found` | – | „Diese Adresse wurde von deinem Team nie zitiert.“ |
| PT429 | `url_rate_limited` | Sekunden | kurz warten |

`url_not_found` kommt auch, wenn nur ein anderes Kunden-Team die Adresse zitiert hat; die Antwort verrät das nicht.

## Laufzeit
- Warm 50–250 ms.
- Kalt 1–5 s bei viel zitierten Adressen und langen Zeiträumen: Den Lade-Zustand zeigen und beim Durchklicken alte Anfragen abbrechen.
- Nicht im Zeitraum: unter 100 ms.

## Alt bleibt
`get_url_bundle_v7` bleibt für Bubble und prüft nach `url_alt_absichern.sql` zusätzlich den Zugang.
