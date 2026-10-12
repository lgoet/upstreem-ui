# Auftrag an den Datenbank-Chat: App-Start der Hauptseite (Stand 13.10.2026)

Diesen ganzen Text als erste Nachricht in den Datenbank-Chat geben. Er ist in sich vollständig.

**Diese Runde ist eine BESTANDSAUFNAHME mit FEHLERSUCHE, MISSBRAUCHSPRÜFUNG, AUFRÄUMLISTE und VORSCHLAG. Du änderst nichts.**

Der Seitenaufbau der Hauptseite (`index`) ist der letzte große Bubble-Workflow, an dem jede Komponente hängt. Er wird zu einem Start, den core selbst ausführt (`UC.rpc` mit dem Nutzer-JWT). Das ist zugleich die Voraussetzung für die Next.js-Migration: Dort gibt es keine Bubble-Workflows, der Start muss also ohne sie laufen.

Lukas: „Das Ding muss einfach nur bulletproof sein. Super sicher. Vor Fraud und Spam geschützt.“ Wie man es zuschneidet (ein Aufruf oder mehrere), entscheidest du nach Befund, siehe Abschnitt 4.

Es gelten dieselbe Bauart und dieselben Regeln wie in den letzten Runden:
- `security definer` mit festem `search_path`;
- kein anon;
- der Nutzer kommt aus `auth.uid()`;
- Antworten als `{meta, row}` bzw. `{meta, rows}`;
- stabile Fehler-`message`, kein 200 mit `status: error`;
- `_pi_rate_limit_v1`;
- nichts außerhalb der Transaktion;
- **Lesen schreibt nie**.

---

## 0. Was der Seitenaufbau heute tut

Bubble, Workflow „Do once, wenn AUTH's User ID nicht leer“, 31 Schritte:

| Schritt | Was | Was in der App ankommt |
|---|---|---|
| 1–2, 26–27 | Ladebild an und aus | – |
| 3 | **Tabellen-Abruf `user_settings`** (Data API, Filter auf die User-ID). Gebraucht wird laut Lukas nur das gespeicherte Thema. | – |
| 4 | Thema setzen | `setUpstreemTheme("dark"\|"light"\|"system")` |
| 5 | RPC `get_my_teams` | – |
| 6–7 | Aktives Team: `last_team_id`, wenn das Team noch existiert, sonst Rückfall auf ein anderes. `get_my_teams` prüft das. | State |
| 8–9 | `?teamid=` in der Adresse: Prüfung, dann aus der Adresse entfernen | State |
| 10 | RPC `get_team_brand_header`. Laut Brands-Runde schreibt `get_team_brand_header_v9` nebenbei `user_settings.last_team_id` (15.233 Aufrufe), und Bubble ruft sie app-weit auch ohne Nutzertoken. | – |
| 11 | Team setzen | `setUpstreemTeam(id)` |
| 12 | Standardmarkt | `setUpstreemDefaultMarket(alpha2)` |
| 13 | Rolle im Team als State | – |
| 14 | Ohne Team: zum Onboarding | – |
| 15 | REFRESH_Quoata: `get_team_plan_quota`, dann `setUpstreemQuota` **und** `setAccessGate` (Zugangs-Gate) | Quota, Gate |
| 16–17 | RPC `get_active_user_notification` | `setUpstreemNotifications` (Karte unten rechts, wegklickbar) |
| 18 | REFRESH_Markets: `get_markets` | `setUpstreemMarkets` (Märkte mit Prompts) |
| 19 | REFRESH_Tags: `get_tags` | `setUpstreemTopics` |
| 20 | REFRESH_Brands: `get_team_companies` | `setUpstreemBrands` |
| 21 | REFRESH_ALL_Markets: „get_markets FULL“ | `setUpstreemAllMarkets` |
| 22 | REFRESH_EVENTS: `list_impact_events` | `setUpstreemEvents` |
| 23 | Modelle | `setUpstreemModels([...])`. Woher die Daten kommen, bitte aus dem Bestand ableiten. |
| 24 | **„Set Internal AUTH“** | `setUpstreemAuth(token, key)`. Das Nutzer-JWT geht als Text in einen Run-JS-Schritt. |
| 25 | Seitenleiste | `setSidebarTeams("sidebar_upstreem", [...])` |
| 29–31 | `drawersReady()`, `setSidebarReady()`, State `app_ready` | – |

