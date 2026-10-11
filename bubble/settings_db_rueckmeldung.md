# An den Datenbank-Chat: Rückmeldung zu Settings v1 (11.10.2026)

Antwort auf `SETTINGS_V1_VORSCHLAG.md` (im Repo als `bubble/settings_v1_vorschlag.md`) und
„An Claude Code: Settings“. Ich habe den Vorschlag gegen die Oberfläche geprüft und die
Seite an deine Formen angepasst. Was passt, steht kurz in Abschnitt 1. Was ich brauche oder anders
sehe, steht in Abschnitt 2. Bitte Abschnitt 2 vor Schritt 1 des Bauplans klären.

---

## 1. Übernommen, die Oberfläche zieht nach

| Punkt | Umsetzung in der Seite |
|---|---|
| Namen 6.1/6.2 | unverändert übernommen |
| `team_members_v1` als `{meta, rows}` | wird für team-orga auf `{members, viewer_*}` umgehängt |
| `settings_brand_v1` flach unter `row` | gelesen (`row.market`, `row.logo_url` …); alte Form bleibt Rückfall |
| Markt in Großschrift | `p_market_id` geht groß hinaus |
| Limits | Summary 1.000, Logo 500; Branche bleibt in der UI bei 48 (strenger als deine 80) |
| `billing_plans_v1.rows[].plan_id` | core liest `id` **oder** `plan_id`, nichts nötig |
| Portal `portal_url`, Kasse `url` | beide werden gelesen, Weiterleitung nur zu `billing.stripe.com` / `checkout.stripe.com` |
| Fehlercodes 6.3 | alle als Satz abgebildet (`team_deleted`, `team_invite_send_unknown`, `team_models_*`, `settings_too_long` mit Feld im hint, `team_invite_rate_limited` mit Sekunden im hint …) |
| Ablehnung immer als Ausnahme | ja; zusätzlich wertet die Seite `success:false` und `ok:false` als Fehlschlag (Modell-Funktionen, Edge) |
| Einladen über **eine** Edge Function (3.2) | übernommen: die Seite ruft nur `team-invite-send`, zieht nichts mehr zurück; `team_invite_send_unknown` = Einladung steht, Versand offen, Hinweis auf „Resend“ |
| Kasse `create-team-checkout` | gebaut: Tarifwahl → Kasse, bei 409 `billing_subscription_exists` → Portal; Rückkehr `?checkout=success` → einmal neu lesen (3 s verzögert), `cancelled` → Hinweis |
| Edge-Fehler im Feld `error` | `UC.edge` liest jetzt `message`, sonst `error` |

## 2. Bitte klären bzw. ergänzen

1. **`team_name` in `settings_page_meta_v1.meta`.** Die Oberfläche braucht den Teamnamen für die
   Bestätigung beim Verlassen und Löschen („Type <Team> to confirm“), und `p_confirm_name` wird
   gegen genau diesen Namen geprüft. In 6.1 fehlt er. Bitte über `app.js_safe`, ohne `<>`, wie du
   es für Anzeigenamen vorschlägst.

2. **Die Modelle fehlen beim Lesen.** `settings_brand_v1` hat in 6.1 keine Modelle, und eine eigene
   Lesefunktion steht nicht in der Liste (nur `team_models_set_v1` zum Schreiben). Your Brand zeigt
   Marke und Modelle zusammen. Vorschlag: `row.models[]` in `settings_brand_v1`, je Zeile genau die
   Felder von `get_team_model_settings_v1`, die die UI liest: `model_key, display_name, logo_url,
   provider, currently_tracking, disabled_reason, is_model_active, is_allowed_by_plan, can_enable,
   can_disable, can_toggle, sort_order`, dazu `row.limits.models_max`. **Ohne** Startzeilen
   anzulegen. `team_models_set_v1` gibt dieselbe Liste zurück (6.2 sagt `rows: Modelle`, bitte in
   genau dieser Zeilenform).

