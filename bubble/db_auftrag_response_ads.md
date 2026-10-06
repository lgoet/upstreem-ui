# Auftrag an den Datenbank-Chat: Ads im Response Detail (Stand 06.10.2026)

Diesen ganzen Text in den Datenbank-Chat geben. Arbeitsregeln wie immer (`datenbank_auftrag.md`,
Abschnitt 0): nichts raten, erst Bestandsaufnahme mit `pg_get_functiondef` und der Struktur der
Tabellen, jede Änderung als vollständiges `create or replace` mit alter Definition als Rückweg und
einer Testabfrage. **Felder kommen nur dazu, keins wird umbenannt oder entfernt.**

## Worum es geht

Das Response Detail (die Seite einer einzelnen Antwort, RPC `get_mention_detail_v8`) bekommt einen
neuen Abschnitt **"Ads"** unter "Products": die Anzeigen, die das Modell zu **genau dieser
Antwort** gezeigt hat. Die Oberfläche ist fertig und liest ein neues Feld `ads` am Eintrag.
Fehlt das Feld oder ist es leer, erscheint der Abschnitt nicht. Es geht also nichts kaputt, solange
die Datenbank es noch nicht liefert.

## Was zu tun ist

`get_mention_detail_v8` bekommt am Eintrag (dort, wo heute `shopping_products` steht) ein Feld
`ads`: eine Liste, ein Element je Anzeige dieses Laufs (`prompt_run_ad` mit dieser
`prompt_run_id`). Keine Anzeigen: `[]` (nicht `null`).

**Felder je Element**: genau die Ad-Objekte der Ads-RPCs (`ADS_V1_RPCS.md`, "Ad-Objekt", die 29
Felder von `recent_ads` / `items`), also mindestens:

| Feld | Inhalt |
|---|---|
| `id` | Id der Beobachtung, als Text (wie in den Ads-RPCs) |
| `ad_id`, `ad_group_id`, `campaign_id`, `ad_account_id`, `utm_campaign` | wie in den Ads-RPCs |
| `advertiser_name`, `company_id` | wie in den Ads-RPCs |
| `ad_format` | `image_card_v2` / `product_card_v2` / Rohwert |
| `title`, `description` | Text der Anzeige |
| `landing_domain`, `url` | Ziel der Anzeige |
| `image_url` | Bild oder `null` |
| `price`, `currency`, `price_str` | wie in den Ads-RPCs |
| `model`, `market`, `observed_at`, `prompt_id`, `prompt_text`, `prompt_run_id`, `topics` | wie in den Ads-RPCs (die Karte zeigt sie hier nicht, der Ad-Drawer schon) |

**Zusätzlich**, weil im Response Detail keine Advertiser-Liste mitkommt:

| Feld | Inhalt |
|---|---|
| `relationship` | `"you"` / `"competitor"` / `null`, dieselbe Regel wie in `list_ads_advertisers_v1` (über `team_company`) |
| `logo_url` | Logo der getrackten Firma oder `null`, dieselbe Quelle wie in `list_ads_advertisers_v1` |
| `domain` | Domain des Werbetreibenden, dieselbe Regel wie in den Ads-RPCs (seit 05.10.: Host von `company.url`, sonst häufigste `landing_domain` des Werbetreibenden im Team, sonst `null`) |

**Reihenfolge**: so, wie die Anzeigen in der Antwort standen (Position, falls es eine gibt), sonst
nach `observed_at` und dann `id`.

**Text**: alle Textfelder durch `app.js_safe`, wie jede Antwort, die Bubble in einen
JavaScript-Backtick setzt (Backtick, Backslash, `${`).

## Test

`get_mention_detail_v8` für einen Lauf mit Anzeigen. Erwartet: `ads` ist eine Liste, jedes Element
trägt `id`, `advertiser_name`, `ad_format`, `title`, `landing_domain`, `relationship`, `logo_url`
und `domain`, und dieselbe `id` kommt auch in `list_ads_library_v1` vor. Ein Lauf ohne Anzeigen
liefert `"ads": []`.
