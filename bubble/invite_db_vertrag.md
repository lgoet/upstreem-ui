# Einladungsseite – Vertrag Datenbank (Stand 08.10.2026)

> Wortgleich vom Datenbank-Chat (08.10.). Auftrag dazu: `invite_db_auftrag.md`. Umgesetzt in
> invite-page.js (data-direct) und core.js (UC.rpc mit opts.anon).

In Prod angelegt und getestet (26/26 Fälle, Rechte geprüft). Die alten Funktionen
(`get_team_invite_by_token_v1/v2`, `accept_team_invite_by_token_v1`) laufen unverändert weiter.

## Aufruf

`POST https://<projekt>.supabase.co/rest/v1/rpc/<funktion>`

| Header | Wert |
|---|---|
| `apikey` | öffentlicher Schlüssel |
| `Authorization` | `Bearer <Nutzer-JWT>` angemeldet, sonst `Bearer <öffentlicher Schlüssel>` |
| `Content-Type` | `application/json` |
| `Content-Profile` | `app` |

Body jeweils `{"p_token": "<token aus ?token=>"}`. Antwort: reines JSON, kein Umschlag.

## Token

- Steht in der URL als `?token=`. Der Parameter `mail` wird von der Datenbank nicht gebraucht und kann ignoriert werden.
- Format: 64 Zeichen `0-9a-f`. Anderes Format ist sofort `invalid` (kein Fehler).

## 1. `get_team_invite_by_token_v3` (anon und angemeldet)

Liefert **immer HTTP 200**, auch bei unbekanntem Token. Nie eine Ausnahme.

```json
{
  "status": "pending",
  "valid": true,
  "team_id": "356039e3-1625-4273-bf5b-d83580cc38be",
  "team_name": "Rösterei Vier",
  "team_logo_url": "https://www.google.com/s2/favicons?domain=rvtc.com&sz=64",
  "role": "member",
  "invited_email": "lukas@upstreem.ai",
  "inviter_name": "bolegnewone@gmail.com",
  "expires_at": "2026-10-15T12:31:13.828153+00:00",
  "signed_in_email": "lukas@upstreem.ai",
  "email_matches": true
}
```

| Feld | Regel |
|---|---|
| `status` | `pending`, `expired`, `revoked`, `accepted`, `invalid`. `expired` auch, wenn die Zeile noch pending ist, aber `expires_at` vorbei. |
| `valid` | `true` genau bei `pending` |
| `team_id`, `team_name`, `team_logo_url` | bei `invalid` null. Logo absolut oder null (kein Logo hinterlegt). |
| `role` | `member` oder `admin`; bei `invalid` null |
| `invited_email` | nur bei `valid = true`, sonst null |
| `inviter_name` | Anzeigename, sonst E-Mail des Einladenden, sonst null |
| `expires_at` | ISO-Zeitpunkt oder null |
| `signed_in_email` | E-Mail aus dem JWT, ohne Anmeldung null |
| `email_matches` | nur bei `valid` und angemeldet: `true`/`false`, sonst null |

Ein gelöschtes Team gilt als `invalid`.

## 2. `accept_team_invite_by_token_v2` (nur angemeldet)

Erfolg (HTTP 200):

```json
{ "ok": true, "team_id": "…", "team_name": "Rösterei Vier", "role": "member", "already_member": false }
```

- **Idempotent:** derselbe Nutzer, dieselbe Einladung nochmal (Neuladen, Doppelklick, Rückkehr vom Login) → `ok: true`, `already_member: true`.
- Nebenwirkungen: Mitgliedschaft mit der eingeladenen Rolle, Einladung `accepted`, Audit-Eintrag.
- **Setzt nicht das aktive Team** (wie die alte Funktion). Nach Erfolg muss das Frontend selbst auf `team_id` wechseln.

Fehler (PostgREST-Form `{code, message, details, hint}`):

| `message` | HTTP | wann |
|---|---|---|
| `invite_invalid` | 400 | Token unbekannt, falsches Format, Team gelöscht |
| `invite_expired` | 400 | abgelaufen |
| `invite_revoked` | 400 | zurückgezogen |
| `invite_used` | 400 | schon von einem anderen Konto angenommen |
| `invite_email_mismatch` | 400 | angemeldetes Konto hat nicht die eingeladene Adresse |
| `not authenticated` | 400 | JWT ohne Nutzer (praktisch nur service_role) |
| `permission denied for function accept_team_invite_by_token_v2` (code `42501`) | 401 | Aufruf mit öffentlichem Schlüssel, also nicht angemeldet |

`42501` wie „nicht angemeldet“ behandeln. Besser: das Annehmen ohne Anmeldung gar nicht aufrufen.

## Empfohlener Ablauf der Seite

1. Token aus der URL lesen, `get_team_invite_by_token_v3` aufrufen.
2. `valid = false` → Zustand anzeigen (`expired`, `revoked`, `accepted`, `invalid`), kein Annehmen-Button.
3. `valid = true` und nicht angemeldet → Login/Registrierung, E-Mail mit `invited_email` vorbelegen, danach zurück auf dieselbe URL.
4. `valid = true`, angemeldet, `email_matches = false` → Hinweis „Diese Einladung gilt für `invited_email`“, Abmelden anbieten.
5. `valid = true`, `email_matches = true` → Annehmen-Button → `accept_team_invite_by_token_v2` → bei `ok` aktives Team auf `team_id` setzen und weiterleiten.
6. Fehler aus Schritt 5 über `message` zuordnen (Tabelle oben). `email_matches` kommt aus dem JWT, die Prüfung beim Annehmen aus dem Konto – im Normalfall identisch, im Zweifel zählt die Antwort von accept.
