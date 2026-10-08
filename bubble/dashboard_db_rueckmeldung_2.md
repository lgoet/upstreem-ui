# Rückmeldung 2 an den Datenbank-Chat: Dashboard v1 (Stand 08.10.2026, nach dem Bau)

Die Oberfläche ist gegen den Vertrag „Dashboard v1 – in Prod“ und die 19 Beispiele gebaut und
getestet. **Es fehlt nichts für den Start.** Zwei Punkte, beide abwärtskompatibel, keiner blockiert:

## 1. Farben bei `p_companies` folgen der Reihenfolge der Auswahl

Beispiel 8 (Mercedes + VW): Mercedes kommt mit `#0ea5e9`, im automatischen Fall (Beispiel 5) mit
`#6366f1`. Die Palette zählt nach der Reihenfolge in der Auswahl, nicht nach der Marke. Wer im Chart
Marken auswählt, sieht dieselbe Marke dann in einer anderen Farbe als vorher.

**Bitte:** Die Palettenfarbe nach `position` aus der vollen Rangliste vergeben (wie im automatischen
Fall) statt nach der Stelle in `p_companies`. Team-Einstellung und Firmenfarbe gehen weiter vor.
Die Oberfläche fängt den häufigsten Fall schon ab: „Reset“ auf die Top 7 schickt kein
`p_companies`, sondern die automatische Auswahl.

## 2. `cached_dashboard_responses_v1`: `p_limit` bis 100

Die Responses-Tabelle bietet 15, 25, 50 und **100** Zeilen je Seite an, der Vertrag erlaubt 1–50.
Bei 100 holt die Oberfläche heute zwei Teile zu 50 (`offset` und `offset + 50`) und hängt sie
aneinander. Das funktioniert, kostet aber zwei Aufrufe gegen das Rate-Limit.

**Bitte:** `p_limit` 1–100 erlauben (eine Erweiterung, kein `_v2`). Dann stelle ich auf einen
Aufruf um.

## Zur Kenntnis (nichts zu tun)

- **Tage ohne Runs (`visibility_pct: null`):** Die Oberfläche lässt den Punkt weg, die Linie läuft
  über den Tag hinweg, wie bei jedem Linienchart der App. In den 19 Beispielen kam kein `null` vor.
- **Rate-Limit:** Die Oberfläche bündelt schnelle Änderungen (Filter 120 ms, Teil-Bedienung 80 ms)
  und lässt „Aktualisieren“ nur einmal zur Zeit laufen. Gemessen: 200 Filterwechsel in 1,4 s
  ergeben 5 Aufrufe, 30 Klicks auf „Aktualisieren“ 2 Aufrufe von `clear_dashboard_cache_v1`.
- **Kennungen:** Topic- und Firmen-Kennungen gehen nur als gültige uuid hinaus. Ein manipulierter
  Eintrag lässt sonst den ganzen Aufruf mit 22P02 scheitern (gilt jetzt auch für Citations v1).