Die Custom Events (REFRESH_*) laufen außerdem **erneut**, sobald eine Komponente meldet, dass sich etwas geändert hat:
- `bubble_fn_upTopicsChanged`: neues Topic, Prompt angelegt, inaktiv usw.;
- `bubble_fn_upMarketsChanged`;
- `bubble_fn_upBrandsChanged`;
- `bubble_fn_upEventsChanged`.

Bubble ruft dann den RPC erneut und den Setter mit dem Ergebnis.

**RPCs auf der Seite** (Liste von Lukas):
- `get_my_teams`, `get_team_brand_header`, `team_portfolio_overview`;
- `clear_prompt_insights_cache`, `clear_competition_overview_cache`, `clear_citation_overview_cache`;
- `get_active_user_notification`, `dismiss_user_notification`;
- `list_impact_events`, `get_team_companies`, `search_quick_actions`, `get_team_plan_quota`;
- `get_tags`, `get_markets`, „get_markets FULL“, `get_billing_plans`.

Quick-Actions-Suche und Einstellungen-Popup sind eigene Runden danach. Hier gehören sie nur in die Bestandsaufnahme (1.1) und die Aufräumliste.

## 0.1 Die Formen, die die App liest (das liefert der Start)

Core hat für jeden Teil einen Speicher. Die Komponenten lesen diese Felder:

| Teil | Felder |
|---|---|
| Thema | `dark` \| `light` \| `system` |
| Team | `id`. Seitenleiste je Team: `id`, `name`, `favicon_url`, `domain`. Der Gate-Knopf „Switch team“ liest dieselbe Liste. |
| Nutzer | `id`, `name`, `email`, `avatar_url` (Seitenleiste, Begrüßung, Einstellungen) |
| Rolle | `owner` \| `admin` \| `member` |
| Standardmarkt | `alpha2` |
| Quota | `used`, `total`, `plan` |
| Zugang (Gate) | `team_id`, `team_name`, `has_access` (nur ausdrücklich `false` sperrt), `access_state` (`deleted`, `past_due`, `unpaid`, `trial_ended`, `no_plan`, `ended`), `access_ended_at`, `can_manage_billing`, `plan_id`, `plan_name`, `billing_interval`, `monthly_price_eur`, `yearly_price_eur` |
| Märkte (mit Prompts) und alle Märkte | `alpha2`, `name`, `flag_url`, `region`, `subregion`, `prompt_count`, `last_used_at` |
| Topics | `id`, `name`, `emoji`, `hex_light`, `hex_dark`, `is_active`, `prompt_count`, `created_at` |
| Marken | `company_id`, `name`, `logo_url` (eigene Marke: Logo, Wettbewerber: Favicon), `role` (`own` \| `competitor`), `domain`, `color` |
| Events | `id`, `event_date` (`YYYY-MM-DD`), `name`, `event_type`, `color`, `icon` (Emoji) |
| Modelle | `key`, `display_name`, `logo_url`, `provider`, `is_active` |
| Benachrichtigung | `id`, `title`, `body`, `cta_label`, `cta_url`, `notification_type`, `priority`, `created_at`; eine Karte zur Zeit |

---

## 1. Bestandsaufnahme (bitte mit Definition und echtem Beispiel)

1. **Jede Funktion aus der Liste in Abschnitt 0:**
   - Definition, Parameter, `security definer`/`invoker`, `search_path`, Rechte (anon, authenticated, service_role), md5;
   - was sie liest und **schreibt**;
   - Aufrufe in den letzten 30 Tagen nach Rolle (`pg_stat_statements`);
   - Laufzeit kalt und warm für Team 877c.

   Dazu die Versionen dahinter: Bubble ruft unter diesen Namen bestimmte Versionen, bitte zuordnen.
2. **`user_settings`:**
   - Spalten, RLS-Policies;
   - wer liest und schreibt (Bubble Data API, `get_team_brand_header_v9`, andere);
   - welche Felder heute benutzt werden (Thema, `last_team_id`, weitere?).
3. **Aktives Team:**
   - Wie entscheidet `get_my_teams` heute zwischen `last_team_id`, Rückfall und `?teamid=`?
   - Wer schreibt `last_team_id` (Teamwechsel in der Seitenleiste `usnTeam`, „New Team“, Onboarding-Finalize, `get_team_brand_header`)?
