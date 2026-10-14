# Fremdcode, fest gepinnt

Bibliotheken, die die Komponenten zur Laufzeit nachladen. Sie liegen im Repo statt auf einem
fremden CDN, damit sie mit dem Pin von upstreem-ui kommen: von jsDelivr (Bubble) und von der
eigenen Domain (upstreem-app, public/ui) gleich. Jede Datei ist unveraendert aus dem npm-Paket
der genannten Version, geprueft gegen dessen sha512-Integritaet (14.10.2026).

| Ordner | Paket | Lizenz | Wer laedt |
|---|---|---|---|
| chart-4.4.4 | chart.js 4.4.4 (dist/chart.umd.js) | MIT | core.js (Chart.js), Vorlade-Snippet |
| emoji-picker-element-1.29.1 | emoji-picker-element 1.29.1 | Apache-2.0 | core.js, prompts-table.js (Emoji-Waehler) |
| emoji-picker-element-data-1.8.0 | emoji-picker-element-data 1.8.0 (en/emojibase) | Apache-2.0 | dieselben, ueber data-source |

Vorher: Chart.js 4.4.4 von cdn.jsdelivr.net/npm, der Emoji-Waehler als `emoji-picker-element@^1`
(jede neue 1.x-Fassung lief ungeprueft in der App) und seine Daten ebenfalls von jsDelivr.
Ein Wechsel der Fassung ist ein neuer Ordner, nie ein Ueberschreiben.
