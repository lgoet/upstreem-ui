# Befundtexte Page Audit: Quellen je Familie

Stand: 22.10.2026. Grundlage für `kurz`, `warum` und `schritte` der 34 Familien in `page-audit-data.js` (`BEFUNDE`), die bis dahin nur `titel` und `umfang` hatten. Jede Aussage im sichtbaren Text ist hier auf eine offizielle oder Primärquelle zurückgeführt. Zitate sind kurz gehalten, alle Seiten am 22.10.2026 abgerufen.

Kennzeichnung: **[belegt]** = an der Quelle gelesen. **[Messung]** = was unser Worker misst (Code gelesen, `app-worker/lib/page-audit/`). **[Folgerung]** = logische Folge ohne eigene Tatsachenbehauptung über einen Anbieter.

Nicht im sichtbaren Text, nur hier: die Quellen selbst (Lukas: "du musst nicht in jeder Erklärung Quellen verweisen"). Im Code steht über jedem Eintrag ein Kommentar mit der Quelle.

## Quellen

| Kürzel | Quelle | URL | Stand der Seite |
|---|---|---|---|
| G-NET | Google, Debug network and DNS errors | https://developers.google.com/crawling/docs/troubleshooting/dns-network-errors | 2025-12-18 |
| G-HTTP | Google, How HTTP status codes, and network and DNS errors affect Google Search | https://developers.google.com/search/docs/crawling-indexing/http-network-errors | 2026-02-04 |
| G-TECH | Google Search Essentials, technical requirements | https://developers.google.com/search/docs/essentials/technical | 2025-12-18 |
| G-AI | Google, AI features and your website | https://developers.google.com/search/docs/appearance/ai-features | 2025-12-10 |
| G-META | Google, Robots meta tag, data-nosnippet, X-Robots-Tag | https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag | 2026-03-24 |
| G-JS | Google, JavaScript SEO basics | https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics | 2026-03-04 |
| G-LAZY | Google, Fix lazy-loaded content | https://developers.google.com/search/docs/crawling-indexing/javascript/lazy-loading | 2025-12-10 |
| G-CANON | Google, How to specify a canonical URL | https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls | 2026-07-10 |
| G-CANTS | Google, Fix canonicalization issues | https://developers.google.com/search/docs/crawling-indexing/canonicalization-troubleshooting | 2026-08-21 |
| G-INTL | Google, Managing multi-regional and multilingual sites | https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites | 2025-12-10 |
| G-CRAWL | Google, Google's common crawlers (Google-Extended) | https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers | 2026-10-15 |
| G-VERIFY | Google, Verifying Googlebot and other Google crawlers | https://developers.google.com/crawling/docs/crawlers-fetchers/verify-google-requests | 2026-03-20 |
| G-TSHOOT | Google, Troubleshoot Google Search crawling errors | https://developers.google.com/search/docs/crawling-indexing/troubleshoot-crawling-errors | 2025-12-18 |
| GSC-IDX | Search Console Help, Page indexing report | https://support.google.com/webmasters/answer/7440203 | ohne Datum |
| GSC-HTTPS | Search Console Help, HTTPS report | https://support.google.com/webmasters/answer/11396518 | ohne Datum |
| BING-GL | Bing Webmaster Guidelines (Abschnitt 10) | https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a | ohne Datum; die Seite lädt nur mit JavaScript, am 22.10. im Browser vollständig gelesen |
| BING-23 | Bing Webmaster Blog, 22.09.2023: neue Optionen für Bing Chat | https://blogs.bing.com/webmaster/2023/9/Announcing-new-options-for-webmasters-to-control-usage-of-their-content-in-Bing-Chat/ | 22.09.2023 |
| BING-25 | Bing Webmaster Blog, 15.10.2025: data-nosnippet | https://blogs.bing.com/webmaster/2025/10/Bing-Introduces-Support-for-the-data-nosnippet-HTML-Attribute/ | 15.10.2025 |
| OAI | OpenAI, Overview of OpenAI Crawlers | https://developers.openai.com/api/docs/bots | ohne Datum |
| PPLX | Perplexity Crawlers | https://docs.perplexity.ai/docs/resources/perplexity-crawlers | ohne Datum |
| ANT | Anthropic, Does Anthropic crawl data from the web | https://support.claude.com/en/articles/8896518 | 07.04.2026 |
| RFC9110 | RFC 9110 HTTP Semantics, 4.3.4 und 15.6 | https://www.rfc-editor.org/rfc/rfc9110.html | Standard |
| RFC1918 | RFC 1918 Address Allocation for Private Internets, 3 | https://www.rfc-editor.org/rfc/rfc1918.html | Standard |
| MDN | MDN: 401, 403, 404, 410, 429, 204, Status-Übersicht, Redirections, DNS, main, Accept-Language, Content-Language | https://developer.mozilla.org/ | laufend |
| W3C-LANG | W3C Internationalization, Declaring language in HTML | https://www.w3.org/International/questions/qa-html-language-declarations | ohne Datum |