4. **Zugang:** `get_team_plan_quota` mit den Gate-Feldern (`team_access`, `access_state`, …): eine echte Antwort je Zustand, soweit es Teams in diesem Zustand gibt.
5. **Benachrichtigungen:**
   - Tabelle, Auswahlregel von `get_active_user_notification`;
   - was `dismiss_user_notification` schreibt;
   - wer Benachrichtigungen anlegt.
6. **Modelle:** Woher kommen sie heute (Team-Modelleinstellungen, Plan)?
7. **Die drei `clear_*_cache`:** Wer ruft sie wann? Gehören sie überhaupt zum Seitenaufbau?
8. **Größe:** Wie viele Zeilen haben Topics, Märkte, alle Märkte (ist die Liste global gleich?), Marken und Events je Team im Schnitt und im Maximum? Wie groß wäre eine Startantwort für das größte Team?

## 2. Prüfung (Befund, Schwere, Vorschlag)

1. **Fremdes Team:**
   - `?teamid=` aus der Adresse, `last_team_id` aus `user_settings` und jede `p_team`-Angabe sind frei wählbar.
   - Kann ein Nutzer ein fremdes Team zum aktiven machen, dessen Daten lesen oder in `last_team_id` schreiben? Ebenso gelöschte Teams, Teams, aus denen er entfernt wurde, und Einladungen, die noch offen sind.
   - Was verrät eine fremde Id (Fehlertext, Zeitverhalten)?
2. **Lesen schreibt:** `get_team_brand_header_v9` schreibt `last_team_id` beim Lesen. Bitte bewerten (Rennen zwischen zwei Tabs, Aufrufe ohne Nutzertoken). Vorschlag: Nur ein ausdrücklicher Teamwechsel schreibt.
3. **Ohne Nutzertoken:** Welche dieser Funktionen sind für anon ausführbar, und welche ruft Bubble heute ohne Token (laut Brands-Runde `get_team_companies_v1`, `get_team_brand_header_v9`)? Was liefern sie anon?
4. **Das Token im Browser:** Schritt 24 schreibt das Nutzer-JWT als Text in einen Run-JS-Schritt (`setUpstreemAuth`). Core braucht es für RPCs nicht mehr (es liest die Sitzung des Plugins), nur noch für Profilbild und Namen (GoTrue, Storage). Bitte bewerten, ob das so bleiben darf oder wie es ohne geht. Die Einstellungen-Runde baut darauf auf.
5. **Das Gate ist nur Anzeige:**
   - Das Zugangs-Gate sperrt die Oberfläche, die Sicherheit liegt in den Funktionen.
   - Prüfst du, dass **jede** Lese- und Schreibfunktion mit `p_team` den Zugang prüft (`require_team_access` samt Abo-Zustand), nicht nur die Mitgliedschaft?
   - Ein Team ohne Zugang darf über direkte RPC-Aufrufe nichts lesen außer Start, Billing und Teamwechsel.
   - Bitte eine Liste der Funktionen, die das heute nicht tun.
6. **Spam:**
   - Teamwechsel im Kreis, Seitenaufbau in Schleife, Benachrichtigung tausendmal wegklicken: Ratenlimits je Nutzer.
   - Was kostet ein Start heute (Anzahl Abfragen, Laufzeit)?
7. **Fraud:**
   - Lässt sich über „New Team“ oder einen Teamwechsel der Zugang eines anderen Teams erschleichen?
   - Bleibt ein Team nach Ablauf des Abos über einen gecachten Start offen?
8. **Benachrichtigungen:**
   - `cta_url` wird als Link geöffnet. Nur `https`, keine fremden Ziele ohne Freigabe, kein `javascript:`.
   - Kann ein Nutzer fremde Benachrichtigungen wegklicken oder lesen?
9. **Gelöschtes oder verlassenes Team während einer offenen Sitzung:** Was passiert beim nächsten Start?

## 3. Aufräumliste (nur Vorschlag)

Je Funktion, View und Policy dieses Bereichs eine Zeile, wie in der Onboarding-Runde:

| Name | Zustand | Aufrufe 30 Tage | ersetzt durch | Vorschlag |
|---|---|---|---|---|

Gelöscht wird nur mit Sicherung und Rückweg, erst nach Umstellung und einer Woche ohne Aufrufe.

## 4. Vorschlag (noch nicht bauen)

Mein Vorschlag, bitte nach deinen Befunden zuschneiden:

