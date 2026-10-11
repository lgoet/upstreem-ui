# Settings v1 – Bestandsaufnahme, Prüfung, Vorschlag (11.10.2026)

Antwort auf settings_db_auftrag.md und Nachtrag 1 (Team Organisation, Billing).
Nur gelesen. Kein Schreibaufruf: keine Einladung, kein Entfernen, kein Löschen, keine Portal- oder Kassensitzung. Das Schreibverhalten habe ich aus den Definitionen gelesen.
Die Beispiele der Lesefunktionen liefen in einer Transaktion mit Rollback, weil auch die Lesefunktionen schreiben: `check_rate_limit` schreibt in `rate_limit`, `get_team_brand_header_v9` setzt `user_settings.last_team_id`, und `get_team_model_settings_v1` legt Startzeilen an.
Die echten Antworten stehen in `settings_lesen_echte_antworten.json` (877c als Owner, Admin, Member, fremder Nutzer, anon; jeweils kalt und warm).

---

## 0. Kurzfassung: kritisch zuerst

| # | Befund | Schwere | Sofort (vor Schritt 1) |
|---|---|---|---|
| K1 | **Phishing über die Einladungs-Mail.** `send-team-invite` übernimmt `base_url` aus dem Body; daraus wird der Link der Mail gebaut. Der Teamname geht ungeschützt ins HTML (`<`, `>` bleiben, `clean_input` entfernt sie nicht). Jeder Owner oder Admin kann so von `invites@send.upstreem.ai` an beliebige Adressen eine Mail mit beliebigem Link und beliebigem HTML schicken. Grenze: nur `check_rate_limit` mit 20 pro Minute, keine Tagesgrenze. | kritisch | Edge Function: `base_url` aus dem Body ignorieren, nur das Secret `INVITE_BASE_URL` verwenden. Teamname HTML-escapen und auf 80 Zeichen kürzen. Teams mit `is_deleted` oder ohne Zugang ablehnen. |
| K2 | **Jeder angemeldete Nutzer kann Teams anlegen.** `create_team_with_brand` und `create_or_get_team` sind für `anon` und `authenticated` ausführbar. Ein Aufruf legt ein Team ohne Bezahlung an, macht den Aufrufer zum Owner und schreibt eine Zeile in die **globale** Tabelle `company`. Zusammen mit K1 heißt das: registrieren, Team anlegen, Firmenname mit HTML, Mail verschicken. In `pg_stat_statements` gibt es keinen Aufruf beider Funktionen; das Onboarding legt Teams über `onboarding_finalize_after_billing_v1` an (nur `service_role`). | kritisch | `revoke execute … from anon, authenticated` auf beide Funktionen. |
| K3 | **Your Brand darf jedes Mitglied schreiben, und der Logo-Schutz fehlt live.** `set_own_brand_settings_v5` prüft nur die Mitgliedschaft, keine Rolle, und nicht, ob `p_company` die eigene Marke ist (H6). Live läuft noch die alte `enforce_own_brand_only`: Sie lässt Logo-Overrides für Wettbewerber zu und prüft das Schema nicht. **brands_logo_nur_eigene.sql ist noch nicht eingespielt.** Außerdem ist die Funktion für anon ausführbar, hat keinen `search_path` und nimmt Markt, Branche und Geschäftsmodell ungeprüft. | hoch | brands_logo_nur_eigene.sql einspielen (liegt bereit). Danach v1 mit Rollenprüfung. |
| K4 | **Team löschen ist hart, verwaist Stripe und bricht bei echten Teams ab.** `delete_team_v3` löscht `team_billing` mit, kündigt das Abo aber nicht. Der nächste Webhook findet kein Team mehr, Stripe bucht weiter ab. Gegen FKs ohne Cascade bricht die Funktion bei jedem Team mit Läufen ab: `prompt_model_run_job` (202 k Zeilen), `prompt_run_ad`, `prompt_run_shopping_product`, `view_job`, `impact_event`, `prompt_activity_log`, `prompt_research_job`, `prompt_purge_job`, `mira_chat_project`. Bei großen Teams (Millionen Zeilen) liefe sie zudem in den Timeout (30 s). `delete_team_v2` ist für anon ausführbar und räumt noch weniger auf. Es gibt weder Namensbestätigung noch Protokoll. | hoch | `delete_team_v2` für anon und authenticated sperren. v3 bleibt für Bubble, bis der neue Weg (Soft-Delete) steht. |
| K5 | **Ein Abo-Ende löscht das Team.** Der Webhook setzt bei `customer.subscription.deleted` (und bei `canceled` / `incomplete_expired`) `team.is_deleted = true`. Danach gibt es keinen Weg zurück: Checkout geht nur über ein Onboarding, das Portal lehnt gelöschte Teams ab, und `accept` lehnt Einladungen ab. Eine abgelaufene Testphase oder eine gescheiterte Zahlung endet so in „gelöscht“. | hoch | Entscheidung nötig (8.6). Vorschlag: Abo-Ende setzt nur den Zugang auf `ended`, nie `is_deleted`. |
| K6 | **Es gibt keinen Kassenweg für bestehende Teams.** `create-onboarding-checkout` braucht ein Onboarding im Status `ready` oder `awaiting_billing`. Teams ohne Abo (alle 8 Legacy-/manuellen Teams, jedes Team nach Abo-Ende) kommen nicht an ein Abo. Das Portal antwortet bei ihnen mit 404 „No billing record found for this team“. | hoch (Funktion) | Neue Edge Function `create-team-checkout` (6.4). |

Weitere Befunde mit Schwere „mittel“ und „niedrig“ stehen in Abschnitt 2. Die SQL für die Sofortmaßnahmen K2, K3 und K4 (Rechte) schreibe ich nach deiner Freigabe als eine Datei mit Rückweg. K1 betrifft eine bestehende Edge Function; die fasse ich nur an, wenn du es ausdrücklich freigibst. Sonst bekommst du den Patch zum Einspielen.

---

## 1. Bestand

### 1.1 Funktionen (Aufrufe seit 05.09.2025 laut pg_stat_statements)

| Funktion | Aufrufe | anon | Rolle (Server) | search_path | Antwort | Ablehnung | Protokoll | Sperre |
|---|---|---|---|---|---|---|---|---|
| get_team_organisation_v4 | 464 | **ja** | Mitglied | ja | jsonb `{viewer_role, permissions, members[], pending_invites:[]}` | Ausnahme `forbidden` | – | – |
| get_team_invites_v1 | 328 | nein | owner/admin | ja | `{invites[], count}` | `forbidden`, `invalid status` | – | – |
| get_team_audit_log_v1 | 483 | **ja** | owner/admin | ja | setof (9 Spalten), limit ≤ 200, offset | `forbidden` | – | – |
| get_team_model_settings_v1 | 2 441 | **ja** | Mitglied | ja | setof (22 Spalten) | `forbidden`, `no_billing_plan…` | – (**legt Startzeilen an**) | – |
| update_team_model_setting_v1 | 170 | **ja** | owner/admin | ja | jsonb `{success, code, message, toast…}` | **Zeile `success:false`** (HTTP 200) | **keins** | Advisory-Lock je Team |
| manage_team_models_v1 | 8 | **ja** | owner/admin | **nein** | wie oben | **Zeile `success:false`** | **keins** | Advisory-Lock |
| set_own_brand_settings_v5 | 45 | **ja** | **jedes Mitglied** | **nein** | `{status:'ok'}` | `forbidden` | **keins** | – |
| get_team_brand_header_v9 | – | **ja** | Mitglied | ja | setof (13 Spalten) | `forbidden` | – (**schreibt user_settings**) | – |
| create_team_invite_v1 | 83 | **ja** | owner/admin | ja | jsonb inkl. **Klartext-Token** und `invite_link` (bubbleapps version-test) | Ausnahmen, Duplikat als **rohe 23505** | member_invited | – |
| resend_team_invite_v1 | 10 | nein | owner/admin | ja | `{ok, token_hash, expires_at}` | Ausnahmen | member_invited mit meta.action=resent | – |
| revoke_team_invite_v1 | 18 | nein | owner/admin | ja | `{ok:true}` | Ausnahmen | invite_revoked | Update mit `status='pending'` |
| kick_team_member_v1 | 8 | nein | owner/admin (admin nur Member) | ja | `{ok:true}` | Ausnahmen | member_removed | **keine** |
| set_team_member_role_v1 | 18 | nein | owner alles, admin nur member→admin | ja | `{ok:true}` | Ausnahmen | role_changed | **keine** |
| leave_team_v1 | 10 | nein | Mitglied | ja | `{ok:true}` | `not member`, `cannot leave as last owner` | member_left | **keine** |
| delete_team_v2 | 4 | **ja** | owner | ja | Zählerobjekt | `forbidden`, `team not found` | – | – |
| delete_team_v3 | 8 | nein | owner | ja | Zählerobjekt | dto. | – (löscht das Protokoll mit) | – |
| get_team_billing_status_v1 | 128 | nein | owner/admin | ja | jsonb `{ok, team…, billing{…}}` | `forbidden` (P0001) | – | – |
| get_billing_plans_v1 | 120 | nein | angemeldet | ja | setof (8 Spalten), nur `is_active` | `Not authenticated` | – | – |
| get_team_plan_quota_v3 | 505 | nein | Mitglied | **nein** | setof (18 Spalten) | 42501 | – | – |
| team_access | – | nein | **keine Prüfung** | **nein** | has_access, access_state, ended_at | – | – | – |
| accept_team_invite_by_token_v2 | – | nein | angemeldet, Mail muss passen | ja | `{ok, team_id, team_name, role, already_member}` | Ausnahmen `invite_*` | invite_accepted | `for update` auf der Einladung |
| get_team_invite_by_token_v3 | – | ja (gewollt) | Token | ja | Statusobjekt | – | – | – |
| check_rate_limit | – | **ja** | – | ja | void | P0001 `Rate limit exceeded…` | – | – |
| create_team_with_brand / create_or_get_team | 0 | **ja** | **jeder Angemeldete** | ja | – | – | – | – |