## Je Familie

### transport.dns_resolution_failed
- Client schlägt zuerst den Hostnamen im DNS nach: **[belegt]** MDN DNS ("translation of human-friendly domain names ... to a numeric IP address", "DNS lookup").
- Google entfernt indexierte, unerreichbare Seiten "within days": **[belegt]** G-NET.
- Schritte A/CNAME und Nameserver: **[belegt]** G-NET (Debug-Schritte).
- "auch an einem Weiterleitungsziel": **[Messung]** `zielPruefen` läuft je Hop, `ende: "dns"` (abruf.ts). Darum der korrigierte `satz`.

### transport.tls_validation_failed
- Zertifikat belegt die Identität, automatische Clients sollen abbrechen, Nutzer werden vorher gefragt: **[belegt]** RFC9110 4.3.4 ("Automated clients ... SHOULD terminate the connection").
- Google meldet ungültige Zertifikate als HTTPS-Fehler: **[belegt]** GSC-HTTPS ("HTTPS has invalid certificate", "update your HTTPS certificate").

### transport.request_timeout
- Google behandelt Timeouts wie 5xx, Crawling langsamer, Entfernen "within days": **[belegt]** G-NET.
- 5 s Verbindung, 20 s Antwort: **[Messung]** `BUDGET` in abruf.ts (`verbindung: 5_000`, `anfrage: 20_000`). Der alte `satz` nannte nur 20 s; ein Verbindungs-Timeout nach 5 s fiel darunter. Eine Wiederholung gibt es nur, wenn die Frist reicht, darum steht sie nicht im Satz.

### http.authentication_required (401)
- 401 = fehlende gültige Anmeldedaten: **[belegt]** MDN 401.
- Googlebot crawlt keine Seiten mit Anmeldung: **[belegt]** G-TECH ("requiring a log-in ... Googlebot will not crawl it").
- Inhalte von 4xx werden nicht genutzt: **[belegt]** G-HTTP.

### http.access_denied (403)
- 403 = verstanden und abgelehnt: **[belegt]** MDN 403.
- 4xx-Inhalte ungenutzt: **[belegt]** G-HTTP.
- Veröffentlichte IP-Adressen der Crawler (Schritt "Server-Logs"): **[belegt]** G-VERIFY (IP-Listen, Reverse DNS), OAI (searchbot.json), PPLX (perplexitybot.json), ANT (bots.json).

### http.not_found (404)
- 404 = nichts gefunden: **[belegt]** MDN 404.
- Google indexiert nicht, frühere Indexierung wird entfernt: **[belegt]** G-HTTP.
- AI Overviews und AI Mode verlinken nur indexierte Seiten: **[belegt]** G-AI ("a page must be indexed and eligible to be shown in Google Search with a snippet").
- "Absichtlich entfernt ist in Ordnung": **[belegt]** GSC-IDX ("404 responses are not necessarily a problem, if the page has been removed without any replacement").
- Schritt 301 bei Umzug: **[belegt]** G-TSHOOT.

