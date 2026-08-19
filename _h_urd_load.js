/* Die zwei Schritte, wortgleich wie sie nach Bubble gehen. */
window.__STEP_YES = function(){
  var INSTANCE_ID = "response_detail_page";
  var versuche = 0;
  (function los(){
    if (typeof window.setResponseDetailLoading === "function") {
      window.setResponseDetailLoading(INSTANCE_ID, "yes");
      return;
    }
    if (versuche++ < 60) { setTimeout(los, 100); return; }
    if (window.console) console.warn("[response-detail] setResponseDetailLoading gibt es nach 6s nicht.");
  })();
};
window.__STEP_NO = function(){
  var INSTANCE_ID = "response_detail_page";
  var versuche = 0;
  (function los(){
    if (typeof window.setResponseDetailLoading === "function") {
      window.setResponseDetailLoading(INSTANCE_ID, "no");
      return;
    }
    if (versuche++ < 60) { setTimeout(los, 100); return; }
    if (window.console) console.warn("[response-detail] setResponseDetailLoading gibt es nach 6s nicht.");
  })();
};