Keine Funktion nutzt `app.require_team_access`. Keine ruft `pg_net` oder `http` auf, und auf `team_member`, `team_invite`, `team_audit_log` und `team_billing` liegt kein Trigger. Es geht also nichts aus der Transaktion hinaus. Einziger Trigger: `trg_clean_text` auf `team` (name, summary, brand_industry, business_model) und auf `team_brand_profile.name_override`. Er entfernt Backtick, Backslash und `${`, aber nicht `<` und `>`.

### 1.2 Edge Functions

| Funktion | verify_jwt | liest aus dem Body | Schlüssel | Team / Kunde / Preis / Rückkehr |
|---|---|---|---|---|
| send-team-invite (v31) | ja | `team_id`, `invite_id`, **`base_url`**; nimmt auch Form-Body und Query-String | Anon-Client mit Nutzer-JWT für die Rollenprüfung, Service-Role für Einladung und Marke | Link = `base_url` (Body) oder Secret `INVITE_BASE_URL`, plus `/invite?token=<token_hash>`. Prüft `pending` und das Ablaufdatum, nicht `is_deleted`. Antwort enthält `invite_link`. |
| create-billing-portal-session (v3) | ja | nur `team_id` | Service-Role + `STRIPE_SECRET_KEY` | Kunde aus `team_billing`, Rolle owner/admin, Team nicht gelöscht. Rückkehr fest `https://app.upstreem.ai/` (`APP_URL` wird geladen, aber nicht genutzt). Kein Ratenlimit. |
| create-onboarding-checkout (v9) | ja | `onboarding_id`, `billing_plan_id`, `billing_interval` | Service-Role + Stripe | Preis aus `billing_plan` (nur aktive), Testphase nur bei monatlich, `customer_email` statt bestehendem Kunden (jedes Mal ein neuer Stripe-Kunde), Promo-Codes bei monatlich, alte offene Session wird verworfen. **Nur für Onboardings.** |
| stripe-webhook (v7) | nein | Stripe-Event | Signatur geprüft (`constructEventAsync`) | `checkout.session.completed` verlangt `onboarding_id` in den Metadaten (sonst 400, Stripe wiederholt). Keine Event-ID-Idempotenz, keine Reihenfolgeprüfung. Abo-Ende setzt `team.is_deleted`. |

Ob Bubble `base_url` mitschickt, sehe ich nicht. Die Funktion nimmt es jedenfalls an. Ob `STRIPE_SECRET_KEY` ein Test- oder Live-Schlüssel ist, kann ich nicht lesen (Secrets). Bitte im Supabase-Dashboard nachsehen: `sk_live_…` oder `sk_test_…`.

### 1.3 Tabellen, FK, RLS (Auszug)

- `team_invite`:
  - CHECK auf den Status pending/accepted/revoked/expired und die Rolle member/admin.
  - Eindeutig: `token_hash`, und `(team_id, lower(invited_email)) where status='pending'`.
  - RLS: alles für `authenticated` gesperrt (gut).
  - **Kein Feld für sent_at oder resend_count.**
- `team_audit_log`:
  - CHECK auf genau 8 Typen: member_invited, invite_accepted, invite_revoked, role_changed, member_removed, member_left, owner_transferred, action_blocked.
  - FK `actor_user_id` und `target_user_id` auf `auth.users` **ohne on delete**. Dasselbe gilt für `team_invite.created_by`, `accepted_by` und `revoked_by`. Ein Nutzer, der je eingeladen oder protokolliert wurde, lässt sich nicht löschen (DSGVO-Löschung scheitert).
- `team_member`: FK auf team ohne Cascade; RLS „nur eigene Zeile“.
- `team_billing`: PK team_id, Cascade; `stripe_subscription_id` eindeutig.
- `rate_limit`: RLS erzwungen, keine Policy; alte Fenster werden nur bei eigenem Aufruf gelöscht (77 Zeilen, älteste vom 04.05.).
- FKs auf `app.team`: 56. Davon ohne Cascade und **nicht** in delete_team_v3 behandelt: siehe K4.

### 1.4 Daten (Abschnitt F)

| Wert | Stand |
|---|---|
| Teams | 14, davon 4 `is_deleted` (alle 4 haben noch Mitglieder) |
| Owner je Team | 12 × 1, 2 × 2; kein Team ohne Owner |
| Mitglieder | 45; max 6, Schnitt 3,2; 10 Nutzer in mehreren Teams |
| @upstreem.ai-Mitglieder | 11 in 11 Teams |
| team_billing | 4 Zeilen, alle `canceled` (Test); 0 gelöschte Teams mit laufendem Abo |
| Teams mit Plan, ohne Billing-Zeile | 8 (7 Legacy Free, 1 Professional) |
| Teams ohne Plan | 2 |
| Pläne | Essential, Professional (14 Tage Test), Enterprise (0), Legacy Free (inaktiv); alle `sort_order` null, `models_max_active` 3 |
| Einladungen | 55: 36 angenommen, 15 zurückgezogen, 4 pending – **alle 4 abgelaufen, Status nie auf expired gesetzt** |
| Einladungen, Spitzen | 7 je Team und Tag, 8 je Nutzer und Tag, max 1 offen je Team; 6 Adressen mehrfach eingeladen; 1 offene auf gelöschtem Team |
| Angenommen, Person nicht mehr Mitglied | 12 |
| Protokoll | 149 Einträge seit 26.01.2026; nie `action_blocked` (siehe 2.7) |
| Modelle | 6 eingeschaltete Modelle, die nicht im Plan des Teams sind (Altbestand) |
| summary | max 633 Zeichen, Median 530; Branche und Geschäftsmodell sind Freitext („hybrid“ und „Hybrid (B2B & B2C)“ nebeneinander) |
| default_market | 13 × DE, 1 × `de` (klein, nicht in `markets`) |
| Gift im Team und in Overrides | 0 |
| **user_metadata mit `<` oder `>`** | **5 Nutzer**; Anzeigenamen kommen roh in Organisation, Protokoll und Einladungsseite |
| team_brand_profile | 20 Zeilen, 3 ohne Verknüpfung zum Team, 0 Logos auf Wettbewerbern; Schemata: 4 https, 2 `//`, 14 leer |
| auth.users | 108, davon 4 unbestätigt |

### 1.5 Messung (877c, Owner)

| Funktion | kalt ms | warm ms |
|---|---|---|
| organisation | 13,4 | 1,0 |
| invites (16) | 7,2 | 0,9 |
| log (50) | 5,2 | 1,1 |
| models | 6,5 | 1,2 |
| billing status | 5,1 | 0,6 |
| plans | 0,7 | 0,2 |
| brand header | 7,8 | 2,1 |
| quota | 5,9 | 1,6 |

