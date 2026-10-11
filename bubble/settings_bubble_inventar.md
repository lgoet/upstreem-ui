# Settings: Bestand in Bubble und in den Bausteinen (Stand 11.10.2026)

Grundlage für den DB-Auftrag (`settings_db_auftrag.md`) und die Seiten-Komponente `settings-page.js`
(Präfix `uss`). Was hier steht, ist gelesen (Code, Vorlagen) oder vom Nutzer geschickt (Bilder der
Workflows und der RPC-Liste). Wo etwas erschlossen ist, steht es dabei.

---

## 1. Aufbau der Ansicht heute

Seitenkopf `settings-page-header.js` (`sph`) mit drei Reitern, darunter je Reiter ein Baustein:

| Reiter (Wert) | Etikett | Baustein | Präfix | Vorlage |
|---|---|---|---|---|
| `preferences` | Your Brand | `settings-brand.js` | `usb` | `bubble/settings_brand_bubble.html` |
| `team` | Team Organisation | `team-orga.js` | `uto` | `bubble/team_orga_bubble.html` |
| `billing` | Billing | `settings-billing.js` | `ubl` | `bubble/settings_billing_bubble.html` |

Nicht Teil der Ansicht: `preferences.js` (`ums`, das Fenster „Preferences“ aus dem Kontomenü; schreibt
Name und Bild selbst über Supabase Auth und Storage) und die Seite Teams (`teams-page.js`).

Der Reiter `preferences` zeigt im Kopf das Logo der eigenen Marke (`data-brand-logo`), die anderen
ein Zeichen. Der Kopf feuert `sphNav {team_id, page}`; der Reiterwechsel selbst passiert vorher im
Browser.

---

## 2. Your Brand (`usb`)

### 2.1 Was der Baustein liest

Über Attribute (von Bubble aus den Teamdaten gesetzt): `data-brand-name`, `data-brand-logo`,
`data-team-id`, `data-team-name`, `data-user-role`, `data-brand-market`, `data-brand-business`
(`b2b|b2c|hybrid`), `data-brand-industry`, `data-brand-summary`.

Über `renderSettingsBrand(params)` (Run JS): vor allem `models[]` je Zeile `model_key`,
`display_name`, `logo_url`, `provider`, `currently_tracking`, `disabled_reason`, `is_model_active`,
`is_allowed_by_plan`, `can_enable`, `can_disable`, `can_toggle`, `sort_order`; aus der ersten Zeile
`active_models_limit` und `user_can_manage`. Märkte aus der App-Ablage (`setUpstreemAllMarkets`).
Branchen sind eine feste Liste im Baustein, eigene Eingabe bis 48 Zeichen.

### 2.2 Ereignisse und Workflows (Bilder des Nutzers, 11.10.)

| Ereignis | Nutzlast | Workflow heute |
|---|---|---|
| `usbMeta` | `{team_id, market_id, business_model, industry, summary}` | `set_own_brand_settings` → Signal `account_updated` |
| `usbLogoUrl` | `{team_id, url}` | `set_own_brand_settings` → Signal `account_updated` |
| `usbModels` | `{team_id, model_keys:"a,b,c"}` (die ganze aktive Liste) | `manage_team_models` → `REFRESH_MODELSETTINGS` → Signal `account_updated` |
| `usbLeaveTeam` | `{team_id, team_name}` | `leave_team` → bei `ok` nein oder leerer Antwort: Hinweis kopieren, Abbruch → States `leave_team` → zur Seite `signup` |
| `usbDeleteTeam` | `{team_id, team_name}` | State `team_deleted` setzen → `delete_team` → bei `ok` ja zur Seite `signup`, sonst State zurück |
| `usbEditBrand` | `{team_id}` | (nicht im Bild; vermutlich der Marken-Editor) |
| `usbLogoFile` | `{name, type, size, data}` | abgeschaltet (`LOGO_UPLOAD = false`) |
| `usbSaved` | `{block, brand_name, message}` | nur Rückmeldung, kein Schreiben |
| Custom `REFRESH_MODELSETTINGS` | – | `get_team_model_settings` |
| Seitenaufbau (Your Brand sichtbar) | – | Loading an → `REFRESH_MODELSETTINGS` → Run JS → Loading aus |

