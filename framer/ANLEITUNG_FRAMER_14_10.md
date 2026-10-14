# Framer: was du selbst einstellen musst (Stand 14.10.2026)

Pin für alles unten: **`da03056`**. Erst eintragen, wenn der Pin geprüft ist (siehe Übergabe im Chat).

Die Live-Seite steht noch auf `f521466` und auf dem alten HTML-Embed. Nach diesen Schritten
kommt alles aus Code-Komponenten, die Framer vorrendert. Crawler sehen dann Text und Links.

---

## 1. Fünf Code-Komponenten anlegen bzw. ersetzen

Für jede Datei gilt: in Framer links **Assets → Code**, dann:

| Datei im Repo | In Framer | Was tun |
|---|---|---|
| `framer/UpstreemLanding.tsx` | neu: **+ → New Component**, Name `UpstreemLanding` | ganzen Inhalt einfügen, speichern |
| `framer/UpstreemTopbar.tsx` | vorhandene Datei `UpstreemTopbar` öffnen | Inhalt **ganz ersetzen**, speichern |
| `framer/UpstreemFooter.tsx` | vorhandene Datei `UpstreemFooter` öffnen | Inhalt **ganz ersetzen**, speichern |
| `framer/UpstreemDemo.tsx` | neu: **+ → New Component**, Name `UpstreemDemo` | ganzen Inhalt einfügen, speichern |
| `framer/UpstreemContact.tsx` | neu: **+ → New Component**, Name `UpstreemContact` | ganzen Inhalt einfügen, speichern |

Den Inhalt immer aus der Datei im Repo kopieren, nie von Hand ändern. Die langen Zeilen zwischen
`SSR ANFANG` und `SSR ENDE` sind erzeugt.

## 2. Startseite (`/`)

1. Das alte HTML-Embed (`landing_hero.html`) löschen.
2. `UpstreemLanding` an seine Stelle ziehen.
3. An der Instanz: Breite **Fill**, Höhe **Auto**, rechts unter **Pin** `da03056`.
4. Keine Topbar und keinen Footer zusätzlich auf diese Seite: die Komponente bringt beide mit.

## 3. Neue Seite `/demo`

1. Pages-Leiste: **+** → neue Seite, Pfad `/demo`.
2. Von oben nach unten drei Instanzen in den Stack:
   - `UpstreemTopbar`: Breite **Fill**, Position **Sticky**, Top **0**, Z-Index **100**
   - `UpstreemDemo`: Breite **Fill**, Höhe **Auto**
   - `UpstreemFooter`: Breite **Fill**
3. Bei allen dreien rechts unter **Pin** `da03056`.

## 4. Neue Seite `/contact`

Wie `/demo`, nur mit `UpstreemContact` in der Mitte. Pfad `/contact`.

Gab es `/contact` schon als Framer-Seite, dann diese Seite umbauen statt eine zweite anzulegen:
Der Knopf „Talk to sales“ unten auf der Startseite zeigte schon vorher dorthin.

## 5. SEO je Seite

In der Pages-Leiste die Seite anklicken → Zahnrad (Page Settings) → **Title** und **Description**.

| Seite | Title | Description |
|---|---|---|
| `/` | `upstreem: AI Search Analytics made simple` | `Track and optimize your brand's AI search performance and drive qualified traffic, leads and revenue.` |
| `/demo` | `Book a demo \| upstreem` | `Pick a time for a 45-minute tour of upstreem: what AI answers say about your brand, which sources they draw on, and where you can win.` |
| `/contact` | `Talk to sales \| upstreem` | `Questions about plans, onboarding or a custom setup? Book a call with the upstreem team or write to lukas@upstreem.ai.` |

Unter **Site Settings → General** dieselbe Zeile wie bei `/` als Standard für die ganze Website,
dazu Favicon und Social Image, falls noch nicht gesetzt.

## 6. JSON-LD

Zwei Blöcke. Beide sind reiner Text: Framer rendert sie unverändert ins `<head>`.

**a) Für die ganze Website**: **Site Settings → General → Custom Code → End of `<head>` tag**:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://upstreem.ai/#organization",
      "name": "upstreem",
      "url": "https://upstreem.ai",
      "logo": "https://tgdossbsevnonssyuewp.supabase.co/storage/v1/object/public/BRANDSTYLES/upstreem-lockup-1f1f1f.svg",
      "sameAs": [
        "https://www.linkedin.com/company/upstreem",
        "https://www.youtube.com/@upstreem"
      ],
      "contactPoint": {
        "@type": "ContactPoint",
        "contactType": "sales",
        "email": "lukas@upstreem.ai",
        "url": "https://upstreem.ai/contact"
      }
    },
    {
      "@type": "WebSite",
      "@id": "https://upstreem.ai/#website",
      "name": "upstreem",
      "url": "https://upstreem.ai",
      "publisher": { "@id": "https://upstreem.ai/#organization" }
    }
  ]
}
</script>
```

**b) Nur auf der Startseite**: Page Settings von `/` → **Custom Code → End of `<head>` tag**:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "upstreem",
  "url": "https://upstreem.ai",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "description": "AI search analytics: track and optimize your brand's AI search performance and drive qualified traffic, leads and revenue.",
  "publisher": { "@id": "https://upstreem.ai/#organization" }
}
</script>
```

Preise stehen mit Absicht nicht drin. Ändert sich ein Preis, wären sie in den strukturierten Daten
veraltet, ohne dass es jemand sieht. Kommen sie später dazu, dann aus derselben Quelle wie die
Preisseite.

## 7. Veröffentlichen und prüfen

1. **Publish**.
2. Rohes HTML prüfen, ohne JavaScript, so wie ein Crawler es sieht:
   `curl -s https://upstreem.ai | grep -c "AI Search Analytics"`. Ergebnis mindestens 1.
   Dasselbe für `https://upstreem.ai/demo` mit `Book a demo`.
3. JSON-LD: https://search.google.com/test/rich-results mit `https://upstreem.ai`. Erwartet:
   Organization erkannt, keine Fehler.