Rechteproben:
- **Member:** invites, log und billing antworten mit P0001 `forbidden`. Organisation, Modelle, Header und Quota liefern Daten.
- **Fremder Nutzer:** überall `forbidden` bzw. 42501, **außer `team_access`: Das liefert den Zugangsstatus eines fremden Teams.**
- **anon:** `not authenticated` oder `permission denied`.

---

## 2. Prüfung (Abschnitt 4)

Format: Befund – Schwere – Vorschlag.

### 2.1 Zugang
1. **curl als anon:**
   - Befund: 13 Settings-Funktionen sind für anon ausführbar. Alle brechen mit `not authenticated` ab, weil `auth.uid()` null ist. `check_rate_limit` kehrt vorher still zurück. Es fließen keine Daten.
   - Schwere: niedrig.
   - Vorschlag: anon überall entziehen (Rechte-Datei wie bei Brands, „später“-Liste).
2. **Fremdes Team:**
   - Befund: Alle Funktionen prüfen die Mitgliedschaft im Server. Ausnahme `team_access(uuid)`: Jeder Angemeldete erfährt für eine bekannte Team-UUID has_access, Status und Enddatum.
   - Schwere: niedrig.
   - Vorschlag: `team_access` nur noch intern (revoke authenticated); v1-Funktionen lesen den Zugang selbst.
3. **Entferntes Mitglied mit gültigem JWT:**
   - Befund: Jede Funktion liest `team_member` bei jedem Aufruf neu, die Sperre greift also sofort. Auch `send-team-invite` prüft live.
   - Schwere: ok.
4. **Teams ohne Zugang:**
   - Befund: Keine Settings-Funktion prüft den Zugang. Das ist für Billing richtig (bezahlen muss möglich bleiben). Für Einladungen ist es falsch: Ein gelöschtes oder abgelaufenes Team kann weiter Mails verschicken (1 offene Einladung auf gelöschtem Team).
   - Schwere: mittel.
   - Vorschlag: Einladen, Rollen, Brand und Modelle nur bei `has_access`. Lesen, Billing, Verlassen und Löschen auch ohne.
5. **Invoker-Funktionen:**
   - Befund: keine im Settings-Pfad (die `_invite_*`-Helfer sind nicht ausführbar).
   - Schwere: ok.
6. **search_path fehlt:**
   - Befund: betrifft manage_team_models_v1, set_own_brand_settings_v5, get_team_plan_quota_v3, team_access und require_team_access. Alle Namen sind qualifiziert; das Risiko ist gering, aber es verstößt gegen die Regel.
   - Schwere: niedrig.
   - Vorschlag: In v1 überall setzen.

### 2.2 Your Brand
1. **Rollen:**
   - Befund: Jedes Mitglied darf Name, Logo, Summary, Markt, Branche und Modell schreiben.
   - Schwere: hoch (K3).
   - Vorschlag: owner/admin.
2. **Fremde company_id (H6):**
   - Befund: `p_company` wird nicht geprüft; die alte Trigger-Fassung erlaubt auch Wettbewerber, inklusive Logo. 3 Profilzeilen hängen an Marken, die nicht mehr verknüpft sind.
   - Schwere: hoch.
   - Vorschlag: Die v1 nimmt keine company_id an und ermittelt die eigene Marke selbst. Logo-Fix einspielen.
3. **Werte:**
   - Befund:
     - `p_market` ungeprüft (`de` steht schon drin, und ein Wert fehlt in `markets`);
     - business_model und industry Freitext ohne Länge;
     - summary ohne Länge;
     - leere Werte können nicht gelöscht werden (`coalesce` behält den alten Wert).
   - Schwere: mittel.
   - Vorschlag:
     - Markt gegen `app.markets.alpha2` (Großschrift);
     - business_model aus der festen Liste `b2b|b2c|hybrid`;
     - industry ≤ 80 Zeichen;
     - summary ≤ 1 000 Zeichen;
     - name ≤ 80 Zeichen;
     - ausdrücklich `null` = zurücksetzen (Override löschen).
4. **Logo, SSRF:**
   - Befund: Kein Server-Code lädt das Logo. `send-team-invite` liest es, verwendet es aber nicht; der PDF-Export läuft über n8n, und ob n8n Logos lädt, sehe ich nicht. Logos werden im Browser anderer Mitglieder geladen. Damit sieht der Logo-Host deren IP (Tracking-Pixel möglich).
   - Schwere: niedrig.
   - Vorschlag: nur `https://` (wie im Logo-Fix), Länge ≤ 500. Langfristig in den eigenen Storage kopieren.
5. **Prompt-Injection:**
   - Befund: summary, business_model und industry gehen in `get_prompt_suggestion_context` bzw. `_pr_job_json_v1` an das LLM. Die Wirkung bleibt im eigenen Team; summary ohne Längengrenze kostet Tokens.
   - Schwere: niedrig.
   - Vorschlag: Längen wie oben; im LLM-Aufruf als Daten kennzeichnen (n8n).
6. **Modelle:**
   - Befund:
     - Limit und Plan werden geprüft, mit Advisory-Lock (gut).
     - Ablehnung als HTTP 200 mit `success:false`.
     - Kein Protokoll.
     - `get_team_model_settings_v1` schreibt beim Lesen.
     - 6 eingeschaltete Modelle liegen außerhalb des Plans.
     - Kosten: mehr Modelle bedeuten mehr Läufe; die Grenze ist `models_max_active` (3 in allen Plänen).
   - Schwere: mittel.
   - Vorschlag:
     - `team_models_set_v1` mit Ausnahmen statt `success:false`;
     - protokollieren (`models_changed`);
     - beim Lesen nichts anlegen;
     - die Plan-Abweichung nur anzeigen (`is_allowed_by_plan:false`), nicht automatisch abschalten.
7. **Marktwechsel:**
   - Befund: `default_market` wirkt nur auf neue Prompts (create_prompt_*, Prompt Research, Vorschläge). Bestehende Prompts behalten ihren Markt.
   - Schwere: ok.
   - Vorschlag: In der Oberfläche als Hinweis anzeigen.

### 2.3 Rollen
1. **Eskalation:**
   - Befund: Ein Admin kann member→admin befördern und Admins einladen. Damit kann ein Admin beliebig viele Admins erzeugen. Owner kann ein Admin nicht werden (gut).
   - Schwere: mittel.
   - Vorschlag: Rollen ändern nur der Owner; ein Admin lädt nur Member ein (8.3).
2. **Fremde IDs:**
   - Befund: Das Ziel muss Mitglied desselben Teams sein (`target not member`).
   - Schwere: ok.
3. **Letzter Owner und Wettlauf:**
   - Befund: Der Owner-Zähler läuft ohne Sperre. Zwei Owner, die sich gleichzeitig herabstufen oder entfernen, lassen ein Team ohne Owner zurück. Das betrifft 2 Teams mit 2 Ownern.
   - Schwere: mittel.
   - Vorschlag: `select … from app.team where id=p_team for update` als ersten Schritt aller Rollen-, Entfern-, Verlassen- und Löschfunktionen.
4. **Owner-Übergabe:**
   - Befund: Es gibt sie nur indirekt (einen anderen zum Owner machen, dann sich selbst herabstufen). Der Typ `owner_transferred` existiert im CHECK, wird aber nie geschrieben. Stripe-Kunde und Rechnungsadresse bleiben beim alten Owner.
   - Schwere: mittel.
   - Vorschlag: `team_member_role_v1` mit `p_role='owner'` (nur durch den Owner) protokolliert `owner_transferred`. Stripe-Rechnungsmail im Portal ändern (Hinweis in der UI).
5. **Nebenwirkungen beim Entfernen:**
   - Befund: `user_settings.last_team_id` zeigt weiter aufs Team, und der nächste Start landet auf `forbidden`. Offene Einladungen, die der Entfernte angelegt hat, bleiben gültig.
   - Schwere: niedrig.
   - Vorschlag: `last_team_id` auf null setzen; eigene offene Einladungen bleiben (sie gehören dem Team).
