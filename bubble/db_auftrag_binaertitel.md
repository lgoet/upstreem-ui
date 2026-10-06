# Auftrag an den Datenbank-Chat: Binärmüll als URL-Titel (Stand 06.10.2026)

Diesen ganzen Text in den Datenbank-Chat geben. Arbeitsregeln wie immer (`datenbank_auftrag.md`,
Abschnitt 0): nichts raten, erst Bestandsaufnahme mit `pg_get_functiondef` und der Struktur der
Tabellen, jede Änderung als vollständiges `create or replace` mit alter Definition als Rückweg und
einer Testabfrage. Tabellen- und Spaltennamen, die hier nicht stehen, **nachsehen, nicht raten**.

---

## Was passiert ist (gemessen an einem HAR vom 06.10.)

Die URL `https://newsonair.gov.in/wp-content/uploads/2026/09/jg-8.mp3` ist eine MP3-Datei. Beim
Erfassen wurden ihre **Bytes als Titel gespeichert**: rund 9 900 Zeichen, davon 5 114
Ersatzzeichen (U+FFFD) und Steuerzeichen, dazu 42 Anführungszeichen und 51 Backslashes.

Dieser Titel kommt an zwei Stellen in der App an:

| RPC | Feld | Folge |
|---|---|---|
| `cached_mentions_overview_v1` | `sources_preview[].title` (Lauf `5803c808-a800-4b1e-9505-b750515c721a`) | Die Responses-Tabelle konnte die ganze Seite nicht lesen. Ist im Frontend jetzt abgefangen. |
| `search_quick_actions_v2` | `title` | Der Run-JS-Schritt stirbt: `SyntaxError: Octal escape sequences are not allowed in template strings`. Quick Actions zeigt keine Treffer. |

Der Unterschied zwischen beiden: In `cached_mentions_overview_v1` sind die Backslashes
schon weg (dort läuft `app.js_safe`). In `search_quick_actions_v2` stehen sie noch drin. `\5`, `\6`
und `\x` sind in einem JavaScript-Backtick ungültige Escapes, und damit ist der ganze Schritt tot,
bevor irgendein Code der Oberfläche läuft. Das kann das Frontend nicht abfangen.

---

## 1. `search_quick_actions_v2` durch `app.js_safe`

Jedes Textfeld der Rückgabe (`title`, `url`, Namen, Domains, alles Text) läuft durch
`app.js_safe`, genau wie bei den anderen RPCs. **Bestandsaufnahme dazu:** Welche Lese-RPCs, die
URL-Titel, Beschreibungen oder Antworttexte zurückgeben, rufen `app.js_safe` **nicht** auf? Liste
zeigen, bevor etwas geändert wird.

## 2. `app.js_safe` entfernt Steuerzeichen und U+FFFD

Erst die aktuelle Definition holen und zeigen. Dann ergänzen, **zusätzlich** zu dem, was sie heute
schon tut (Backtick, Backslash, `${`):

- Steuerzeichen U+0001 bis U+001F **außer** Zeilenumbruch, Wagenrücklauf und Tab: entfernen.
- U+FFFD (`chr(65533)`, das Ersatzzeichen für kaputte Bytes): entfernen.

Anführungszeichen bleiben. Sie gehören in Titel und Texte, und die Oberfläche kommt mit ihnen klar.

## 3. Kein Titel aus Nicht-Text

An der Stelle, an der beim Erfassen einer URL der Titel geschrieben wird (Tabelle, Funktion oder
Trigger nachsehen und zeigen), gilt ab jetzt: Ein Titel wird nur übernommen, wenn

- er kein U+FFFD und keine Steuerzeichen (außer Leerraum) enthält **und**
- er höchstens 500 Zeichen lang ist.

Sonst `null`. Ist der Inhaltstyp der Seite bekannt (z. B. `audio/*`, `video/*`, `image/*`,
`application/pdf`, `application/octet-stream`): dann gar keinen Titel aus dem Inhalt lesen.
Am liebsten als eine Funktion `app.clean_title(text)`, die beim Schreiben läuft.

## 4. Einmal aufräumen

Erst zählen und die Treffer zeigen (URL, Länge des Titels), dann ändern:

- alle Titel mit U+FFFD oder Steuerzeichen,
- alle Titel über 500 Zeichen.

Beide auf `null` setzen. Erwartet mindestens die eine MP3 von oben.

## 5. Tests

- `search_quick_actions_v2` mit `p_search = 'jg-8.mp3'` für das Team
  `877c649c-f5f2-44e9-bb04-155f5bf44e70`: Der Treffer hat `title` `null`, nirgends steht ein
  Backslash.
- `cached_mentions_overview_v1` mit denselben Parametern wie im HAR (`p_date_from = '2026-07-09'`):
  Im Lauf `5803c808-…` hat `sources_preview[1].title` den Wert `null`.
- Gegenprobe: ein normaler Titel mit Anführungszeichen und Umlauten kommt unverändert an.