### http.gone (410)
- 410 = dauerhaft weg: **[belegt]** MDN 410 ("likely to be permanent").
- Rest wie 404: G-HTTP, G-AI.

### http.rate_limited (429)
- 429 = zu viele Anfragen in einer Zeit: **[belegt]** MDN 429 (RFC 6585, 4).
- Google: 429 gilt als Serverfehler, Crawling langsamer, indexierte URLs "eventually dropped": **[belegt]** G-HTTP.
- `satz` korrigiert: **[Messung]** abruf.ts wiederholt 429 nur, wenn Retry-After höchstens 10 s ist. "also after a retry" stimmte also nicht immer.

### http.server_error (5xx)
- 5xx = Server konnte die Anfrage nicht ausführen: **[belegt]** RFC9110 15.6, MDN Status-Übersicht.
- Google crawlt langsamer, indexierte URLs "eventually dropped": **[belegt]** G-HTTP.
- `satz` korrigiert: **[Messung]** wiederholt wird nur bei 502, 503, 504, nicht bei 500.

### http.empty_representation
- Google kann 204 nicht verarbeiten ("wasn't able to receive any content"), leere Seiten als soft 404: **[belegt]** G-HTTP.

### http.unexpected_status
- "Google only indexes pages that are served with an HTTP 200": **[belegt]** G-TECH.
- AI Overviews und AI Mode nur indexierte Seiten: G-AI.

### redirect.loop
- Schleife endet nie, Browser zeigen einen Fehler: **[belegt]** MDN Redirections.
- Google nennt "A redirect loop" als Grund für nicht indexiert: **[belegt]** GSC-IDX (Redirect error).

### redirect.unresolved
- Google folgt bis zu 10 Weiterleitungen: **[belegt]** G-HTTP ("follow up to 10 redirect hops").
- Zu lange Ketten und "A bad or empty URL in the redirect chain" als Weiterleitungsfehler: **[belegt]** GSC-IDX.
- Unsere Grenze 5: **[Messung]** `BUDGET.weiterleitungen = 5`.

### redirect.unsafe_destination
- Was wir nicht folgen: **[Messung]** netz.ts `zielPruefen`: anderes Schema als http/https, Zugangsdaten in der URL, unüblicher Port, reine IP-Adresse, nicht öffentliche Adresse. Titel und `satz` korrigiert: "non-public" traf den Port- und den IP-Fall nicht.
- Private Adressen sind aus dem Internet nicht erreichbar: **[belegt]** RFC1918 3 ("no global meaning", "cannot have IP connectivity to any host outside of the enterprise").

### redirect.https_downgrade
- Google bevorzugt HTTPS als Canonical, außer wenn die HTTPS-Seite auf HTTP weiterleitet: **[belegt]** G-CANON.
- "ohne Verschlüsselung geladen": **[Folgerung]** aus der Kette (http-Ziel).

### response.suspected_challenge
- "Google Search does not interact with your page": **[belegt]** G-LAZY.
- Anbieter veröffentlichen IP-Bereiche zum Durchlassen: **[belegt]** OAI ("allowing requests from our published IP ranges"), PPLX (WAF-Regeln, User Agent und IP gemeinsam), ANT (bots.json).
- `satz` entschärft: **[Messung]** heuristics.json sagt selbst, das Cloudflare-Merkmal komme auch auf lesbaren Seiten vor. Darum "contains signs of" statt "looks like ... instead of its content".

### response.suspected_login_wall
- Googlebot crawlt keine Seiten mit Anmeldung: **[belegt]** G-TECH.
- "Jeder andere Crawler bräuchte ein Konto": **[Folgerung]**, keine Aussage über einen Anbieter.

