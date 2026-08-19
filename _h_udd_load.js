/* Die zwei Schritte, wortgleich wie sie nach Bubble gehen. */
window.__UDD_YES = function(){
  var INSTANCE_ID = "domain_detail_page";
  var versuche = 0;
  (function los(){
    if (typeof window.setDomainDetailLoading === "function") {
      window.setDomainDetailLoading(INSTANCE_ID, "yes");
      return;
    }
    if (versuche++ < 60) { setTimeout(los, 100); return; }
    if (window.console) console.warn("[domain-detail] setDomainDetailLoading gibt es nach 6s nicht.");
  })();
};
window.__UDD_NO = function(){
  var INSTANCE_ID = "domain_detail_page";
  var versuche = 0;
  (function los(){
    if (typeof window.setDomainDetailLoading === "function") {
      window.setDomainDetailLoading(INSTANCE_ID, "no");
      return;
    }
    if (versuche++ < 60) { setTimeout(los, 100); return; }
    if (window.console) console.warn("[domain-detail] setDomainDetailLoading gibt es nach 6s nicht.");
  })();
};
