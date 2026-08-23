/* Die Folterprobe: DERSELBE Payload, aber mit allem, was in echten Daten vorkommt und was
   Komponenten dieser App schon einmal zerlegt hat. Jeder Fall geht durch den Backtick-Weg --
   den, den Bubble nimmt -- und danach wird gemessen, ob die Seite noch steht. */
window.__FAELLE = [
  ["sauber",              { title: "Ganz normaler Titel" }],
  ["doppeltes Zitat",     { title: 'NATURE ONE "rave. now. together." | 2026' }],
  ["Apostroph",           { title: "L'Ete des festivals - c'est parti" }],
  ["Schraegstrich Klammern", { title: "A/B (Test) – 50/50 [beta] {x}" }],
  ["leerer Wert",         { title: "", description: "", domain: "" }],
  ["null ueberall",       { title: null, description: null, citation_type: null, url_type: null,
                            domain_share: null, global_share: null, global_rank: null, last_seen: null }],
  ["Backslash",           { title: "Pfad C:\\Users\\Test und ein \\ am Ende" }],
  ["Zeilenumbruch",       { description: "Zeile eins\nZeile zwei\nZeile drei" }],
  ["Emoji",               { title: "Festival 🎪 mit Camping 💎 und Musik 🎵" }],
  ["HTML-Entities",       { description: "Techno &amp; Elektro &lt;b&gt;fett&lt;/b&gt; &quot;zitiert&quot;" }],
  ["Script-Versuch",      { title: "<script>window.__XSS=1<\/script><img src=x onerror=window.__XSS=2>" }],
  ["Dollar-Klammer",      { title: "Preis ${betrag} und `backtick` im Titel" }],
  ["sehr lang",           { title: new Array(60).join("Sehr langer Titel ohne Umbruchgelegenheit ") }],
  ["Zahlen als Text",     { domain_share: "99,15", global_share: "11.60", global_rank: "1" }],
  ["Marke mit Zitat",     { companies: [{ company_id: "a", company_name: 'Paro "Fest" & Co', logo_url: "" },
                                        { company_id: "b", company_name: "L'Autre", logo_url: "" }] }],
  ["companies leer",      { companies: [] }],
  ["companies fehlt",     { companies: undefined }],
  ["summary reiner Text", { markdown_summary: "Kein JSON, nur ein Satz." }],
  ["summary leer",        { markdown_summary: "" }],
  ["summary kaputt",      { markdown_summary: '{"summary": ' }]
];
