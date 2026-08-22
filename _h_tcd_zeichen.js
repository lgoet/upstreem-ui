/* Die drei Sonderfaelle aus dem echten Response, wortgleich als TEXT -- so wie Bubble ihn in den
   Run-JS-Step einsetzt. Nichts erfunden. */
window.__textMitZeichen = '[' +
  '{"url":"https://www.nature-one.de/","title":"NATURE ONE \\"rave. now. together.\\" | 30. Juli - 02. August 2026","favicon":"https://www.google.com/s2/favicons?domain=nature-one.de&sz=128","url_type":"homepage","used_total":87,"total_count":5147,"citation_type":"Competition","share_prev_pct":10.43,"share_delta_pct":-1.21,"global_share_pct":9.22},' +
  '{"url":"https://festivalnetworks.com/best-electronic-festivals-europe-2026.html","title":"Best Electronic Festivals Europe 2026 — 15 Compared | Festival Networks","favicon":"https://www.google.com/s2/favicons?domain=festivalnetworks.com&sz=128","url_type":"listicle","used_total":75,"total_count":5147,"citation_type":"Editorial","share_prev_pct":7.94,"share_delta_pct":0.00,"global_share_pct":7.94},' +
  '{"url":"https://www.ticketswap.de/magazine/guides/best-festivals-germany","title":"Beste Musikfestivals in Deutschland 2026 | TicketSwap Guide – TicketSwap","favicon":"https://www.google.com/s2/favicons?domain=ticketswap.de&sz=128","url_type":"listicle","used_total":77,"total_count":5147,"citation_type":"Brand_Platform","share_prev_pct":7.94,"share_delta_pct":0.22,"global_share_pct":8.16}' +
']';
/* Und derselbe Text, nachdem die Anfuehrungszeichen im Titel NICHT escaped wurden -- genau das
   passiert, wenn ein Bubble-Ausdruck den Titel roh in JSON einsetzt. */
window.__textKaputt = window.__textMitZeichen.replace('\\"rave. now. together.\\"', '"rave. now. together."');