6. **Sitzplatzgrenze:**
   - Befund: Kein Plan hat eine Sitzgrenze.
   - Schwere: –.
   - Vorschlag: Feld `seats_max` erst einführen, wenn es verkauft wird.
7. **Gleiche Rolle:**
   - Befund: `set_team_member_role` mit derselben Rolle schreibt `role_changed` mit from=to.
   - Schwere: niedrig.
   - Vorschlag: `unchanged:true` zurückgeben, keinen Eintrag schreiben.

### 2.4 Einladungen und E-Mail
1. **Nur invite_id:**
   - Befund: `send-team-invite` nimmt zusätzlich `base_url`.
   - Schwere: kritisch (K1).
   - Vorschlag: nur `team_id` und `invite_id`.
2. **Rollenprüfung per JWT:**
   - Befund: vorhanden (owner/admin, live über RLS).
   - Schwere: ok.
3. **HTML-Escape:**
   - Befund: fehlt (teamName in subject, title, h1, Text und Button).
   - Schwere: kritisch (K1).
   - Vorschlag: escapen, Länge ≤ 80; den Betreff ohne Zeilenumbrüche.
4. **Mengen:**
   - Befund: nur `create_invite` 20 pro Minute je Nutzer. Resend: 10 Minuten Abstand, keine Obergrenze. Kein Limit je Team oder Tag.
   - Schwere: hoch (zusammen mit K1).
   - Vorschlag: 50 offen je Team, 20 je Team und Tag, 30 je Nutzer und Tag, Resend alle 5 Minuten, max 5. Bei Überschreitung PT429 `team_invite_rate_limited`.
5. **Doppelte offene Einladung:**
   - Befund: Sie kommt als rohe 23505 mit dem Constraint-Namen. **Abgelaufene Einladungen bleiben `pending` und sperren eine neue Einladung an dieselbe Adresse dauerhaft**; das betrifft alle 4 heute offenen.
   - Schwere: mittel.
   - Vorschlag:
     - eine offene, nicht abgelaufene Einladung wird zurückgegeben mit `unchanged:true`;
     - eine abgelaufene wird im selben Aufruf auf `expired` gesetzt, danach wird neu angelegt;
     - `expired` beim Lesen berechnen.
6. **Normalisierung und Rolle:**
   - Befund: `lower(btrim)` ja; Format nicht geprüft (nur in der Edge Function); Rolle member/admin per CHECK.
   - Schwere: niedrig.
   - Vorschlag: Format im Server (`^[^\s@]+@[^\s@]+\.[^\s@]+$`, ≤ 254).
7. **Token:**
   - Befund: 256 Bit, 7 Tage.
     - `create` speichert sha256(Token) und gibt den Klartext zurück.
     - Die Mail verschickt aber **den Hash selbst** als Link-Token.
     - `_invite_find_id_v1` akzeptiert beides.
     - Damit steht der wirksame Link-Schlüssel im Klartext in der Datenbank; `resend` gibt ihn sogar an den Browser.
     - Die Annahme verlangt aber die passende Mail-Adresse, deshalb ist das nicht kritisch.
   - Schwere: mittel.
   - Vorschlag: Die neue Edge Function erzeugt den Token selbst, die DB speichert nur den Hash, und der Klartext geht nur in die Mail. Den alten Hash-Pfad in `_invite_find_id_v1` erst entfernen, wenn Bubble abgelöst ist.
8. **Annahme:**
   - Befund: Mail-Abgleich gegen `auth.users`, `for update`, gelöschtes Team abgelehnt.
   - Schwere: ok.
   - Lücke: Unbestätigte Konten (4) können annehmen, wenn sie den Link haben.
   - Vorschlag: `email_confirmed_at is not null` verlangen.
9. **Enumeration:**
   - Befund: `create` meldet `user already member`. Wer einlädt, ist ohnehin owner/admin und sieht die Mitglieder. Es gibt keine Aufzählung fremder Konten.
   - Schwere: ok.
10. **Resend-Semantik:** siehe Nachtrag 3.4.

### 2.5 Verlassen und Löschen
1. **Letzter Owner:**
   - Befund: Verlassen ist gesperrt; Wettlauf siehe 2.3.3.
   - Schwere: mittel.
2. **Namensbestätigung:**
   - Befund: fehlt bei Verlassen und Löschen.
   - Schwere: mittel.
   - Vorschlag: `p_confirm_name` muss gleich dem angezeigten Teamnamen sein (trim, Groß/klein egal), sonst 22023 `team_confirm_name_mismatch`.
3. **Was delete_team löscht:**
   - Befund: siehe K4. Das Protokoll wird mitgelöscht; Onboarding und user_settings werden abgehängt.
   - Schwere: hoch.
   - Vorschlag: Soft-Delete. Sofort `is_deleted`, `deletion_requested_at`, Mitglieder bleiben (für die Wiederherstellung) und der Zugang ist zu. Nach 14 Tagen räumt ein Hintergrund-Job in Schritten auf wie `brand_purge_job` (Rollups, Läufe, Konfiguration, zuletzt das Team). Globale Tabellen bleiben unangetastet. Wiederherstellung innerhalb der 14 Tage nur durch Support.
4. **Stripe-Kündigung:**
   - Befund: fehlt.
   - Schwere: hoch.
   - Vorschlag: `team_delete_v1` setzt `team_billing.cancel_requested_at`. Eine neue Edge Function `team-billing-cancel` (Service-Role, per Cron oder direkt nach dem RPC) kündigt in Stripe sofort, ohne Erstattung (Entscheidung 8.4). Der Webhook bestätigt.
5. **Missbrauch der Testphase:**
   - Befund: Testphase je Onboarding und immer ein neuer Stripe-Kunde. Ein Nutzer kann mit neuem Onboarding (oder neuem Konto) eine neue Testphase holen. Heute nicht vorgekommen (0 Nutzer mit 2 Testphasen).
   - Schwere: mittel.
   - Vorschlag: Testphase nur, wenn weder der Nutzer noch das Team je ein `team_billing` mit `trial_ends_at` hatte. Bestehenden Kunden wiederverwenden. Zusätzlich in Stripe Radar die Karten-Fingerprints prüfen.
6. **remaining_teams / next_team_id:**
   - Befund: gibt es heute nicht.
   - Vorschlag: `team_leave_v1` und `team_delete_v1` liefern `{remaining_teams, next_team_id}` (nächstes nicht gelöschtes Team des Nutzers, nach `team_member.created_at`) und setzen `last_team_id` darauf.

### 2.6 Billing
1. **Portal:**
   - Befund:
     - Kunde aus der DB, owner/admin, gelöschtes Team abgelehnt, Rückkehr fest (gut).
     - Kein Ratenlimit.
     - Fehlertext von Stripe geht roh an den Client.
     - `APP_URL` wird nicht genutzt.
   - Schwere: niedrig.
   - Vorschlag: neue Funktion mit Ratenlimit (5 pro Minute je Nutzer), stabile Codes, Rückkehr `APP_URL + /settings/billing`.
2. **Checkout:** fehlt für Teams (K6).
   - Vorschlag (6.4):
     - nur `plan_id` und `billing_interval`;
     - Preis aus der Tariftabelle, nur aktive Pläne;
     - Testphase höchstens einmal;
     - Promo-Codes nach Entscheidung;
     - Idempotenzschlüssel `team-checkout-<team>-<plan>-<interval>-<Minute>`;
     - bestehender Kunde wird wiederverwendet;
     - bei laufendem Abo 409 `billing_subscription_exists` → Portal.
3. **Webhook:**
   - Befund:
     - Signatur ja.
     - Keine Event-Idempotenz; jede Verarbeitung synchronisiert aber den Abo-Stand neu aus Stripe, Wiederholungen sind also harmlos.
     - Reihenfolge: Bei `customer.subscription.updated` wird der Event-Stand geschrieben, nicht der aktuelle. Ein verspätetes älteres Event kann einen neueren Stand überschreiben.
     - Ohne `onboarding_id` → 400, Stripe wiederholt 3 Tage.
   - Schwere: mittel.
   - Vorschlag:
     - Abo immer frisch per `stripe.subscriptions.retrieve` laden (wie bei Rechnungen);
     - Tabelle `stripe_event` (id, type, received_at) für die Idempotenz;
     - `metadata.source='team'` behandeln;
     - kein `is_deleted` bei Abo-Ende (K5).
     - Das betrifft eine bestehende Edge Function, also nur mit deiner Freigabe.
