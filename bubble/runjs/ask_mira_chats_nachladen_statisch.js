(function () {
  var ROH = `[
  { "id": "6a17fa06-a38c-45ee-a502-4639d85d1a06", "title": "Wettbewerber Erwähnungsanalyse", "status": "active", "is_pinned": false, "project_id": null, "updated_at": "2026-06-30T08:18:44.691752+00:00", "project_title": null },
  { "id": "1271a8b9-529a-4d2b-8da3-90b409ef29c3", "title": "Wettbewerber Erwähnungsanalyse", "status": "active", "is_pinned": false, "project_id": null, "updated_at": "2026-06-30T08:18:43.298947+00:00", "project_title": null },
  { "id": "61f5d894-4b8e-4016-81a0-1b33c90919e5", "title": "Q2 2026 Visibility Report", "status": "active", "is_pinned": false, "project_id": null, "updated_at": "2026-06-29T20:45:21.932934+00:00", "project_title": null },
  { "id": "4739c894-4753-48be-ae25-4a8adb51dbe1", "title": "Negative Prompts Übersicht", "status": "active", "is_pinned": false, "project_id": null, "updated_at": "2026-06-28T10:02:53.396855+00:00", "project_title": null },
  { "id": "fde6da20-ffa5-4a5e-b538-b9e7cb61f11a", "title": "Negative Prompts Übersicht (?)", "status": "active", "is_pinned": false, "project_id": null, "updated_at": "2026-06-28T07:52:30.831144+00:00", "project_title": null },
  { "id": "dd626c85-705a-426c-9b50-24a1de8ae876", "title": "Negative Prompts Überblick", "status": "active", "is_pinned": false, "project_id": null, "updated_at": "2026-06-27T22:15:50.025074+00:00", "project_title": null },
  { "id": "43375b5f-aeb1-4f18-b5ee-34cadbac41b0", "title": "KI-Sichtbarkeitsreport Q2 2026", "status": "active", "is_pinned": false, "project_id": null, "updated_at": "2026-06-22T14:25:37.818459+00:00", "project_title": null },
  { "id": "d675bc07-e6ce-4a7f-a3f9-e7b9e1f5c8d7", "title": "Wettbewerber Themen Lücken", "status": "active", "is_pinned": false, "project_id": null, "updated_at": "2026-06-22T13:48:39.266552+00:00", "project_title": null },
  { "id": "2f81d585-a71a-4128-994c-27867b863f20", "title": "Top Brand Heute", "status": "active", "is_pinned": false, "project_id": null, "updated_at": "2026-06-22T12:58:51.629228+00:00", "project_title": null },
  { "id": "0200fb78-ecfb-4e80-b9ec-0b8334f4d96f", "title": "Q2 2026 Action Plan", "status": "active", "is_pinned": false, "project_id": null, "updated_at": "2026-06-22T12:44:22.479897+00:00", "project_title": null },
  { "id": "5f1bef8f-9aec-47b9-ac4e-21808c0e326f", "title": "KI-Sichtbarkeitsreport Q2 2026", "status": "active", "is_pinned": false, "project_id": null, "updated_at": "2026-06-22T11:27:57.661124+00:00", "project_title": null },
  { "id": "cc7fac99-1a61-4066-a807-438d8c038ec2", "title": "Sentiment-Report 30 Tage", "status": "active", "is_pinned": false, "project_id": null, "updated_at": "2026-06-22T11:12:16.422514+00:00", "project_title": null },
  { "id": "9408ab17-5eca-4f4b-8518-5f166622935c", "title": "Greeting", "status": "active", "is_pinned": false, "project_id": null, "updated_at": "2026-06-21T14:51:09.826184+00:00", "project_title": null },
  { "id": "12bc9f1d-c0cb-4128-8742-a77edb88426b", "title": "AI-Visibility Verbesserung", "status": "active", "is_pinned": false, "project_id": null, "updated_at": "2026-06-19T10:29:01.927862+00:00", "project_title": null },
  { "id": "3694fd8f-cf08-4f64-8b97-b44d3d1fec22", "title": "Schnellste Visibility Verbesserung", "status": "active", "is_pinned": false, "project_id": null, "updated_at": "2026-06-19T10:07:53.937979+00:00", "project_title": null }
]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });

  try { if (window.askMiraAppendPreviousChats) window.askMiraAppendPreviousChats(ROH); } catch (e) {}
})();