### response.suspected_soft_404
- Auslöser Titel oder H1 wie "page not found" und kein weiterer Haupttext: **[Messung]** heuristics.json `error_heading_without_main`.
- Google nennt das soft 404 und führt es unter den Gründen für nicht indexiert: **[belegt]** G-HTTP, GSC-IDX.
- Schritte 404/410, 301, Inhalt wiederherstellen: **[belegt]** G-TSHOOT.

### variants.ua_access_difference
- Auslöser: 401, 403, 429, 5xx, abgebrochene Kette oder Challenge-Merkmal nur mit dem Crawler-Namen: **[Messung]** bewertung.ts (A4).
- Echte Crawler kommen von veröffentlichten IP-Adressen: **[belegt]** G-VERIFY, OAI, PPLX, ANT.
- Zulassen über User Agent UND IP: **[belegt]** PPLX ("combine both User-Agent string matching and IP address verification").

### variants.language_access_failure
- Browser schicken Accept-Language nach ihrer Sprache: **[belegt]** MDN Accept-Language.
- Google rät von automatischer Weiterleitung nach Sprache ab, Googlebot schickt kein Accept-Language: **[belegt]** G-INTL.
- Ob andere Crawler eine Sprache schicken, ist nirgends dokumentiert: steht darum nicht im Text.

### robots.grounding_policy_disallowed
- Google-Extended: Token ohne eigenen User Agent, steuert Training künftiger Gemini-Modelle UND Grounding in Gemini Apps, wirkt nicht auf die Google-Suche: **[belegt]** G-CRAWL.
- Schritt "Erlauben erlaubt auch das Training": **[Folgerung]** aus G-CRAWL, es ist ein einziges Token für beides.

### directives.noindex
- noindex: nicht in Suchergebnissen zeigen; none = noindex, nofollow; Meta-Tag und X-Robots-Tag: **[belegt]** G-META.
- Nicht indexiert, also kein Link in AI Overviews und AI Mode: G-META + G-AI; GSC-IDX ("encountered a 'noindex' directive and therefore did not index it").
- Bing: "Use NOINDEX when a URL should NOT appear in Bing search, Copilot experiences, or grounding API results": **[belegt]** BING-GL 10.

### directives.expired
- unavailable_after: nach dem Datum nicht mehr zeigen: **[belegt]** G-META.
- AI Overviews und AI Mode: G-AI.

### directives.nosnippet
- nosnippet gilt auch für AI Overviews und AI Mode und verhindert die Nutzung als "direct input"; max-snippet:0 = nosnippet; data-nosnippet für Teile: **[belegt]** G-META.
- Nur Seiten, die mit Snippet gezeigt werden dürfen: **[belegt]** G-AI.

### directives.bing_preview_restriction
- "DATA-NOSNIPPET and NOSNIPPET prevent Bing from displaying captions and may limit Copilot citation quality": **[belegt]** BING-GL 10.
- max-snippet begrenzt die Vorschau: **[belegt]** BING-25 ("Limit the size or duration of preview content").
- **Vorsichtiger:** Eine Wirkung von max-snippet auf Copilot dokumentiert Bing nicht. Der Text sagt sie darum nur für nosnippet.

### directives.snippet_cap
- max-snippet = Höchstzahl Zeichen, gilt auch für AI Overviews und AI Mode und begrenzt die direkte Nutzung: **[belegt]** G-META.
- **Vorsichtiger:** Ein Satz "die Seite kann dort weiter erscheinen" war geplant. Google sagt das so nicht ausdrücklich. Er ist weggelassen; der `satz` sagt "a limit, not an exclusion" (Definition).

### directives.bing_noarchive
- "NOARCHIVE prevents content from being used in Copilot responses and grounding results": **[belegt]** BING-GL 10.
- Seite bleibt in der Bing-Suche: **[belegt]** BING-23 ("will still appear in our search results"). Achtung: Beitrag von 2023, damals "Bing Chat".
- nocache als Mittelweg (nur URL, Titel, Snippet): **[belegt]** BING-GL 10, BING-23.