4. **get_billing_plans:**
   - Befund: nur aktive (gut), Ausgabe ohne Stripe-IDs (gut).
   - Kleinigkeit: `sort_order` ist überall null; die Reihenfolge ergibt sich aus dem Preis.
   - Schwere: ok.
5. **Billing-Status für Member:**
   - Befund: Heute `forbidden`. Außerdem widersprechen sich Status und Zugang:
     - Für die 8 Teams ohne Billing-Zeile meldet `get_team_billing_status_v1` `has_active_access:false` und „No billing“.
     - `team_access` meldet für dieselben Teams `has_access:true` (Plan ohne Stripe).
     - Beispiel 877c: Die Billing-Seite zeigt „kein Zugang“, die App läuft.
   - Schwere: mittel.
   - Vorschlag: `billing_status_v1` nimmt den Zugang aus `team_access`; Member sehen Plan, Zustand und Enddatum ohne Preise und ohne `can_manage`.
6. **Test- oder Live-Schlüssel:** nicht lesbar, bitte prüfen (siehe 1.2).

### 2.7 Protokoll
1. **Wer liest:**
   - Befund: nur owner/admin (Funktion und RLS).
   - Schwere: ok.
2. **Paging:**
   - Befund: offset, ≤ 200.
   - Schwere: niedrig.
   - Vorschlag: `p_before` (created_at, id) als Cursor, `p_limit` ≤ 100.
3. **Unveränderlich:**
   - Befund: Direktes Schreiben ist per RLS gesperrt. `delete_team_v*` löscht das Protokoll mit.
   - Vorschlag: Beim Soft-Delete bleibt es stehen, bis der Purge läuft.
4. **Vollständig:** Es fehlen:
   - `action_blocked`: wird geschrieben, dann folgt `raise`, und das Rollback löscht die Zeile. Es gab nie einen Eintrag.
   - Modelle, Brand, Logo, Löschen, Portal, Checkout.
   - Ein erneutes Senden erscheint als `member_invited` mit meta.action=resent.
   - Der Inner Join auf auth.users würde Einträge gelöschter Nutzer verschlucken; das Löschen solcher Nutzer scheitert heute aber ohnehin am FK.
   - Schwere: mittel.
   - Vorschlag:
     - CHECK um die neuen Typen erweitern (nur dazu):
       - invite_resent
       - invite_send_failed
       - member_left (gibt es schon)
       - team_deleted
       - team_restored
       - brand_settings_changed
       - brand_logo_changed
       - models_changed
       - billing_portal_opened
       - checkout_started
     - Abgelehnte Aktionen nicht protokollieren (sie würden zurückgerollt). Stattdessen meldet der Server sie mit stabilem Code; wer sie zählen will, nutzt die Edge-Logs.
     - Left join auf auth.users, Anzeige „gelöschter Nutzer“.

### 2.8 Offene Fragen
Siehe Abschnitt 8 mit meinen Empfehlungen.

---

## 3. Nachtrag 1 (Bubble-Workflows)

### 3.1 Antwortform der fünf Funktionen
Alle fünf geben **ein jsonb-Objekt** zurück, nie eine Liste und nie eine Zeile `ok:false`. Jede Ablehnung ist eine **Ausnahme**: SQLSTATE P0001, außer beim Duplikat. PostgREST antwortet darauf mit HTTP 400 und `{code, message, details, hint}`. Bubble bekommt dann einen Fehler, keine Zeile.

| Funktion | Erfolg | Ablehnungen (message) |
|---|---|---|
| revoke_team_invite_v1 | `{ok:true}` | `not authenticated`, `forbidden`, `invite not found`, `invite not pending`, `invite state changed` |
| resend_team_invite_v1 | `{ok:true, token_hash, expires_at}` | `not authenticated`, `forbidden`, `invite not found`, `invite not pending`, `rate_limited` (Einladung < 10 min alt oder letzter Resend < 10 min), `invite state changed` |
| set_team_member_role_v1 | `{ok:true}` | `not authenticated`, `forbidden` (Rolle fehlt, Admin außerhalb member→admin), `invalid role`, `target not member` (auch bei fremder ID), `cannot remove last owner` |
| kick_team_member_v1 | `{ok:true}` | `not authenticated`, `cannot kick self`, `forbidden` (kein owner/admin, Admin gegen Nicht-Member), `target not member`, `cannot remove last owner` |
| create_team_invite_v1 | `{invite_id, team_id, team_name, invited_email, invited_role, expires_at, token, invite_link}` | `Rate limit exceeded. Please try again in a moment.`, `not authenticated`, `forbidden`, `email required`, `invalid role`, `user already member`, **23505 `duplicate key value violates unique constraint "team_invite_team_email_pending_uq"`** |

Bestätigt: `set_team_member_role` und `kick_team_member` liefern bei einer Ablehnung **keine** Zeile `ok:false`, sondern eine Ausnahme. Bubbles `Objects:count > 0` meldet also keinen falschen Erfolg; wenn Bubble den Fehler nicht abfängt, bleibt er nur still. Bubble kann die Bedingung trotzdem auf `ok is yes` umstellen, weil jede Erfolgsantwort `ok:true` enthält. Ausnahme: `create_team_invite`, die kein `ok` hat; dort `invite_id is not empty`.
Abweichend davon liefern die **Modell-Funktionen** (`update_team_model_setting_v1`, `manage_team_models_v1`) eine Ablehnung als HTTP 200 mit `success:false`. Dort muss Bubble `success` prüfen.

Neuer Vertrag: Erfolg = Objekt `{meta, row}` mit dem neuen Stand. Ablehnung immer als Ausnahme mit stabiler message (Liste in 6.3). Die Duplikat-Einladung wird kein Fehler, sondern gibt die bestehende Einladung zurück, mit `meta.unchanged:true`. Eine abgelaufene wird ersetzt.

### 3.2 Einladen: Versand scheitert
- **Nutzlast:**
  - `send-team-invite` liest `team_id`, `invite_id` und `base_url`, aus JSON, Form-Body oder Query-String.
  - `base_url` muss weg (K1).
  - Was Bubble konkret schickt, sehe ich nicht. Bitte im Bubble-Workflow nachsehen, ob `base_url` gesetzt ist; wenn ja, ist `INVITE_BASE_URL` vielleicht gar nicht als Secret gesetzt.
- **Prüfung vor dem Versand:**
  - Ja: Status `pending` und nicht abgelaufen, gelesen direkt vor dem Resend-Aufruf.
  - Ein **späterer** Aufruf nach dem Zurückziehen sendet nicht.
  - Eine Lücke bleibt aber im **selben** Aufruf: Die Prüfung ist bestanden, Resend braucht länger als Bubbles Timeout, Bubble zieht zurück, und Resend stellt trotzdem zu. Dann kommt ein Link an, der schon zurückgezogen ist.
- **Entscheidung:** Variante B, der Versandstand gehört an die Einladung, gesteuert von einem einzigen Aufruf der neuen Edge Function `team-invite-send`.
  - Begründung: E-Mail und Datenbank lassen sich nicht in eine Transaktion legen. „Edge legt an und sendet“ (A) hat dieselbe Lücke, nur verdeckt. Mit sichtbarem Versandstand ist jeder Zustand erklärbar.
  - Ablauf:
    1. `team_invite_create_v1` (mit Nutzer-JWT, alle Rechte- und Mengenprüfungen) legt die Einladung mit `sent_at = null` an. Den Token-Hash erzeugt die Edge Function, die DB sieht den Klartext nie. **Kein Protokolleintrag.**
    2. Versand über Resend mit `Idempotency-Key: invite-<id>-<send_no>`.
    3. Erfolg: `team_invite_mark_sent_v1` (nur service_role) setzt `sent_at` und schreibt `member_invited`.
    4. Endgültiger Fehler (Resend antwortet 4xx/5xx): `team_invite_send_failed_v1` (nur service_role) setzt `status='send_failed'` (CHECK nur erweitert) und `send_failed_at`. **Kein `invite_revoked`**, und die Adresse ist sofort wieder einladbar.
    5. Unklar (Zeitüberschreitung zu Resend): ein Wiederholversuch mit demselben Idempotenzschlüssel. Bleibt es unklar, bleibt `sent_at` null, die Antwort ist 502 `team_invite_send_unknown`, und die Einladung erscheint als „Versand unklar – erneut senden“. Erneut senden nutzt denselben Schlüssel; Resend stellt höchstens einmal zu.
    6. Annehmen geht nur mit `sent_at is not null` (oder einem gesetzten Resend-Stand).
  - Ergebnis: Kein `invite_revoked` für nie versandte Einladungen, kein toter Link nach späten Zustellungen, und die Seite ruft genau eine Funktion auf.

