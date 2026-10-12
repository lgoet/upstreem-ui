# Rückmeldung an den Datenbank-Chat: Domain-Drawer und Marken-Editor v1 (13.10.2026)

Diesen Text in den Datenbank-Chat geben. Kurz gesagt: **Die Lieferung ist angenommen.** Beide Drawer
laufen gegen die echten Antworten aus `domain_editor_v1_echte_antworten.json`. Zwei Punkte sind
offen (Abschnitt 3).

## 1. Domain-Drawer

Gemessen im Prüfstand drw09 mit deinen Antworten:
- **Kopf:** `domain_detail_v1`.
  - Die Eingabe `https://WWW.ADAC.de/test?x=1` wird zu `adac.de`.
  - Der Chip zeigt den wirksamen Typ, das Menü „Counts as“ den Stand (`override`, sonst `citation_type_auto_label`).
- **Widerspruch:** Bei der Domain einer verfolgten Marke ist die widersprüchliche Wahl schon im Menü gesperrt, mit deinem Satz als Grund. Für `mercedes-benz.de` lautet er „This is the domain of your brand Mercedes Benz.“ Kommt der Fehler trotzdem, zeigt der Toast denselben Satz mit `details`.
- **Mitglied:** `can_override: false` zeigt den Stand, öffnet aber kein Menü.
- **Stats:**
  - `timeseries` als Liste nehme ich als Citation-Share-Kurve.
  - 43.3 % (+3.7) für adac.de, gleich `share_pct` in `cached_citations_domains_v1` (43.29 / 3.65).
- **URL Share:** `domain_share_pct` und `domain_share_total_pct`, Titel aus `urls[]`. Der Modus zeigt die Verteilung innerhalb der Domain.
- **Nie zitiert:** „Misc“, „Your team has never cited this domain.“ und 0 %. Ungültig: nur der Satz.
- **Unterseiten und KI-Antworten:** bestehende RPCs mit `p_domain`.
- **Export:** Er trägt `domain`, Bubble reicht es an `export_citations_urls_v1` bzw. `export_responses_v1` weiter.

## 2. Marken-Editor

- **Lesen:** `brand_edit_v1`. Die Felder nehmen die Grenzen aus `meta.limits` (Name und Alias 60).
- **Archivierte Marke:** „This brand is no longer tracked. You can view its settings.“, Bedienelemente gesperrt.
- **Mitglied:** eigener Satz, ebenfalls gesperrt.
- **Schreiben** (jede Antwort ist der neue Stand, so wird gezeichnet):
  - **Abgelehnt:**
    - „a“ (`too_short`);
    - „Mercedes“ (`collides`): „This name already belongs to Mercedes Benz.“, mit `details`;
    - „BMW“ (`duplicate`): „This is already the brand's name.“;
    - Name „Mercedes-Benz“ (`taken`).
    - Der abgelehnte Wert bleibt im Feld.
  - **Angenommen:** „BMW AG“, „the“ (deine Entscheidung, siehe unten), „BMW Group“.
  - Ein abgelehnter Schalter springt zurück.
- **Nach Name oder Farbe** zieht die Oberfläche selbst nach: Marken-Speicher und Brand-Drawer laden neu. Deine Caches leeren sich laut Vertrag ohnehin.

## 3. Offen

1. **Allgemeine Wörter als Alias:** Ohne Sperrliste geht „the“ durch (Fall 62), so entschieden. Dein Punkt 5 (Wortgrenzen in n8n) ist damit der einzige Schutz gegen solche Aliase. Ist er schon gebaut oder ein eigener Auftrag? Bitte als offenen Punkt führen, bis klar ist, wer ihn baut.
2. **`brand_log_v1`:** Die Oberfläche dafür (Protokoll in Settings, Filter-Chips wie das Team-Log) ist noch nicht gebaut. Das nehme ich auf, sobald Lukas es bestellt. Bis dahin bitte nichts entfernen.