Signal `account_updated` = Run JS `upstreemSignal("account_updated", "meta")`. In JS hört niemand
darauf; der Seiten-Workflow `bubble_fn_upSignal` lädt den Team-Kopf neu (Seitenleiste, Attribute oben)
und ruft `setSettingsBrandLoading(…, "no")`.

### 2.3 Befunde im Baustein

1. **Erfolgsmeldung vor dem Speichern.** „<Marke> settings updated“ kommt beim Klick, nicht nach der
   Antwort der Datenbank. Scheitert der Aufruf, stand trotzdem „updated“ da.
2. **Team löschen** zeigt nur, wer `data-user-role = owner` hat. Rolle kommt aus Bubble-Daten.
3. **Team verlassen** darf jeder, auch der letzte Owner. Keine Prüfung im Browser.
4. Bestätigung über den getippten Teamnamen (Groß/klein zählt, Leerzeichen am Rand nicht). Ohne
   bekannten Namen heißt das Wort „this team“. Löschen braucht dazu einen zweiten Klick binnen 4 s.
5. **Logo-Link ohne Prüfung des Schemas** (`javascript:`, `data:`, `http:` gehen hinaus).
6. **Zusammenfassung ohne Längengrenze.**
7. `user_can_manage` fehlt → Vorgabe `true`; `active_models_limit` fehlt → Vorgabe 3. Grenze und
   „mindestens ein Modell“ nur im Browser.
8. Workflow Löschen setzt den State **vor** dem Aufruf; Workflow Verlassen leitet nach `signup`, ohne
   dass `ok` ausdrücklich geprüft wird (nur „nein oder leer“).

---

## 3. Team Organisation (`uto`)

### 3.1 Setter und Antwortformen

- `renderTeamOrga(p)`: `members[]` (Pflicht) mit `role, email, user_id, joined_at, display_name`;
  `permissions{can_invite, can_manage_roles, can_manage_members}`; `viewer_role`,
  `viewer_user_id`, `viewer_email`.
- `setTeamOrgaInvites(id, p)`: `{count, invites[]}` oder Liste; je Zeile `invite_id,
  invited_email, invited_role, status, expires_at, created_by_email, revoked_at, accepted_at`.
  Gezeigt werden nur offene.
- `setTeamOrgaLog(id, p)`: Liste oder `{logs[]}`/`{entries[]}`; je Zeile `created_at, event_type,
  actor_email|actor_display_name, target_email, meta{}`.

### 3.2 Ereignisse und Workflows (Bilder des Nutzers, 11.10.)

| Ereignis | Nutzlast | Workflow heute |
|---|---|---|
| `utoInvite` | `{team_id, email, role}` (`member\|admin`) | `SET_LOADING_YES` → States processing, invite_loading → `create_team_invite` → **Invoke `send-team-invite`** (nur bei count > 0) → **`revoke_team_invite`, wenn der Versand scheitert** → invite_loading → `UPDATE_ALL_TEAMORGA` (count > 0) → Hinweise: Erfolg (count > 0 und Versand ok), „duplicate key value“, „user already member“, Versand gescheitert → processing → `SET_LOADING_NO` |
| `utoResend` | `{team_id, invite_id, email, role}` | `SET_LOADING_YES` → processing → `resend_team_invite` → Invoke `send-team-invite` (wenn `first item's ok`) → `UPDATE_ALL_TEAMORGA` (ok) → Hinweis Erfolg (ok) bzw. zwei Fehlerhinweise nach Statustext → processing → `SET_LOADING_NO` |
| `utoRevoke` | `{team_id, invite_id, email}` | `SET_LOADING_YES` → processing → `revoke_team_invite` → `UPDATE_ALL_TEAMORGA` (ok) → Hinweis ok / nicht ok oder leer → processing → `SET_LOADING_NO` |
| `utoRemove` | `{team_id, user_id, email, self:false}` | `SET_LOADING_YES` → `kick_team_member` → Hinweis bei count > 0 / count 0 → `UPDATE_ALL_TEAMORGA` (count > 0) → `SET_LOADING_NO` |
| `utoRole` | `{team_id, user_id, email, role}` | `SET_LOADING_YES` → `set_team_member_role` → Hinweis bei count > 0 / count 0 → `UPDATE_ALL_TEAMORGA` (count > 0) → `SET_LOADING_NO` |
| `UPDATE_ALL_TEAMORGA` | – | `UPDATE_TEAM` → `UPDATE_INVITES` → `UPDATE_LOGS` |
| `UPDATE_TEAM` | – | `get_team_organisation` → `get_team_audit_log_v1` → FILL MEMBERS |
| `UPDATE_INVITES` | – | `get_team_invites` → FILL INVITES |
| `UPDATE_LOGS` | – | `get_team_audit_log_v1` → Run JS |
| Seitenaufbau (`active_component` = team, einmal) | – | `SET_LOADING_YES` → `UPDATE_ALL_TEAMORGA` → `SET_LOADING_NO` |

