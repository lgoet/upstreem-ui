# Rückmeldung an den Datenbank-Chat: Brand Detail v1 (12.10.2026)

Diesen Text in den Datenbank-Chat geben. Kurz gesagt: **Die Lieferung ist angenommen.** Der Drawer
läuft gegen die echten Antworten aus `brand_detail_v1_echte_antworten.json`. Deine Grundregel „alles
aus Sicht der Drawer-Marke“ ist umgesetzt. Eine Frage ist offen (Abschnitt 3).

## 1. Was der Drawer aus deiner Lieferung nimmt

Gemessen im Prüfstand drw07 mit deinen echten Antworten:

| Teil | Quelle | Gemessen |
|---|---|---|
| Kopf | `brand_detail_v1.row`: `name`, `domain`, `logo_url`/`favicon_url`, `status`, `deactivated_at` | „BMW“, „bmw.com“ mit Favicon; Mercedes mit Team-Logo |
| Große Zahl im Brand Detail | Zeile `company_id = id` aus `rows` der Overview mit `p_companies` | BMW 37.1 % (+2.4 %), Mercedes 31.3 % (+0.8 %) |
| Kurve | `performance_company_chart_v1` | Visibility, Rank (5.0) und Sentiment (78), Tag und Woche |
| Varianten | `performance_brand_variations_v1` | „BMW 24.9 %, 204 of 821“ |
| Top Citations | Ring und Liste mit `p_brand` | 3.96k Citations. Der Schalter heißt „BMW mentioned?“, und angehakt geht `p_mentioned = yes` **mit** `p_brand` hinaus. |
| Responses | `cached_dashboard_responses_v1` mit `p_brand` | BMW 596 und Mercedes 503, jeweils gleich `mentions` der Overview |
| Export | `brand_id` in der Nutzlast | Bubble gibt es als `p_brand` an alle drei Exporte weiter |

**Responses:**
- Der Schalter der Tabelle steht fest auf „<Drawer-Marke> mentioned?“, angehakt, ausgegraut und nicht klickbar. Ein Klick löst 0 Anfragen aus (gemessen).
- Die Spalte „Mentioned?“ bleibt bei der eigenen Marke, wie bei dir (`own_mentioned`).
- `p_mentioned` schicke ich als `'all'`, also die Vorgabe ohne Filter, nie als `yes` oder `no`.

**Inaktive Marke (Kompyte):**
- Kopf mit Logo und Name.
- Darunter: „Your team stopped tracking this brand on 11. Oct 2026.“
- Filterzeile und Bausteine sind ausgeblendet. Damit stehen die PT404 von Kurve und Varianten nirgends als Fehler da.

**Ohne Nennung (BYD):**
- Die große Zahl zeigt einen Strich, die Kurve „No data“.
- Die Tabelle zeigt „This brand wasn't mentioned in the selected period.“
- Citations zeigen ihren Leerzustand.

**Dabei gefunden und behoben (unsere Seite):** Brand Detail zeigte bei `visibility_pct: null` den Wert „0%“, weil `Number(null)` 0 ist. Jetzt steht dort der Strich. Das betrifft auch das heutige Bubble-Element.

**Fehler:**
- `brand_not_found` wird zu „This brand doesn't exist in this team.“, auf Deutsch dein Wortlaut.
- `team_access_<state>`, `team_forbidden`, `team_deleted` und `settings_not_authenticated` haben je einen Satz ohne „Try again“.
- `brand_rate_limited` zeigt einen Satz mit „Try again“.

## 2. Was der Drawer nicht nimmt (bewusst)

- **`color`:** Die Kurve trägt die Markenfarbe, wenn Brand Detail sie bekommt. Ich gebe sie heute nicht mit, weil `color` meist `null` ist. Soll die Markenfarbe aus den Einstellungen dort erscheinen, ist es eine Zeile.
- **`tracked_since` und `last_mentioned_at`:** nicht angezeigt. Der Nutzer hat für den Kopf nur Logo, Name und Domain bestellt.

## 3. Eine Frage

**Laufzeit des ersten Aufrufs:** `brand_detail_v1` für Mercedes brauchte im Test 1,9 s, BMW gleich danach 61 ms. Die Overview für Mercedes brauchte ebenfalls 1,8 s.
- War das der kalte Start des Durchgangs, oder kostet die eigene Marke im Kopf mehr? Etwa wegen des Team-Logos oder `last_mentioned_at` vor der Umstellung auf die Tagesstatistik.
- Der Kopf ist das Erste, was der Nutzer sieht. Bitte einmal warm für die eigene Marke messen.
