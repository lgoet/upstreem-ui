# Rückmeldung an den Datenbank-Chat: url_detail_v1 (12.10.2026)

Danke, eingebaut und gegen deine echten Antworten geprüft (`url_detail_v1_echte_antworten.json`,
Prüfstand mit dem URL-Drawer aus core). **Von deiner Seite ist nichts mehr zu tun**, außer dass
Lukas `url_detail_v1.sql` und danach `url_alt_absichern.sql` einspielt.

## Was die Oberfläche liest
- **`meta.url`** ist die Adresse für alles Weitere: die Tabelle (`cached_dashboard_responses_v1`
  mit `p_url`), den Export, den Pin, Mira und Create with AI. Gemessen mit deiner „anderen
  Schreibweise“ (ohne `www.`, mit `/`): Die Seite wird gefunden, und die Tabelle lädt mit
  `https://www.adac.de/…`. Die 523 Antworten stimmen mit `cited_runs` überein.
- **„Last seen“ = `last_cited_at`.** `last_scraped_at` wird nicht gezeigt.
- **`in_range: false`** (chip.de):
  - Statt der Kennzahlen steht „Im gewählten Zeitraum nicht zitiert. Zuletzt am 15. Aug 2026.“
    mit dem Knopf „Zeitraum anpassen“. Der Knopf setzt 17.07.–15.08. und lädt beides neu.
  - Die Tabelle zeigt ihren Leerzustand mit demselben Satz. Dafür geht kein Aufruf hinaus.
- `brands[]` (eigene Marke zuerst), `conversion[]`, `summary` als Klartext (bei `null` ist der
  Abschnitt weg), `description` als Klartext, maskiert.
- **Fehler:**
  - `url_not_found` → „Diese Adresse wurde von deinem Team nie zitiert.“
  - `dashboard_invalid_date` → „Der gewählte Zeitraum ist ungültig.“
  - Die übrigen wie bei Response Detail. „Noch einmal versuchen“ gibt es nur bei Netz-,
    Server- und Ratenfehlern.
- Die Filter Modelle, Märkte und Topics schickt der Drawer nicht mit: Er hat nur den Kalender.
  Damit gelten deine Vorgaben, und Kennzahlen und Tabelle passen zueinander.

## Export
Der Knopf ist im Drawer wieder da. Das Export-Fenster gibt `url` (und später `domain`) in seiner
Nutzlast an Bubble weiter. Der Bubble-Workflow muss sie als `p_url`/`p_domain` an
`export_responses_v1` geben (leer heißt `null`); das macht Lukas. Geprüft: Ein Export, der danach
von einer Seite ohne Drawer aufgeht, trägt keine Adresse mehr.

Keine offenen Fragen.
