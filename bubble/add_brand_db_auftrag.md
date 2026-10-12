# Auftrag an Claude Code: „Add Brand“ überall über `brand_add_v1` (13.10.2026)

## Warum
Der Dialog `add-brand.js` speichert heute auf zwei Wegen:

| Wo geöffnet | Speichern über | Folge |
|---|---|---|
| Brands-Seite („Add Brand“, „Track“ in Explore Brands) | `brands-page.js` → `anlegen()` → RPC `brand_add_v1` | richtig |
| überall sonst (Quick Action „Add new brand“, alte Ansichten) | `bubble_fn_uabAddBrand` → Bubble-Workflow → n8n (Erreichbarkeit) → `add_competitor_v4` mit Service-Key | alter Weg |

- `brand_add_v1` ist live, wurde aber laut `pg_stat_statements` noch **kein einziges Mal** aufgerufen.
- `add_competitor_v4` hat 65 Aufrufe, alle als `service_role` (n8n).
- Ziel: **ein** Weg, ohne Bubble und ohne n8n. Danach können der Bubble-Workflow, der n8n-Workflow und `add_competitor_v4` weg.

## Was zu tun ist
1. **`add-brand.js` speichert selbst**, wenn weder `opts.onSubmit` noch `setAddBrandSubmit` gesetzt ist:
   - `UC.rpc("brand_add_v1", { p_team, p_name, p_domain })`;
   - Team aus dem App-Store (wie die anderen Komponenten);
   - Payload wie heute: Name getrimmt (max 75), Domain normalisiert und als ASCII/Punycode.
2. **Die Logik aus `brands-page.js` → `anlegen()` wandert in den Dialog:**
   - **`brands_duplicate`** (PT409) gilt als Erfolg: Dialog zu, Hinweis „This brand is already in your account“.
   - **Erfolg:**
     - `meta.action = reactivated` → „Brand activated again“, sonst „Brand added“;
     - `meta.rewritten = true` → Zusatz „Special characters were removed from the name.“
   - **Fehler als Satz unter den Feldern** (`addBrandError`):

     | message | Satz |
     |---|---|
     | `brands_limit_reached` | Plan voll, `hint` = freie Plätze bzw. `inactive:50` |
     | `brands_daily_limit_reached` | Tageskontingent, `hint` `tracked:<Rest>` |
     | `brands_rate_limited` | `hint` = Sekunden |
     | `brands_own_brand` | „Das ist deine eigene Marke“ |
     | `brands_invalid_param` | `hint` beginnt mit `p_name:` bzw. `p_domain:` → Fehler am passenden Feld |
     | `forbidden` / `team_access_*` | kein Zugriff |
     | Netz oder unbekannt | „The brand could not be added“ |

   Die Fehlerliste steht vollständig in `brands_v1_vertrag.md` 11.3.
3. **Nach Erfolg:**
   - wie heute `up-brand-added` feuern;
   - **zusätzlich die Marken-Ablage der App neu füllen** (Seitenleiste, Filter, Marken-Menüs). `brands-page.js` macht das in `nachAenderung()` über `brands_page_meta_v1`: bitte als gemeinsamen Helfer in core oder im Dialog, damit es auf jeder Seite passiert.
4. **`brands-page.js`:**
   - `setAddBrandSubmit(anlegen, root)` und `onSubmit: anlegen` können bleiben (dann gilt die Seite) oder entfallen, wenn der Dialog alles kann. Bitte **ein** Verhalten, keine doppelte Fehlerliste.
   - `nachAenderung()` muss auch laufen, wenn der Dialog selbst gespeichert hat (auf `up-brand-added` hören).
5. **`bubble_fn_uabAddBrand` nicht mehr feuern.** `addBrandSuccess`/`addBrandError` bleiben als öffentliche API, damit ein alter Bubble-Workflow nicht ins Leere ruft, solange er noch auf Seiten steht.
6. **Kopf-Kommentar der Datei** und `quick_actions_bubble.html`: Quick Action „Add new brand“ öffnet nur noch `openAddBrand()`. Der Bubble-Workflow hinter `bubble_fn_qa_add_brand` braucht keinen Speicher-Schritt mehr.

## Für Lukas in Bubble danach
- Den Workflow „uabAddBrand“ (bzw. den Speicher-Schritt mit dem n8n-Aufruf) auf allen Seiten entfernen.
- Den n8n-Workflow für das Anlegen von Marken deaktivieren, sobald `add_competitor_v4` eine Woche lang keine Aufrufe mehr hat. Das prüfe ich.

## Danach in der Datenbank (mache ich, mit Sicherung und Rückweg)
- `add_competitor_v1`–`v4`, `add_team_competitor_v1` absichern und später löschen.
- Heute darf jeder `add_competitor_v4` ausführen, auch anon. anon bekommt nur eine Fehlermeldung, aber das Recht gehört weg.
