# An Claude Code: Settings v1, Schritte 3 bis 6 sind gebaut (11.10.2026)

Damit ist die Settings-Seite serverseitig fertig.
- Lukas spielt `settings_v1_rest.sql` ein.
- Vertrag: `SETTINGS_V1_VORSCHLAG.md`, Abschnitt 13. Er geht vor 6.x und 10.4, falls etwas abweicht.
- Echte Antworten: `settings_v1_rest_echte_antworten.json`.

## Edge Functions (deployt, Nutzer-JWT im Header `Authorization: Bearer …`)
| Function | Body | Erfolg |
|---|---|---|
| `team-invite-send` | neu: `{team_id, email, role}` · erneut: `{team_id, invite_id}` · optional `base_url` (z. B. `https://app.upstreem.ai/version-test`) | `{success:true, invite_id, sent_at, unchanged, send_state, resend_count, expires_at}` |
| `team-billing-portal` | `{team_id, return_path?}` | `{success:true, url, portal_url, return_url}` → `window.location = url` |

## RPCs (Schema `app`)
| Funktion | Parameter | Antwort |
|---|---|---|
| `team_invite_revoke_v1` | `p_team, p_invite_id` | `{row}` Einladungszeile |
| `team_invites_v1` | wie bisher | gleiche Form, neu `sent_at`; `send_state` jetzt echt |
| `team_member_remove_v1` | `p_team, p_user_id` | wie `team_members_v1` |
| `team_member_role_v1` | `p_team, p_user_id, p_role` | wie `team_members_v1` + `meta.unchanged` |
| `team_leave_v1` | `p_team, p_confirm_name` | `row{left, remaining_teams, next_team_id}` |
| `team_delete_v1` | `p_team, p_confirm_name` | `row{deleted, purge_after, stripe_cancel, remaining_teams, next_team_id}` |

## Wichtig für die Seite
### Einladen
- `unchanged:true` heißt: Die Adresse ist schon offen eingeladen, es ging keine Mail raus. Biete dann „erneut senden“ an.
- Mögliche Fehler:
  - 502 `team_invite_send_failed` mit hint `create`: Die Adresse wurde abgelehnt und ist sofort neu einladbar.
  - 502 `team_invite_send_failed` mit hint `resend`: Der alte Link gilt weiter.
  - 502 `team_invite_send_unknown`: Die Zustellung ist unklar; die Einladung steht in der Liste mit `send_state:'unknown'`.
  - 429 `team_invite_rate_limited`: Der hint ist die Wartezeit in Sekunden oder `max` (fünfmal erneut gesendet).
- Abgelaufene Einladungen lassen sich erneut senden. Gibt es für dieselbe Adresse schon eine neuere offene, kommt 409 `team_invite_pending`.
- Den Knopf sperren, solange der Aufruf läuft (sonst zwei Mails).

### Rollen und Entfernen
Spiegel der Server-Regeln für die Knöpfe:

| | owner | admin | member |
|---|---|---|---|
| selbst | nichts (Verlassen über `team_leave_v1`) | nichts | – |
| Entfernen | alle | nur member | – |
| member↔admin | ja | ja, auch bei anderen admins | – |
| zum owner machen | ja, mit frischer Anmeldung | nein | – |
| owner anfassen | ja (der letzte owner bleibt) | nein | – |

- Kommt PT403 `settings_reauth_required`, muss sich der Nutzer neu anmelden (Google- oder Passwort-Login, höchstens 15 Minuten alt) und den Schritt wiederholen. Das gilt für „zum owner machen“ und für „Team löschen“.

### Verlassen und Löschen
- Zur Bestätigung muss der Teamname eingetippt werden. Groß- und Kleinschreibung zählen nicht. Bei falschem Namen kommt 22023 `team_confirm_name_mismatch`.
- Der letzte owner bekommt beim Verlassen 409 `team_last_owner` mit hint `transfer_or_delete`. Zeige dann: erst einen anderen owner ernennen oder das Team löschen.
- Nach Erfolg zu `next_team_id` wechseln. Ist es `null`, kommt der Nutzer in die Team-Anlage bzw. Onboarding.
- Löschen ist weich. Der Text dazu: „Das Team wird nach 30 Tagen endgültig gelöscht“ (`purge_after`). Wiederherstellen geht nur über den Support.

### Billing
- Portal: Bei 409 `billing_no_customer` stattdessen zur Kasse (`create-team-checkout`).
- Das Portal geht auch ohne Zugang (abgelaufenes Abo), damit die Zahlung repariert werden kann.

### Fehler allgemein
- Die Antwort ist immer `message` = Code, wie bisher. Die vollständige Liste steht in 13.4.
- Schreibende Aufrufe sind auf 20 je Minute begrenzt: `team_rate_limited`, hint in Sekunden.

## Plan-Limits (neu, live seit 11.10.2026, `SETTINGS_V1_VORSCHLAG.md` Abschnitt 14)
- Bei einem Planwechsel pausiert der Server sofort alles über dem neuen Limit. Die zuletzt hinzugefügten gehen zuerst: Wettbewerber, aktive Prompts und Modelle.
- Für die Seite ändert sich nichts Pflichtiges: Pausierte Wettbewerber stehen im Archiv, pausierte Prompts sind inaktiv.
- Optional ein Hinweis „wegen Plan-Limit pausiert“, erkennbar an:
  - `team_competitor_archive.deactivated_reason = 'plan_limit'`
  - `prompt.plan_paused_at`
  - `team_model_setting.plan_paused_at`
- Beim Downgrade in der Kasse vorher warnen: „Über dem neuen Limit werden die zuletzt hinzugefügten pausiert.“

## Alt bleibt (für Bubble)
Diese Funktionen nicht mehr aufrufen, aber auch nicht entfernen:
- `create_team_invite_v1`
- `send-team-invite`
- `create-billing-portal-session`
- `delete_team_v3`