### 3.3 (Ausnahme bis dahin)
Die neue Seite macht es bis zur Umstellung wie Bubble. Das ist in Ordnung. Ein Zurückziehen nach gescheitertem Versand schreibt bis dahin `invite_revoked`.

### 3.4 Erneut senden
`resend_team_invite_v1` ändert **sofort und endgültig**:
- neuer Token (`token_hash` ersetzt; der alte Link ist tot);
- `expires_at = now() + 7 Tage`;
- Protokoll `member_invited` mit meta.action=resent.

Es gibt keinen Zähler (die Sperre von 10 Minuten wird aus dem Protokoll gelesen). Das alles passiert **vor** dem Mailversand. Scheitert danach `send-team-invite`, hat die eingeladene Person keinen gültigen Link mehr, und im Protokoll steht trotzdem „erneut gesendet“.

Vorschlag `team_invite_resend` über die Edge Function:
1. `team_invite_resend_prepare_v1` (Rolle, 5 Minuten Abstand, max 5) legt den neuen Hash in `token_hash_next` ab.
2. Versand.
3. Erfolg: `mark_sent` tauscht next→current, setzt `resend_count+1`, `last_sent_at` und `expires_at` und schreibt `invite_resent`.
4. Fehler: `token_hash_next` wird geleert. Der alte Link gilt weiter, und es entsteht kein Eintrag.

Die Annahme akzeptiert current und next. Ein nachträglich zugestellter Link funktioniert also auch dann, wenn `mark_sent` nicht mehr ankam.

### 3.5 Billing: Tarifwahl und Portal
- **Nutzlast des Portals:**
  - nur `team_id`, kein Tarif, kein Takt.
  - Erfolg 200: `{success:true, portal_url, return_url, team_id, billing_status, cancel_at_period_end, access_ends_at, billing_interval}`.
- **Fehler:** Body immer `{success:false, error}`:

  | Status | error |
  |---|---|
  | 405 | Method not allowed |
  | 500 | Missing server configuration |
  | 401 | Missing Authorization header / Not authenticated |
  | 400 | Invalid team_id |
  | 404 | Team not found |
  | 409 | Team is deleted |
  | 403 | Forbidden / Only team owners/admins can manage billing |
  | 404 | No billing record found for this team |
  | 409 | Missing Stripe customer id |
  | 500 | Stripe did not return a portal URL / roher Stripe-Fehlertext |

  Bubble leitet heute auch bei einem Fehler weiter, auf eine leere Adresse.
- **Tarifwechsel im Portal:** Die Portal-Konfiguration liegt in Stripe, dafür habe ich keinen Zugriff. Bitte im Stripe-Dashboard unter Settings → Billing → Customer portal prüfen:
  - ob „Customers can switch plans“ an ist;
  - welche Produkte und Preise dort freigegeben sind. Es müssen genau die `stripe_monthly_price_id` und `stripe_yearly_price_id` von Essential, Professional und Enterprise sein.

  Ein Preis im Portal, der in `billing_plan` fehlt, kommt über den Webhook ohne Plan an: `resolvePlanForPrice` liefert null, und Plan und Takt bleiben alt.
- **Team ohne Abo:**
  - **Nie bezahlt** (Legacy, manuell; 8 Teams, z. B. 877c): keine Billing-Zeile, kein Stripe-Kunde, das Portal antwortet 404.
  - **Testphase vorbei / Abo gekündigt:** Der Kunde existiert. Das Portal zeigt Rechnungen und Zahlungsmittel, legt aber kein neues Abo an. Der Webhook hat das Team zudem auf `is_deleted` gesetzt (K5), also antwortet das Portal 409 „Team is deleted“.
  - **Heute gibt es für beide keinen Weg zu einem Abo.** Wir brauchen die Kassen-Funktion `create-team-checkout` (6.4) und die Webhook-Anpassung (2.6.3).

### 3.6 Audit-Log doppelt
Das Limit ist 50 Aufrufe pro Minute und Nutzer. Ein Doppelaufruf je Laden ist unkritisch, die neue Seite ruft ohnehin einmal.

---

## 4. Außerhalb des Auftrags (Abschnitt 5, nur Befunde)
- **user_metadata im Server:**
  - Befund: `display_name`, `full_name` und `name` aus `raw_user_meta_data` gehen roh in get_team_organisation_v4, get_team_audit_log_v1 und get_team_invite_by_token_v3 (`inviter_name`). Diese Werte setzt der Nutzer selbst (`auth.updateUser`). 5 Konten enthalten `<` oder `>`. Auf der Einladungsseite sieht das ein **anderer** Nutzer.
  - Schwere: mittel.
  - Vorschlag: In v1 über `app.js_safe` ausgeben und `<>` entfernen, Länge ≤ 80. Die UI rendert ohnehin nur als Text.
- **Einladungsseite und Registrierung:**
  - Unbestätigte Konten dürfen annehmen (2.4.8).
  - `create_team_invite_v1` gibt noch einen Link auf `llmoscout.bubbleapps.io/version-test` zurück. Bubble nutzt ihn vermutlich nicht.
- **Brand-Editor:**
  - Nach Logo-Fix und v1 bleibt `enforce_own_brand_only` (Name auch für Wettbewerber) wie entschieden.
- **Konto löschen:**
  - FKs ohne on delete auf auth.users (Protokoll, Einladungen) verhindern das Löschen eines Kontos. Muss beim Thema „Konto löschen“ gelöst werden.
  - Vorschlag: Spalten auf null setzen (`on delete set null`), E-Mail im Protokoll bleibt als Text.

---

## 5. Rechte-Tabelle (so erzwingt sie der Server)

| Aktion | owner | admin | member | ohne Zugang (abgelaufen) | gelöschtes Team |
|---|---|---|---|---|---|
| Seite lesen (meta, brand, members) | ja | ja | ja | ja | nein (PT404) |
| Einladungen lesen | ja | ja | nein | ja | nein |
| Protokoll lesen | ja | ja | nein | ja | nein |
| Billing-Status lesen | voll | voll | ohne Preise | ja | nein |
| Brand speichern, Logo | ja | ja | nein | nein | nein |
| Modelle setzen | ja | ja | nein | nein | nein |
| Einladen | member, admin | **nur member** (8.3) | nein | nein | nein |
| Erneut senden, zurückziehen | ja | ja (eigene und Member-Einladungen) | nein | nein | nein |
| Mitglied entfernen | alle außer sich (letzter Owner geschützt) | nur member | nein | ja | nein |
| Rolle ändern | ja, auch Owner-Übergabe | **nein** (8.3) | nein | ja | nein |
| Verlassen | ja, wenn nicht letzter Owner | ja | ja | ja | ja |
| Team löschen | ja (Name + Reauth) | nein | nein | ja | – |
| Portal öffnen | ja | ja | nein | ja | nein |
| Checkout | ja | ja | nein | ja | nein (8.6) |

Reihenfolge in jeder Funktion:
1. `auth.uid()`;
2. Mitgliedschaft und Rolle (42501 fremdes Team, PT403 Rolle);
3. Team `for update` (nur bei Schreibfunktionen);
4. Zugang;
5. Werte (22023);
6. Ratenlimit (PT429);
7. Schreiben;
8. Protokoll;
9. Cache leeren;
10. neuer Stand zurück.

---

## 6. Vorschlag Funktionen (Namen wie die UI sie erwartet)

Alle: `security definer`, `set search_path = app, public, extensions, pg_temp`, revoke von public und anon, grant authenticated (die `_mark_*` nur service_role), Benutzer nur aus `auth.uid()`, kein `exception when others`. Ausgabe über `app.js_safe`; Anzeigenamen und Teamnamen ohne `<>`. Fehler als `raise exception '<code>' using errcode = …, hint = …`.

