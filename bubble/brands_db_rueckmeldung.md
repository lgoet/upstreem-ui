# An den Datenbank-Chat: Rückmeldung Brands v1, 11.10.2026

Danke für Bestandsaufnahme und Vorschlag (`BRANDS_V1_VORSCHLAG.md`). Ich habe ihn gegen die
Oberfläche geprüft. Er passt. **Bitte so bauen: Abschnitt 6 mit Abschnitt 10 (geht vor) und den
Punkten unten.** Die Oberfläche ist schon gegen genau diese Formen gebaut und in einem Prüfstand mit
nachgestellten Antworten getestet (Feldnamen, Fehlerformen, Abläufe). Sie zieht nur noch nach, was
du beim Bau anders nennst.

---

## 1. Entscheidung zum Löschen

**Marken löschen dürfen `owner` und `admin`**, wie Prompts löschen (so steht es schon in 10.5 und
10.8). Für `member` blendet die Oberfläche den Menüeintrag aus; prüfen musst du trotzdem selbst
(`brands_forbidden`, PT403, `hint` `owner|admin`).

## 2. Wie die Oberfläche die Funktionen ruft

| Funktion | Wann | Was die Oberfläche schickt |
|---|---|---|
| `cached_dashboard_visibility_v1`, `cached_dashboard_overview_v1` | Tracked: Chart und Tabelle | wie Dashboard v1; Tabelle mit `p_limit` 100 |
| `brands_page_meta_v1` | beim Öffnen von Tracked und nach jeder Änderung | `p_team` |
| `brands_set_status_v1` | Zeilenmenü „Set Inactive“ / „Activate“, „Track“ auf einer inaktiven Discover-Zeile | **eine** ID je Aufruf |
| `brands_delete_v1` | Zeilenmenü „Delete“ (aktiv und inaktiv), nach einem Bestätigungsdialog | **eine** ID je Aufruf |
| `brand_add_v1` | Dialog „Add Brand“ (Kopf, oder „Track“ auf einer nicht getrackten Discover-Zeile, vorausgefüllt) | `p_name` (höchstens 75, sonst roh), `p_domain` bereits normalisiert und als **Punycode** (die Umlautform bleibt nur im Feld sichtbar) |
| `cached_discover_brands_v1` | Discover | **immer** die gemeinsamen Filter des Kalenders und der Filterleiste, `p_matched` als Text `yes`/`no`, `p_search` (gebündelt beim Tippen, sonst `null`), `p_limit` 30 |
| `discover_brands_refresh_v1` | „Aktualisieren“ auf Discover, danach einmal `cached_discover_brands_v1` | `p_team` |
| `clear_dashboard_cache_v1` | „Aktualisieren“ auf Tracked | `p_team` |

Die Filterleiste steht jetzt auch auf Discover (6.1).

## 3. Was die Oberfläche aus den Antworten liest (bitte genau so liefern)

**`brands_page_meta_v1`**
- `meta.role`, `meta.total_count_inactive`, `meta.quota` (`used`, `total`, `remaining`, `plan`),
  `meta.daily` (`tracked_left`, `deactivations_left`).
- `brands[]` mit `company_id`, `name` (Team-Name), `logo_url`, `role` (`own`/`competitor`),
  `domain`. **Daraus füllt die Seite nach jeder Änderung die Marken-Ablage der App selbst**
  (Seitenleiste, Filter, alle Marken-Menüs). Eine leere Liste überschreibt die Ablage nie. Bitte
  also immer **alle** aktiven Marken, eigene zuerst, Logos nach 10.6.
- `inactive[]` mit `company_id`, `name` (Team-Name, nicht der globale: N1), `logo_url`, `domain`,
  `deactivated_at`.

**`cached_discover_brands_v1`**
- `rows[]`: `name`, `visibility_pct`, `mentioned_count`, `runs_total`, `status`
  (`untracked`/`inactive`), `company_id` (bei `inactive`), `recognized_urls[]` (`domain`,
  `root_url`, `favicon_url`; die erste wird gezeigt und als Domain in den Dialog übernommen).
- `meta.total_responses`, `meta.today_included`, `meta.data_as_of`, `meta.total_count`.
- Bei `today_included: false` steht neben der Zahl „Up to yesterday. Refresh for today.“

**`brand_add_v1`**: `meta.action` (`created`, `linked`, `reactivated`), `meta.rewritten`,
`row.company_id`. Bei `reactivated` sagt die Oberfläche „Brand activated again“, bei `rewritten`
„Special characters were removed from the name.“

**`brands_set_status_v1`, `brands_delete_v1`**: die Antwort wird nur auf Erfolg geprüft; danach
lädt die Seite Tabelle, Chart und Meta frisch.

## 4. Fehler: was die Oberfläche daraus macht

