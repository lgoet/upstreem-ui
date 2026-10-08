# Auftrag an den Datenbank-Chat: Einladungsseite direkt (Stand 08.10.2026)

Diesen ganzen Text als Nachricht in den Datenbank-Chat geben. Er ist in sich vollständig.

---

## 0. Worum es geht

Die Einladungsseite (`/invite?token=…`) ruft ihre zwei Funktionen ab jetzt **selbst** auf, ohne
Bubble-Workflow dazwischen. Das ist derselbe Weg wie bei Shopping und Citations: PostgREST,
`POST /rest/v1/rpc/<funktion>`, Schema `app` (`Content-Profile: app`).

- **Nicht angemeldet** (der häufigste Fall: jemand klickt den Link aus der Mail) ruft die Seite
  mit dem öffentlichen Schlüssel auf, also als Rolle **`anon`**.
- **Angemeldet** ruft sie mit dem Nutzer-JWT auf (`authenticated`).

Heute laufen `get_team_invite_by_token_v2` und das Annehmen über Bubble. Die alten Funktionen
bleiben **unverändert**, bis die neue Seite live ist. Neues entsteht daneben (Versionsregel wie
bei Citations).

## 1. Zuerst lesen, nichts ändern

Bitte die vollständigen Definitionen (`pg_get_functiondef`) und die Rechte von:

- `get_team_invite_by_token_v2`
- der Funktion zum Annehmen (heute über Bubble gerufen, vermutlich `accept_team_invite_by_token`)

Dazu kurz beantworten:

1. In welchem Schema liegen sie, und welche Parameter nehmen sie? **Nimmt v2 neben dem Token auch
   eine E-Mail an und filtert danach?** Hintergrund: Die Links in den Einladungsmails tragen
   gerade `&mail=` **leer**, und die Seite bekommt von v2 nichts zurück.
2. Was tut das Annehmen außer der Mitgliedschaft? Zum Beispiel: Rolle setzen, `accepted_at`/
   `accepted_by` setzen, das Team als aktives Team des Nutzers setzen. Alles davon muss die neue
   Funktion genauso tun.
3. Prüft das Annehmen, ob die Adresse des angemeldeten Kontos die eingeladene ist? Das heutige
   Verhalten bleibt, es soll nur benannt werden.
4. Wer erzeugt den Einladungslink in der Mail (Bubble, n8n, Datenbank)? Wie heißt dort der
   Parameter für die Adresse (`mail` oder `email`)?

## 2. Neu: `app.get_team_invite_by_token_v3(p_token text) returns jsonb`

- `security definer`, `set search_path`.
- `revoke` von `public`; `grant execute` an **`anon`**, `authenticated`, `service_role`.
- Kein E-Mail-Parameter. Der Token allein entscheidet.
- **Wirft für keinen Zustand der Einladung eine Ausnahme.** Jeder Token, auch ein unbekannter,
  bekommt HTTP 200 mit dieser Form:

```json
{
  "status": "pending",
  "valid": true,
  "team_id": "…uuid…",
  "team_name": "Acme",
  "team_logo_url": "https://…",
  "role": "member",
  "invited_email": "anna@acme.com",
  "inviter_name": "Lukas Gotzkes",
  "expires_at": "2026-10-20T10:00:00+00:00",
  "signed_in_email": null,
  "email_matches": null
}
```

| Feld | Regel |
|---|---|
| `status` | `pending`, `expired`, `revoked`, `accepted` oder `invalid`. **`expired` auch dann, wenn die Zeile noch `pending` steht, `expires_at` aber vorbei ist.** |
| `valid` | `true` genau dann, wenn `status = 'pending'`. |
| `team_id`, `team_name`, `team_logo_url` | bei `invalid` alle `null`, sonst gefüllt. Das Logo immer absolut (`https://…`; ein `//…` aus dem Bubble-CDN mit `https:` davor). |
| `role` | die Rolle, mit der eingeladen wurde (`member`, `admin` …); bei `invalid` `null`. |
| `invited_email` | **nur bei `valid = true`**, sonst `null`. Die Seite setzt damit die Adresse für die Anmeldung vor. |
| `inviter_name` | Name des Einladenden, sonst seine Adresse, sonst `null`. |
| `expires_at` | ISO-Zeitpunkt oder `null`. |
| `signed_in_email` | die Adresse aus dem JWT (`auth.email()`), ohne Anmeldung `null`. |
| `email_matches` | `lower(trim(signed_in_email)) = lower(trim(invited_email))`. Ohne Anmeldung oder bei ungültiger Einladung `null`. |

- Ein Token, der nicht `^[0-9a-f]{64}$` ist, gilt sofort als `invalid`, ohne Abfrage.
- Nichts sonst nach außen: keine IDs des Einladenden, keine anderen Adressen, keine
  Team-Mitglieder.
- Bitte bestätigen, dass die Tokens zufällig mit 256 Bit erzeugt werden. Dann braucht die
  `anon`-Abfrage kein Rate-Limit, weil Raten aussichtslos ist.

## 3. Neu: `app.accept_team_invite_by_token_v2(p_token text) returns jsonb`

- `security definer`, `set search_path`.
- `revoke` von `public` **und `anon`**; `grant execute` an `authenticated`, `service_role`.
- Der Nutzer kommt aus dem JWT (`auth.uid()`), nie aus einem Parameter.
- Dieselben Nebenwirkungen wie die heutige Funktion (Abschnitt 1, Frage 2).

Erfolg:

```json
{ "ok": true, "team_id": "…uuid…", "team_name": "Acme", "role": "member", "already_member": false }
```

- **Idempotent:** Nimmt derselbe Nutzer dieselbe Einladung noch einmal an (Neuladen, Doppelklick,
  Rückkehr von der Anmeldung), kommt `ok: true` mit `already_member: true`, kein Fehler.

Fehler als Ausnahme mit **stabiler `message`**, so wie PostgREST sie ausgibt
(`{code, message, details, hint}`):

| message | wann |
|---|---|
| `invite_invalid` | Token unbekannt oder falsches Format |
| `invite_expired` | abgelaufen |
| `invite_revoked` | zurückgezogen |
| `invite_used` | schon von einem **anderen** Konto angenommen |
| `invite_email_mismatch` | nur, wenn die heutige Funktion die Adresse prüft (Frage 3) |
| `not authenticated` | kein JWT |

## 4. Antwortform

**Reines `jsonb`, ohne Umschlag `{"json": …}`**, wie bei Citations v1. Den Umschlag brauchte nur
Bubbles Run-JS, und das gibt es auf dieser Seite nicht mehr.

## 5. Tests und was ich zurück brauche

1. Für jeden `status` von v3 eine echte Antwort, je einmal als `anon` und als `authenticated`
   (Test-Einladungen anlegen, danach aufräumen):
   - `pending`;
   - `pending`, aber `expires_at` vorbei (muss `expired` liefern);
   - `revoked`;
   - `accepted`;
   - unbekannter Token;
   - Token im falschen Format.
2. `accept_team_invite_by_token_v2`: einmal Erfolg, einmal derselbe Aufruf noch einmal
   (`already_member: true`), dazu jeder Fehler aus der Tabelle in Abschnitt 3.
3. Die Rechte geprüft: `anon` darf v3, aber **nicht** annehmen.
4. Die Antworten auf die vier Fragen aus Abschnitt 1.
