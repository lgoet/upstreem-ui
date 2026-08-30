/* Der statische Run-JS-Schritt aus bubble/brand_editor_bubble.html, wortgleich -- nur die
   Kennung zeigt auf das Harness. Wer den Schritt aendert, aendert ihn hier mit. */
var STATISCH = `{
  "aliases": [
    {
      "mode": "exact_ci",
      "pattern": "anfragenfluss.de",
      "alias_id": "8f4fcc2c-f61b-414c-92e9-694f64fa7da4",
      "priority": 100,
      "is_active": true,
      "created_at": "2026-02-27T07:20:18.290477+00:00"
    }
  ],
  "company": {
    "name": "Anfragenfluss",
    "domain": "www.anfragenfluss.de",
    "company_id": "fd2f56a4-d11d-45a3-b10e-bd93a249b75f",
    "favicon_url": "https://www.google.com/s2/favicons?domain=anfragenfluss.de&sz=64",
    "default_color": null,
    "color_override": null,
    "effective_color": null
  },
  "tracking_periods": [
    { "ended_at": null, "started_at": "2026-02-26T20:59:16.117706+00:00", "start_reason": "created" }
  ]
}`
  .replace(/:\s*([,}\]])/g, ": null$1")
  .replace(/:\s*(yes|no)\s*([,}\]])/g, function(_, v, t){ return ": " + (v === "yes") + t; });

if (typeof window.setBrandEditor === "function") window.setBrandEditor("b1", STATISCH);