`team_id` kommt in diesen Ereignissen aus `getTeam()` der Seite (makeFire), nicht aus dem Baustein.

**Antwortform der heutigen Funktionen (aus den Bedingungen erschlossen):** Listen von Zeilen.
`revoke_team_invite` und `resend_team_invite` tragen `ok` in der ersten Zeile; bei
`set_team_member_role`, `kick_team_member` und `create_team_invite` prüft Bubble nur, ob überhaupt
eine Zeile kam. Fehler kommen teils als Zeile `ok:false`, teils als Ausnahme mit Statustext (roh aus
Postgres: „duplicate key value“).

### 3.3 Rollenregeln im Baustein (nur Anzeige)

- member: keine Aktion, sieht weder Einladungen noch Protokoll.
- admin: einladen (Member und Admin), erneut senden, zurückziehen; Member entfernen; Rollen
  zwischen Member und Admin ändern, auch bei anderen Admins, nicht bei sich selbst (11.10. vom
  Nutzer bestimmt).
- owner: alles; der letzte Owner ist unantastbar; eigene Zeile nie entfernbar.
- `@upstreem.ai`-Mitglieder: gesperrt.
- Die Flags `can_manage_*` werden bewusst nicht gelesen (Widerspruch `admin` + `can_manage_roles:
  false` beim Nutzer, `datenbank_auftrag.md` §3).

### 3.4 Befunde

1. **Keine Rückfrage** bei Entfernen, Rollenwechsel (auch „zum Owner machen“) und Zurückziehen
   (seit 4326fb6 im Baustein behoben).
2. Einladen schließt den Dialog sofort, ohne auf die Antwort zu warten; ein Fehler (Adresse schon
   Mitglied, Grenze) erreicht den Nutzer nur über einen Bubble-Hinweis.
3. E-Mail ohne Längengrenze, nur `UC.mailOk`.
4. **Rolle und Entfernen melden womöglich Erfolg, der keiner ist:** Bubble prüft dort nur
   `count > 0`. Liefert die Funktion eine Zeile `ok:false` (wie Revoke und Resend), steht trotzdem
   der Erfolgshinweis da und die Liste lädt neu. Sofort in Bubble behebbar: Bedingung auf
   `first item's ok is yes`, sobald der DB-Chat die Antwortform bestätigt.
5. **Erneut senden meldet Erfolg, auch wenn die E-Mail nicht hinausging:** der Erfolgshinweis
   hängt nur an `resend_team_invite`, nicht am Ergebnis von `send-team-invite`.
6. Zurückziehen nach gescheitertem Versand schreibt einen Protokolleintrag `invite_revoked` für
   eine Einladung, die nie jemand bekam.
7. `get_team_audit_log_v1` läuft bei jedem `UPDATE_ALL_TEAMORGA` **zweimal** (in `UPDATE_TEAM`
   und in `UPDATE_LOGS`).
8. Eine zweite offene Einladung an dieselbe Adresse endet als roher Postgres-Fehler („duplicate
   key value“) statt als eigene Meldung.

