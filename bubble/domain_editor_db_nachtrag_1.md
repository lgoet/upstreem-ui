# Nachtrag 1 an den Datenbank-Chat: `brand_log_v1` je Marke (13.10.2026)

Diesen Text in den Datenbank-Chat geben.

**Worum es geht:** Das Protokoll steht jetzt im Marken-Editor, als Abschnitt „Activity Log“ mit
Filter der Ereignisarten, wie das Team-Log. Dort gehört es zu **einer** Marke. `brand_log_v1` kennt
aber keine Einschränkung auf eine Marke. Die Oberfläche holt deshalb je 100 Einträge des Teams und
filtert selbst auf `companies[]`. Bei einem großen Team mit vielen Änderungen an anderen Marken
heißt das viele leere Abrufe. Höchstens fünf je Klick, danach „Show older entries“.

**Bitte:**
- `p_company uuid default null` als letzten, optionalen Parameter in `brand_log_v1`.
- Bedeutung: nur Einträge, deren `companies` diese Marke enthält.
- Domain-Einträge (`domain_own` / `_competitor` / `_auto`) dazu, wenn die Domain die Website-Domain dieser Marke ist. Dann steht die Zuordnung ihrer eigenen Domain im Protokoll der Marke.
- Ohne `p_company` bleibt alles wie heute, Settings kann es weiter teamweit nutzen.
- Fremde oder unbekannte Marke: leere `rows`, kein Fehler (wie die übrigen Lese-RPCs). Oder `brand_not_found`, wenn dir das stimmiger ist. Bitte sag, welches.
- Dieselben Regeln wie bisher: nur owner/admin, `p_types`, `next_before`.

Nach dem Bau bitte echte Antworten für die eigene Marke und für BMW, je einmal ohne Filter und einmal mit `p_types = ['alias']`. Die Oberfläche schaltet dann vom Filtern im Browser auf `p_company` um.