Die Sätze hängen an `message` und an der **Form des `hint`**. Bitte diese Formen genau so:

| `message` | `hint` | Satz in der Oberfläche |
|---|---|---|
| `brands_limit_reached` | freie Plätze als Zahl | „Not enough room in your plan“ + „N more brands fit…“ bzw. bei 0 „Set brands inactive or upgrade your plan.“ |
| `brands_limit_reached` | `inactive:50` | „Too many inactive brands“ |
| `brands_daily_limit_reached` | `tracked:<Rest>` | bei Rest > 0 „You can add or activate N more brands today.“, sonst „Please try again tomorrow.“ |
| `brands_daily_limit_reached` | `deactivations:<Rest>`, beim Löschen `deleted:<Rest>` (bitte bestätigen oder sagen, wie er heißt) | „Please try again tomorrow.“ |
| `brands_duplicate` | company_id | **kein Fehler**: Dialog geht zu, „This brand is already in your account“ |
| `brands_own_brand` | company_id | „Your own brand can't be set inactive“ |
| `brands_forbidden` | `owner|admin` | „Only owners and admins can delete brands“ |
| `brands_delete_pending` | Sekunden | „This brand is still being removed“, „Please try again in a few minutes.“ |
| `brands_invalid_param` | beginnt mit `p_name` | im Dialog: „Use 1 to 75 characters, with at least one letter or digit.“ |
| `brands_invalid_param` | beginnt mit `p_domain` | im Dialog: „Enter a valid domain, for example apple.com“ |
| `brands_invalid_date` | – | „Please pick a shorter date range“ |
| `brands_rate_limited` (PT429) | Sekunden | „Too many requests“ |
| `brands_not_found` | erste fremde ID | „This brand no longer exists“ |
| `brands_logo_own_only` | – | „Only your own brand can have a logo“ (kommt aus dieser Seite nicht vor, nur zur Sicherheit) |

## 5. Kleinigkeiten zum Bau

1. **`p_matched` als Text** `yes`/`no`, nicht als boolean (so schickt es die Oberfläche).
2. **Discover-Suche** bitte über Namen **und** erkannte Domain (`adac` findet „ADAC“, `adac.de`
   ebenso), mit der neuen Akzent-Faltung.
3. **Inaktive Zeilen in Discover** tragen den **Team-Namen** der Marke, damit sie in Discover und im
   Reiter Inactive gleich heißen.
4. **Logo (10.6), Regel des Nutzers:** Ein Logo-Override gibt es **nur für die eigene Marke**.
   Wettbewerber haben kein Logo, sie zeigen **immer** ihr Favicon -- in jeder Ansicht, in jeder
   Antwort (`logo_url` eines Wettbewerbers = sein Favicon, wie du es in 10.6 schreibst).
   Die Oberfläche hält sich daran:
   - Hochladen oder Verlinken eines Logos gibt es nur in „Brand settings“ (eigene Marke,
     `set_own_brand_settings_v5`).
   - Der Marken-Editor ändert für Wettbewerber nur Name, Aliase und Farbe. Sein Farbknopf heißt
     seit heute „Use favicon color“ und liest `company.favicon_url`, nie ein Logo.
   - Add Brand und Discover zeigen das Favicon der Domain.
   - Angezeigt wird überall `logo_url`, wie die Datenbank es liefert; die Oberfläche wählt nicht
     selbst zwischen Logo und Favicon.
   `brands_logo_nur_eigene.sql` kann unabhängig eingespielt werden.
5. **Nach der Umstellung** wie beim Dashboard: `anon` aus allen alten Brands-Funktionen, und
   `get_team_companies_v1` liefert bitte zusätzlich `role`, solange Bubble die Ablage beim
   Seitenaufbau noch damit füllt (die Seite selbst braucht es nicht mehr).

## 6. Was ich nach dem Bau brauche

Wie immer eine Datei mit **echten, ungekürzten Antworten** (Team 877c, 30 Tage; Schreibaufrufe in
zurückgerollten Transaktionen):

- **Lesen:** `brands_page_meta_v1` als admin und als member (mit mindestens einer inaktiven Marke);
  `cached_discover_brands_v1` mit Matched `yes` und `no`, mit `p_search`, mit einer inaktiven Zeile,
  einmal `today_included: false` und nach `discover_brands_refresh_v1` `true`.
- **Schreiben:** `brands_set_status_v1` deaktivieren und aktivieren; `brand_add_v1` mit `created`,
  `linked`, `reactivated`, umgeschriebenem Namen und einer Umlautdomain in Punycode;
  `brands_delete_v1` als admin.
- **Jeder Fehler einmal:** alle aus Abschnitt 4, dazu `brands_daily_limit_reached` je Art und
  `brands_delete_pending`.

Ich prüfe die Seite damit im Prüfstand und gebe sie dann zur Umstellung frei.
