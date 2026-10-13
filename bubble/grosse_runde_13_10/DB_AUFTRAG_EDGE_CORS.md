# DB-Auftrag: Edge Functions für die Next.js-App freigeben (CORS)

Stand 13.10.2026. Zum Weiterleiten an den DB-Chat.

## Befund

In der Next.js-App (lokal `http://localhost:3000`, später Vercel) schlägt Mira beim Senden fehl.
In den Logs von `mira-send` steht nichts. Grund: Der Browser schickt die eigentliche Anfrage gar
nicht erst ab.

`mira-send` beantwortet die Vorabanfrage (OPTIONS) nur für zwei Adressen mit
`Access-Control-Allow-Origin`:

```ts
const ALLOWED_ORIGINS = new Set<string>([
  "https://app.upstreem.ai",
  "https://llmoscout.bubbleapps.io",
]);
```

Gemessen am 13.10. per `curl -X OPTIONS … -H "Origin: http://localhost:3000"` gegen jede Function
(204 ohne Freigabe bedeutet: Der Browser blockt den POST):

| Function | localhost:3000 | Wird gebraucht für |
|---|---|---|
| `mira-send` | **keine Freigabe** | Mira: Nachricht und Sprache senden |
| `mira-export-pdf` | **keine Freigabe** | Mira: PDF-Export |
| `start-job` | **keine Freigabe** | Look for new, Prompt Research |
| `team-billing-cancel` | **keine Freigabe** | Settings: Abo kündigen |
| `onboarding-start` | **keine Freigabe** | Onboarding |
| `onboarding-prompts` | **keine Freigabe** | Onboarding |
| `onboarding-checkout` | **keine Freigabe** | Onboarding |
| `onboarding-checkout-status` | **keine Freigabe** | Onboarding |
| `export`, `team-invite-send`, `team-billing-portal`, `create-team-checkout`, `create-billing-portal-session`, `send-team-invite`, `create-onboarding-checkout` | `*` | (funktionieren) |

Auf `https://app.upstreem.ai` (Bubble live) laufen alle. Betroffen ist nur die neue App.

## Was zu tun ist

In den **acht** Functions oben die erlaubten Adressen um die Next.js-App erweitern. Vorschlag, damit
die Liste nicht in acht Dateien gepflegt wird:

```ts
// Feste Adressen plus eine Liste aus dem Secret APP_ORIGINS (kommagetrennt).
const ALLOWED_ORIGINS = new Set<string>([
  "https://app.upstreem.ai",
  "https://llmoscout.bubbleapps.io",
  "http://localhost:3000",
  ...(Deno.env.get("APP_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
]);
```

- `http://localhost:3000` fest eintragen (lokale Entwicklung).
- Die Vercel-Adresse kommt über das Secret `APP_ORIGINS`, sobald sie feststeht (z. B.
  `https://upstreem-app.vercel.app`). Dafür muss danach kein Code mehr geändert werden.
- Bitte **kein** `*` für diese acht: Sie arbeiten mit dem Nutzer-JWT. Die feste Liste ist richtig, sie
  ist nur zu kurz.
- Alles andere an den Functions bleibt, wie es ist.

## Rückmeldung bitte

Für jede der acht Functions die Antwort auf:

```bash
curl -s -o /dev/null -D - -X OPTIONS "https://tgdossbsevnonssyuewp.supabase.co/functions/v1/mira-send" -H "Origin: http://localhost:3000" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: authorization,apikey,content-type"
```

Erwartet: `HTTP/2 204` **mit** `access-control-allow-origin: http://localhost:3000`.
