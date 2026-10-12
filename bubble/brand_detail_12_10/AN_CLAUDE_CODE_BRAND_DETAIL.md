# An Claude Code: Brand Detail v1 ist gebaut (12.10.2026)

Lukas spielt `brand_detail_v1.sql` ein, danach `brand_alt_absichern.sql`. Echte, ungekürzte Antworten liegen in `brand_detail_v1_echte_antworten.json` (Team 877c, 7 Tage, Mercedes = eigene Marke, BMW = Wettbewerber). Enthalten sind:
- Kopf, Kennzahlen, Kurve (3 Modi Tag, einmal Woche) und Varianten;
- Citations: Ring Domain und URL, Domains, URLs, „erwähnt = yes“ und die Exporte;
- Responses: erste Seite, Suche, Seite > 100 und kombiniert mit `p_company_ids`;
- der Responses-Export;
- inaktive Marke, Marke ohne Nennung und fremde Marke;
- jede Fehlerform.

**Grundregel:** Alles im Drawer ist aus Sicht der Drawer-Marke.

## 1. Kopf: `brand_detail_v1`
`POST /rest/v1/rpc/brand_detail_v1` mit `{ p_team, p_company }` (Header `Content-Profile: app`, Nutzer-JWT)
```
{ meta: { team_id, company_id, data_as_of },
  row:  { company_id, name,            // Team-Override, sonst globaler Name
          domain,                      // ohne Schema und www., z. B. "bmw.de"
          logo_url,                    // eigene Marke: Team-Logo, sonst Favicon; immer https
          favicon_url,
          role: 'own' | 'competitor',
          status: 'active' | 'inactive',
          color,                       // Team-Farbe, sonst Standardfarbe; kann null sein
          tracked_since,               // Beginn des laufenden (bei inaktiv: des letzten) Beobachtungszeitraums
          last_mentioned_at,           // letzte Antwort mit Nennung, null wenn nie
          deactivated_at } }           // nur bei inaktiv
```
Der Kopf hat keinen Zeitraum.

## 2. Komponenten
| Komponente | RPC | Hinweis |
|---|---|---|
| Kennzahlen | `cached_dashboard_overview_v1(…, p_companies => [id])` | Zeile mit `company_id = id` aus `rows`: `visibility_pct`, `avg_rank`, `sentiment`, `mentions`, jeweils mit `_prev`/`_delta` |
| Kurve | `performance_company_chart_v1(p_team, p_company, …, p_mode, p_granularity)` | Modi `visibility`, `rank`, `sentiment`; Tag/Woche/Monat |
| Varianten | `performance_brand_variations_v1(p_team, p_company, …)` | alle Schreibweisen |
| Top Citations | `cached_citations_overview_v1(…, p_mode, p_brand)` für den Ring, `cached_citations_domains_v1` / `_urls_v1(…, p_brand)` für die Liste | nur Zitate aus Antworten, die die Marke nennen |
| Responses | `cached_dashboard_responses_v1(…, p_brand)` | nur Antworten, die die Marke nennen |
| Exporte | `export_responses_v1`, `export_citations_domains_v1`, `export_citations_urls_v1` jeweils mit `p_brand` | Bubble-Workflows: `p_brand` durchreichen, leer heißt `null` |

**Regeln:**
- `p_brand` ist überall der letzte, optionale Parameter. Ohne ihn ist alles wie bisher; der Vorher/Nachher-Vergleich ist identisch.
- Mitgeben: Kalender (`p_date_from`, `p_date_to`) und Modelle.
- **Citations mit `p_brand`:**
  - `meta.runs_with_any` = Antworten mit Nennung und mindestens einer Quelle; Anteile beziehen sich darauf.
  - `meta.brand_id` ist gesetzt.
  - `p_mentioned` = „Seite erwähnt die Drawer-Marke“. Die Checkbox heißt daher „<Markenname> mentioned“.
  - `is_mentioned` in den Zeilen bezieht sich ebenfalls auf die Drawer-Marke.
- **Responses mit `p_brand`:**
  - `user_rank` und `user_sentiment` sind die der Drawer-Marke.
  - `own_mentioned`/`has_user_brand` bleiben die eigene Marke.
  - `meta.filters.brand` ist gesetzt.
  - `p_company_ids` wirkt zusätzlich (UND).
- **„Mentioned“-Checkbox in der Responses-Tabelle (Lukas):** Sie zeigt „<Markenname> mentioned = yes“, angehakt, ausgegraut und nicht klickbar, damit klar ist, was die Tabelle zeigt. `p_mentioned` **nicht** mitschicken: Er meint dort die eigene Marke.
- Geprüft (7 und 30 Tage, Mercedes und BMW): `total_count` der Responses = Export = `mentions` der Overview = Läufe mit Nennung. In 7 Tagen sind das für BMW 596 und für Mercedes 503. Citations `runs_with_any` ist höchstens so groß (BMW: 591).

## 3. Inaktive Marke (nur über alte Links)
- `brand_detail_v1` liefert `status: 'inactive'` mit `deactivated_at`.
- Kurve und Varianten antworten mit `performance_not_found` (PT404).
- Overview, Responses und Citations liefern leer bzw. 0.
- Der Drawer zeigt statt Zahlen einen Hinweis („Diese Marke wird nicht mehr beobachtet.“).

**Ohne Nennung im Zeitraum:**
- Overview: `mentions` 0, `visibility_pct` null.
- Kurve: Punkte ohne Werte.
- Varianten: leer.
- Responses und Citations: leer.
- Den Leerzustand zeigen.

**Fremde Marke** in den Komponenten: leer, ohne Fehler. Nur `brand_detail_v1` sagt `brand_not_found`.

## Fehler von `brand_detail_v1` (`message` = Code)
| SQLSTATE | message | hint | Drawer |
|---|---|---|---|
| 28000 | `settings_not_authenticated` | – | Anmeldung |
| 42501 | `team_forbidden` | – | kein Zugriff |
| PT404 | `team_deleted` | – | Team gelöscht |
| PT402 | `team_access_<state>` | Zustand | Hinweis auf Abo |
| 22023 | `team_invalid_param` | `p_team` / `p_company` | – |
| PT404 | `brand_not_found` | – | „Diese Marke gibt es in diesem Team nicht.“ (auch fremd) |
| PT429 | `brand_rate_limited` | Sekunden | kurz warten (120 je Minute) |

## Laufzeit (kalt, im Test)
| Aufruf | 7 Tage | 30 Tage |
|---|---|---|
| `brand_detail_v1` | unter 100 ms | – |
| Overview | 0,2–1,8 s | – |
| Kurve | unter 20 ms | – |
| Varianten | 35 ms | – |
| Responses mit `p_brand` | 0,1–0,5 s | – |
| Citations mit `p_brand` | 0,3–1,5 s | bis etwa 3 s bei großen Marken |

Die Citations mit `p_brand` werden über die Läufe gerechnet statt über die Rollups. Warm kommt alles aus dem Cache (6 Stunden, gleiche Datenversion).

## Alt bleibt
`get_company_detailed_overview_v4`, `…chart_v3/v4` und `get_company_brand_name_variations_v2` bleiben für Bubble. Nach `brand_alt_absichern.sql` prüfen sie zusätzlich den Zugang. `get_company_edit_v2` liefert für fremde Marken `brand_not_found`.