### directives.bing_nocache
- "NOCACHE limits Copilot to using only the URL, title, and snippet, reducing citation depth and answer quality": **[belegt]** BING-GL 10.
- Beide gesetzt, Bing behandelt es als nocache: **[belegt]** BING-23.
- Schritt nennt noarchive mit: **[Folgerung]** ohne nocache gälte noarchive allein.

### directives.dynamic_conflict
- "may skip rendering and JavaScript execution" bei noindex; Ändern per JavaScript "may not work as expected"; "not all bots can run JavaScript": **[belegt]** G-JS.

### content.raw_main_empty
- main = "dominant content of the body": **[belegt]** MDN main.
- "not all bots can run JavaScript": **[belegt]** G-JS.
- **Vorsichtiger:** Der alte `satz` sagte, Systeme ohne JavaScript bekämen keinen Haupttext von dieser Seite. **[Messung]** bewertung.ts meldet die Familie auch, wenn D2 bestanden ist, der Text also nach dem Rendern außerhalb des markierten Bereichs steht. Der neue Text sagt nur, dass der markierte Bereich leer ist.

### interaction.suspected_gate
- "Google Search does not interact with your page": **[belegt]** G-LAZY.
- Googlebot crawlt keine Seiten mit Anmeldung: **[belegt]** G-TECH.
- Titel und `satz` um "sign-in" ergänzt: **[Messung]** bewertung.ts (D3) meldet heute genau Passwortfeld ohne gerenderten Haupttext.

### canonical.conflicting
- "Don't specify different URLs as canonical for the same page": **[belegt]** G-CANON.
- CMS und Plugins können Canonicals falsch setzen: **[belegt]** G-CANTS.
- **Vorsichtiger:** Dass Google bei mehreren Angaben alle ignoriert, steht nur in einem Blogbeitrag von 2013 ("5 common mistakes with rel=canonical"), nicht in der aktuellen Doku. Nicht im Text.

### canonical.invalid
- "Use absolute paths rather than relative paths with the rel="canonical" link element": **[belegt]** G-CANON.
- Auslöser: Angabe nicht als http(s)-Adresse auflösbar: **[Messung]** bewertung.ts (E1).

### language.declaration_conflict
- lang = Sprache des Texts, Content-Language = Publikum, Abweichung kann gewollt sein (Sprachkurs): **[belegt]** MDN Content-Language, W3C-LANG ("the in-page language declaration always overrides the HTTP information").
- Google nutzt kein lang-Attribut: **[belegt]** G-INTL ("We don't use any code-level language information such as lang attributes").
- `satz` korrigiert: **[Messung]** bewertung.ts (F1) vergleicht nur lang und Content-Language, hreflang nicht.

## Offene Lücken, nicht in dieser Runde behoben

1. **Platzhalter und Übersetzung.** `befundText` füllt `{token}` usw. bevor die Seite `t()` aufruft. `t()` sucht dann den fertigen Satz und findet ihn nicht. Betroffen: Titel und `satz` von `variants.ua_access_difference` ("Different response for PerplexityBot") und die gefüllten Schritte von `robots.search_path_disallowed`. Die Muster stehen im Katalog. Sie greifen, sobald `befundText` vor dem Füllen übersetzt.
2. **robots.search_path_disallowed, "the rule shown above".** Der Worker schreibt die Regel als `details.regel` (bewertung.ts), `DETAIL_FELDER` liest `rule`. Ob die Datenbank das Feld umbenennt, ist nicht geprüft. Wenn nicht, steht über dem Schritt im echten Lauf keine Regel (in der Fixture schon, die setzt `rule`).
3. **Randfall transport.request_timeout.** abruf.ts meldet eine ausgeschöpfte Gesamtfrist oder Abrufgrenze (`job_deadline_exceeded`) als `fehler: "timeout"`, bewertung.ts macht daraus denselben Befund wie einen Timeout der Seite. HANDOFF 8 verlangt, beides zu trennen. Beim ersten Seitenabruf ist das unwahrscheinlich, aber möglich.
