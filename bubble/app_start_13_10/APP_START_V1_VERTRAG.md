# App-Start v1: Vertrag für Claude Code (13.10.2026)

Dieser Vertrag ersetzt den Bubble-Start der Hauptseite: `user_settings` per REST, `get_my_teams_v4`, `get_team_brand_header_v9`, `get_team_plan_quota*`, `get_markets_v2`, `get_tags*`, `get_team_companies_v1`, `get_active_user_notification_v1` und `setUpstreemAuth`.

- **Echte Antworten:** `app_start_v1_echte_antworten.json`, 26 Fälle, ungekürzt.
  - Die Fälle stammen aus Produktion, aber in einer Transaktion mit Rollback: Es wurde nichts gespeichert.
  - Zwei Fälle sind gekürzt und dort markiert: Fall 13 (der Rest ist identisch mit Fall 12) und Fall 25 (die Marktliste, 3 von 134).
- **Alle Aufrufe:** `POST /rest/v1/rpc/<name>` mit Header `Content-Profile: app`.
  - Das Token kommt aus der Plugin-Sitzung. Es gibt kein JWT im Run-JS und kein `setUpstreemAuth` mehr.
  - anon darf keine dieser Funktionen ausführen.
- **Antwortform:** immer `{meta, row}`. Einzige Ausnahme ist `markets_all_v1` mit `{meta, rows}`.

---

## 1 Ablauf

```
Seite lädt
 └─ app_start_v1(p_team_hint)                     1 Aufruf, schreibt nichts
     ├─ row = null                     -> Onboarding (Nutzer ohne Team)
     ├─ row.access.has_access = false  -> Gate (Billing-Bildschirm), KEINE weiteren Team-Aufrufe
     └─ sonst
         ├─ team_context_v1(active_team_id)        Speicher: brands, topics, markets, models, events
         ├─ user_notification_v1(active_team_id)   höchstens eine Karte
         └─ markets_all_v1()                       einmal je Sitzung (global, 134 Märkte)

Teamwechsel
 └─ team_switch_v1(p_team)  -> Antwort wie app_start_v1 (neues aktives Team)
     └─ wie oben: Gate oder team_context_v1(p_team) + user_notification_v1(p_team)

Eigene Änderung an Marken / Themen / Modellen / Events
 └─ team_context_v1(team, ['brands'] | ['topics'] | ['models'] | ['events'] | ['markets'])   nur den Teil

Theme
 └─ user_settings_set_v1('theme', 'dark' | 'light' | 'system')

Karte wegklicken
 └─ user_notification_dismiss_v1(id, 'close' | 'secondary' | 'primary')
```

- **`p_team_hint`:** das Team aus der URL bzw. aus dem Tab-Zustand, falls vorhanden. Sonst `null`.
  - Ein fremder, unbekannter oder gelöschter Hinweis wird still übergangen. Es gibt dafür nie einen Fehler und nie fremde Daten (Fall 08, 13).
- **Kein Polling.** Der Speicher lädt nur nach eigenen Änderungen und beim Teamwechsel neu.
- **Mehrere Tabs:** `app_start_v1` schreibt nichts. Jeder Tab behält sein Team. Nur `team_switch_v1` setzt `last_team_id`, also das Team für den nächsten Start ohne Hinweis.

---

## 2 Funktionen

### 2.1 `app_start_v1(p_team_hint uuid default null)`
**Wofür:** alles für das erste Bild. Ratenlimit 60/min je Nutzer.

```
meta: {
  user:     { id, email, display_name, avatar_url },
  settings: { theme },                               // 'dark' | 'light' | 'system' (ohne Zeile: 'system')
  teams:    [{ id, name, domain, favicon_url, role, has_access, access_state, created_at }],
  active_team_id: uuid | null,
  active_reason:  'hint' | 'last' | 'first' | 'none',
  data_as_of
}
row: null | {
  team_id, team_name, role,                          // role: owner | admin | member
  own_brand: { company_id, name, logo_url, domain, color } | null,
  default_market: { alpha2, name, flag_url } | null,
  timezone,
  access: { team_id, team_name, has_access, access_state, access_ended_at, can_manage_billing,
            plan_id, plan_name, billing_interval, monthly_price_eur, yearly_price_eur },
  quota:  { used, total, plan, competitors_used, competitors_total, models_used, models_total }
}
```

- **`display_name` und `avatar_url`** setzt der Nutzer selbst.
  - Immer als Text rendern, nie als HTML.
  - `avatar_url` ist nur `https` oder `null`.
  - `display_name` ist bereinigt (keine Steuer- und Richtungszeichen) und höchstens 100 Zeichen lang.
- **`teams`** sind sortiert nach `created_at`.
  - Gelöschte Teams sieht nur der Owner, mit `access_state: 'deleted'`, zum Wiederherstellen.
  - Gelöschte Teams werden nie automatisch aktiv (Fall 12).