1. **`app_start_v1(p_team_hint uuid default null)`**: alles, was VOR dem ersten Bild feststehen muss. Wenig und schnell.
   - `meta.user` mit `{id, email, display_name, avatar_url}` und `meta.settings` mit `{theme}`.
   - `meta.teams[]` für die Seitenleiste: `{id, name, domain, favicon_url, role, has_access, access_state}`.
   - `meta.active_team_id` und `meta.active_reason` (`hint` | `last` | `first` | `none`).
     - `p_team_hint` ist `?teamid=`.
     - Ungültig, fremd oder gelöscht heißt: ignoriert, nie Fehler, nie fremde Daten (wie bei `p_pinned_team_id` in den Fünf Ansichten).
   - `row`: das aktive Team mit Rolle, eigener Marke `{company_id, name, logo_url, domain}`, Standardmarkt, Zugang (alle Gate-Felder) und Quota `{used, total, plan}`.
   - Ohne Team: `row: null`, dann geht die Seite ins Onboarding.
   - Schreibt nichts.
2. **`team_context_v1(p_team uuid, p_parts text[] default null)`**: die Speicher des Teams, `{brands, topics, markets, models, events}`, einzeln abrufbar über `p_parts`.
   - Damit lädt core nach einem „Changed“-Signal nur den betroffenen Teil nach (ersetzt die Custom Events), und ein Teamwechsel braucht keinen ganzen Start.
   - Bitte sagen, ob `all_markets` als globale Liste besser eine eigene, lange cachebare Funktion ist.
3. **`team_switch_v1(p_team uuid)`**:
   - der einzige Weg, der `last_team_id` schreibt;
   - prüft Mitgliedschaft, Ratenlimit;
   - antwortet wie `app_start_v1` für das neue Team.
   - Ersetzt das Schreiben in `get_team_brand_header`.
4. **`user_notification_v1()`** und **`user_notification_dismiss_v1(p_id uuid, p_reason text)`**: `reason` ist `close` | `secondary` | `primary`, nur eigene.
5. **`user_settings_set_v1(p_key text, p_value text)`**: zunächst nur `theme`. Die übrigen Einstellungen kommen in der Einstellungen-Runde dazu.

**Fehler** (`message` = Code, `hint` = Grund):

| SQLSTATE | message | hint |
|---|---|---|
| 28000 | `app_not_authenticated` | – |
| 42501 | `team_forbidden` | – |
| PT402 | `team_access_<state>` | Zustand. Nur für Teamdaten, nie für Start und Teamwechsel. |
| PT429 | `app_rate_limited` | Sekunden |
| 22023 | `app_invalid_param` | Feld |

**Laufzeit:** Ziel für `app_start_v1` sind unter 150 ms warm für Team 877c, ohne Cache, der Zugangszustände überdauert.

---

## Dazu bitte

1. die Antworten auf 1 und 2, Befunde nach Schwere (sofort / vor dem Umbau / mit dem Umbau);
2. die Aufräumliste aus 3;
3. den Vorschlag aus 4, angepasst an deine Befunde, als `APP_START_V1_VORSCHLAG.md`;
4. nach dem Bau eine Datei mit echten, ungekürzten Antworten (Team 877c, Rolle owner und member, ein Nutzer ohne Team, ein Team ohne Zugang, ein fremdes `p_team_hint`, ein gelöschtes Team als `last_team_id`).

**Hilfsabfragen** (anpassen, wo die Namen abweichen):

```sql
-- A) Funktionen dieses Bereichs mit Rechten
select p.oid::regprocedure as fn, p.prosecdef, p.proconfig,
       has_function_privilege('anon', p.oid, 'execute') as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as authed,
       md5(pg_get_functiondef(p.oid)) as md5
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public','app')
  and p.proname ~* '(my_teams|brand_header|portfolio|clear_.*_cache|notification|impact_events|team_companies|quick_actions|plan_quota|get_tags|get_markets|billing_plans|user_settings)'
order by 1;

-- B) Aufrufe nach Rolle
select r.rolname, s.calls, round(s.mean_exec_time::numeric, 1) as ms, left(s.query, 160) as q
from pg_stat_statements s join pg_roles r on r.oid = s.userid
where s.query ~* '(my_teams|brand_header|portfolio|notification|impact_events|team_companies|plan_quota|get_tags|get_markets|user_settings)'
order by s.calls desc limit 80;

-- C) user_settings und Benachrichtigungen: Policies
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies where tablename ~* '(user_settings|notification)' order by 2, 3;
```