---

## 4. Billing (`ubl`)

| Ereignis | Nutzlast | Workflow heute (Bilder vom 11.10.) |
|---|---|---|
| Seitenaufbau (`active_component` = billing, einmal) | – | `get_team_billing_status` → FILL BILLING (`setBillingSubscription`) |
| `ublPlans` | `{team_id, current_plan_id}` | `get_billing_plans` → Run JS (`setBillingPlans`) |
| `ublManage` | `{team_id}` | State forwarding → `OPEN PORTAL` |
| `ublSelectPlan` | `{team_id, plan_id, plan_name, billing_interval, price_eur, …}` | State forwarding → **`OPEN PORTAL`** (dasselbe wie Manage) |
| `OPEN PORTAL` | – | State forwarding → Invoke `create-billing-portal-session` → State forwarding → „Open an external website“ |

„Manage billing“ zeigt der Baustein nur bei `can_manage_billing !== false`; Entwicklerzugang
(„Legacy Free“) sperrt den Knopf. Das Tarif-Fenster ist `UC.makePlanDialog` (dasselbe wie im Access
Gate).

**Befunde:**

1. **Die Tarifwahl geht verloren.** `ublSelectPlan` öffnet nur das Portal; welchen Tarif der Nutzer
   im Fenster gewählt hat, wird nirgends weitergegeben (`OPEN PORTAL` hat keinen Parameter, soweit
   im Bild sichtbar). Ob das Portal einen Tarifwechsel anbietet, hängt an seiner Einstellung bei
   Stripe; ein Team **ohne** Abo (kein Stripe-Kunde) kann im Portal kein neues Abo abschließen.
2. **Kein Fehlerzweig:** Scheitert `create-billing-portal-session`, wird trotzdem „Open an external
   website“ ausgeführt (mit leerer oder fehlerhafter Adresse).
3. Es gibt keine eigene Kassen-Funktion. Die Seite geht für die Tarifwahl deshalb denselben Weg
   (Portal), bis der Vertrag etwas anderes nennt.

## 5. RPC-Liste des Nutzers (Bild, 11.10.)

Lesen: `get_team_organisation`, `get_team_invites`, `get_team_audit_log_v1`,
`get_team_model_settings`, `get_team_billing_status`, `get_billing_plans`.

Schreiben: `set_own_brand_settings`, `manage_team_models`, `create_team_invite`,
`resend_team_invite`, `revoke_team_invite`, `kick_team_member`, `set_team_member_role`,
`leave_team`, `delete_team`.

Edge Functions (im Bild mit `<>`): `send-team-invite`, `create-billing-portal-session`.

Nicht in der Liste, aber gebraucht: die Lesefunktion für Name, Logo, Markt, Geschäftsmodell,
Branche und Zusammenfassung der eigenen Marke (heute Attribute aus dem Team-Kopf). Eine Kasse gibt
es nicht; die Tarifwahl öffnet heute das Portal (Abschnitt 4).

---

## 6. Was die neue Seite ändert (Kurzfassung)

- Eine Wurzel `.uss-root`: Kopf mit Krumen und drei Reitern, darunter die drei Bausteine **im
  lokalen Modus** (`data-local="yes"`). Ihre Ereignisse gehen an die Seite, nicht an Bubble.
- Die Seite ruft die Funktionen selbst (`UC.rpc`, `UC.edge`, Nutzer-JWT). Verlinkt wird **Schritt
  für Schritt**, je Funktion nach abgestimmtem Vertrag (Schalter `LIVE` in `settings-data.js`).
- Rückfragen für alles, was nicht zurückzunehmen ist: Entfernen, Rolle ändern, Owner übergeben,
  Einladung zurückziehen; Verlassen und Löschen wie bisher mit getipptem Teamnamen.
- Erfolg erst nach der Antwort der Datenbank. Fehler als Satz, nie still.
- Nach Änderungen an Marke und Modellen: `upstreemSignal("account_updated", "meta")`, solange der
  Team-Kopf noch aus Bubble kommt.