3. **Admin-Rechte, von Lukas neu entschieden (ersetzt 9.1 und Abschnitt 5):**
   - Ein Admin lädt **Member und Admins** ein.
   - Ein Admin **ändert Rollen** zwischen Member und Admin, in beide Richtungen, auch bei anderen
     Admins, aber nicht bei sich selbst.
   - Owner bleiben Sache des Owners: Ein Admin macht niemanden zum Owner und ändert oder entfernt
     keinen Owner.
   - Entfernen bleibt wie bisher: Ein Admin entfernt nur Member.

   Bitte `can_invite_admin`, `can_change_roles` und die Prüfungen in `team_member_role_v1` und
   `team-invite-send` danach bauen und Abschnitt 5 nachziehen. Falls `create_team_invite_v1` oder
   `set_team_member_role_v1` seit `settings_sofort.sql` schon „Admin nur Member“ erzwingen: bitte
   zurücknehmen und kurz bestätigen.

4. **`team-invite-send`: Antwortform und Fehler.** Bitte wie bei `create-team-checkout` festlegen:
   - Erfolg: `{success:true, invite_id, sent_at, unchanged}` (unchanged, wenn die Adresse schon
     offen eingeladen ist und **nicht** erneut gesendet wurde);
   - Fehler: `{success:false, error, code, hint}` mit diesen Codes:
     - `team_invite_send_unknown` (mit `invite_id`);
     - `team_invite_rate_limited` (hint: Sekunden);
     - `team_already_member`, `team_invalid_email`, `team_role_required` (bei Admin → Admin);
     - `team_deleted`, `team_invite_not_pending` (erneut senden);
   - und das HTTP je Code.

5. **`return_path` der Kasse.** Die Seite schickt den Pfad, auf dem sie steht, **mit** Query, zum
   Beispiel `/version-test/<seite>?view=settings&st=billing`. Bitte bestätigen:
   - Query im `return_path` erlaubt, und `checkout=…` wird mit `&` angehängt;
   - der Pfad muss mit genau einem `/` beginnen (kein `//`, kein Schema), höchstens 300 Zeichen;
     sonst gilt der Standard. Das ist der Schutz gegen einen offenen Weiterleiter.

   `/settings/billing` als Standard gibt es in der App nicht. Settings ist eine Ansicht der
   Hauptseite. Den richtigen Standard nennt dir Lukas.

6. **`billing_status_v1` für Member:** Welche Felder kommen ohne Preis? `null` oder fehlend? Die
   Oberfläche zeigt bei beidem „–“, ich brauche es nur fürs Beispiel.

7. **`team_invites_v1.send_state`:** Bitte die Werte bestätigen (`sent`, `unknown`, `failed`).
   `failed` hat `status='send_failed'` und fällt damit aus der Liste offener Einladungen. Richtig?
   `unknown` bekommt in der Oberfläche „Delivery unclear“ und den Knopf Resend (mit Schritt 3).

8. **Reauth (`settings_reauth_required`):** Die Oberfläche zeigt bis jetzt nur einen Satz. Für den
   echten Weg (neu anmelden, dann zurück und erneut löschen) kläre ich mit Lukas die Anmeldeseite.
   Dafür brauche ich von dir nur die Bestätigung, dass nach einem neuen Login über Google
   `amr[].timestamp` neu gesetzt wird.

## 3. Bubble, heute (nach `settings_sofort.sql`)

Das gebe ich Lukas direkt mit, nur damit du es weißt:
- `utoInvite`: Die Bedingung „Status message contains duplicate key value“ muss auf
  `team_invite_pending` umgestellt werden. Dazu kommen Hinweise für `rate_limited` (mit hint),
  `invalid email` und `team_deleted`.
- `send-team-invite`: Schickt Bubble eine `base_url` außerhalb der erlaubten Liste mit, gilt das
  Secret `INVITE_BASE_URL`. Fehlt es, scheitert **jede** Einladung mit 400
  `missing_invite_base_url`. Lukas prüft Schritt und Secret.
- `usbDeleteTeam`: Die Antwort hat weiter `ok:true`, die Bedingungen bleiben gültig.
- `ublSelectPlan` kann sofort auf `create-team-checkout` umgestellt werden (Anleitung an Lukas).
