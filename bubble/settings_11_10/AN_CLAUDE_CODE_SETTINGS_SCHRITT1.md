# An Claude Code: Settings v1, Schritt 1 (Lesen) ist gebaut (11.10.2026)

Datei `settings_v1_lesen.sql`, spielt Lukas ein. Vertrag: `SETTINGS_V1_VORSCHLAG.md` Abschnitt 11. Echte Antworten: `settings_v1_lesen_echte_antworten.json`.

## Funktionen (alle `Content-Profile: app`, Antwort `{meta, row}` oder `{meta, rows}`)
| Funktion | Wer | Wichtig für die Seite |
|---|---|---|
| `settings_page_meta_v1(p_team)` | Mitglied | `meta.team_name` (für „Type <Team> to confirm“), alle `can_*` in `row`, Grund in `row.reasons` (`role` / `no_access` / `last_owner`) |
| `settings_brand_v1(p_team)` | Mitglied | `row.models[]` in genau der Zeilenform aus 10.2, `row.limits.models_max`, `row.markets[]`, `row.business_model_key` (`b2b`/`b2c`/`hybrid`/null). Legt keine Startzeilen an. |
| `team_members_v1(p_team)` | Mitglied | je Zeile `can_remove`, `can_change_role`, `role_options` nach den Admin-Regeln 10.3 |
| `team_invites_v1(p_team, p_status)` | owner/admin | `send_state` ist bis Schritt 3 immer `sent` |
| `team_log_v1(p_team, p_limit, p_before)` | owner/admin | Blättern: `meta.next_before` an `p_before`; `null` = Ende |
| `billing_status_v1(p_team)` | Mitglied | Member: Preise `null`, `can_manage_billing:false`; dazu `can_checkout`, `can_open_portal` |
| `billing_plans_v1(p_team)` | Mitglied | `trial_available`, `is_current`; `meta.current_plan_listed:false` bei Legacy Free |

**Fehler:**

| SQLSTATE | message | hint |
|---|---|---|
| 28000 | `settings_not_authenticated` | – |
| 42501 | `team_forbidden` | – |
| PT404 | `team_deleted` | – |
| PT403 | `team_role_required` | `owner,admin` |
| 22023 | `team_invalid_param` | Parameter |
| PT429 | `…_rate_limited` | Sekunden |

## Geänderte Entscheidung
**Support-Konten bleiben sichtbar** (Lukas, 11.10.). `is_support` steht in jeder Mitgliederzeile, ist aber immer `false`; niemand wird ausgeblendet.

## Daten
- Die 4 wiederhergestellten Teams (upstreem, Der Sanitätscoach, MotelOne, digitallotsen) haben jetzt Legacy Free ohne Stripe, Zugang `active`. Ihr Stripe-Kunde ist gemerkt, ein späterer Checkout nutzt ihn.
- Teams ohne Zugang bekommen keine täglichen Läufe mehr.

## Als Nächstes
Schritt 2: `settings_brand_save_v1`, `settings_brand_logo_v1`, `team_models_set_v1` (Form 6.2 und 10.2). Danach Schritt 3: Einladungen mit `team-invite-send` (10.4).

Bitte melden, wenn eine Form nicht zur Seite passt. Am besten gleich gegen die echten Antworten prüfen.
