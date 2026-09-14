(function () {
  var ROH = `{
  "range_label": "Last 30 days",
  "overview": { "range_label": "Last 30 days", "visibility_pct": 33.33, "visibility_delta_pct": 0.4,
    "visibility_position": 1, "brand_count": 8, "avg_rank": 4.1, "avg_rank_delta": 0.06,
    "best_rank": 3.96, "sentiment": 63, "sentiment_delta": 2.55, "field_avg_sentiment": 61 },
  "brands": [
    { "company_id": "50000000-0000-0000-0000-000000000001", "position": 1, "name": "OwnBrand",
      "logo_url": "https://example.com/logo.png", "visibility_pct": 33.33, "visibility_delta_pct": 0.4,
      "avg_rank": 4.1, "avg_rank_delta": 0.06, "sentiment": 63, "sentiment_delta": 2.55, "is_own": true }
  ],
  "citations_label": "Last 30 days",
  "top_domains": [
    { "domain": "adac.de", "favicon": "https://example.com/favicon.ico", "citation_type": "Editorial",
      "share_pct": 12.5, "share_delta_pct": 1.2, "used_total": 1840 }
  ],
  "totalCountDomain": 128,
  "top_urls": [
    { "url": "https://www.adac.de/rund-ums-fahrzeug/autokatalog/marken-modelle/",
      "title": "Autokatalog: Alle Marken und Modelle", "favicon": "https://example.com/favicon.ico",
      "url_type": "article", "global_share_pct": 4.75, "share_delta_pct": -0.3, "used_total": 412 }
  ],
  "totalCountUrl": 32500,
  "chats": [
    { "id": "71000000-0000-0000-0000-000000000002", "title": "Wettbewerber aufholen",
      "preview": "Welche Domains zitieren ...", "updated_at": "2026-09-14T10:00:00+00:00",
      "status": "active", "project_id": "70000000-0000-0000-0000-000000000001",
      "project_title": "Projekt A", "is_pinned": true }
  ],
  "chat_projects": [
    { "id": "70000000-0000-0000-0000-000000000001", "title": "Projekt A", "status": "active",
      "updated_at": "2026-09-12T08:00:00+00:00", "session_count": 3 }
  ],
  "opportunities": [
    { "id": "80000000-0000-0000-0000-000000000001", "status": "Created",
      "lead_url": "https://www.adac.de/rund-ums-fahrzeug/autokatalog/marken-modelle/",
      "lead_domain": "adac.de", "lead_title": "Autokatalog: Alle Marken und Modelle",
      "lead_favicon": "https://example.com/favicon.ico", "effective_citation_type": "Editorial",
      "recommendation_type": "guest_post", "priority_score": 87.5, "priority_label": "High",
      "label": "Guest post", "headline": "Get listed in the ADAC Autokatalog",
      "reason": "Cited in 41 % of answers, competitors mentioned there, you are not.",
      "supporting_urls_count": 3, "market": "DE", "competitor_count": 2,
      "global_share_pct": 4.75, "trend_pct": 1.3, "created_at": "2026-09-01T09:00:00+00:00" }
  ],
  "errors": {}
}`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });

  var D = {};
  try { D = JSON.parse(ROH); } catch (e) { D = {}; }

  try {
    if (window.renderPowerDashboard) window.renderPowerDashboard(JSON.stringify({
      instanceId: "upw1",
      overview: D.overview, brands: D.brands,
      top_domains: D.top_domains, top_urls: D.top_urls,
      citations_label: D.citations_label,
      totalCountDomain: D.totalCountDomain, totalCountUrl: D.totalCountUrl,
      errors: D.errors
    }));
  } catch (e) {}

  try { if (D.chats && window.askMiraSetPreviousChats) window.askMiraSetPreviousChats(D.chats); } catch (e) {}
  try { if (D.chat_projects && window.askMiraSetProjects) window.askMiraSetProjects(D.chat_projects); } catch (e) {}
  try { if (D.opportunities && window.opportunitiesSetItems) window.opportunitiesSetItems(D.opportunities); } catch (e) {}
})();