- **Regel für das aktive Team:**
  1. Hinweis, wenn Mitglied und nicht gelöscht;
  2. sonst `last_team_id`, wenn Mitglied und nicht gelöscht;
  3. sonst das erste Team mit Zugang;
  4. sonst das erste nicht gelöschte Team;
  5. sonst `none`.
- **`quota` und `access`** sind identisch mit `get_team_plan_quota_v3` für Teams mit Plan. Ohne Plan gibt es keinen Fehler mehr, sondern `access_state: 'no_plan'` und `null` bei den Plan-Feldern (Fall 06).
- **Laufzeit in der Datenbank:** 7–16 ms.

### 2.2 `team_context_v1(p_team uuid, p_parts text[] default null)`
**Wofür:** der Speicher des Teams. Ratenlimit 120/min.

- **`p_parts`** ⊂ `brands`, `topics`, `markets`, `models`, `events`. `null` lädt alle Teile. Ein anderer Wert ergibt `22023 app_invalid_param`, hint `p_parts`.
- **Nicht Mitglied** → `42501 team_forbidden`. **Ohne Zugang** → `PT402 team_access_<state>`, hint = Zustand (Fall 07, 14).
- **Antwort:** `{meta: {team_id, parts, data_as_of}, row: {<teil>: [...]}}`. Es kommen nur die angefragten Teile.

| Teil | Felder | Reihenfolge |
|---|---|---|
| `brands` | `company_id, name, logo_url, role, domain, color` (gleiche Form wie der Brands-Speicher aus Brands v1) | eigene zuerst |
| `topics` | `id, name, emoji, hex_light, hex_dark, is_active, prompt_count, created_at` | neueste zuerst |
| `markets` | `alpha2, name, flag_url, region, subregion, prompt_count, last_used_at` (nur Märkte aktiver Prompts) | `prompt_count` absteigend |
| `models` | `key, display_name, logo_url, provider, is_active, color_lightmode, color_darkmode` (eingeschaltete Modelle des Teams; ohne Team-Einstellung die Modelle des Plans, es wird nichts angelegt) | `sort_order` |
| `events` | `id, event_date (YYYY-MM-DD), name, event_type, color, icon` | neueste zuerst |

### 2.3 `markets_all_v1()`
`{meta: {count, data_as_of}, rows: [{alpha2, name, flag_url, region, subregion, language_code}]}`, sortiert nach Name. Diese Liste in der Sitzung halten.

### 2.4 `team_switch_v1(p_team uuid)`
- Ratenlimit 30/min.
- **Erlaubt:** jedes eigene Team, auch ohne Zugang, damit das Gate den Billing-Bildschirm zeigen kann. Gelöschte Teams nur für den Owner.
- **Fremdes Team oder gelöschtes Team als Nicht-Owner** → `42501 team_forbidden` (Fall 10).
- **Schreibt `last_team_id`.** Die Antwort hat die Form von `app_start_v1` mit diesem Team, `active_reason: 'last'` (Fall 11).

### 2.5 `user_notification_v1(p_team uuid default null)`
- **`row`:** `{id, title, body, color, cta_label, cta_url, notification_type, priority, created_at}` oder `null`.
- **`color`** ist immer `#RRGGBB`.
- **`cta_url`** ist nur `https://…` (≤ 2000 Zeichen), sonst `null`. Ohne `cta_url` keinen Link rendern (Fall 17).
- **Fremdes `p_team`** zählt wie kein Team; `meta.team_id` ist dann `null`.

### 2.6 `user_notification_dismiss_v1(p_id uuid, p_reason text default 'close')`
- **`p_reason`:** `close` (X), `secondary` (zweiter Knopf) oder `primary` (CTA geklickt).
- **Nur Karten, die der Nutzer sehen darf.** Jede andere Id ergibt `22023 app_invalid_param`, hint `p_id`. Doppelt wegklicken ist kein Fehler.
- **Ratenlimit** 30/min.

### 2.7 `user_settings_set_v1(p_key text, p_value text)`
- **Erlaubt:** nur `theme` mit `dark | light | system`.
- **Antwort:** `{meta: {key}, row: {theme}}`.
- **Ratenlimit** 30/min.
- **Kein REST mehr auf `user_settings`.**

---

## 3 Zugang (Gate)

| `access_state` | `has_access` | wann | Oberfläche |
|---|---|---|---|
| `active` | true | Abo aktiv, Trial läuft, Plan ohne Stripe | normal |
| `canceling` | true | gekündigt, Zugang bis `access_ended_at` | normal + Hinweis „endet am …“ |
| `trial_ended` | false | Trial seit über 1 Tag vorbei, keine Zahlung | Gate |
| `past_due` | false | Zahlung offen (`past_due`, `incomplete`) | Gate (Zahlung aktualisieren) |
| `unpaid` | false | Stripe `unpaid` | Gate |
| `ended` | false | Abo beendet | Gate |
| `no_plan` | false | Team ohne Plan | Gate (Plan wählen) |
| `deleted` | false | Team gelöscht (nur Owner sieht es) | Wiederherstellen-Hinweis |

