(function(){
  var INSTANCE_ID = "response_detail_page";

  var MODELLE = [
    { key: "chatgpt",    display_name: "ChatGPT", short_name: "ChatGPT",
      logo_url: "https://cdn-icons-png.freepik.com/512/12222/12222588.png" },
    { key: "google-aio", display_name: "Google AI Overviews", short_name: "Google AIO",
      logo_url: "https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" },
    { key: "perplexity", display_name: "Perplexity", short_name: "Perplexity",
      logo_url: "https://www.google.com/s2/favicons?domain=perplexity.ai&sz=64" }
  ];

  var versuche = 0;
  (function los(){
    if (typeof window.setResponseDetail === "function") {
      if (typeof MODELLE !== "undefined" && typeof window.setUpstreemModels === "function") {
        window.setUpstreemModels(JSON.stringify(MODELLE));
      }
      window.setResponseDetail(INSTANCE_ID, `RPC_ANTWORT`);
      return;
    }
    if (versuche++ < 60) { setTimeout(los, 100); return; }
    if (window.console) console.warn("[response-detail] setResponseDetail gibt es nach 6s nicht.");
  })();
})();