### 6.1 Lesen
| Funktion | Antwort |
|---|---|
| `settings_page_meta_v1(p_team)` | `{meta:{team_id, viewer_role, viewer_user_id, viewer_email, has_access, access_state, is_deleted}, row:{can_edit_brand, can_manage_models, can_invite, can_invite_admin, can_manage_members, can_change_roles, can_transfer_owner, can_leave, can_delete, can_manage_billing, reasons:{<flag>: 'role'|'no_access'|'last_owner'|'deleted'}}}` |
| `settings_brand_v1(p_team)` | `{meta, row:{company_id, name, name_default, logo_url, logo_default, market, market_name, business_model, industry, summary, limits:{name:80, industry:80, summary:1000, logo:500}, markets:[{alpha2,name}]}}` – schreibt nichts |
| `team_members_v1(p_team)` | `{meta:{viewer_role, viewer_user_id, viewer_email, permissions}, rows:[{user_id, email, display_name, role, joined_at, is_self}]}` (Form 6.3 aus dem Auftrag) |
| `team_invites_v1(p_team)` | `{meta:{count}, rows:[{invite_id, invited_email, invited_role, status, created_at, created_by_email, expires_at, resend_count, last_sent_at, send_state:'sent'|'unknown'|'failed'}]}`; `expired` wird berechnet |
| `team_log_v1(p_team, p_limit, p_before)` | `{meta:{next_before}, rows:[{log_id, created_at, event_type, actor_user_id, actor_email, actor_display_name, target_user_id, target_email, meta}]}` |
| `billing_status_v1(p_team)` | wie `get_team_billing_status_v1`, aber `has_active_access` aus `team_access`; Member ohne Preise |
| `billing_plans_v1()` | `{rows:[{plan_id, name, monthly_price_eur, yearly_price_eur, prompts_per_day, competitors_max_active, models_max_active, trial_days, trial_available, is_current}]}` |

### 6.2 Schreiben
| Funktion | Antwort bei Erfolg | Protokoll |
|---|---|---|
| `settings_brand_save_v1(p_team, p_market_id, p_business_model, p_industry, p_summary)` | `{meta:{changed:[…]}, row: settings_brand}` | brand_settings_changed (alt/neu je Feld, summary nur Länge) |
| `settings_brand_logo_v1(p_team, p_logo_url)` (null = zurücksetzen) | dto. | brand_logo_changed |
| `team_models_set_v1(p_team, p_model_keys text[])` | `{meta:{changed}, rows: Modelle}` | models_changed (an/aus) |
| `team_invite_create_v1(p_team, p_email, p_role, p_token_hash)` | `{meta:{unchanged}, row: invite}` | – (erst bei mark_sent) |
| `team_invite_resend_v1(p_team, p_invite_id, p_token_hash_next)` | `{row: invite}` | – (erst bei mark_sent) |
| `team_invite_mark_sent_v1 / _send_failed_v1` (service_role) | `{row}` | member_invited / invite_resent / invite_send_failed |
| `team_invite_revoke_v1(p_team, p_invite_id)` | `{row}` | invite_revoked |
| `team_member_remove_v1(p_team, p_user_id)` | `{rows: members}` | member_removed |
| `team_member_role_v1(p_team, p_user_id, p_role)` | `{meta:{unchanged}, rows: members}` | role_changed / owner_transferred |
| `team_leave_v1(p_team, p_confirm_name)` | `{row:{remaining_teams, next_team_id}}` | member_left |
| `team_delete_v1(p_team, p_confirm_name)` | `{row:{deleted:true, purge_after, remaining_teams, next_team_id}}` | team_deleted |

### 6.3 Fehlercodes (message = Code)
| SQLSTATE | message |
|---|---|
| 28000 | `settings_not_authenticated` |
| 42501 | `team_forbidden` (fremdes Team) |
| PT403 | `team_role_required` (hint: benötigte Rolle), `settings_reauth_required` |
| PT404 | `team_not_found`, `team_member_not_found`, `team_invite_not_found` |
| PT409 | `team_last_owner`, `team_invite_not_pending`, `team_cannot_remove_self`, `team_already_member`, `team_deleted`, `billing_subscription_exists`, `billing_no_customer` |
| PT429 | `team_rate_limited`, `team_invite_rate_limited` (hint: Sekunden bis frei) |
| 22023 | `settings_invalid_market`, `settings_invalid_business_model`, `settings_too_long` (hint: Feld), `settings_invalid_logo_url`, `team_invalid_email`, `team_invalid_role`, `team_confirm_name_mismatch`, `team_models_invalid` (hint: Keys), `team_models_limit`, `team_models_min_one` |
| PT402 | `team_access_<state>` (Schreiben ohne Zugang) |

### 6.4 Edge Functions (neu, darf ich selbst deployen)
| Funktion | Eingang | Ausgang | Kern |
|---|---|---|---|
| `team-invite-send` | `{team_id, email, role}` oder `{team_id, invite_id}` (erneut) | `{ok, invite_id, sent_at}` / 502 `team_invite_send_unknown` | Ablauf 3.2/3.4, HTML-Escape, Link nur aus Secret |
| `team-billing-portal` | `{team_id}` | `{url}` | wie heute plus Ratenlimit, `APP_URL/settings/billing`, stabile Codes |
| `team-checkout` | `{team_id, plan_id, billing_interval}` | `{url}` | owner/admin; Preis aus `billing_plan`; bestehender Kunde; Testphase nur einmal je Team und Nutzer; Metadaten `{source:'team', team_id, user_id, plan_id, billing_interval}`; Idempotenzschlüssel; 409 bei laufendem Abo |
| `team-billing-cancel` | intern (Cron) | – | kündigt Abos gelöschter Teams |

Der bestehende `stripe-webhook` muss `source:'team'` verstehen und darf bei Abo-Ende nicht mehr löschen. Das ist eine Änderung an einer bestehenden Edge Function und braucht deine Freigabe.

**Reauth:** Supabase-JWTs tragen `amr` (Liste `{method, timestamp}` der Anmeldung) und `iat`. `iat` wird bei jedem Token-Refresh neu gesetzt und taugt dafür nicht. `amr[*].timestamp` ist die eigentliche Anmeldung. Die Prüfung `max((auth.jwt()->'amr'->i->>'timestamp')::bigint) > now() - 15 min` ist im Server machbar; sonst PT403 `settings_reauth_required`. Für `team_delete_v1` und die Owner-Übergabe einsetzen. Die UI meldet sich dann neu an (Passwort oder OAuth).

### 6.5 Limits
| Art | Limit |
|---|---|
| Lesen | 60 pro Minute je Nutzer und Funktion |
| Schreiben | 20 pro Minute |
| Einladungen | 50 offen je Team, 20 je Team und Tag, 30 je Nutzer und Tag |
| Erneut senden | alle 5 Minuten, max 5 je Einladung |
| Portal / Checkout | 5 pro Minute je Nutzer |

Umsetzung über `check_rate_limit`, aber mit festem Funktionsnamen und ohne Direktaufruf: `check_rate_limit` nicht mehr für anon und authenticated freigeben. Die Tagesgrenzen werden aus `team_invite` gezählt.

### 6.6 Beispiele
Die echten Antworten der heutigen Lesefunktionen stehen in `settings_lesen_echte_antworten.json`. Die Beispiele der v1-Funktionen kommen mit dem Bau (wie bei Brands).

---

## 7. Bauplan
0. **Sofort, vor Schritt 1** (eine SQL-Datei mit Rückweg, nach Freigabe):
   - K2 revoke `create_team_with_brand` und `create_or_get_team`;
   - K4 revoke `delete_team_v2`;
   - `team_access` und `check_rate_limit` nur intern;
   - brands_logo_nur_eigene.sql einspielen (liegt bereit);
   - K1 Patch `send-team-invite` (escapen, `base_url` ignorieren, gelöschtes Team ablehnen); bestehende Edge Function, also durch dich oder mit Freigabe.