- **`can_manage_billing`** ist true für owner und admin. Members sehen im Gate „Bitte Owner/Admin fragen“.
- **Seit `app_start_zugang.sql`** gibt jede Seitenfunktion mit Team-Parameter für ein Team ohne Zugang `PT402 team_access_<state>` zurück (HTTP 402, hint = Zustand). Das betrifft alte und neue Funktionen.
  - **Regel für core:** HTTP 402 → Gate zeigen, nicht als Fehler-Toast.
  - Zehn alte Funktionen fangen Fehler selbst ab und antworten stattdessen `{status: 'error', status_message: …}`. Bei diesen steht `team_access_<state>` in der Meldung: `add_competitor_v4`, `add_team_competitor_v1`, `create_prompt_with_tags`, `create_prompt_with_tags_v3`, `create_prompt_with_tags_v4`, `reactivate_competitor_v1`, `reactivate_competitor_v2`, `deactivate_competitor_v5`, `reset_team_url_v1`, `update_team_company_display_name_v1`.
- **Ohne Zugangssperre** (Ausnahmen, weil sie ohne Zugang laufen müssen):
  - Start, Benachrichtigung und Teamwechsel;
  - Billing und Teamverwaltung (Einladungen, Mitglieder, Rollen, Verlassen, Löschen, Protokoll);
  - Marken-Einstellungen und Onboarding.

---

## 4 Fehler

| HTTP | SQLSTATE | message | hint | wann |
|---|---|---|---|---|
| 401 | 42501 | `permission denied for function …` | – | ohne Token (Fall 24) |
| 403 | 28000 | `app_not_authenticated` | – | Token ohne Nutzer |
| 403 | 42501 | `team_forbidden` | – | fremdes Team (Fall 09, 10) |
| 402 | PT402 | `team_access_<state>` | Zustand | Team ohne Zugang (Fall 07, 14) |
| 429 | PT429 | `app_rate_limited` | – | Ratenlimit (Fall 26) |
| 400 | 22023 | `app_invalid_param` | Feldname | falscher Parameter (Fall 18, 19, 21, 22, 23) |

**Ratenlimits je Nutzer und Minute:**

| Funktion | Limit |
|---|---|
| Start | 60 |
| Teamwechsel | 30 |
| Speicher | 120 |
| Wegklicken | 30 |
| Einstellungen | 30 |

Bei 429 nicht sofort wiederholen, sondern einige Sekunden warten.

---

## 5 Was core nicht mehr tut
- **`user_settings` per REST** lesen oder schreiben: Theme kommt aus dem Start und wird über `user_settings_set_v1` gesetzt.
- **`last_team_id` schreiben.** Das macht nur `team_switch_v1`.
- **`get_team_brand_header_v9` aufrufen.** Diese Funktion schreibt beim Lesen `last_team_id`.
- **`get_my_teams_v4`, `get_team_plan_quota*`, `get_markets_v2`, `get_tags*`, `get_team_companies_v1`, `get_team_model_settings_v1` und `get_active_user_notification_v1`/`dismiss_user_notification_v1` für den Start nutzen.**
- **`clear_*_cache` nach Änderungen aufrufen.** Die v1-Caches leeren sich selbst.

---

## 6 Einspielen (Lukas, je Datei ein Block, in dieser Reihenfolge)
1. **`app_start_sofort.sql`** (Rückweg `app_start_sofort_rueckweg.sql`): S1 bis S5, damit sind die akuten Lücken zu. Bubble läuft unverändert weiter (getestet: Teams, Header, Quota, Märkte, Tags, Firmen, Tag anlegen, Suche, Mira, Power-Dashboard).
2. **`app_start_v1.sql`** (Rückweg `app_start_v1_rueckweg.sql`): neue Funktionen und die Spalte `reason`. Bestehendes ändert sich nicht.
3. **`app_start_zugang.sql`** (Rückweg `app_start_zugang_rueckweg.sql`): Zugangssperre in 177 Funktionen (166 plpgsql, 11 SQL), `team_access` mit 1 Tag Trial-Karenz.
   - **Wirkung in Bubble:** Die zwei Teams ohne Plan, **Factory Bottrop/Altura Labs** (cf32814c, Owner Lukas) und **Rösterei** (356039e3), bekommen auf den Datenseiten Fehler statt Daten.
   - Alle anderen 12 Teams haben einen Plan und merken nichts.
   - Wer diese zwei Teams weiter nutzen will, gibt ihnen vorher einen Plan.

**Rückwege immer in umgekehrter Reihenfolge:** zugang → v1 → sofort. Der v1-Rückweg bricht ab, solange die Zugangssperre noch steht.

Jede Datei endet mit einer Testabfrage. Die erwarteten Werte stehen in den Spaltennamen.
