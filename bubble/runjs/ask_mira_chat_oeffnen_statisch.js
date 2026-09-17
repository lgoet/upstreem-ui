(function () {
  var CHAT_ID = `f6e520eb-81c8-4d44-bd4e-d9e61f678022`;

  var ROH = `[{
  "id": "e13ae649-ce7e-43cf-a2bc-882d5c1a36cf",
  "role": "user",
  "status": "success",
  "content": "Schreib mein Daily Briefing: wo Sichtbarkeit, durchschnittlicher Rang und Sentiment stehen und in welche Richtung sie laufen.",
  "content_html": "",
  "created_at": "Sep 17, 2026 8:32 am",
  "latency_ms": 0,
  "metadata": { "evidence": [], "evidence_items": [], "opportunities": [], "actions": [] }
},{
  "id": "ac5a7add-2276-4428-9176-9750058baedc",
  "role": "assistant",
  "status": "success",
  "content": "Daily Briefing - 11.-17.09.2026 (letzte 7 Tage). Kurzfassung: Sichtbarkeit und Mentions von LeeUp Media ziehen deutlich an, der Rank bleibt stabil - aber das Sentiment faellt spuerbar.",
  "content_html": "<p><strong>Daily Briefing - 11.-17.09.2026</strong></p><p>Sichtbarkeit und Mentions ziehen an, das Sentiment faellt.</p><p><span data-mira-action-id=\"oppc_1\" data-mira-action=\"create_opportunity\" data-mira-lead-url=\"https://www.leadfluss.de/blog/solar-leads-kaufen\" data-mira-title=\"Praesent werden bei PV-Lead-Anbieterlisten\" data-mira-reason=\"Der Prompt &quot;beste lead agentur solar&quot; zeigt 0 % eigene Sichtbarkeit.\">Add as Opportunity</span></p>",
  "created_at": "Sep 17, 2026 8:34 am",
  "latency_ms": 86306,
  "metadata": {
    "evidence": ["brand","competitor","prompt"],
    "evidence_items": [],
    "opportunities": [],
    "actions": [
      {
        "id": "c36157ce-7260-48b9-b8ad-d96db4d1bf5e",
        "type": "create_opportunity",
        "action_key": "oppc_1",
        "label": "Add as Opportunity",
        "payload": {
          "team_id": "",
          "lead_url": "https://www.leadfluss.de/blog/solar-leads-kaufen",
          "title": "Praesent werden bei PV-Lead-Anbieterlisten",
          "reason": "Der Prompt "beste lead agentur solar" zeigt 0 % eigene Sichtbarkeit, waehrend Wettbewerber dort bis zu 58,82 % erreichen.",
          "recommendation_type": ""
        },
        "sort_order": 1
      }
    ]
  }
}]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });

  try { if (window.askMiraSetActiveChat) window.askMiraSetActiveChat(CHAT_ID, false); } catch (e) {}
  try { if (window.askMiraSetMessages)   window.askMiraSetMessages(ROH); } catch (e) {}
  try { if (window.askMiraTypeLastAnswer) window.askMiraTypeLastAnswer(); } catch (e) {}
  try { if (window.askMiraSetLoading)    window.askMiraSetLoading("no"); } catch (e) {}
})();