1. Lesen: settings_page_meta_v1, settings_brand_v1, team_members_v1, team_invites_v1, team_log_v1, billing_status_v1, billing_plans_v1.
2. Brand schreiben: settings_brand_save_v1, settings_brand_logo_v1, team_models_set_v1; Protokoll-CHECK erweitern.
3. Einladungen: Spalten an `team_invite` (sent_at, send_failed_at, resend_count, last_sent_at, token_hash_next), Status `send_failed`, Funktionen und `team-invite-send`.
4. Mitglieder: team_member_remove_v1, team_member_role_v1 (mit `for update`, Owner-Übergabe).
5. Billing: `team-billing-portal`, `team-checkout`, Webhook-Anpassung (Freigabe).
6. Verlassen und Löschen: team_leave_v1, team_delete_v1 (Soft-Delete, Reauth), Purge-Job, `team-billing-cancel`.

---

## 8. Offene Fragen mit Empfehlung
1. **Letzter Owner will gehen:** Verlassen bleibt gesperrt. Er muss erst einen Owner ernennen oder das Team löschen. Empfehlung: so lassen.
2. **@upstreem.ai-Mitglieder (11 in 11 Teams):** Heute sind es normale Mitglieder. Kunden sehen und entfernen sie, sie zählen mit, und sie erscheinen im Protokoll. Empfehlung: neues Feld `team_member.is_support boolean default false`. Support-Mitglieder bleiben für Kunden unsichtbar und werden nicht protokolliert, solange sie nur lesen. Sie dürfen nicht Owner sein. Die Rolle bleibt, es ist ein Merkmal und keine eigene Rolle.
3. **Admin-Rechte:** Empfehlung: Ein Admin lädt nur Member ein und ändert keine Rollen. Heute darf er member→admin befördern und Admins einladen.
4. **Löschen sofort oder weich:** Empfehlung: weich mit 14 Tagen, Abo sofort kündigen, ohne anteilige Erstattung. Ob ihr erstattet, ist eure Geschäftsentscheidung.
5. **Owner-Übergabe:** Empfehlung: Der Owner ernennt einen anderen Owner (Reauth) und wird selbst Admin, wenn er das wählt. Der Stripe-Kunde bleibt; die Rechnungsmail ändert der neue Owner im Portal.
6. **Abo-Ende:** Empfehlung: Das Team bleibt bestehen (`access_state = ended`), Daten bleiben 90 Tage, Checkout bleibt möglich. Löschen nur auf Wunsch.
7. **Reauth:** machbar über `amr` (6.4). Empfehlung: für Löschen und Owner-Übergabe.
8. **Promo-Codes im Team-Checkout:** wie im Onboarding nur monatlich? Empfehlung: ja, gleich halten.
9. **Billing für Member sichtbar:** Empfehlung: Plan und Zustand ja, Preise und Portal nein.

---

## 9. Entscheidungen und Umsetzung vom 11.10.2026 (geht vor)

### 9.1 Entscheidungen
| Punkt | Entscheidung |
|---|---|
| K1 Einladungs-Mail | beheben (erledigt, `send-team-invite` v33; `llmoscout.bubbleapps.io` ist alt und nicht mehr erlaubt) |
| K2 Teams ohne Bezahlung anlegen | `create_team_with_brand`, `create_or_get_team` entfernen |
| K3 Logo/Your Brand | `brands_logo_nur_eigene.sql` spielt Lukas ein |
| K4 Team löschen | weich löschen, endgültig nach **30 Tagen** per Hintergrundjob; heute schon gelöschte Teams nie automatisch löschen |
| K5 Abo-Ende | löscht das Team **nicht** |
| K6 Kasse | neue Edge Function für bestehende Teams |
| Admin-Rechte | Admin lädt nur **Member** ein, darf aber Member → Admin befördern; sonst keine Rollenänderung |
| Support-Konten @upstreem.ai | eigenes Merkmal, für Kunden unsichtbar (kommt mit Schritt 4) |
| 4 heute gelöschte Teams | wieder auf „nicht gelöscht“ (`teams_wiederherstellen.sql`) |

### 9.2 Geänderte Verträge (heute schon gültig nach `settings_sofort.sql`)

**`delete_team_v3(p_team)`** (Bubble-Name bleibt)
- Erfolg: `{ok:true, team_id, team_deleted:1, soft_deleted:true, already_deleted, purge_after, stripe_cancel:'none'|'pending', schedules_disabled}`.
- Die früheren Zähler je Tabelle entfallen. Das ist eine bewusste Ausnahme von „Felder kommen nur dazu“, denn es wird nichts mehr sofort gelöscht.
- Ablehnung wie bisher: `not authenticated`, `forbidden`, `team not found`.

**`create_team_invite_v1`** (Antwortform unverändert). Neue Ablehnungen:

| SQLSTATE | message | hint |
|---|---|---|
| PT409 | `team_deleted` | – |
| PT409 | `team_invite_pending` (statt roher 23505) | – |
| 22023 | `invalid email` | – |
| PT429 | `rate_limited` | `team_open_invites`, `team_daily_invites` oder `user_daily_invites` |

`invite_link` in der Antwort zeigt jetzt auf `https://app.upstreem.ai/invite?token=…` (vorher alte Bubble-Domain). Abgelaufene offene Einladungen werden beim nächsten Einladen auf `expired` gesetzt und sperren die Adresse nicht mehr. anon darf die Funktion nicht mehr aufrufen.

**`send-team-invite`** (v33)
- `base_url` aus dem Body gilt nur, wenn sie auf `https://app.upstreem.ai`, `upstreem.ai` oder `www.upstreem.ai` zeigt. Erlaubt sind dabei leerer Pfad, `/version-test` oder `/version-live`.
- Sonst gilt das Secret `INVITE_BASE_URL`. Fehlt auch das, kommt 400 `missing_invite_base_url`.
- Der Teamname wird HTML-escaped und auf 80 Zeichen gekürzt.
- Gelöschte Teams bekommen 409 `team_deleted`.

**`create-team-checkout`** (neu)
- Eingang: `{team_id, billing_plan_id, billing_interval: 'monthly'|'yearly', return_path?}`.
- Ausgang: `{success:true, url, checkout_url, checkout_session_id, billing_plan_id, billing_plan_name, billing_interval, trial_days}`.
- Fehler: `{success:false, error:<code>, code, hint}`:

  | HTTP | SQLSTATE / Code |
  |---|---|
  | 401 | 28000 |
  | 403 | 42501 `team_forbidden`, PT403 `team_role_required` |
  | 404 | PT404 `billing_plan_not_found` |
  | 409 | PT409 `team_deleted`, `billing_subscription_exists` (hint `portal`) |
  | 429 | PT429 `billing_rate_limited` |
  | 400 | 22023 |
  | 502 | Stripe |

- Rückkehr: `APP_URL + return_path` (Standard `/settings/billing`) mit `?checkout=success&session_id=…` oder `?checkout=cancelled`.
- Testphase nur bei monatlich, höchstens einmal je Team und Nutzer. Promo-Codes nur bei monatlich.
- Läuft schon ein Abo, kommt 409, und die UI öffnet das Portal.

**Webhook**
- `metadata.source = 'team'` ruft `_billing_team_checkout_apply_v1` auf.
- Ein Abo-Ende setzt nur `team_billing`, nie `team.is_deleted`.
- `customer.subscription.updated` liest den aktuellen Stand aus Stripe.

**Endgültiges Löschen**
- Tabelle `team_purge_job`, Cron `team-purge-worker` (30 s, 7 s Budget).
- 96 Schritte in Blöcken zu 2000 Zeilen, Kinder zuerst. Am Ende eine Restprüfung über jede Tabelle mit `team_id`.
- Gemessen im Rollback: HUBie mit 413.000 Zeilen in 36 s, also etwa 5 Cron-Läufe.
- Läuft noch ein Abo, wartet das Löschen, bis `team-billing-cancel` gekündigt hat (Cron `team-billing-cancel` alle 5 min über pg_net).

**Support**
- `app.team_restore_v1(team)` holt ein Team zurück, solange das Löschen noch nicht läuft.
- `app.team_purge_schedule_v1(team, tage)` plant das endgültige Löschen für ein schon gelöschtes Team ausdrücklich ein.
- Beides nur im SQL-Editor bzw. mit service_role.

### 9.3 Deployt am 11.10.2026
`send-team-invite` v33, `stripe-webhook` v8, `create-team-checkout` v1, `team-billing-cancel` v1. Rückwege: `edge/orig/send-team-invite_v31.ts`, `edge/orig/stripe-webhook_v7.ts`. Die beiden neuen Funktionen brauchen `settings_sofort.sql` (vorher antworten sie mit 500).
