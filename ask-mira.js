/* upstreem ask-mira.js — component logic. Requires core.js (window.UpstreemCore) first.

   Mira, the agent surface. Ported from the standalone ask_mira.html with the LOGIC UNTOUCHED:
   every window.askMira* method, every bubble_fn_ask_mira_* call, every CustomEvent name and every
   payload key below is byte-identical to the standalone, because this component drives real
   Bubble workflows and a rename would break them silently.

   What this wrapper adds around that body, and nothing else:
     - a stub queue, so the askMira* calls Bubble fires before core.js has loaded are replayed in
       call order instead of being lost (STYLEGUIDE §25 step 2)
     - a boot retry that waits for window.UpstreemCore
     - UC.watchRoots, because Bubble replaces this element's markup once its dynamic expressions
       resolve

   Deliberately NOT using UC.makeMount: this is a page-level singleton with a namespaced-by-prefix
   api (window.askMiraSetMessages, not a flat renderX keyed off data-instance), the same situation
   quick-actions and prompt-research are in. */
(function(){
  "use strict";

  /* ---------- stubs ----------
     Bubble calls these by name from its own workflows, regularly before core.js has finished
     loading. Queue and replay rather than drop. */
  var API_NAMES = [
    "askMiraSetMessages","askMiraAddMessage","askMiraExpectAnswer","askMiraTypeLastAnswer",
    "askMiraSetExtras","askMiraSetLoading","askMiraSetPreviousChats","askMiraSetProjects",
    "askMiraSetTopics","askMiraSetMessagesFromEl","askMiraSetTopicsFromEl",
    "askMiraSetPreviousChatsFromEl","askMiraSetProjectsFromEl","askMiraSetActiveChat",
    "askMiraSetTitlePending","askMiraSetTitlePendingFromEl","askMiraSetExportPending",
    "askMiraClearInput","askMiraSetTheme","askMiraSetMarket","askMiraSetSettings",
    "askMiraSetModels","askMiraSetFavicons","askMiraSetBrandLogos","askMiraSetCompanies",
    "askMiraSetTool","askMiraSetFaviconsFromEl","askMiraSetBrandLogosFromEl",
    "askMiraSetToolFromEl","askMiraGetState","askMiraOpportunityResult",
    "askMiraResolveVoice","askMiraRejectVoice","askMiraSetTranscript","askMiraVoiceCancel"
  ];
  var __amBootQueue = window.__amBootQueue = window.__amBootQueue || [];
  if (!window.__amBootStubbed){
    window.__amBootStubbed = true;
    API_NAMES.forEach(function(n){
      if (typeof window[n] !== "function"){
        window[n] = function(){ __amBootQueue.push([n, arguments]); };
        window[n].__amStub = true;
      }
    });
  }

  function amBoot(triesLeft){
    if (!window.UpstreemCore){
      if (triesLeft > 0){ setTimeout(function(){ amBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    amRun();
    var UC = window.UpstreemCore;
    if (UC.watchRoots) UC.watchRoots("am-root", amRun);
    [100, 300, 800, 1800].forEach(function(ms){ setTimeout(amRun, ms); });
  }

  function amRun(){
    var el = document.getElementById("ask-mira");
    if (!el || el.__askMiraInit) return;
    amInit();
    /* Replay whatever Bubble queued against the stubs, in call order. A stub is only replaced by
       the real implementation inside amInit; anything still stubbed is skipped rather than thrown. */
    var q = window.__amBootQueue;
    if (q && q.length){
      q.splice(0, q.length).forEach(function(entry){
        var fn = window[entry[0]];
        if (typeof fn !== "function" || fn.__amStub) return;
        try { fn.apply(null, entry[1]); }
        catch(e){ if (window.console) console.error("[ask-mira] queued " + entry[0] + " failed:", e); }
      });
    }
  }

  function amInit(){

  var root = document.getElementById('ask-mira');
  if (!root || root.__askMiraInit) return;
  root.__askMiraInit = true;

  /* ---------------- Inline icon set (no external libs) ---------------- */
  var ICON = {
    user: '<svg viewBox="0 0 24 24"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    trend: '<svg viewBox="0 0 24 24"><path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/></svg>',
    source: '<svg viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>',
    flag: '<svg viewBox="0 0 24 24"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/></svg>',
    smile: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /> <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>',
    download: '<svg viewBox="0 0 24 24"><path d="M12 15V3" /> <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /> <path d="m7 10 5 5 5-5" /></svg>',
    zap: '<svg viewBox="0 0 24 24"><path d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z" /></svg>',
    maximize: '<svg viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3" /> <path d="M21 8V5a2 2 0 0 0-2-2h-3" /> <path d="M3 16v3a2 2 0 0 0 2 2h3" /> <path d="M16 21h3a2 2 0 0 0 2-2v-3" /></svg>',
    globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /> <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /> <path d="M2 12h20" /></svg>',
    link: '<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /> <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>',
    fileText: '<svg viewBox="0 0 24 24"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" /> <path d="M14 2v5a1 1 0 0 0 1 1h5" /> <path d="M10 9H8" /> <path d="M16 13H8" /> <path d="M16 17H8" /></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" /></svg>',
    swords: '<svg viewBox="0 0 24 24"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" y1="14" x2="9" y2="18"/><line x1="7" y1="17" x2="4" y2="20"/><line x1="3" y1="19" x2="5" y2="21"/></svg>',
    prompt: '<svg viewBox="0 0 24 24"><path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" /></svg>',
    citation: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
    competitor: '<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    recommendation: '<svg viewBox="0 0 24 24"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12c.5.5 1 1.5 1 3h6c0-1.5.5-2.5 1-3a7 7 0 0 0-4-12z"/></svg>',
    brand: '<svg viewBox="0 0 24 24"><path d="M12 2 4 5v6c0 5 3.4 8.3 8 11 4.6-2.7 8-6 8-11V5z"/></svg>',
    thumbsUp: '<svg viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>',
    thumbsDown: '<svg viewBox="0 0 24 24"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /> <path d="M3 6h18" /> <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>',
    pencil: '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M18 6 6 18" /> <path d="m6 6 12 12" /></svg>',
    telescope: '<svg viewBox="0 0 24 24"><path d="m10.065 12.493-6.18 1.318a.934.934 0 0 1-1.108-.702l-.537-2.15a1.07 1.07 0 0 1 .691-1.265l13.504-4.44"/><path d="m13.56 11.747 4.332-.924"/><path d="m16 21-3.105-6.21"/><path d="M16.485 5.94a2 2 0 0 1 1.455-2.425l1.09-.272a1 1 0 0 1 1.212.727l1.515 6.06a1 1 0 0 1-.727 1.213l-1.09.272a2 2 0 0 1-2.425-1.455z"/><path d="m6.158 8.633 1.114 4.456"/><path d="m8 21 3.105-6.21"/><circle cx="12" cy="13" r="2"/></svg>',
    settings: '<svg viewBox="0 0 24 24"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>',
    chevron: '<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg>',
    chevronRight: '<svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" /></svg>',
    dots: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>',
    folderOpen: '<svg viewBox="0 0 24 24"><path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2"/></svg>',
    folder: '<svg viewBox="0 0 24 24"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><g transform="rotate(45 12 12)"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></g></svg>',
    pinOff: '<svg viewBox="0 0 24 24"><g transform="rotate(45 12 12)"><path d="M12 17v5"/><path d="M15 9.34V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H7.89"/><path d="M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h11"/></g><path d="m2 2 20 20"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>'
  };
  var EVIDENCE = {
    brand:         { label: 'Your Brand',     color: '#3a8ea3', icon: ICON.copy },
    competitor:    { label: 'Competitor',     color: '#d9852e', icon: ICON.swords },
    prompt:        { label: 'Prompt',         color: '#8b5cf6', icon: ICON.zap },
    prompt_run:    { label: 'Response',       color: '#7a8aa0', icon: ICON.maximize },
    response:      { label: 'Response',       color: '#7a8aa0', icon: ICON.maximize },
    domain:        { label: 'Domain',         color: '#2ec27e', icon: ICON.globe },
    url:           { label: 'URL',            color: '#3b82f6', icon: ICON.link },
    citation:      { label: 'Citation',       color: '#6b7280', icon: ICON.fileText },
    recommendation:{ label: 'Recommendation', color: '#2ec27e', icon: ICON.star }
  };

  /* ---------------- Elements ---------------- */
  var elMessages   = root.querySelector('#am-messages');
  var elChat       = root.querySelector('#am-chat');
  var elSuggGrid   = root.querySelector('#am-suggested-grid');
  var elSugg       = root.querySelector('#am-suggested');
  var elSuggLbl    = root.querySelector('#am-suggested-label');
  var elComposer   = root.querySelector('#am-composer');
  var elTextarea   = root.querySelector('#am-textarea');
  var elPhLoop     = root.querySelector('#am-ph-loop');
  var elQuoteSlot  = root.querySelector('#am-quote-slot');
  var elPhText     = root.querySelector('#am-ph-text');
  var elSend       = root.querySelector('#am-send');
  var elDetail     = root.querySelector('#am-detail');
  var elSegThumb   = root.querySelector('#am-seg-thumb');
  var elSettingsToggle = root.querySelector('#am-settings-toggle');
  var elSettingsPanel  = root.querySelector('#am-settings-panel');
  var elStatusText = root.querySelector('#am-status-text');
  var elPrevPanel  = root.querySelector('#am-prev-panel');
  var elPrevList   = root.querySelector('#am-prev-list');
  var _prevLoaded  = false;   // becomes true once the app receives its chat sessions (or a timeout fallback)
  /* Das Skelett soll aussehen wie der Inhalt, der kommt: Zeilen von 34px mit EINER Textzeile
     darin, nicht sieben ausgefuellte Bloecke. Die Breiten wechseln, weil Chatnamen verschieden
     lang sind -- gleich lange Balken lesen sich als Tabelle, nicht als Liste. */
  var SKEL_BREITEN = [78, 62, 84, 55, 71, 66, 48];
  function _prevSkeletonHTML(){
    var rows = '';
    for (var i = 0; i < SKEL_BREITEN.length; i++){
      rows += '<div class="am-prev-skel-row"><span class="am-prev-skel-line" style="width:' +
              SKEL_BREITEN[i] + '%"></span></div>';
    }
    return '<div class="am-prev-skel"><div class="am-prev-skel-head"></div>' + rows + '</div>';
  }
  var elPrevScrim  = root.querySelector('#am-prev-scrim');
  var elOpenPrev   = root.querySelector('#am-open-prev');
  /* Label + icon are patched here, not left to the markup. The root markup lives in a Bubble HTML
     element the user pasted once; bubble/ask_mira_bubble.html is only the template for a FRESH
     install, so a wording or icon change made there never reaches an existing page. Doing it from
     JS means the CDN pin alone carries the change -- no Bubble-side edit. Idempotent, so a
     re-render or a re-init cannot double-apply it. */
  (function(){
    if (!elOpenPrev) return;
    var full = elOpenPrev.querySelector('.am-prev-label-full');
    if (full) full.textContent = 'All Chats';
    var ic = elOpenPrev.querySelector('.am-ic');
    // feather message-circle (round). The square message-square is the one the composer uses.
    if (ic) ic.innerHTML = '<path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />';
  })();
  var elClosePrev  = root.querySelector('#am-close-prev');
  var elNewChat    = root.querySelector('#am-new-chat');
  var elHlBtn      = root.querySelector('#am-settings-btn');
  var elHlPanel    = root.querySelector('#am-hl-settings-panel');
  var elDdBrand    = root.querySelector('#am-dd-brand');
  var elDdCitation = root.querySelector('#am-dd-citation');
  var elDdResponse = root.querySelector('#am-dd-response');

  var MIRA_SRC = "https://tgdossbsevnonssyuewp.supabase.co/storage/v1/object/public/BRANDSTYLES/Mira.svg";

  /* ---------------- State ---------------- */
  window.askMiraState = window.askMiraState || {
    activeChatId: null,
    titlePending: false,
    answerDetail: 'balanced',
    model: 'pro',
    chatLoading: false,
    isLoading: false,
    messages: [],
    previousChats: [],
    projects: [],
    topics: [],
    collapsed: { projects: false, recents: false },
    collapsedProjects: {},
    market: null,
    models: {},
    favicons: [],
    brandLogos: [],
    currentTool: '',
    toolState: '',
    settings: { brand: 'logo', citation: 'icon', response: 'logo' }
  };
  var S = window.askMiraState;
  if (!S.settings) S.settings = { brand: 'logo', citation: 'icon', response: 'logo' };
  if (!S.settings.response) S.settings.response = 'logo';
  if (!S.models) S.models = {};
  if (!S.favicons) S.favicons = [];
  if (!S.brandLogos) S.brandLogos = [];
  var feedbackMap = {};   // message_id -> 'up' | 'down'
  var exportPendingMap = {};   // message_id -> true while a PDF export is running
  var USER_CLAMP = 450;        // max chars shown for a long user message before truncation (desktop)
  var USER_CLAMP_MOBILE = 225; // mobile: about half
  function _userClamp(){ return root.getBoundingClientRect().width <= 720 ? USER_CLAMP_MOBILE : USER_CLAMP; }
  var userExpandedMap = {};    // user message_id -> true when expanded to full length

  /* ---------------- Localization (DE for German market, else EN) ---------------- */
  var STR = {
    en: {
      placeholder: 'Ask Mira...',
      suggested: [
        'What is hurting our visibility?',
        'Which sources should we improve first?',
        'Why are competitors mentioned more often?',
        'Show me negative responses.',
        'What changed in the last 30 days?'
      ],
      loading: [
        'Getting started…',
        'Preparing your answer…',
        'Gathering the context…',
        'Looking through your workspace…',
        'Pulling together what we need…',
        'Setting things up…',
        'Warming up the analysis…'
      ],
      tryAsking: 'Try asking',
      galleryLabel: 'Explore categories',
      greetings: [
        'How can I help you today?',
        'What would you like to know?',
        'Where should we look first?',
        'What can I dig into for you?'
      ],
      urlVisit: 'Visit',
      urlDetail: 'Open detail page',
      oppAdd: 'Add as opportunity',
      oppAdding: 'Adding\u2026',
      oppAdded: 'Added',
      oppExists: 'Already added',
      oppError: 'Couldn\u2019t add the opportunity. Please try again.',
      runNow: 'Working for', runDone: 'Worked for', thoughtMoment: 'Thought for a moment',
      galleryBack: 'All categories',
      gallery: [
        { name: 'Optimization & Growth', subs: [
          { name: 'Best starting points', prompts: [
            'What should I optimize first to improve my AI Visibility?',
            'Where is the biggest missed opportunity for my Brand?',
            'What would you focus on this week if you wanted the fastest AI Visibility improvement?',
            'Which opportunity should become our first task?'
          ]}
        ]},
        { name: 'Visibility & Competitors', subs: [
          { name: 'Brand performance', prompts: [
            'How visible is my Brand compared to competitors?',
            'Which competitors improved the most recently?'
          ]},
          { name: 'Competitive gaps', prompts: [
            'Why are competitors mentioned more often than us?',
            'In which Topics do competitors appear while we are missing?',
            'Which Topics are strong for us and should be protected?'
          ]}
        ]},
        { name: 'Sources, Citations & URLs', subs: [
          { name: 'Cited sources', prompts: [
            'Which URLs matter most for our AI Visibility?',
            'Which sources are most important in our priority Topics?',
            'Which Domains should we try to get listed on?',
            'Which UGC / Community sources should we monitor or improve presence on?'
          ]},
          { name: 'URL deep dives', prompts: [
            'Which URLs help competitors appear in Responses?',
            'What is happening on this URL?'
          ]}
        ]},
        { name: 'Responses & Sentiment', subs: [
          { name: 'Tone of voice', prompts: [
            'What positive things are said about my Brand?',
            'Which Claims should we reinforce in our content?',
            'What negative things are said about my Brand?'
          ]},
          { name: 'Source tracing', prompts: [
            'Where might negative claims about our Brand come from?'
          ]}
        ]},
        { name: 'Reporting', reporting: true, desc: 'Full reports on your AI visibility', reports: [
          { icon: 'fileText', label: 'Full Report', desc: 'Visibility, competitors, sources & sentiment in one', prompt: 'Create one comprehensive, presentation-ready AI visibility report for {TIMEFRAME}. Cover our overall visibility and share of voice versus competitors, our strongest and weakest topics, the sources and domains driving our mentions (and where we are missing), a short sentiment read, and our single biggest win and biggest risk. Use clear sections, concrete numbers and a 3-bullet executive takeaway.' },
          { icon: 'trend', label: 'What Changed', desc: 'Biggest moves & new mentions vs. the prior period', prompt: 'Show what changed in our AI visibility over {TIMEFRAME} versus the prior period. Surface the biggest movers (topics, competitors and sources that gained or lost ground), any new brands or mentions that appeared, and anything that needs attention. End with a short "so what" and 2-3 concrete actions based on the changes.' },
          { icon: 'smile', label: 'Sentiment Report', desc: 'How AI describes and frames our brand', prompt: 'Create a sentiment and perception report for {TIMEFRAME}. Summarise overall sentiment and its trend, the positive themes and claims worth amplifying, the negative or risky themes and where they seem to originate, and concrete actions to improve how AI describes us. Keep it structured and quotable.' },
          { icon: 'recommendation', label: 'Action Plan', desc: 'Prioritised opportunities & next steps', prompt: 'Turn our AI visibility data for {TIMEFRAME} into a prioritised action plan. List the 5 highest-leverage opportunities (the prompts, topics and sources that would move our share of voice the most), each with the expected impact and one concrete next step. Order them by impact so we know exactly where to start.' }
        ]}
      ]
    },
    de: {
      placeholder: 'Frag Mira...',
      suggested: [
        'Was schadet unserer Sichtbarkeit?',
        'Welche Quellen sollten wir zuerst verbessern?',
        'Warum werden Wettbewerber häufiger genannt?',
        'Zeig mir negative Antworten.',
        'Was hat sich in den letzten 30 Tagen geändert?'
      ],
      loading: [
        'Geht los…',
        'Bereite deine Antwort vor…',
        'Hole den Kontext zusammen…',
        'Sehe mich in deinem Workspace um…',
        'Stelle alles bereit…',
        'Bereite die Analyse vor…',
        'Lege los…'
      ],
      tryAsking: 'Probier mal',
      galleryLabel: 'Kategorien entdecken',
      greetings: [
        'Wie kann ich dir helfen?',
        'Was möchtest du wissen?',
        'Wo sollen wir zuerst hinschauen?',
        'Was soll ich für dich analysieren?'
      ],
      urlVisit: 'Besuchen',
      urlDetail: 'Detailseite öffnen',
      oppAdd: 'Als Opportunity hinzufügen',
      oppAdding: 'Wird hinzugefügt\u2026',
      oppAdded: 'Hinzugefügt',
      oppExists: 'Bereits hinzugefügt',
      oppError: 'Opportunity konnte nicht hinzugefügt werden. Bitte erneut versuchen.',
      runNow: 'Arbeitet seit', runDone: 'Gearbeitet', thoughtMoment: 'Kurz nachgedacht',
      galleryBack: 'Alle Kategorien',
      gallery: [
        { name: 'Optimierung & Wachstum', subs: [
          { name: 'Beste Startpunkte', prompts: [
            'Was sollte ich zuerst optimieren, um meine AI-Visibility zu verbessern?',
            'Wo liegt die größte verpasste Chance für meine Marke?',
            'Worauf würdest du dich diese Woche konzentrieren, um die AI-Visibility am schnellsten zu verbessern?',
            'Welche Opportunity sollte unsere erste Aufgabe werden?'
          ]}
        ]},
        { name: 'Visibility & Wettbewerber', subs: [
          { name: 'Marken-Performance', prompts: [
            'Wie sichtbar ist meine Marke im Vergleich zu Wettbewerbern?',
            'Welche Wettbewerber haben sich zuletzt am stärksten verbessert?'
          ]},
          { name: 'Wettbewerbslücken', prompts: [
            'Warum werden Wettbewerber häufiger erwähnt als wir?',
            'In welchen Themen tauchen Wettbewerber auf, während wir fehlen?',
            'Welche Themen sind stark für uns und sollten geschützt werden?'
          ]}
        ]},
        { name: 'Quellen, Citations & URLs', subs: [
          { name: 'Zitierte Quellen', prompts: [
            'Welche URLs sind für unsere AI-Visibility am wichtigsten?',
            'Welche Quellen sind in unseren Prioritäts-Themen am wichtigsten?',
            'Auf welchen Domains sollten wir versuchen, gelistet zu werden?',
            'Welche UGC-/Community-Quellen sollten wir beobachten oder dort unsere Präsenz verbessern?'
          ]},
          { name: 'URL-Deep-Dives', prompts: [
            'Welche URLs helfen Wettbewerbern, in Responses zu erscheinen?',
            'Was passiert auf dieser URL?'
          ]}
        ]},
        { name: 'Responses & Sentiment', subs: [
          { name: 'Tonalität', prompts: [
            'Was wird Positives über meine Marke gesagt?',
            'Welche Claims sollten wir in unseren Inhalten verstärken?',
            'Was wird Negatives über meine Marke gesagt?'
          ]},
          { name: 'Quellen-Tracing', prompts: [
            'Woher könnten negative Aussagen über unsere Marke stammen?'
          ]}
        ]},
        { name: 'Reporting', reporting: true, desc: 'Ausführliche Reports zu deiner KI-Sichtbarkeit', reports: [
          { icon: 'fileText', label: 'Vollständiger Report', desc: 'Sichtbarkeit, Wettbewerber, Quellen & Sentiment in einem', prompt: 'Erstelle einen umfassenden, präsentationsfertigen KI-Sichtbarkeits-Report für {TIMEFRAME}. Behandle unsere Gesamt-Sichtbarkeit und unseren Share of Voice gegenüber Wettbewerbern, unsere stärksten und schwächsten Themen, die Quellen und Domains, die unsere Nennungen treiben (und wo wir fehlen), eine kurze Sentiment-Einschätzung sowie unseren größten Erfolg und unser größtes Risiko. Klare Abschnitte, konkrete Zahlen und ein Executive-Takeaway in 3 Bullets.' },
          { icon: 'trend', label: 'Was sich geändert hat', desc: 'Größte Bewegungen & neue Nennungen ggü. Vorperiode', prompt: 'Zeige, was sich an unserer KI-Sichtbarkeit über {TIMEFRAME} gegenüber der Vorperiode verändert hat. Hebe die größten Bewegungen hervor (Themen, Wettbewerber und Quellen, die zugelegt oder verloren haben), neue Marken oder Nennungen, die aufgetaucht sind, und alles, was Aufmerksamkeit braucht. Schließe mit einem kurzen "Was bedeutet das?" und 2-3 konkreten Maßnahmen.' },
          { icon: 'smile', label: 'Sentiment-Report', desc: 'Wie KI unsere Marke beschreibt und einordnet', prompt: 'Erstelle einen Sentiment- und Wahrnehmungs-Report für {TIMEFRAME}. Fasse das Gesamt-Sentiment und seinen Trend zusammen, die positiven Themen und Aussagen zum Verstärken, die negativen oder riskanten Themen samt vermuteter Herkunft sowie konkrete Maßnahmen, um die KI-Wahrnehmung zu verbessern. Strukturiert und zitierfähig.' },
          { icon: 'recommendation', label: 'Action Plan', desc: 'Priorisierte Chancen & nächste Schritte', prompt: 'Mach aus unseren KI-Sichtbarkeitsdaten für {TIMEFRAME} einen priorisierten Action Plan. Liste die 5 wirkungsvollsten Chancen (die Prompts, Themen und Quellen, die unseren Share of Voice am meisten heben würden), jeweils mit erwarteter Wirkung und einem konkreten nächsten Schritt. Sortiere nach Wirkung, damit klar ist, wo wir anfangen.' }
        ]}
      ]
    }
  };
  var SUGG_ICONS = [ICON.trend, ICON.source, ICON.competitor, ICON.smile, ICON.clock];
  var GALLERY_ICONS = [
    '<svg viewBox="0 0 24 24"><path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/></svg>',
    '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>',
    '<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /> <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>',
    '<svg viewBox="0 0 24 24"><path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" /></svg>',
    '<svg viewBox="0 0 24 24"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" /></svg>'
  ];

  var lang = 'en';
  function L(){ return STR[lang] || STR.en; }
  function resolveLang(){ lang = (String(S.market||'').toLowerCase() === 'de') ? 'de' : 'en'; }
  /* EINE Schreibweise fuer jede Dauer in dieser Komponente: die Uhr des Arbeitsprotokolls, die
     Denkzeile und die Zeile ueber alten Antworten. Vorher stand ueber einer geladenen Antwort
     "Nachgedacht fuer 2 Minuten 58 Sekunden" und ueber einer frischen "Gearbeitet 2m 58s".
     Die Sekunden fallen auch bei Minuten NIE weg -- sonst liest sich 3m wie gerundet. */
  function runDauer(ms){
    var s = Math.max(0, Math.round(Number(ms) / 1000));
    if (s < 60) return s + 's';
    return Math.floor(s / 60) + 'm ' + (s % 60) + 's';
  }
  function formatThought(ms){
    return (lang === 'de' ? 'Nachgedacht ' : 'Thought for ') + runDauer(ms);
  }
  function thoughtHtml(m, role, isLast){
    if (role !== 'assistant' || !isLast) return '';
    /* Gibt es aus DIESER Sitzung ein fertiges Arbeitsprotokoll, steht es statt der einzelnen Zeile
       ueber der Antwort. Nur wenn der Lauf vorbei ist -- solange er laeuft, gehoert der Block in die
       Ladezeile darunter, sonst stuende er zweimal im Verlauf. Der Platzhalter wird nach dem
       innerHTML gefuellt: die Logos brauchen echte Elemente (Fehlerbehandlung am Bild). */
    if (!RUN.live && RUN.valid && RUN.steps.length){ _runEmitted = true; return '<div class="am-run"></div>'; }
    var raw = m.latency_ms;
    if (raw == null && m.metadata && typeof m.metadata === 'object') raw = m.metadata.latency_ms;
    var ms = (typeof raw === 'number') ? raw : parseFloat(String(raw == null ? '' : raw).replace(',', '.').replace(/[^0-9.]/g, ''));
    if (!isFinite(ms) || ms <= 0) return '';
    /* Ohne Protokoll (Neuladen, alter Chat) steht dieselbe Uhr da wie mit -- gleiche Schrift,
       gleiche Farbe, gleicher Wortlaut, nur ohne Trennlinie und ohne Schritte. */
    return '<div class="am-run is-bare"><div class="am-run-head"><span class="am-run-clock">' +
           esc(L().runDone + ' ' + runDauer(ms)) + '</span></div></div>';
  }

  /* ---------------- Helpers ---------------- */
  function esc(v){ var d = document.createElement('div'); d.textContent = String(v==null?'':v); return d.innerHTML; }

  /* HTML sanitizer: rebuilds a clean tree from a strict whitelist.
     -> No <script>/<style>/<iframe>, no inline event handlers, no javascript: URLs. */
  var ALLOWED = {
    P:[], BR:[], STRONG:[], B:[], EM:[], I:[], U:[], SPAN:['data-mira-sentiment','data-mira-source-signal','data-mira-entity-type','data-mira-evidence-id','data-mira-entity-id','data-mira-entity-key','data-mira-entity-url','data-mira-domain','data-mira-action','data-mira-action-id','data-mira-lead-url','data-mira-title','data-mira-reason','data-mira-prompt-id','data-mira-prompt-run-id','data-mira-company-id'], CODE:[], PRE:[],
    H3:[], H4:[], UL:[], OL:[], LI:[], A:['href'], BLOCKQUOTE:[],
    TABLE:[], THEAD:[], TBODY:[], TR:[], TH:['colspan','rowspan'], TD:['colspan','rowspan']
  };
  function sanitizeInto(src, dest, doc){
    var nodes = src.childNodes, i;
    for (i = 0; i < nodes.length; i++){
      var child = nodes[i];
      if (child.nodeType === 3){ dest.appendChild(doc.createTextNode(child.nodeValue)); continue; }
      if (child.nodeType !== 1) continue;
      var tag = child.tagName.toUpperCase();
      if (!ALLOWED[tag]) {
        if (tag === 'DIV' && child.hasAttribute('data-mira-opportunity')){
          var ph = doc.createElement('div');                                   // keep opportunity-card placeholder as an empty marker
          ph.setAttribute('data-mira-opportunity', child.getAttribute('data-mira-opportunity'));
          dest.appendChild(ph); continue;
        }
        sanitizeInto(child, dest, doc); continue;
      } // unwrap unknown, keep text
      var el = doc.createElement(tag.toLowerCase());
      ALLOWED[tag].forEach(function(attr){
        if (!child.hasAttribute(attr)) return;
        var v = child.getAttribute(attr);
        if (attr === 'href'){ var lv = v.trim().toLowerCase(); if (lv.indexOf('javascript:')===0 || lv.indexOf('vbscript:')===0 || lv.indexOf('data:')===0) return; }
        if (attr === 'data-mira-sentiment'){ if (v !== 'positive' && v !== 'negative') return; }
        if (attr === 'data-mira-source-signal'){ if (v === 'true' || v === 'likely') v = 'likely'; else if (v !== 'unclear') return; }
        if (attr === 'data-mira-lead-url' || attr === 'data-mira-entity-url'){ var lu = v.trim().toLowerCase(); if (lu.indexOf('javascript:')===0 || lu.indexOf('vbscript:')===0) return; }
        el.setAttribute(attr, v);
      });
      if (tag === 'A'){ el.setAttribute('target','_blank'); el.setAttribute('rel','noopener noreferrer'); }
      sanitizeInto(child, el, doc);
      dest.appendChild(el);
    }
  }
  // Strip a matched pair of surrounding quotes from a table cell (used for quoted prompts).
  function stripCellQuotes(cell){
    var t = (cell.textContent || '').replace(/^\s+|\s+$/g, '');
    if (t.length < 2) return;
    var OPEN = '[\\u0022\\u201C\\u201D\\u201E\\u00AB]';   // "  “  ”  „  «
    var CLOSE = '[\\u0022\\u201C\\u201D\\u00BB]';          // "  “  ”  »
    var openRe = new RegExp('^' + OPEN), closeRe = new RegExp(CLOSE + '$');
    if (!(openRe.test(t) && closeRe.test(t))) return;
    var leadRe = new RegExp('^\\s*' + OPEN + '\\s*'), trailRe = new RegExp('\\s*' + CLOSE + '\\s*$');
    var walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT, null);
    var first = null, last = null, n;
    while ((n = walker.nextNode())){ if (/\S/.test(n.nodeValue)){ if (!first) first = n; last = n; } }
    if (!first) return;
    if (first === last){
      first.nodeValue = first.nodeValue.replace(leadRe, '').replace(trailRe, '');
    } else {
      first.nodeValue = first.nodeValue.replace(leadRe, '');
      last.nodeValue = last.nodeValue.replace(trailRe, '');
    }
  }
  function sanitizeHtml(dirty){
    try {
      var s = String(dirty == null ? '' : dirty);
      // Repair double-escaped markup: attributes arriving as  =\"value\"  instead of  ="value"
      // (happens when content_html gets JSON-encoded twice upstream). No-op for clean HTML.
      if (s.indexOf('=\\"') !== -1) s = s.replace(/\\"/g, '"');
      var parsed = new DOMParser().parseFromString('<body>'+s+'</body>', 'text/html');
      var out = document.createElement('div');
      sanitizeInto(parsed.body, out, document);
      // wrap tables for horizontal scroll
      out.querySelectorAll('table').forEach(function(t){
        if (t.parentNode && t.parentNode.classList && t.parentNode.classList.contains('am-table-scroll')) return;
        var w = document.createElement('div'); w.className = 'am-table-scroll';
        t.parentNode.insertBefore(w, t); w.appendChild(t);
      });
      // In table cells, prompts often arrive wrapped in quotes ("...") which then wrap onto their
      // own lines. Strip a matched pair of surrounding quotes (+ the whitespace around them).
      out.querySelectorAll('td').forEach(stripCellQuotes);
      return out.innerHTML;
    } catch(e){ return esc(dirty); }
  }

  function relTime(value){
    if (!value) return '';
    var d = new Date(value); if (isNaN(d.getTime())) return String(value);
    var diff = (Date.now() - d.getTime())/1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff/60)+'m ago';
    if (diff < 86400) return Math.floor(diff/3600)+'h ago';
    if (diff < 604800) return Math.floor(diff/86400)+'d ago';
    try { return new Intl.DateTimeFormat(undefined,{month:'short',day:'2-digit'}).format(d); } catch(e){ return String(value); }
  }

  function scrollToBottom(smooth){
    requestAnimationFrame(function(){ elChat.scrollTo({ top: elChat.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }); });
  }
  // Scroll behaviour for the next render: 'newmsg' = align start of last message at top
  // (used when a NEW message arrives); 'bottom' = scroll fully down (used when loading a chat).
  var _scrollMode = 'newmsg';
  // Timestamp when the user sends; used to measure "thinking" time client-side
  // as a fallback when the live answer payload doesn't carry latency_ms yet.
  var _sendStartTs = 0;
  var _pendingAnswer = false; // true while a running/streaming assistant answer is still awaited
  var _lastSendTs = 0;        // when the user last sent — a recent send means a live session (keep the chat)
  var _unknownChatTimer = null;
  // Show a "jump to latest" button (like ChatGPT/Claude) when scrolled up from the bottom.
  var elScrollBottom = root.querySelector('#am-scroll-bottom');
  function updateScrollBtn(){
    if (!elScrollBottom) return;
    var hasMsgs = root.classList.contains('has-messages');
    var distFromBottom = elChat.scrollHeight - elChat.scrollTop - elChat.clientHeight;
    var show = hasMsgs && distFromBottom > 120;
    elScrollBottom.classList.toggle('is-visible', show);
    if (!show && typeof _clearNewBadge === 'function') _clearNewBadge();   // back in view -> clear "new" badge
  }
  if (elScrollBottom) elScrollBottom.addEventListener('click', function(){
    if (_holdRelease) _holdRelease();                                  // cancel any active position-hold
    var hadNew = elScrollBottom.classList.contains('has-new');
    if (hadNew && _scrollToNewMsgStart()){                             // unread answer -> go to ITS start, not the bottom
      _clearNewBadge();
      return;
    }
    _clearNewBadge();
    _followCapTop = -1;                                               // user explicitly wants the very bottom
    scrollToBottom(true);
    if (_typingActive && typeof _startStick === 'function') _startStick();
  });
  elChat.addEventListener('scroll', updateScrollBtn, { passive: true });
  /* Gedrosselt: der Handler liest scrollHeight, scrollTop und clientHeight und schreibt danach
     eine Klasse -- an jedem Bild einer Ziehbewegung ist das ein erzwungenes Layout. Am Ende der
     Bewegung reicht es; beim Scrollen (der eigentliche Anlass) laeuft er unveraendert weiter. */
  amAufResize(updateScrollBtn, { hoehe: true });
  // Action buttons (Create / Confirm) — delegate on root so it works for messages rendered
  // either by this component (messageHtml) OR injected into the DOM elsewhere (Bubble) + askMiraSetExtras.
  root.addEventListener('click', function(e){
    var actBtn = e.target.closest ? e.target.closest('.am-opp-action') : null;
    if (!actBtn) return;
    e.preventDefault(); e.stopPropagation();
    var action = null; try { action = JSON.parse(actBtn.getAttribute('data-action')); } catch(err){ action = null; }
    if (action) _emitMiraAction(action, actBtn);
  });
  // Opportunity card status dropdown
  function closeAllStatus(except){
    root.querySelectorAll('.uo-status.is-open').forEach(function(s){
      if (s !== except){ s.classList.remove('is-open'); var b=s.querySelector('.uo-status-btn'); if (b) b.setAttribute('aria-expanded','false'); }
    });
  }
  function toggleStatus(st){
    if (!st) return;
    var open = st.classList.contains('is-open');
    closeAllStatus(st);
    st.classList.toggle('is-open', !open);
    var b = st.querySelector('.uo-status-btn'); if (b) b.setAttribute('aria-expanded', (!open) ? 'true' : 'false');
  }
  function emitMoveStatus(oid, newStatus, oldStatus){
    var payload = { opportunity_id: oid, recommendation_id: oid, status: newStatus, previous_status: oldStatus };
    if (typeof window.bubble_fn_ask_mira_move_opportunity_status === 'function') window.bubble_fn_ask_mira_move_opportunity_status(JSON.stringify(payload));
    else { window.dispatchEvent(new CustomEvent('askmira:opportunity-move-status', { detail: payload })); console.log('Ask Mira move opportunity status:', payload); }
  }
  function applyStatus(opt){
    var st = opt.closest('.uo-status'); if (!st) return;
    var newKey = opt.getAttribute('data-status'), oldKey = st.getAttribute('data-status');
    var meta = OPP_STATUS_MAP[newKey]; if (!meta || newKey === oldKey){ st.classList.remove('is-open'); return; }
    var oldMeta = OPP_STATUS_MAP[oldKey];
    // optimistic UI: reflect the new status on the card immediately, no refresh
    st.setAttribute('data-status', newKey);
    var dot = st.querySelector('.uo-status-btn .uo-status-dot'); if (dot) dot.style.setProperty('--uo-stat', meta.color);
    var lab = st.querySelector('.uo-status-label'); if (lab) lab.textContent = meta.label;
    var menu = st.querySelector('.uo-status-menu'); if (menu) menu.innerHTML = statusOptionsHtml(newKey);
    st.classList.remove('is-open');
    var b = st.querySelector('.uo-status-btn'); if (b) b.setAttribute('aria-expanded','false');
    emitMoveStatus(st.getAttribute('data-oid'), meta.label, oldMeta ? oldMeta.label : oldKey);   // send the exact DB status label
  }
  root.addEventListener('click', function(e){
    if (!e.target.closest) return;
    var opt = e.target.closest('.uo-status-opt');
    if (opt){ e.preventDefault(); e.stopPropagation(); applyStatus(opt); return; }
    var btn = e.target.closest('.uo-status-btn');
    if (btn){ e.preventDefault(); e.stopPropagation(); toggleStatus(btn.closest('.uo-status')); return; }
    closeAllStatus(null);
  });
  document.addEventListener('click', function(e){ if (!root.contains(e.target)) closeAllStatus(null); });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeAllStatus(null); });
  // "Show more" / "Show less" toggle for a collapsed run of 4+ consecutive cards
  root.addEventListener('click', function(e){
    var sm = e.target.closest ? e.target.closest('.am-opp-showmore') : null;
    if (!sm) return;
    e.preventDefault();
    var run = sm.closest('.am-opp-run'); if (!run) return;
    var collapsed = run.classList.toggle('is-collapsed');
    var rest = run.querySelector('.am-opp-run-rest');
    sm.textContent = _showMoreLabel(rest ? rest.children.length : 0, !collapsed);
  });
  // List row <-> full card: click a row to unfold its card; click the card to fold it back
  root.addEventListener('click', function(e){
    if (!e.target.closest) return;
    if (e.target.closest('.uo-status')) return;   // status dropdown handles its own clicks (never folds the card)
    var row = e.target.closest('.am-opp-item .uo-row');
    if (row){
      var it = row.closest('.am-opp-item');
      if (it){
        var scope = it.closest('.am-opps') || root;
        scope.querySelectorAll('.am-opp-item:not(.is-collapsed)').forEach(function(o){ if (o !== it) o.classList.add('is-collapsed'); });   // only one open at a time
        it.classList.remove('is-collapsed');
      }
      return;
    }
    var card = e.target.closest('.am-opp-item .uo-card');
    if (card){
      if (window.getSelection && String(window.getSelection()).length > 0) return;   // don't fold while selecting text
      var it2 = card.closest('.am-opp-item'); if (it2) it2.classList.add('is-collapsed');
    }
  });
  // Wheel bridge: scrolling vertically while hovering a wide table should scroll the chat,
  // not get swallowed by the table's horizontal scroll container.
  root.addEventListener('wheel', function(e){
    var ts = e.target && e.target.closest ? e.target.closest('.am-table-scroll') : null;
    if (!ts) return;
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // genuine horizontal scroll -> leave to table
    var before = elChat.scrollTop;
    elChat.scrollTop = before + e.deltaY;
    if (elChat.scrollTop !== before){ e.preventDefault(); }
  }, { passive: false, capture: true });
  // Robust chat scrolling: some embeds (Bubble) let a hovered child — brand chips, opportunity
  // card text/date/url — swallow the wheel so the chat won't scroll. Bridge EVERY wheel over the
  // chat straight to elChat itself, so it always scrolls regardless of what's under the cursor.
  // On Windows (steppy mouse wheels) we ease it; Mac/trackpads already glide, so keep them instant.
  var _isWin = /Win/i.test(navigator.platform || '') || /Windows/i.test(navigator.userAgent || '');
  var _smTarget = 0, _smAnim = false, _smPrev = -1, _smFrames = 0;
  function _smStep(){
    var max = elChat.scrollHeight - elChat.clientHeight; if (max < 0) max = 0;
    if (_smTarget > max) _smTarget = max; if (_smTarget < 0) _smTarget = 0;
    var cur = elChat.scrollTop, diff = _smTarget - cur;
    // finished, stuck by sub-pixel rounding (no progress), or safety cap -> snap & stop
    if (Math.abs(diff) < 1 || cur === _smPrev || ++_smFrames > 240){
      elChat.scrollTop = _smTarget; _smAnim = false; _smPrev = -1; _smFrames = 0; return;
    }
    _smPrev = cur;
    elChat.scrollTop = cur + diff * 0.22;
    requestAnimationFrame(_smStep);
  }
  elChat.addEventListener('mousedown', function(e){ if (e.button === 1) { _smAnim = false; } });   // middle-click autoscroll: don't fight it
  elChat.addEventListener('wheel', function(e){
    if (e.ctrlKey) return;                                                            // pinch-zoom
    if (e.target && e.target.closest && e.target.closest('.am-table-scroll')) return; // tables: handled by the capture bridge above
    if (elChat.scrollHeight <= elChat.clientHeight) return;                           // nothing to scroll
    var dy = e.deltaY * (e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? elChat.clientHeight : 1));
    if (!dy) return;
    var atTop = elChat.scrollTop <= 0;
    var atBottom = elChat.scrollTop + elChat.clientHeight >= elChat.scrollHeight - 1;
    if ((dy < 0 && atTop) || (dy > 0 && atBottom)) return;                            // let the page scroll past the edges
    if (_isWin){
      if (!_smAnim) _smTarget = elChat.scrollTop;                                     // start fresh from current position
      _smTarget = Math.max(0, Math.min(elChat.scrollHeight - elChat.clientHeight, _smTarget + dy));
      e.preventDefault();
      if (!_smAnim){ _smAnim = true; _smPrev = -1; _smFrames = 0; requestAnimationFrame(_smStep); }
    } else {
      elChat.scrollTop += dy;
      e.preventDefault();
    }
  }, { passive: false });
  // Scroll so the START of the newest message sits at the top of the chat (ChatGPT-style),
  // clamped by the browser so short messages just settle at max scroll.
  function scrollNewMessageTop(smooth){
    requestAnimationFrame(function(){
      var msgs = elMessages.querySelectorAll('.am-msg:not(.am-msg-loading):not(.am-msg-run)');
      var last = msgs.length ? msgs[msgs.length - 1] : (elMessages.lastElementChild || null);
      if (!last){ elChat.scrollTo({ top: elChat.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }); return; }
      var top = last.getBoundingClientRect().top - elChat.getBoundingClientRect().top + elChat.scrollTop - 12;
      elChat.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' });
    });
  }
  // On send: immediately (no animation) put the new user message near the top and RESERVE the space
  // below it, so the loading state — and later the taller tool loader — land in their final position
  // right away and never need a second scroll.
  function _pinSendScroll(){
    requestAnimationFrame(function(){
      var msgs = elMessages.querySelectorAll('.am-msg:not(.am-msg-loading):not(.am-msg-run)');
      var last = msgs.length ? msgs[msgs.length - 1] : null;
      if (!last){ elMessages.style.minHeight = ''; elChat.scrollTo({ top: elChat.scrollHeight, behavior: 'auto' }); return; }
      elMessages.style.minHeight = '';                                   // reset before measuring
      var chatTop = elChat.getBoundingClientRect().top;
      var msgTopInContent = last.getBoundingClientRect().top - chatTop + elChat.scrollTop;
      var msgH = last.getBoundingClientRect().height;
      var GAP = 38, LOADER_RESERVE = 196;                                // Platz fuer Uhr + rund fuenf Schrittzeilen
      // pin the new message to the middle of the screen — but not so low that a tall loader would be clipped
      var fitCap = elChat.clientHeight - msgH - GAP - LOADER_RESERVE;
      var offset = Math.min(elChat.clientHeight * 0.5, Math.max(0, fitCap));
      var desired = Math.max(0, msgTopInContent - offset);
      var ld = elMessages.querySelector('.am-msg-loading');
      var reserveExtra = Math.max(0, LOADER_RESERVE - (ld ? ld.getBoundingClientRect().height : 0));  // hold height for the loader growing in
      var deficit = (desired + elChat.clientHeight) - elChat.scrollHeight + reserveExtra;
      if (deficit > 0){ elMessages.style.minHeight = (elMessages.getBoundingClientRect().height + deficit) + 'px'; }
      elChat.scrollTo({ top: desired, behavior: 'auto' });               // instant -> already at the final position
    });
  }

  /* ---------------- Rendering ---------------- */
  function evPill(type, label){
    var def = EVIDENCE[String(type||'').toLowerCase()];
    var color = def ? def.color : '#6b7280';
    var icon = def ? def.icon : ICON.flag;
    var ic = icon.replace('<svg ', '<svg class="am-ev-ic" ');
    var text = label || (def ? def.label : (type || 'Info'));
    return '<span class="am-ev-pill" style="--am-ev-color:'+esc(color)+';">'+ic+'<span>'+esc(text)+'</span></span>';
  }
  function evidenceHtml(m, extraTypes){
    if (!m || typeof m !== 'object') return '';
    var types = [];
    var simple = asArrayLoose(m.evidence);
    if (simple.length){
      simple.forEach(function(ev){ types.push(typeof ev === 'string' ? ev : (ev && ev.type) || ''); });
    } else {
      asArrayLoose(m.evidence_items).forEach(function(it){ if (it && it.type) types.push(it.type); });
      if (!types.length && m.metadata && Array.isArray(m.metadata.evidence)) m.metadata.evidence.forEach(function(ev){ types.push(typeof ev==='string'?ev:(ev&&ev.type)||''); });
    }
    // additive: types of pool-linked entities that were actually mentioned in this message's text
    (extraTypes || []).forEach(function(t){ types.push(t); });
    var seen = {}, uniq = [];
    types.forEach(function(t){ t = String(t||'').toLowerCase(); if (!t || seen[t]) return; seen[t] = 1; uniq.push(t); });
    if (!uniq.length) return '';
    var pills = uniq.map(function(t){ return evPill(t, ''); }).join('');
    return '<div class="am-evidence" data-explain="evidence">'+pills+'</div>';
  }

  function actionsHtml(m, role){
    var copyBtn = '<button class="am-act-btn" type="button" data-act="copy" aria-label="Copy" data-tip="Copy">'+ICON.copy+'</button>';
    if (role === 'user') return '<div class="am-msg-actions">'+copyBtn+'</div>';
    var exporting = !!exportPendingMap[m.id];
    var exportBtn = '<button class="am-act-btn'+(exporting?' is-exporting':'')+'" type="button" data-act="export" aria-label="Export to PDF" data-tip="Export to PDF"'+(exporting?' disabled':'')+'>'+(exporting?'<span class="am-act-spinner" aria-hidden="true"></span>':ICON.download)+'</button>';
    var fb = feedbackMap[m.id] || '';
    var up = '<button class="am-act-btn'+(fb==='up'?' is-active':'')+'" type="button" data-act="up" aria-label="Good response" data-tip="Good response">'+ICON.thumbsUp+'</button>';
    var down = '<button class="am-act-btn'+(fb==='down'?' is-active':'')+'" type="button" data-act="down" aria-label="Bad response" data-tip="Bad response">'+ICON.thumbsDown+'</button>';
    return '<div class="am-msg-actions">'+exportBtn+copyBtn+up+down+'</div>';
  }

  /* ---- Inline brand/source logos: prepend a small logo before each evidence mention ---- */
  /* data:image ist ausdruecklich erlaubt, und zwar nur diese Typen. Grund: ein Aufrufer darf ein
     erzeugtes Logo mitgeben, ohne es irgendwo hochzuladen -- die Hero-Sektion der Landingpage tut
     genau das, ihre Markenzeichen sind erzeugte SVG. Vorher fiel jede solche Adresse still durch
     und die Chips standen ohne Logo da.
     Sicher ist es, weil die Adresse ausschliesslich in einem <img src> landet: ein SVG im
     Bildkontext fuehrt kein Skript aus und laedt nichts nach. Alles andere -- javascript:, data:
     mit fremdem Typ, blob: -- bleibt draussen. */
  function safeImgUrl(u){
    u = String(u||'').trim();
    if (/^\/\//.test(u)) u = 'https:' + u;
    if (/^data:image\/(png|jpe?g|gif|webp|avif|svg\+xml)[;,]/i.test(u)) return u;
    return /^https?:\/\//i.test(u) ? u : '';
  }
  function buildLogoTerms(items, raw){
    var terms = [];
    asArrayLoose(items).forEach(function(it){
      if (!it || typeof it !== 'object') return;
      var logo = safeImgUrl(it.icon_url) || safeImgUrl(it.favicon_url);
      if (!logo) return;
      var meta = { id: it.id || '', entity_id: it.entity_id || '', action: it.action || '', type: it.type || '', title: it.title || it.company_name || '', entity_key: it.entity_key || '', entity_url: it.entity_url || '', url: it.url || '', domain: it.domain || '' };
      var t = String(it.type || '').toLowerCase();
      var fields;  // [value, priority]  — higher priority wins a term collision
      if (t === 'url'){
        // url: full URL / path forms are canonical (prio 3); page title prio 2;
        // the bare DOMAIN (subtitle) is only prio 1 -> a real domain evidence item will own it.
        var stripUrl = function(u){ return String(u||'').trim().replace(/^https?:\/\/(www\.)?/i, ''); };
        var du = stripUrl(it.entity_url), dk = stripUrl(it.entity_key);
        fields = [[it.entity_url,3],[it.entity_key,3],[du,3],[dk,3],[du.replace(/\/+$/,''),3],[dk.replace(/\/+$/,''),3],[it.url,3],
                  [it.company_name,2],[it.title,2],[it.subtitle,1],[it.domain,1]];
      } else if (t === 'domain' || t === 'citation'){
        // domain/citation: the domain string is canonical (prio 3). subtitle = citation-type label -> never.
        fields = [[it.entity_key,3],[it.entity_url,3],[it.url,3],[it.domain,3],[it.company_name,3],[it.title,3]];
      } else {
        // brand/competitor/etc.: the entity name (prio 3).
        fields = [[it.company_name,3],[it.title,3]];
      }
      var seenLocal = {};
      fields.forEach(function(f){
        var term = String(f[0] || '').trim();
        if (term.length < 2) return;
        var k = term.toLowerCase();
        if (seenLocal[k]) return; seenLocal[k] = 1;
        terms.push({ term: term, logo: logo, meta: meta, prio: f[1] });
      });
    });
    if (raw) return terms;
    var best = {}, order = [];
    terms.forEach(function(t){
      var k = t.term.toLowerCase();
      if (!best[k]){ best[k] = t; order.push(k); }
      else if ((t.prio||0) > (best[k].prio||0)){ best[k] = t; }   // higher priority wins the term
    });
    var out = order.map(function(k){ return best[k]; });
    out.sort(function(a,b){ return b.term.length - a.term.length; });
    return out;
  }

  /* ---- Session evidence pool: only the messages currently loaded; never other sessions ---- */
  function buildSessionEvidencePool(){
    var all = [];
    (S.messages || []).forEach(function(m){
      if (!m) return;
      asArrayLoose(m.evidence_items).forEach(function(it){ if (it && typeof it === 'object') all.push(it); });
    });
    return all;
  }
  // Identity = the navigation target. Same target => same entity (not ambiguous, even if listed twice).
  function evIdentity(meta){
    return [meta.type||'', meta.entity_id||'', meta.entity_key||'', meta.action||'', meta.entity_url||'', meta.url||'', meta.domain||''].join('|');
  }
  // Pool terms that map to EXACTLY ONE entity across the whole session (100% unambiguous).
  function buildUnambiguousPoolTerms(){
    var raw = buildLogoTerms(buildSessionEvidencePool(), true);
    var byTerm = {};
    raw.forEach(function(t){
      var k = t.term.toLowerCase();
      var sig = evIdentity(t.meta);
      if (!byTerm[k]) byTerm[k] = { term: t.term, logo: t.logo, meta: t.meta, sigs: {} };
      byTerm[k].sigs[sig] = 1;
    });
    var out = [];
    Object.keys(byTerm).forEach(function(k){
      var e = byTerm[k];
      if (Object.keys(e.sigs).length === 1) out.push({ term: e.term, logo: e.logo, meta: e.meta, fromPool: true });
    });
    out.sort(function(a,b){ return b.term.length - a.term.length; });
    return out;
  }
  // Per message: own evidence wins; unambiguous pool terms fill the gaps (only entities not already covered).
  function termsForMessage(m, poolTerms){
    var own = buildLogoTerms(m && m.evidence_items);
    if (!poolTerms || !poolTerms.length) return own;
    var ownSet = {};
    own.forEach(function(t){ ownSet[t.term.toLowerCase()] = 1; });
    var extra = poolTerms.filter(function(t){ return !ownSet[t.term.toLowerCase()]; });
    var combined = own.concat(extra);
    combined.sort(function(a,b){ return b.term.length - a.term.length; });
    return combined;
  }
  function isWordChar(ch){ return /[a-z0-9äöüßéèáàâ]/i.test(ch); }
  // Brand/competitor names may ONLY be matched when they stand free:
  // before -> start of text, whitespace, or a period (e.g. "1.Brand").
  // after  -> end of text, whitespace, or normal sentence punctuation ( , . : ; ) ! ? " ).
  // Deliberately NOT allowed as neighbours: URL connectors like - / _ — so a brand name that
  // sits inside a link (".../anfragenfluss-5983055") is never tagged.
  function okStrictBoundary(before, after){
    var beforeOk = ['', '.', '\u2022', '\u00B7', '\u2023', '\u25AA', '\u25E6', '(', '\u201E', '\u201C', '"', '\''];
    var afterOk  = ['', ',', '.', ':', ';', ')', '!', '?', '\u2022', '\u00B7', '\u2023', '\u25AA', '\u25E6', '\u201C', '\u201D', '"', '\''];
    var b = (/\s/.test(before) || beforeOk.indexOf(before) !== -1);
    var a = (/\s/.test(after)  || afterOk.indexOf(after)  !== -1);
    return b && a;
  }
  function logoImgHtml(url){ return '<img class="am-inline-logo" src="'+esc(url)+'" alt="" loading="lazy">'; }
  // model key -> logo url (from askMiraSetModels)
  function _modelLogo(key){
    if (!key || !S.models) return '';
    var m = S.models[String(key).toLowerCase()] || S.models[String(key)];
    return (m && m.logo_url) ? String(m.logo_url) : '';
  }
  // small "response" fallback icon (message bubble), used when no model logo resolves
  var RESP_FALLBACK_SVG = '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  // Decide the marker that precedes a matched entity, based on the current Settings:
  //  brand/competitor -> S.settings.brand  ('logo' | 'icon' | 'none')
  //  url/domain/citation/prompt -> S.settings.citation ('favicon' | 'icon' | 'none')
  //  response -> S.settings.response ('logo' | 'icon' | 'none') — logo = model logo box
  function leadingVisual(type, logoUrl, matched){
    var t = String(type || '').toLowerCase();
    var isBrand = (t === 'brand' || t === 'competitor');
    var isResp  = (t === 'response' || t === 'prompt_run');
    var isCite  = (t === 'url' || t === 'domain' || t === 'citation' || t === 'prompt');
    var mode = isBrand ? (S.settings && S.settings.brand)
             : isResp  ? (S.settings && S.settings.response)
             : isCite  ? (S.settings && S.settings.citation) : 'logo';
    mode = mode || (isBrand ? 'logo' : isResp ? 'logo' : 'icon');
    if (mode === 'none') return null;
    function iconFor(){
      var svg = isBrand ? (t === 'competitor' ? ICON.swords : ICON.copy)
              : (t === 'domain' ? ICON.globe : t === 'prompt' ? ICON.zap : isResp ? ICON.maximize : ICON.link);
      var span = document.createElement('span'); span.className = 'am-inline-ic'; span.innerHTML = svg; return span;
    }
    // Response chips: a small logo box holding the model logo (matches the landing-page component)
    if (isResp){
      if (mode === 'icon') return iconFor();
      var box = document.createElement('span'); box.className = 'am-resp-ic';
      if (logoUrl){
        var rim = document.createElement('img');
        rim.src = logoUrl; rim.alt = '';
        rim.setAttribute('loading','lazy'); rim.setAttribute('referrerpolicy','no-referrer'); rim.setAttribute('draggable','false');
        rim.onerror = function(){ box.innerHTML = RESP_FALLBACK_SVG; };
        box.appendChild(rim);
      } else { box.innerHTML = RESP_FALLBACK_SVG; }
      return box;
    }
    if (mode === 'icon') return iconFor();
    // 'logo' / 'favicon': show the favicon image; if none is available, fall back to the type icon
    if (!logoUrl) return iconFor();
    var img = document.createElement('img');
    img.className = 'am-inline-logo'; img.src = logoUrl; img.alt = '';
    img.setAttribute('loading','lazy'); img.setAttribute('referrerpolicy','no-referrer'); img.setAttribute('draggable','false');
    var monoSrc = String(matched||'').replace(/^https?:\/\/(www\.)?/i, '').trim();
    img.setAttribute('data-mono', (monoSrc || matched || '?').trim().charAt(0).toUpperCase());
    return img;
  }
  function decorateTextNode(node, terms){
    var text = node.nodeValue; if (!text || !/\S/.test(text)) return;
    var lower = text.toLowerCase();
    var frag = document.createDocumentFragment();
    var pos = 0, guard = 0;
    while (pos < text.length && guard++ < 500){
      var best = null;
      for (var i=0;i<terms.length;i++){
        var tl = terms[i].term.toLowerCase();
        var ttype = (terms[i].meta && terms[i].meta.type || '').toLowerCase();
        var strict = (ttype === 'brand' || ttype === 'competitor');
        var idx = lower.indexOf(tl, pos);
        while (idx !== -1){
          var before = idx>0 ? text.charAt(idx-1) : '';
          var after = (idx+tl.length)<text.length ? text.charAt(idx+tl.length) : '';
          var ok = strict ? okStrictBoundary(before, after) : (!isWordChar(before) && !isWordChar(after));
          if (ok) break;   // valid boundary
          idx = lower.indexOf(tl, idx+1);
        }
        if (idx !== -1 && (!best || idx < best.idx)){ best = { idx: idx, len: tl.length, logo: terms[i].logo, meta: terms[i].meta, fromPool: terms[i].fromPool }; }
      }
      if (!best){ frag.appendChild(document.createTextNode(text.slice(pos))); break; }
      if (best.idx > pos) frag.appendChild(document.createTextNode(text.slice(pos, best.idx)));
      var matched = text.slice(best.idx, best.idx + best.len);
      var meta = best.meta || {};
      var wrap = document.createElement('span');
      wrap.className = 'am-logo-wrap';
      if (best.fromPool) wrap.setAttribute('data-from-pool', '1');
      if (meta.entity_id) wrap.setAttribute('data-entity-id', meta.entity_id);
      if (meta.action) wrap.setAttribute('data-action', meta.action);
      if (meta.type) wrap.setAttribute('data-type', meta.type);
      if (meta.id) wrap.setAttribute('data-ev-id', meta.id);
      if (meta.title) wrap.setAttribute('data-title', meta.title);
      if (meta.entity_key) wrap.setAttribute('data-entity-key', meta.entity_key);
      if (meta.entity_url) wrap.setAttribute('data-entity-url', meta.entity_url);
      if (meta.url) wrap.setAttribute('data-url', meta.url);
      if (meta.domain) wrap.setAttribute('data-domain', meta.domain);
      var visual = leadingVisual(meta.type, best.logo, matched);
      if (visual) wrap.appendChild(visual); else wrap.classList.add('is-bare');
      var tspan = document.createElement('span');
      tspan.className = 'am-logo-text'; tspan.textContent = matched;
      wrap.appendChild(tspan);
      frag.appendChild(wrap);
      pos = best.idx + best.len;
    }
    if (frag.childNodes.length) node.parentNode.replaceChild(frag, node);
  }
  function injectLogosTerms(container, terms){
    if (!terms || !terms.length) return;
    var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    var nodes = [], n; while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function(node){ decorateTextNode(node, terms); });
  }

  /* ---- New: explicit entity spans from the formatter (data-mira-*) ----
     The formatter now tags every clear mention; the UI just resolves the matching
     evidence_item by id/entity_id/entity_key/url/domain and styles it like a logo wrap. */
  var ACTION_BY_TYPE = { brand:'open_brand', competitor:'open_competitor', url:'open_url', domain:'open_domain', prompt:'open_prompt', response:'open_response', citation:'open_url' };
  var _ID_FIELDS_BY_TYPE = { prompt: 'prompt_id', response: 'prompt_run_id', prompt_run: 'prompt_run_id',
                             brand: 'company_id', competitor: 'company_id' };
  function resolveEntityItem(items, q, type){
    items = asArrayLoose(items);
    function find(test){ for (var i=0;i<items.length;i++){ if (items[i] && test(items[i])) return items[i]; } return null; }
    var hit = null;
    if (q.evId)  hit = find(function(it){ return it.id && String(it.id) === q.evId; });
    if (!hit && q.entId) hit = find(function(it){ return it.entity_id && String(it.entity_id) === q.entId; });
    // some evidence_items only ever populate the type-specific id field (prompt_id/prompt_run_id/
    // company_id), never the generic entity_id -- match the span's own id against THAT field too,
    // since the span itself always carries the same value in data-mira-entity-id regardless of
    // which backend field it came from.
    if (!hit && q.entId && type){
      var idField = _ID_FIELDS_BY_TYPE[type];
      if (idField) hit = find(function(it){ return it[idField] && String(it[idField]) === q.entId; });
    }
    if (!hit && q.key)   hit = find(function(it){ return it.entity_key && String(it.entity_key) === q.key; });
    if (!hit && q.url)   hit = find(function(it){ return (it.url && String(it.url) === q.url) || (it.entity_url && String(it.entity_url) === q.url); });
    if (!hit && q.domain)hit = find(function(it){ return it.domain && String(it.domain) === q.domain; });
    return hit;
  }
  // The evidence_items payload carries a generic entity_id PLUS type-specific id fields
  // (prompt_id, prompt_run_id, company_id) -- which one is actually populated varies by type
  // (url/domain never get entity_id, only entity_key/entity_url). Try every source in order
  // instead of trusting a single field, so the id Bubble receives on click is never empty just
  // because this particular type used a different field name upstream.
  function _resolvedEntityId(item, q, type){
    if (item.entity_id) return String(item.entity_id);
    var specific = { prompt: item.prompt_id, response: item.prompt_run_id, prompt_run: item.prompt_run_id,
                      brand: item.company_id, competitor: item.company_id }[type];
    if (specific) return String(specific);
    if (q.entId) return q.entId;
    if (item.entity_key) return String(item.entity_key);
    if (q.key) return q.key;
    if (item.entity_url || item.url) return String(item.entity_url || item.url);
    if (q.url) return q.url;
    if (item.domain) return String(item.domain);
    if (q.domain) return q.domain;
    return '';
  }
  function decorateEntitySpans(container, items){
    var spans = container.querySelectorAll('span[data-mira-entity-type]');
    for (var i=0;i<spans.length;i++){
      var span = spans[i];
      var type = String(span.getAttribute('data-mira-entity-type') || '').toLowerCase();
      var q = {
        evId:   span.getAttribute('data-mira-evidence-id') || '',
        entId:  span.getAttribute('data-mira-entity-id') || '',
        key:    span.getAttribute('data-mira-entity-key') || '',
        url:    span.getAttribute('data-mira-entity-url') || '',
        domain: span.getAttribute('data-mira-domain') || ''
      };
      // some builds only put a type-specific id attribute on the span (data-mira-prompt-id /
      // data-mira-prompt-run-id / data-mira-company-id) instead of the generic
      // data-mira-entity-id -- fold it into entId so every lookup below sees it the same way.
      if (!q.entId){
        var _typeAttr = { prompt: 'data-mira-prompt-id', response: 'data-mira-prompt-run-id',
                           prompt_run: 'data-mira-prompt-run-id', brand: 'data-mira-company-id',
                           competitor: 'data-mira-company-id' }[type];
        if (_typeAttr) q.entId = span.getAttribute(_typeAttr) || '';
      }
      var item = resolveEntityItem(items, q, type) || {};
      var text = span.textContent || '';
      var logo = safeImgUrl(item.icon_url) || safeImgUrl(item.favicon_url);
      // response chips: resolve the model logo from the models registry (askMiraSetModels).
      // the model key lives in the evidence item's subtitle, e.g. "chatgpt · 2026-06-12" -> "chatgpt".
      if (type === 'response' || type === 'prompt_run'){
        var _sub = String(item.subtitle || '');
        var mk = _sub ? _sub.split(/\s*[·•|]\s*/)[0].trim() : '';
        if (!mk) mk = item.model || item.model_key || item.provider_key || item.key || item.entity_key || q.key || '';
        var ml = _modelLogo(mk);
        if (ml) logo = ml;
      }
      // data-* the existing open handler expects
      span.classList.add('am-logo-wrap');
      span.setAttribute('data-type', item.type || type);
      span.setAttribute('data-action', item.action || ACTION_BY_TYPE[type] || 'open_evidence');
      var _rid = _resolvedEntityId(item, q, type);
      if (_rid) span.setAttribute('data-entity-id', _rid);
      else if (window.console) console.warn('[AskMira] evidence chip has no resolvable id -- type="'+type+'", text="'+text.slice(0,40)+'". The evidence_items entry is missing entity_id/prompt_id/company_id/entity_key and the span itself carries no data-mira-entity-id either.');
      if (item.id || q.evId) span.setAttribute('data-ev-id', item.id || q.evId);
      if (item.entity_key || q.key) span.setAttribute('data-entity-key', item.entity_key || q.key);
      if (item.entity_url || q.url) span.setAttribute('data-entity-url', item.entity_url || q.url);
      if (item.url || q.url) span.setAttribute('data-url', item.url || q.url);
      if (item.domain || q.domain) span.setAttribute('data-domain', item.domain || q.domain);
      span.setAttribute('data-title', item.title || item.company_name || text);
      // wrap the text + prepend the marker (logo / icon / none per Settings)
      var tspan = document.createElement('span'); tspan.className = 'am-logo-text'; tspan.textContent = text;
      span.textContent = '';
      var visual = leadingVisual(item.type || type, logo, text);
      if (visual) span.appendChild(visual); else span.classList.add('is-bare');
      span.appendChild(tspan);
    }
  }

  /* ===== Opportunities + Action buttons in assistant messages =====
     opportunities -> cards rendered with the Opportunities page's own styling/fields.
     actions       -> buttons that emit a JS event carrying the full action (type/action_key/payload). */
  var _OPP_MONTHS = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  var _OPP_REC_ICON = {
    create_matching_content: '<polyline points="16 3 21 3 21 8"/><line x1="10" y1="14" x2="21" y2="3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/>',
    build_presence: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>',
    get_listed: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r="1.2"/><circle cx="3.5" cy="12" r="1.2"/><circle cx="3.5" cy="18" r="1.2"/>',
    improve_existing_content: '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>'
  };
  var _OPP_CITE = { Brand_Platform:'Brand Platforms', UGC_Community:'UGC / Community', Competition:'Competition', Editorial:'Editorial', Institutional:'Institutional', Knowledge_Base:'Knowledge Base', You:'Your Content' };
  var _OPP_CITE_COLOR = { Editorial:'#14b8a6', UGC_Community:'#0ea5e9', Knowledge_Base:'#6366f1', Brand_Platform:'#d946ef', Institutional:'#64748b', Competition:'#f97316', You:'#f43f5e' };
  var _OPP_STAT_COLOR = { pending:'#9ca3af', in_progress:'#2384E2', done:'#15803d', ignored:'#b4451f' };
  // the four canonical statuses a card can move between (label = exact DB status value)
  var OPP_STATUSES = [
    { key:'pending',     label:'Created',     color:'#9ca3af' },
    { key:'in_progress', label:'In Progress', color:'#2384E2' },
    { key:'done',        label:'Done',        color:'#15803d' },
    { key:'ignored',     label:'Ignored',     color:'#b4451f' }
  ];
  var OPP_STATUS_MAP = {}; OPP_STATUSES.forEach(function(s){ OPP_STATUS_MAP[s.key] = s; });
  function statusOptionsHtml(currentKey){
    return OPP_STATUSES.filter(function(s){ return s.key !== currentKey; }).map(function(s){
      return '<button class="uo-status-opt" type="button" data-status="'+s.key+'"><span class="uo-status-dot" style="--uo-stat:'+s.color+';"></span><span>'+esc(s.label)+'</span></button>';
    }).join('');
  }
  function statusControlHtml(item){
    var key = _oppStatusKey(item.status);
    var meta = OPP_STATUS_MAP[key] || OPP_STATUSES[0];
    return '<div class="uo-status" data-status="'+key+'" data-oid="'+_escAttr(item.id)+'">'+
      '<button class="uo-status-btn" type="button" aria-haspopup="true" aria-expanded="false" title="Change status">'+
        '<span class="uo-status-dot" style="--uo-stat:'+meta.color+';"></span>'+
        '<span class="uo-status-label">'+esc(meta.label)+'</span>'+
        '<svg class="uo-status-chev" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg>'+
      '</button>'+
      '<div class="uo-status-menu" role="menu">'+statusOptionsHtml(key)+'</div>'+
    '</div>';
  }
  function _oppRecIcon(t){ return _OPP_REC_ICON[t] || _OPP_REC_ICON.get_listed; }
  function _oppCitePretty(c){ return _OPP_CITE[c] || String(c||'').replace(/_/g,' '); }
  function _oppCiteColor(c){ return _OPP_CITE_COLOR[c] || '#6f737c'; }
  function _oppStatusKey(s){ s = String(s||'').toLowerCase(); if (s.indexOf('progress')>=0) return 'in_progress'; if (s==='done'||s==='completed') return 'done'; if (s==='ignored') return 'ignored'; return 'pending'; }
  function _oppStatusLabel(s){ return (String(s||'').toLowerCase()==='created') ? 'Pending' : String(s||''); }   // value stays "Created"; only the label says "Pending"
  function _oppTagPills(topics, limit){   // 1:1 reuse of the Opportunities module chip rendering
    var list = Array.isArray(topics) ? topics : [];
    var shown = limit ? list.slice(0, limit) : list;
    var hidden = list.length - shown.length;
    var html = shown.map(function(t){
      t = t || {};
      var color = t.hex_light || t.hex_dark || '#6b7280';
      return '<span class="uo-tag" style="--uo-tag:'+_escAttr(color)+';">'+(t.emoji?'<span class="uo-tag-emoji">'+esc(t.emoji)+'</span>':'')+'<span>'+esc(t.name||'')+'</span></span>';
    }).join('');
    if (hidden > 0) html += '<span class="uo-tag-more">+'+hidden+'</span>';
    return html;
  }
  function _oppFmtDate(iso){ if(!iso) return ''; var d=new Date(iso); if(isNaN(d.getTime())) return String(iso); return d.getDate()+'. '+_OPP_MONTHS[d.getMonth()]+' '+d.getFullYear(); }
  function _oppPct(v){ var n=Number(v); if(!isFinite(n)) return '–'; return (Math.round(n*100)/100)+'%'; }
  function _oppPotLevel(item){ var l=String(item.priority_label||'').toLowerCase(); if(l==='high')return 4; if(l==='medium')return 3; if(l==='low')return 2; var s=Number(item.priority_score)||0; return s>=75?4:s>=50?3:s>=25?2:1; }
  function _oppPot(item){ var lvl=_oppPotLevel(item), bars=''; for(var i=1;i<=4;i++) bars+='<span class="uo-pot-bar p'+i+(i<=lvl?' is-on':'')+'"></span>'; return '<span class="uo-pot"><span class="uo-pot-bars">'+bars+'</span></span>'; }
  function _oppFav(url, name, cls){
    var initials = String(name||'?').trim().charAt(0).toUpperCase() || '?'; var c = cls || 'uo-fav';
    url = String(url||'').trim(); if (!/^https?:\/\//i.test(url)) url = '';
    if (!url) return '<span class="uo-fav-fb '+c+'" style="display:inline-flex;">'+esc(initials)+'</span>';
    return '<img class="'+c+'" src="'+esc(url)+'" alt="" referrerpolicy="no-referrer" loading="lazy" onerror="this.style.display=\'none\';if(this.nextElementSibling)this.nextElementSibling.style.display=\'inline-flex\';">'+
           '<span class="uo-fav-fb '+c+'">'+esc(initials)+'</span>';
  }
  function _escAttr(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function _oppKpi(label, val){ return '<div class="uo-kpi"><div class="uo-kpi-label">'+label+'</div><div class="uo-kpi-val">'+val+'</div></div>'; }
  function _oppMeta(k, v){ return '<div class="uo-meta-item"><span class="uo-meta-k">'+k+'</span><span class="uo-meta-v">'+v+'</span></div>'; }

  function oppCardHtml(item){
    if (!item || typeof item !== 'object') return '';
    var trendUp = Number(item.trend_pct) >= 0;
    var gapNeg  = Number(item.gap) < 0;
    var arrowUp   = '<svg viewBox="0 0 24 24"><path d="M7 7h10v10" /> <path d="M7 17 17 7" /></svg>';
    var arrowDown = '<svg viewBox="0 0 24 24"><path d="m7 7 10 10" /> <path d="M17 7v10H7" /></svg>';
    var comps = asArrayLoose(item.mentioned_competitors);
    var compTotal = Number(item.competitor_count); if (!isFinite(compTotal)) compTotal = comps.length;
    var compMore = compTotal - comps.length;
    var statusPill = item.status ? statusControlHtml(item) : '';

    var meta = '<div class="uo-meta-grid">'+
      _oppMeta('Market', esc(item.market||'–'))+
      _oppMeta('Priority', esc(item.priority_label||'–')+(item.priority_score!=null?' · '+(Math.round((Number(item.priority_score)||0)*10)/10):''))+
      (item.effective_citation_type ? _oppMeta('Citation Type', '<span class="uo-cite" style="--uo-cite:'+_oppCiteColor(item.effective_citation_type)+';">'+esc(_oppCitePretty(item.effective_citation_type))+'</span>') : '')+
      (item.created_at ? _oppMeta('Created', esc(_oppFmtDate(item.created_at))) : '')+
    '</div>';

    var topics = asArrayLoose(item.topics);
    var topicsHtml = topics.length ? '<div class="uo-tags">'+_oppTagPills(topics)+'</div>' : '';

    /* Gedeckelt auf drei, wie in opportunities.js. Die Chips brechen um, also waechst die Liste
       bei vielen Wettbewerbern in immer neue Reihen und schiebt die aufgeklappte Karte im Chat
       ueber ihren Rand hinaus -- genau der abgeschnittene Zustand, den man dann sieht. Versteckt
       wird per Klasse statt per slice, damit der Zaehler den Rest ohne Neuaufbau nachreichen
       kann. Klick liegt auf elMessages, siehe dort. */
    var vorne = 3;
    var lokal = Math.max(0, comps.length - vorne);
    var gesamtMehr = lokal + Math.max(0, compMore);
    var chip = !gesamtMehr ? ''
      : lokal
        ? '<button type="button" class="uo-comp-more" data-comp-expand data-comp-rest="'+Math.max(0, compMore)+'">+'+gesamtMehr+' more</button>'
        : '<span class="uo-comp-more">+'+gesamtMehr+' more</span>';

    var compList = comps.length ? '<div class="uo-sec">Mentioned competitors</div><div class="uo-comp-list'+(lokal ? ' is-capped' : '')+'">'+
      comps.map(function(c){ c = c || {}; return '<span class="uo-comp">'+_oppFav(c.favicon_url, c.name)+'<span class="uo-comp-name">'+esc(c.name||'')+'</span></span>'; }).join('')+
      chip+'</div>' : '';

    return '<div class="uo-card am-opp-card">'+
      '<div class="uo-card-top">'+
        '<span class="uo-eyebrow"><svg viewBox="0 0 24 24">'+_oppRecIcon(item.recommendation_type)+'</svg><span>'+esc(item.label||'')+'</span></span>'+
        '<span class="uo-card-topright">'+statusPill+_oppPot(item)+'</span>'+
      '</div>'+
      '<h3 class="uo-card-title">'+esc(item.headline||'')+'</h3>'+
      (item.reason ? '<p class="uo-card-reason">'+esc(item.reason)+'</p>' : '')+
      '<div class="uo-source">'+_oppFav(item.lead_favicon, item.lead_domain)+
        '<div class="uo-source-meta"><span class="uo-source-title">'+esc(item.lead_title||'')+'</span><span class="uo-source-domain">'+esc(item.lead_domain||'')+'</span></div>'+
      '</div>'+
      topicsHtml+
      '<div class="uo-sec">Details</div>'+meta+
      compList+
    '</div>';
  }
  function oppRowHtml(item){   // compact list-mode row (1:1 with the Opportunities list view), the default collapsed view
    if (!item || typeof item !== 'object') return '';
    var topics = asArrayLoose(item.topics);
    return '<div class="uo-row">'+
      '<div class="uo-row-main">'+
        '<span class="uo-row-title">'+esc(item.headline||'')+'</span>'+
        '<span class="uo-row-sub">'+_oppFav(item.lead_favicon, item.lead_domain)+'<span class="uo-row-domain">'+esc(item.lead_domain||'')+'</span><span class="uo-dot-sep"></span><span class="uo-row-domain">'+esc(_oppFmtDate(item.created_at))+'</span></span>'+
      '</div>'+
      '<div class="uo-row-right">'+
        (topics.length ? '<span class="uo-row-tags">'+_oppTagPills(topics, 2)+'</span>' : '')+
        _oppPot(item)+
      '</div>'+
    '</div>';
  }
  function oppItemHtml(item){   // collapsed row + the full card that unfolds on click
    if (!item || typeof item !== 'object') return '';
    return '<div class="am-opp-item is-collapsed" data-id="'+_escAttr(item.id)+'">'+
      oppRowHtml(item)+
      '<div class="am-opp-card-wrap">'+oppCardHtml(item)+'</div>'+
    '</div>';
  }
  function _msgOpps(m){ var o = asArrayLoose(m && m.opportunities); if (!o.length && m && m.metadata) o = asArrayLoose(m.metadata.opportunities); return o; }
  function _msgActs(m){ var a = asArrayLoose(m && m.actions);       if (!a.length && m && m.metadata) a = asArrayLoose(m.metadata.actions);       return a; }
  function _showMoreLabel(n, expanded){ return expanded ? 'Show less' : ('Show '+n+' more'); }
  // Mount opportunity cards at their <div data-mira-opportunity="ID"></div> placeholders inside `container`.
  // Cards land exactly where Mira placed them in content_html — interleaved with the prose, not a block.
  // A run of 4+ back-to-back placeholders (no text between) collapses to the first 3 + a "Show more" toggle.
  function mountInlineCards(container, m){
    if (!container || !container.querySelectorAll) return false;
    var phs = container.querySelectorAll('[data-mira-opportunity]');
    if (!phs.length) return false;
    var byId = {}; _msgOpps(m).forEach(function(o){ if (o && o.id != null) byId[String(o.id)] = o; });
    var list = Array.prototype.slice.call(phs);
    // group consecutive placeholder siblings (only whitespace between them) into runs
    var runs = [], cur = null;
    list.forEach(function(el){
      var adj = false;
      if (cur){
        var last = cur[cur.length-1];
        if (last.parentNode && last.parentNode === el.parentNode){
          adj = true;
          var n = last.nextSibling;
          while (n && n !== el){
            if (n.nodeType === 1){ adj = false; break; }
            if (n.nodeType === 3 && n.nodeValue && n.nodeValue.trim() !== ''){ adj = false; break; }
            n = n.nextSibling;
          }
        }
      }
      if (adj) cur.push(el); else { cur = [el]; runs.push(cur); }
    });
    runs.forEach(function(run){
      var cards = [];
      run.forEach(function(ph){ var o = byId[String(ph.getAttribute('data-mira-opportunity'))]; if (o) cards.push(o); });
      var first = run[0], parent = first.parentNode;
      if (cards.length && parent){
        var wrap = document.createElement('div'); wrap.className = 'am-opps';
        if (cards.length >= 4){
          wrap.className += ' am-opp-run is-collapsed';
          var head = cards.slice(0,3), rest = cards.slice(3);
          wrap.innerHTML = head.map(oppItemHtml).join('')+
            '<div class="am-opp-run-rest">'+rest.map(oppItemHtml).join('')+'</div>'+
            '<button class="am-opp-showmore" type="button">'+_showMoreLabel(rest.length, false)+'</button>';
        } else {
          wrap.innerHTML = cards.map(oppItemHtml).join('');
        }
        parent.insertBefore(wrap, first);
      }
      run.forEach(function(ph){ if (ph.parentNode) ph.parentNode.removeChild(ph); });   // consume the placeholders
    });
    return true;
  }
  function oppsBlockHtml(m){
    var opps = _msgOpps(m);
    if (!opps.length) return '';
    return '<div class="am-opps">'+opps.map(oppCardHtml).join('')+'</div>';
  }
  function actionButtonsHtml(m){
    // Action buttons are rendered EXCLUSIVELY inline from content_html (data-mira-action spans).
    // The message-level `actions` array is kept for persistence/history but is no longer rendered
    // as a separate button under the message / citation chips.
    return '';
  }
  function _legacyActionButtonsHtml(m){
    var acts = _msgActs(m);
    if (!acts.length) return '';
    acts = acts.slice().sort(function(a,b){ return (Number(a&&a.sort_order)||0) - (Number(b&&b.sort_order)||0); });
    var btns = acts.map(function(a){
      if (!a || typeof a !== 'object') return '';
      var json; try { json = JSON.stringify(a); } catch(e){ json = '{}'; }
      return '<button class="am-cta am-opp-action" type="button" data-action="'+_escAttr(json)+'">'+esc(a.label||'Action')+'</button>';
    }).join('');
    return btns ? '<div class="am-msg-buttons">'+btns+'</div>' : '';
  }
  // emit a JS event carrying the FULL action (type, action_key, payload) — Bubble fn + DOM CustomEvent
  function _emitMiraAction(action, btn){
    var payloadJson; try { payloadJson = JSON.stringify(action); } catch(e){ payloadJson = ''; }
    var fnName = (typeof window.askMiraActionFn === 'string' && window.askMiraActionFn) ? window.askMiraActionFn : 'bubble_fn_miraAction';
    try { if (typeof window[fnName] === 'function') window[fnName](payloadJson); } catch(e){}   // Bubble JavaScript-to-Bubble element
    try {
      (btn || root).dispatchEvent(new CustomEvent('mira-action', { detail: action, bubbles: true }));  // bubbles up to document — listen on root OR document, fires once
    } catch(e){}
  }

  /* Turn full-bold lines into visual headings (no <h*> tags). Rules:
     - the very first line of the message, if the WHOLE line is bold -> +2.5px (am-mh1)
     - any other standalone line (line breaks / block boundaries before AND after) that is
       entirely bold -> +1.5px (am-mh2)
     - never inside tables. */
  // Merge consecutive same-type lists (ol/ol or ul/ul separated only by whitespace).
  // Mira occasionally emits each item as its own <ol>, which would restart at "1." every time.
  function mergeAdjacentLists(container){
    ['ol', 'ul'].forEach(function(tag){
      Array.prototype.slice.call(container.querySelectorAll(tag)).forEach(function(list){
        if (!list.parentNode) return;                    // already merged into a previous run
        var next = list.nextSibling;
        while (next){
          if (next.nodeType === 3 && !/\S/.test(next.nodeValue)){ next = next.nextSibling; continue; }   // skip whitespace
          if (next.nodeType === 1 && next.tagName && next.tagName.toLowerCase() === tag){
            while (next.firstChild) list.appendChild(next.firstChild);
            var gone = next; next = next.nextSibling; if (gone.parentNode) gone.parentNode.removeChild(gone);
            continue;
          }
          break;                                          // different element -> keep it a separate list
        }
      });
    });
  }

  // ===== "Add as opportunity": inline span -> button -> (on success) the normal opportunity card =====
  var _oppcState = {};   // action_id -> { status:'loading'|'created'|'exists', rec? }  (kept across re-renders in this session)
  /* Diese beiden Konstanten werden ausgewertet, sobald der Block durchlaufen wird -- und genau
     dort meldet die Konsole in der echten App "UC is not defined". Lokal ist der Fall nicht
     reproduzierbar (UC liegt eine Ebene hoeher im selben Scope), also steht die Geometrie hier
     direkt statt ueber das Kit: dieselben Feather-Pfade, die UC.icon("plus")/("check") liefert,
     nur ohne Abhaengigkeit an einer Stelle, die nachweislich faellt. */
  var OPPC_PLUS  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
                   'stroke-linecap="round" stroke-linejoin="round">' +
                   '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  var OPPC_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
                   'stroke-linecap="round" stroke-linejoin="round">' +
                   '<polyline points="20 6 9 17 4 12"/></svg>';
  var OPPC_SPIN  = '<svg class="am-oppc-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.2-8.6"/></svg>';
  function _oppcApplyState(btn, state){
    var lab = btn.querySelector('.am-oppc-label'), ic = btn.querySelector('.am-oppc-ic');
    btn.classList.remove('is-loading', 'is-exists');
    if (state === 'loading'){ btn.classList.add('is-loading'); btn.disabled = true; if (ic) ic.innerHTML = OPPC_SPIN; if (lab) lab.textContent = L().oppAdding; }
    else if (state === 'exists'){ btn.classList.add('is-exists'); btn.disabled = true; if (ic) ic.innerHTML = OPPC_CHECK; if (lab) lab.textContent = L().oppExists; }
    else { btn.disabled = false; if (ic) ic.innerHTML = OPPC_PLUS; if (lab) lab.textContent = L().oppAdd; }
  }
  function _oppcMakeButton(aid, url, title, reason){
    var btn = document.createElement('button');
    btn.className = 'am-oppc-btn'; btn.type = 'button';
    if (aid) btn.setAttribute('data-mira-action-id', aid);
    btn.setAttribute('data-mira-lead-url', url);
    if (title != null) btn.setAttribute('data-mira-title', title);
    if (reason != null) btn.setAttribute('data-mira-reason', reason);
    btn.innerHTML = '<span class="am-oppc-ic">'+OPPC_PLUS+'</span><span class="am-oppc-label">'+esc(L().oppAdd)+'</span>';
    return btn;
  }
  function _oppcHasContent(p){ return !!(p && (p.textContent.trim() || p.querySelector('img,a,strong,em,table,ul,ol,button,.am-logo-wrap,.am-oppc-btn'))); }
  function _oppcOnlyNode(p, node){
    if (!p) return false;
    var kids = Array.prototype.slice.call(p.childNodes).filter(function(n){
      if (n.nodeType === 3 && !/\S/.test(n.nodeValue)) return false;
      if (n.nodeType === 1 && n.classList && n.classList.contains('am-oppc-br')) return false;
      return true;
    });
    return kids.length === 1 && kids[0] === node;
  }
  // render the SAME collapsible card, placed EXACTLY where the span/button was (no leftover gap / jump)
  function _oppcPlaceCard(node, rec){
    var wrap = document.createElement('div'); wrap.className = 'am-opps am-opps-inline';
    try { wrap.innerHTML = oppItemHtml(rec); } catch(e){ if (node.parentNode) node.parentNode.removeChild(node); return null; }
    var p = node.closest ? node.closest('p') : null;
    if (p && p.parentNode && _oppcOnlyNode(p, node)){
      p.parentNode.replaceChild(wrap, p);                       // the paragraph only held it -> card lands in place
    } else {
      var anchor = (p && p.parentNode) ? p : node;
      anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
      if (node.parentNode) node.parentNode.removeChild(node);
    }
    return wrap;
  }
  function mountOpportunityActions(container){
    Array.prototype.slice.call(container.querySelectorAll('span[data-mira-action="create_opportunity"]')).forEach(function(span){
      var aid = span.getAttribute('data-mira-action-id') || '';
      var url = span.getAttribute('data-mira-lead-url') || '';
      if (!url) return;   // nothing to create against
      var st = aid ? _oppcState[aid] : null;
      if (st && st.rec){
        // already created/exists this session -> show the card directly (no button)
        var w = _oppcPlaceCard(span, st.rec);
        if (w){ w.classList.add('is-in'); return; }
      }
      var btn = _oppcMakeButton(aid, url, span.getAttribute('data-mira-title'), span.getAttribute('data-mira-reason'));
      span.parentNode.replaceChild(btn, span);
      var obr = document.createElement('br'); obr.className = 'am-oppc-br';
      var obr2 = document.createElement('br'); obr2.className = 'am-oppc-br';   // one extra line break after each add button
      if (btn.parentNode){ btn.parentNode.insertBefore(obr, btn.nextSibling); btn.parentNode.insertBefore(obr2, obr.nextSibling); }
      if (st && st.status === 'loading') _oppcApplyState(btn, 'loading');
    });
  }
  function _oppcButtons(aid){ return Array.prototype.slice.call(root.querySelectorAll('.am-oppc-btn')).filter(function(b){ return (b.getAttribute('data-mira-action-id') || '') === aid; }); }
  function _oppcToast(msg){
    var el = root.querySelector('.am-toast');
    if (!el){ el = document.createElement('div'); el.className = 'am-toast'; root.appendChild(el); }
    el.textContent = msg; el.classList.add('is-on');
    clearTimeout(el._t); el._t = setTimeout(function(){ el.classList.remove('is-on'); }, 4000);
  }
  // success: quick check pulse, then the button is replaced in-place by the real card (which fades in)
  function _oppcSwapToCard(btn, rec){
    var ic = btn.querySelector('.am-oppc-ic'), lab = btn.querySelector('.am-oppc-label');
    btn.disabled = true; btn.classList.remove('is-loading'); btn.classList.add('is-done', 'is-confirm');
    if (ic) ic.innerHTML = OPPC_CHECK; if (lab) lab.textContent = L().oppAdded;
    setTimeout(function(){
      if (!btn.parentNode) return;
      var w = _oppcPlaceCard(btn, rec);          // removes the button + drops the empty <p> in the same frame -> no leftover gap
      if (w) requestAnimationFrame(function(){ w.classList.add('is-in'); });
    }, 560);
  }
  // click -> disable + loading, hand off to Bubble (adds team_id/user_id and calls the RPC)
  elMessages.addEventListener('click', function(e){
    /* Wettbewerber-Zaehler aufklappen. Steht vor dem Aktions-Button, weil beide in derselben
       Karte liegen und ein Zaehler nie eine Opportunity anlegen soll. */
    var mehr = e.target.closest ? e.target.closest('[data-comp-expand]') : null;
    if (mehr){
      var liste = mehr.closest('.uo-comp-list');
      if (liste) liste.classList.remove('is-capped');
      var rest = Number(mehr.getAttribute('data-comp-rest')) || 0;
      if (!rest){ mehr.remove(); return; }
      /* Was der Server gar nicht mitgeschickt hat, bleibt als reiner Text stehen -- den Zaehler
         ersatzlos zu entfernen wuerde die Liste als vollstaendig ausgeben. */
      var bleibt = document.createElement('span');
      bleibt.className = 'uo-comp-more';
      bleibt.textContent = '+' + rest + ' more';
      mehr.parentNode.replaceChild(bleibt, mehr);
      return;
    }

    var btn = e.target.closest ? e.target.closest('.am-oppc-btn') : null;
    if (!btn || btn.disabled) return;
    var aid = btn.getAttribute('data-mira-action-id') || '';
    var payload = { action_id: aid, lead_url: btn.getAttribute('data-mira-lead-url') || '' };
    var t = btn.getAttribute('data-mira-title');  if (t != null) payload.title = t;
    var r = btn.getAttribute('data-mira-reason'); if (r != null) payload.reason = r;
    if (aid) _oppcState[aid] = { status: 'loading' };
    _oppcApplyState(btn, 'loading');
    if (typeof window.bubble_fn_ask_mira_create_opportunity === 'function') window.bubble_fn_ask_mira_create_opportunity(JSON.stringify(payload));
    else { window.dispatchEvent(new CustomEvent('askmira:create-opportunity', { detail: payload })); console.log('Ask Mira create opportunity:', payload); }
  });
  // Bubble reports the RPC result: { action_id, status, recommendation, error }.
  // Created OR AlreadyExists (with a recommendation) -> show the normal opportunity card.
  window.askMiraOpportunityResult = function(res){
    if (typeof res === 'string'){ var pj = looseJsonParse(res); if (pj == null){ console.warn('[AskMira] askMiraOpportunityResult: could not parse payload'); return; } res = pj; }
    res = res || {};
    var aid = res.action_id || (res.recommendation && res.recommendation.action_id) || '';
    var status = String(res.status || '');
    var rec = res.recommendation || null;
    var btns = aid ? _oppcButtons(aid) : [];
    if ((status === 'Created' || status === 'AlreadyExists') && rec){
      if (aid) _oppcState[aid] = { status: (status === 'Created' ? 'created' : 'exists'), rec: rec };
      if (btns.length) btns.forEach(function(b){ _oppcSwapToCard(b, rec); });
      if (status === 'Created'){
        if (typeof window.bubble_fn_ask_mira_opportunity_created === 'function'){ try { window.bubble_fn_ask_mira_opportunity_created(JSON.stringify(rec)); } catch(_){} }
        window.dispatchEvent(new CustomEvent('askmira:opportunity-created', { detail: { recommendation: rec } }));
      }
    } else if (status === 'AlreadyExists'){          // exists but no card returned -> just mark it added
      if (aid) _oppcState[aid] = { status: 'exists' };
      btns.forEach(function(b){ _oppcApplyState(b, 'exists'); });
    } else {                                          // Error / Complete / unexpected
      if (aid) delete _oppcState[aid];
      btns.forEach(function(b){ _oppcApplyState(b, null); });   // re-enable so the user can retry
      _oppcToast(res.error || L().oppError);
    }
  };

  function promoteStrongHeadings(root){
    if (!root) return;
    var BOLD = { strong: 1, b: 1 };
    // a br-delimited segment (array of sibling nodes) is a full-bold line if it has real
    // text and every non-whitespace node is a <strong>/<b>
    function segIsFullBold(nodes){
      var hasBold = false;
      for (var i=0;i<nodes.length;i++){
        var n = nodes[i];
        if (n.nodeType === 3){ if (n.textContent.trim()) return false; continue; } // stray text -> not full bold
        if (n.nodeType === 1){
          var t = n.tagName.toLowerCase();
          if (t === 'br') continue;
          if (!BOLD[t]) return false;
          if (n.textContent.trim()) hasBold = true;
        }
      }
      return hasBold;
    }
    function wrapSegment(nodes, cls, block, brNode){
      var span = document.createElement('span');
      span.className = cls;
      for (var i=0;i<nodes.length;i++) span.appendChild(nodes[i]);
      if (cls === 'am-mh2') block.insertBefore(document.createElement('br'), brNode || null); // extra line break above sub-headings
      block.insertBefore(span, brNode || null);
    }
    var lineIndex = 0; // counts non-empty lines across the whole message, in order
    function processBlock(block){
      var segs = [], cur = [];
      var kids = Array.prototype.slice.call(block.childNodes);
      for (var i=0;i<kids.length;i++){
        var n = kids[i];
        if (n.nodeType === 1 && n.tagName.toLowerCase() === 'br'){ segs.push({ nodes: cur, br: n }); cur = []; }
        else cur.push(n);
      }
      segs.push({ nodes: cur, br: null });
      for (var s=0;s<segs.length;s++){
        var nodes = segs[s].nodes, text = '';
        for (var j=0;j<nodes.length;j++) text += (nodes[j].textContent || '');
        if (!text.trim()) continue;              // blank line: ignore (don't advance index)
        var idx = lineIndex++;
        if (!segIsFullBold(nodes)) continue;
        wrapSegment(nodes, idx === 0 ? 'am-mh1' : 'am-mh2', block, segs[s].br);
      }
    }
    (function walk(node){
      var kids = Array.prototype.slice.call(node.childNodes);
      for (var i=0;i<kids.length;i++){
        var c = kids[i];
        if (c.nodeType !== 1) continue;
        var t = c.tagName.toLowerCase();
        if (t === 'table') continue;             // never touch tables
        if (t === 'p' || t === 'li' || t === 'blockquote') processBlock(c);
        else if (t === 'ul' || t === 'ol' || t === 'div' || t === 'section') walk(c);
      }
    })(root);
  }
  function messageHtml(m, poolTerms, isLastAsst){
    var role = (m.role === 'user') ? 'user' : 'assistant';
    var body, poolTypes = [];
    if (role === 'assistant' && m.content_html){
      var tmp = document.createElement('div');
      tmp.innerHTML = sanitizeHtml(m.content_html);
      var terms = termsForMessage(m, poolTerms);
      var hasEntitySpans = tmp.querySelector('span[data-mira-entity-type]');
      if (hasEntitySpans){
        decorateEntitySpans(tmp, m.evidence_items);   // new explicit-span path
      } else {
        injectLogosTerms(tmp, terms);                  // legacy text-matching fallback
        var pw = tmp.querySelectorAll('.am-logo-wrap[data-from-pool]');
        for (var i=0;i<pw.length;i++){ var ty = pw[i].getAttribute('data-type'); if (ty) poolTypes.push(ty); }
      }
      mountInlineCards(tmp, m);                         // place opportunity cards at their placeholders (inline)
      promoteStrongHeadings(tmp);                        // full-bold lines -> visual headings
      mergeAdjacentLists(tmp);                           // Mira sometimes emits several separate <ol> in a row -> keep one running 1,2,3…
      mountOpportunityActions(tmp);                       // turn "create_opportunity" spans into action buttons
      body = tmp.innerHTML;
    } else {
      var raw = String(m.content == null ? '' : m.content);
      if (role === 'user' && m.pending_voice && !raw){
        body = '<div class="am-user-skel" aria-label="Transcribing voice message">'
             +   '<span class="am-user-skel-line" style="width:72%"></span>'
             +   '<span class="am-user-skel-line" style="width:46%"></span>'
             + '</div>';
      } else if (role === 'user' && raw.length > _userClamp()){
        var _uc = _userClamp();
        var uExpanded = !!userExpandedMap[m.id];
        var shortHtml = esc(raw.slice(0, _uc).replace(/\s+$/, '')).replace(/\n/g, '<br>');
        var fullHtml  = esc(raw).replace(/\n/g, '<br>');
        body = '<div class="am-user-body'+(uExpanded ? '' : ' is-clamped')+'">'+
                 '<p class="am-user-p am-user-p-short">'+shortHtml+'…</p>'+
                 '<p class="am-user-p am-user-p-full">'+fullHtml+'</p>'+
                 '<button class="am-user-more" type="button" data-act="user-more">'+(uExpanded ? 'Weniger anzeigen' : 'Mehr anzeigen')+'</button>'+
               '</div>';
      } else {
        body = '<p>'+esc(raw).replace(/\n/g, '<br>')+'</p>';
      }
    }
    var ev = (role === 'assistant') ? evidenceHtml(m, poolTypes) : '';
    var extras = (role === 'assistant') ? actionButtonsHtml(m) : '';   // cards now render inline inside body
    /* Der Kopf wird vor dem Rahmen gebaut: traegt die Nachricht das Arbeitsprotokoll, faehrt sie
       NICHT nochmal ein (amMsgIn). Sonst spraenge der Block beim Wechsel von der Ladezeile zur
       Antwort ein Stueck, obwohl er an derselben Stelle stehen bleiben soll. */
    var kopf = thoughtHtml(m, role, isLastAsst);
    var mitRun = (kopf.indexOf('am-run') >= 0) ? ' has-run' : '';
    return '<div class="am-msg is-'+role+mitRun+'" data-id="'+esc(m.id||'')+'">'+
           '<div class="am-msg-main">'+kopf+'<div class="am-bubble">'+body+ev+extras+'</div>'+actionsHtml(m, role)+'</div></div>';
  }

  /* ---- typing reveal for brand-new answers (same feel & speed as the landing-page showcase) ---- */
  var _prevMsgKeys = [];
  var _prevLoading = false;
  var _typedKeys = Object.create(null);
  var _forceTypeNext = false;
  var _forceTimer = null;
  var _typingActive = false;
  function _msgKey(m){
    if (!m) return '';
    if (m.id) return 'id:' + m.id;
    return (m.role || '?') + ':' + ((m.content_html || m.content || '') + '').length + ':' + (m.created_at || '');
  }
  function _prepTyping(bub){
    var units = [];
    function isChip(el){ return el.matches('.am-logo-wrap, [data-mira-entity-type], [data-mira-sentiment], [data-mira-source-signal], .am-ev-pill, .am-inline-logo'); }
    function isBlock(el){ return el.matches('table, .am-table-scroll, .am-evidence, .am-srclist, .am-srcrow, .am-source, .am-draft, .am-opps, .am-oppc-btn, .am-msg-buttons, li, blockquote, pre, hr'); }
    function isOppcPara(el){ if (!el.querySelector || !el.querySelector('.am-oppc-btn')) return false; var kk = Array.prototype.slice.call(el.childNodes).filter(function(n){ if (n.nodeType===3) return /\S/.test(n.nodeValue); if (n.nodeType===1 && n.classList && n.classList.contains('am-oppc-br')) return false; return true; }); return kk.length===1 && kk[0].classList && kk[0].classList.contains('am-oppc-btn'); }
    function walk(node){
      var kids = Array.prototype.slice.call(node.childNodes);
      for (var i=0;i<kids.length;i++){
        var ch = kids[i];
        if (ch.nodeType === 3){
          var txt = ch.nodeValue;
          if (!txt || !/\S/.test(txt)) continue;
          var frag = document.createDocumentFragment();
          var parts = txt.split(/(\s+)/);
          for (var j=0;j<parts.length;j++){
            var part = parts[j];
            if (part === '') continue;
            if (/^\s+$/.test(part)){ frag.appendChild(document.createTextNode(part)); continue; }
            var sp = document.createElement('span'); sp.className = 'am-rv-w'; sp.textContent = part;
            frag.appendChild(sp); units.push({ el: sp, t: 'w' });
          }
          node.replaceChild(frag, ch);
        } else if (ch.nodeType === 1 && ch.matches){
          if (isChip(ch)){ ch.style.display = 'none'; units.push({ el: ch, t: 'c' }); }
          else if (ch.matches('p') && isOppcPara(ch)){ ch.classList.add('am-rv-b'); ch.style.display = 'none'; units.push({ el: ch, t: 'b' }); }
          else if (isBlock(ch)){ ch.classList.add('am-rv-b'); ch.style.display = 'none'; units.push({ el: ch, t: 'b' }); }
          else { walk(ch); }
        }
      }
    }
    try { walk(bub); } catch(e){ return []; }
    return units;
  }
  /* ---- smooth auto-follow ("stick to bottom") engine ---- */
  var _stick = false, _stickRAF = null, _lastAutoTop = -1, _stickGuards = false, _newCount = 0;
  var _newMsgEl = null;       // the unread answer the badge points at (for "scroll to its start")
  var _holdRelease = null;    // releases an active scroll-hold when the user navigates explicitly
  var _followCapTop = -1;     // max scrollTop while following a typing answer (keeps the question in view)
  function _bottomGap(){ return elChat.scrollHeight - elChat.scrollTop - elChat.clientHeight; }
  function _atBottom(thr){ return _bottomGap() < (thr || 130); }
  // true only when NOT a single line of `el` is visible (its top is at/below the chat's visible bottom)
  function _msgFullyBelow(el){
    try {
      if (!el || !el.getBoundingClientRect) return false;
      return el.getBoundingClientRect().top >= (elChat.getBoundingClientRect().bottom - 2);
    } catch(e){ return false; }
  }
  function _stickStep(){
    if (!_stick){ _stickRAF = null; return; }
    var bottom = elChat.scrollHeight - elChat.clientHeight;
    // never follow past the point where the last user message would leave the top of the view
    var target = (_followCapTop >= 0) ? Math.min(bottom, _followCapTop) : bottom;
    var cur = elChat.scrollTop;
    var diff = target - cur;
    if (diff > 1){
      var next = cur + diff * 0.18;                 // eased glide -> smooth even when big blocks land
      if (target - next < 0.8) next = target;
      elChat.scrollTop = next;
    }
    _lastAutoTop = elChat.scrollTop;
    _stickRAF = requestAnimationFrame(_stickStep);
  }
  function _startStick(){
    _bindStickGuards();
    if (_stick) return;
    _stick = true; _lastAutoTop = elChat.scrollTop;
    if (!_stickRAF) _stickRAF = requestAnimationFrame(_stickStep);
  }
  function _stopStick(){
    if (!_stick) return;
    _stick = false;
    _followCapTop = -1;                 // drop the question-in-view cap once following ends
    if (_stickRAF){ cancelAnimationFrame(_stickRAF); _stickRAF = null; }
  }
  function _bindStickGuards(){
    if (_stickGuards) return; _stickGuards = true;
    // the slightest upward intent ends auto-follow immediately
    elChat.addEventListener('wheel', function(e){ if (_stick && e.deltaY < 0) _stopStick(); }, { passive: true });
    elChat.addEventListener('touchmove', function(){ if (_stick && elChat.scrollTop < _lastAutoTop - 1) _stopStick(); }, { passive: true });
    elChat.addEventListener('keydown', function(e){ if (_stick && (e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'Home')) _stopStick(); });
    elChat.addEventListener('scroll', function(){ if (_stick && _lastAutoTop >= 0 && elChat.scrollTop < _lastAutoTop - 2) _stopStick(); }, { passive: true });
  }

  /* ---- "new message" pill on the scroll-to-bottom button ---- */
  function _bumpNewBadge(msgEl){
    if (msgEl) _newMsgEl = msgEl;                 // remember the unread answer
    if (!elScrollBottom) return;
    var lbl = elScrollBottom.querySelector('.am-scroll-label');
    if (!lbl){ lbl = document.createElement('span'); lbl.className = 'am-scroll-label'; elScrollBottom.appendChild(lbl); }
    lbl.textContent = 'New Message';
    elScrollBottom.classList.add('has-new', 'is-visible');
  }
  function _clearNewBadge(){
    _newMsgEl = null;
    if (elScrollBottom) elScrollBottom.classList.remove('has-new');
  }
  // Jump to where the unread answer BEGINS (question near the top), not to the very bottom.
  function _scrollToNewMsgStart(){
    if (!_newMsgEl || !_newMsgEl.getBoundingClientRect) return false;
    try {
      var prev = _newMsgEl.previousElementSibling;
      var anchor = (prev && prev.classList && prev.classList.contains('am-msg')) ? prev : _newMsgEl;
      var top = anchor.getBoundingClientRect().top - elChat.getBoundingClientRect().top + elChat.scrollTop - 14;
      elChat.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      return true;
    } catch(e){ return false; }
  }

  // Put the last user message near the top; the answer types into the space below it.
  // Also set the follow cap so auto-scroll never pushes that question off the top.
  function _anchorForTyping(bub){
    try {
      var msgEl = bub.closest ? bub.closest('.am-msg') : null;
      if (!msgEl){ _followCapTop = -1; return; }
      var prev = msgEl.previousElementSibling;
      var anchor = (prev && prev.classList && prev.classList.contains('am-msg')) ? prev : msgEl;
      var top = anchor.getBoundingClientRect().top - elChat.getBoundingClientRect().top + elChat.scrollTop - 14;
      _followCapTop = Math.max(0, top);                 // don't auto-scroll past here -> question stays in view
      elChat.scrollTo({ top: _followCapTop, behavior: 'smooth' });
    } catch(e){ _followCapTop = -1; }
  }
  // When a new answer arrives while the user is reading higher up, KEEP their position:
  // pin the scroll for a short window so any external "scroll to bottom" gets undone.
  function _holdScroll(){
    var top = elChat.scrollTop;
    var until = Date.now() + 700;
    function release(){ until = 0; _holdRelease = null; }
    _holdRelease = release;                                  // let an explicit click cancel the hold
    function pin(){
      if (Date.now() > until){ elChat.removeEventListener('wheel', release); elChat.removeEventListener('touchstart', release); return; }
      if (Math.abs(elChat.scrollTop - top) > 1) elChat.scrollTop = top;   // undo auto jump-to-bottom
      requestAnimationFrame(pin);
    }
    elChat.addEventListener('wheel', release, { passive: true });          // user takes over -> stop holding
    elChat.addEventListener('touchstart', release, { passive: true });
    requestAnimationFrame(pin);
  }
  function _startTyping(bub, units){
    if (!units || !units.length) return;
    var _typeMul = parseFloat(root.getAttribute('data-typespeed'));
    if (!isFinite(_typeMul) || _typeMul <= 0) _typeMul = 1;
    var msgEl = (bub && bub.closest) ? bub.closest('.am-msg') : null;
    if (msgEl) msgEl.classList.add('am-typing');     // hide the hover bar (copy/good/bad) until done
    _typingActive = true;
    root.classList.add('am-is-typing');              // guard: keep un-revealed opportunity buttons hidden (survives re-renders)
    var follow = _atBottom(120);                     // only follow if the user is essentially at the bottom
    if (follow){
      _anchorForTyping(bub);
      setTimeout(function(){ if (_typingActive) _startStick(); }, 430);   // start sticking once the anchor settles
    } else {
      _holdScroll();                                 // user is reading above -> DON'T let anything scroll them down
      if (_msgFullyBelow(msgEl)) _bumpNewBadge(msgEl);   // ...and only show "New Message" if not one line of the answer is visible
    }
    var i = 0;
    function tick(){
      if (i >= units.length){
        _typingActive = false;
        root.classList.remove('am-is-typing');
        if (msgEl) msgEl.classList.remove('am-typing');
        _stopStick();
        return;
      }
      var u = units[i++];
      if (u.t === 'c'){ u.el.style.display = ''; }
      else if (u.t === 'b'){ u.el.style.display = ''; void u.el.offsetWidth; u.el.classList.add('on'); var _ob = u.el.classList && u.el.classList.contains('am-oppc-btn') ? u.el : (u.el.querySelector ? u.el.querySelector('.am-oppc-btn') : null); if (_ob) _ob.classList.add('on'); }  // reveal block: take space + fade (also mark inner oppc button so the typing-guard releases it)
      else { u.el.classList.add('on'); }
      var d = u.t === 'b' ? 82 : (u.t === 'c' ? 23 : 7 + Math.random()*6.5);   // 35% faster than the original 126/36/11-21
      /* data-typespeed am Root: ein Faktor auf diese Zeiten, Standard 1. Gebraucht von der
         Hero-Sektion der Landingpage -- dort schaut man dem Tippen zu, in der App will man die
         Antwort haben. Am Root und nicht als globale Einstellung, weil es eine Eigenschaft DIESER
         Platzierung ist; jede Sekunde neu gelesen waere Verschwendung, also einmal je Zeichen und
         nur, wenn das Attribut ueberhaupt da ist. */
      setTimeout(tick, d * _typeMul);
    }
    tick();
  }

  function _chatSkeletonHtml(){
    var asst = ['92%','86%','79%','64%'].map(function(w){ return '<span class="am-skel-line" style="width:'+w+'"></span>'; }).join('');
    return '<div class="am-msg is-user am-msg-skel"><div class="am-bubble"><span class="am-skel-line" style="width:55%"></span></div></div>'+
           '<div class="am-msg is-assistant am-msg-skel"><div class="am-bubble">'+asst+'</div></div>';
  }
  function renderMessages(){
    if (S.chatLoading && !S.messages.length){
      setHasMessages(true);                           // show the chat view immediately while it loads
      elMessages.innerHTML = _chatSkeletonHtml();
      elMessages.style.minHeight = '';
      return;
    }
    setHasMessages(S.messages.length > 0 || S.isLoading);
    root.setAttribute('data-citation', (S.settings && S.settings.citation) || 'icon');
    root.setAttribute('data-response', (S.settings && S.settings.response) || 'logo');
    var poolTerms = buildUnambiguousPoolTerms();   // unambiguous, current session only
    var lastAsstIdx = -1;
    for (var li = S.messages.length - 1; li >= 0; li--){ if (S.messages[li] && S.messages[li].role === 'assistant'){ lastAsstIdx = li; break; } }
    _runEmitted = false;
    elMessages.innerHTML = S.messages.map(function(m, idx){ return messageHtml(m, poolTerms, idx === lastAsstIdx); }).join('');
    elMessages.querySelectorAll('.am-inline-logo').forEach(function(img){
      img.addEventListener('error', function(){
        var span = document.createElement('span');
        span.className = 'am-inline-logo am-inline-logo-fallback';
        span.textContent = img.getAttribute('data-mono') || '';
        if (img.parentNode) img.parentNode.replaceChild(span, img);
      });
    });
    if (S.isLoading){
      _updateLoadingUI();
    } else {
      /* Der Lauf ist fertig, die Antwort aber noch nicht da: Bubble schickt sie manchmal NACH dem
         Ende des Ladens. Dann steht das Protokoll allein am Ende -- sonst blitzt die ganze Liste
         fuer einen Moment weg und kaeme mit der Antwort neu. */
      if (!_runEmitted && RUN.valid && RUN.steps.length){
        elMessages.insertAdjacentHTML('beforeend',
          '<div class="am-msg is-assistant am-msg-run has-run"><div class="am-msg-main">'+
          '<div class="am-run"></div></div></div>');
      }
      runMount();
    }

    /* ---- decide whether the LAST message should type out ----
       It types only if the last message is an assistant answer that is genuinely NEW, detected by
       EITHER of two signals (covers every way Bubble can deliver an answer):
         (a) APPEND  — the message list is the previous list plus 1-2 new messages (prefix preserved).
                       Works whether the answer arrives via askMiraAddMessage or askMiraSetMessages
                       (whole list re-sent). A full chat load / switch replaces the list (no shared
                       prefix) -> not an append -> no typing.
         (b) LOADING-DONE — the answer appears right as the thinking/loading state ends.
       A per-answer key (id, or role+length+date) is remembered in _typedKeys so the SAME answer
       never types twice on later re-renders (settings change, hover, etc.). */
    var _curKeys = S.messages.map(_msgKey);
    var _isAppend = false;
    if (_prevMsgKeys.length > 0 && _curKeys.length > _prevMsgKeys.length && (_curKeys.length - _prevMsgKeys.length) <= 2){
      _isAppend = true;
      for (var _pk = 0; _pk < _prevMsgKeys.length; _pk++){ if (_prevMsgKeys[_pk] !== _curKeys[_pk]){ _isAppend = false; break; } }
    }
    var _loadingDone = _prevLoading && !S.isLoading;
    var _lastKey = (lastAsstIdx >= 0 && lastAsstIdx === S.messages.length - 1) ? _curKeys[lastAsstIdx] : null;
    var _typeUnits = null;
    var _shouldType = _lastKey && !S.isLoading && !_typedKeys[_lastKey] && (
      _forceTypeNext || _isAppend || _loadingDone
    );
    if (_shouldType){
      var _asstEls = elMessages.querySelectorAll('.am-msg.is-assistant:not(.am-msg-loading)');
      var _newBub = _asstEls.length ? _asstEls[_asstEls.length - 1].querySelector('.am-bubble') : null;
      if (_newBub){ _typeUnits = _prepTyping(_newBub); if (!_typeUnits.length) _typeUnits = null; }
      _typedKeys[_lastKey] = true;
      _forceTypeNext = false;                       // consume ONLY when we actually type a new answer
      if (_forceTimer){ clearTimeout(_forceTimer); _forceTimer = null; }
    }
    _prevMsgKeys = _curKeys;
    _prevLoading = S.isLoading;

    if (!S.messages.length){ elMessages.style.minHeight = ''; if (!S.isLoading){ elChat.scrollTop = 0; } }
    else if (_typeUnits) { elMessages.style.minHeight = ''; /* _startTyping positions the scroll itself */ }
    else if (_scrollMode === 'bottom') { elMessages.style.minHeight = ''; scrollToBottom(true); }
    else if (S.isLoading) _pinSendScroll();   // send -> jump straight to the final position, reserve loader space
    else { elMessages.style.minHeight = ''; scrollNewMessageTop(true); }
    _scrollMode = 'newmsg';
    updateLoopState();
    if (_typeUnits) _startTyping(_newBub, _typeUnits);
    if (typeof updateScrollBtn === 'function') setTimeout(updateScrollBtn, 80);
  }

  var _greetIdx = -1;
  var _galleryCat = null;
  /* Der Kategorienblock laesst sich zuklappen, und die Entscheidung ueberlebt den Seitenwechsel.
     In try/catch, weil localStorage im privaten Fenster beim Lesen schon wirft -- ohne den Fang
     stuerzt die ganze Komponente an einer Bequemlichkeit. */
  var CAT_KEY = 'am_cat_closed';
  var _catClosed = (function(){
    try { return localStorage.getItem(CAT_KEY) === '1'; } catch(e){ return false; }
  })();
  function catKlappen(){
    _catClosed = !_catClosed;
    try { localStorage.setItem(CAT_KEY, _catClosed ? '1' : '0'); } catch(e){}
    if (elSugg) elSugg.classList.toggle('is-catclosed', _catClosed);
    if (elSuggLbl) elSuggLbl.setAttribute('aria-expanded', _catClosed ? 'false' : 'true');
  }
  var _reportRange = '30d';
  var _reportTopics = [];      // selected topic ids
  var _reportTopicMode = 'or'; // 'or' = any of, 'and' = all of
  function repQuarters(n){
    var now = new Date(), y = now.getFullYear(), q = Math.floor(now.getMonth()/3)+1, out = [];
    for (var i=0;i<n;i++){ out.push({ y:y, q:q }); q--; if (q<1){ q=4; y--; } }
    return out;
  }
  function repFmt(d, de){
    if (de) return ('0'+d.getDate()).slice(-2)+'.'+('0'+(d.getMonth()+1)).slice(-2)+'.'+d.getFullYear();
    var m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return m[d.getMonth()]+' '+d.getDate()+', '+d.getFullYear();
  }
  function repRangeOptions(){
    var de = (L() === STR.de);
    var opts = [
      { id:'7d',  label: de?'Letzte 7 Tage':'Last 7 days' },
      { id:'30d', label: de?'Letzte 30 Tage':'Last 30 days' },
      { id:'60d', label: de?'Letzte 60 Tage':'Last 60 days' }
    ];
    repQuarters(4).forEach(function(qq){ opts.push({ id:'q'+qq.y+'-'+qq.q, label:'Q'+qq.q+' '+qq.y, group:'q' }); });
    return opts;
  }
  function repTimeframe(id){
    var de = (L() === STR.de);
    if (id==='7d')  return de?'die letzten 7 Tage':'the last 7 days';
    if (id==='30d') return de?'die letzten 30 Tage':'the last 30 days';
    if (id==='60d') return de?'die letzten 60 Tage':'the last 60 days';
    if (id.charAt(0)==='q'){ var p=id.slice(1).split('-'), y=+p[0], q=+p[1], sm=(q-1)*3;
      var s=new Date(y,sm,1), e=new Date(y,sm+3,0);
      return 'Q'+q+' '+y+' ('+repFmt(s,de)+' – '+repFmt(e,de)+')'; }
    if (id.charAt(0)==='y'){ var yr=+id.slice(1);
      return (de?'das gesamte Jahr ':'the full year ')+yr+' ('+repFmt(new Date(yr,0,1),de)+' – '+repFmt(new Date(yr,11,31),de)+')'; }
    return de?'die letzten 30 Tage':'the last 30 days';
  }
  function repRangeLabel(){
    var o = repRangeOptions().filter(function(x){ return x.id===_reportRange; })[0];
    return o ? o.label : repRangeOptions()[1].label;
  }
  function repTopicById(id){ return (S.topics||[]).filter(function(t){ return String(t.id)===String(id); })[0]; }
  function repTopicLabel(){
    if (!_reportTopics.length) return 'All topics';
    if (_reportTopics.length === 1){ var t = repTopicById(_reportTopics[0]); return t ? t.name : '1 topic'; }
    return _reportTopics.length + ' topics';
  }
  /* The reporting topics picker IS the shared topics-filter component now (prefix utf), not a
     hand-built copy of it. The copy was the reason a change to the app's dropdown had to be made
     twice, and the second one was always the one that got forgotten.

     Three things make it fit here without changing how reporting works:
       data-local="yes"   nothing leaves the page. The selection is turned into a SENTENCE for the
                          report prompt (repTopicClause below), there is no Bubble workflow to
                          notify -- and without this an unset data-topics-fn would fall back to
                          bubble_fn_utfTopics and start poking whatever owns that name.
       data-newtopic="no" no New Topic button. This picker narrows an existing list; creating
                          topics belongs to the pages that manage them.
       data-instance      fixed, so the component's own store keeps the selection when the gallery
                          re-renders -- which it does on every single interaction, destroying and
                          rebuilding this node each time.
     The topic list and the selection are pushed in after each render (see syncRepTopics), and the
     selection comes back through the component's DOM event, wired once in initRoot. */
  var REP_TOPICS_ID = "utf_mira_report";
  function repTopicsMarkup(de){
    if (!(S.topics && S.topics.length)) return '';
    return '<div class="up-root utf-root am-rep-topics"' +
             ' data-instance="' + REP_TOPICS_ID + '"' +
             ' data-local="yes" data-newtopic="no"' +
             ' data-isdark="' + (root.getAttribute('data-theme') === 'dark' ? 'yes' : 'no') + '"></div>';
  }
  /* Called right after the gallery paints. The component may have just been rebuilt from scratch,
     so both the list and the current selection are handed over again; both setters are silent, so
     this cannot loop back into a change event. */
  function syncRepTopics(){
    if (!elSuggGrid || !elSuggGrid.querySelector('.am-rep-topics')) return;
    /* Twice: now and on the next tick. The picker may not have mounted yet at this instant, and
       an unmounted instance QUEUES the call -- but that queue holds only one entry per instance,
       so of the three setters below only the last would survive and the topic list would be the
       one dropped. The second pass runs against a mounted picker and applies all three in order.
       Both are idempotent, so doing it twice costs a render nobody sees. */
    /* galWhenIdle statt setTimeout(...,0): laeuft die Galerie gerade, wartet der zweite Durchgang
       auf das Ende der Bewegung statt sich in ihre ersten Frames zu legen. Ausserhalb einer
       Animation verhaelt es sich wie vorher. Siehe die Begruendung bei _galIdleQueue. */
    galWhenIdle(pushRepTopics);
    pushRepTopics();
  }
  function pushRepTopics(){
    if (!elSuggGrid || !elSuggGrid.querySelector('.am-rep-topics')) return;
    try {
      if (window.console && window.__amDebugTopics) console.log('[ask-mira] push', (S.topics||[]).length, 'topics');
      if (window.setTopicsFilterTopics) window.setTopicsFilterTopics(REP_TOPICS_ID, S.topics || []);
      if (window.setTopicsFilterSelected) window.setTopicsFilterSelected(REP_TOPICS_ID, _reportTopics.join(','));
      if (window.setTopicsFilterMode) window.setTopicsFilterMode(REP_TOPICS_ID, _reportTopicMode);
      if (window.setTopicsFilterTheme) window.setTopicsFilterTheme(REP_TOPICS_ID, root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
    } catch(e){
      /* Not swallowed: a failure here means the picker silently shows nothing, which is far worse
         than a line in the console. */
      if (window.console) console.warn('[ask-mira] pushing topics into the picker failed:', e);
    }
  }
  function repTopicClause(de){
    if (!_reportTopics.length) return '';
    var names = _reportTopics.map(function(id){ var t=repTopicById(id); return t?t.name:null; }).filter(Boolean);
    if (!names.length) return '';
    var joined = names.join(', ');
    if (_reportTopicMode === 'and')
      return de ? (' Beschränke den Report ausschließlich auf Inhalte, die alle diese Themen betreffen: '+joined+'.')
                : (' Limit the report strictly to content covering all of these topics: '+joined+'.');
    return de ? (' Beschränke den Report auf die folgenden Themen: '+joined+'.')
              : (' Limit the report to the following topics: '+joined+'.');
  }
  function renderSuggested(){
    var title = root.querySelector('#am-welcome-title');
    if (title){
      var gs = L().greetings || ['How can I help you today?'];
      if (_greetIdx < 0 || _greetIdx >= gs.length) _greetIdx = Math.floor(Math.random() * gs.length);
      title.textContent = gs[_greetIdx];
    }
    _galleryCat = null;
    renderGallery();
    renderQuickActions();
  }

  // Mobile-only quick actions (ChatGPT-style shortcuts). Reuse the exact desktop prompts.
  var _QA_IC = {
    report: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    smile:  '<svg viewBox="0 0 24 24"><path d="M15 10V9" /> <path d="M16.472 15a6 6 0 01-8.943 0" /> <path d="M9 10V9" /> <circle cx="12" cy="12" r="10" /></svg>',
    trend:  '<svg viewBox="0 0 24 24"><path d="M16 7h6v6" /> <path d="m22 7-8.5 8.5-5-5L2 17" /></svg>',
    eye:    '<svg viewBox="0 0 24 24"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>'
  };
  var QUICK_ACTIONS = {
    en: [
      { icon:'report', label:'Full report',            prompt:'Create one comprehensive, presentation-ready AI visibility report for {TIMEFRAME}. Cover our overall visibility and share of voice versus competitors, our strongest and weakest topics, the sources and domains driving our mentions (and where we are missing), a short sentiment read, and our single biggest win and biggest risk. Use clear sections, concrete numbers and a 3-bullet executive takeaway.' },
      { icon:'smile',  label:'Sentiment report',       prompt:'Create a sentiment and perception report for {TIMEFRAME}. Summarise overall sentiment and its trend, the positive themes and claims worth amplifying, the negative or risky themes and where they seem to originate, and concrete actions to improve how AI describes us. Keep it structured and quotable.' },
      { icon:'trend',  label:'Where to optimize first',prompt:'What should I optimize first to improve my AI Visibility?' },
      { icon:'eye',    label:'Why competitors get cited more', prompt:'Why are competitors mentioned more often than us?' }
    ],
    de: [
      { icon:'report', label:'Vollständiger Report',   prompt:'Erstelle einen umfassenden, präsentationsfertigen KI-Sichtbarkeits-Report für {TIMEFRAME}. Behandle unsere Gesamt-Sichtbarkeit und unseren Share of Voice gegenüber Wettbewerbern, unsere stärksten und schwächsten Themen, die Quellen und Domains, die unsere Nennungen treiben (und wo wir fehlen), eine kurze Sentiment-Einschätzung sowie unseren größten Erfolg und unser größtes Risiko. Klare Abschnitte, konkrete Zahlen und ein Executive-Takeaway in 3 Bullets.' },
      { icon:'smile',  label:'Sentiment-Report',       prompt:'Erstelle einen Sentiment- und Wahrnehmungs-Report für {TIMEFRAME}. Fasse das Gesamt-Sentiment und seinen Trend zusammen, die positiven Themen und Aussagen zum Verstärken, die negativen oder riskanten Themen samt vermuteter Herkunft sowie konkrete Maßnahmen, um die KI-Wahrnehmung zu verbessern. Strukturiert und zitierfähig.' },
      { icon:'trend',  label:'Wo zuerst optimieren?',  prompt:'Was sollte ich zuerst optimieren, um meine AI-Visibility zu verbessern?' },
      { icon:'eye',    label:'Warum werden Wettbewerber häufiger genannt?', prompt:'Warum werden Wettbewerber häufiger erwähnt als wir?' }
    ]
  };
  function renderQuickActions(){
    var host = root.querySelector('#am-quick'); if (!host) return;
    var list = (lang === 'de' ? QUICK_ACTIONS.de : QUICK_ACTIONS.en);
    host.innerHTML = list.map(function(a){
      return '<button class="am-quick-item" type="button" data-qa="'+escAttr(a.prompt)+'">'+
        '<span class="am-quick-ic">'+(_QA_IC[a.icon]||'')+'</span>'+
        '<span class="am-quick-label">'+esc(a.label)+'</span>'+
      '</button>';
    }).join('');
  }
  /* Opening or closing a category was a bare innerHTML swap: the card grid became the prompt list
     in a single frame, while every other panel in the app moves over 200ms ease. The block's own
     height is the one thing that actually changes, so that is what animates -- from the height
     measured BEFORE the swap to the one measured after -- plus a short fade so the incoming
     content does not pop in at full strength against a still-moving box.
     Wrapped around renderGallery() rather than bolted onto the click handler on purpose: there are
     five separate paths that re-render this block (category click, back button, report range,
     topic reopen, reset to start), and every one of them is an open or a close from the user's
     side. Doing it here is the only way "everywhere" actually means everywhere.
     The forced reflow between the two height writes is required, not cosmetic: without it the
     browser coalesces both into one style recalc and the element jumps straight to its end value
     with nothing to transition from. */
  var _galTimers = [], _galOff = [];
  /* Arbeit, die waehrend der Bewegung NICHT laufen darf.
     syncRepTopics setzte seinen zweiten Durchgang per setTimeout(...,0) ab. Der laeuft im
     naechsten Task -- und das ist exakt der Task, in dem der 150ms-Slide seine ersten Frames
     zeichnet. Dieser Durchgang schiebt vier Setter in die Topics-Komponente, die sich daraufhin
     samt Menue neu aufbaut. Layout und Paint dieser Arbeit teilen sich die Frames mit der
     laufenden Hoehenanimation, und genau so fuehlt sich "es stockt zwischendurch" an.

     Der Aufschub ist kein fester Timer, sondern haengt am Ende der Bewegung: solange animiert
     wird, sammelt sich die Arbeit hier und laeuft, wenn galReset die Animation abraeumt. Wird die
     Animation abgebrochen (zweiter Klick mitten hinein), laeuft sie sofort -- verloren gehen darf
     sie nie, sonst steht der Picker ohne Liste da. */
  var _galBusy = false, _galIdleQueue = [];
  function galRunIdle(){
    var q = _galIdleQueue; _galIdleQueue = [];
    for (var i = 0; i < q.length; i++){ try { q[i](); } catch(e){} }
  }
  function galWhenIdle(fn){
    if (!_galBusy){ setTimeout(fn, 0); return; }
    _galIdleQueue.push(fn);
  }
  function galClearTimers(){
    for (var i = 0; i < _galTimers.length; i++) clearTimeout(_galTimers[i]);
    _galTimers = [];
    for (var j = 0; j < _galOff.length; j++) _galOff[j]();
    _galOff = [];
    _galBusy = false;
    galRunIdle();
  }
  function galLater(fn, ms){ _galTimers.push(setTimeout(fn, ms)); }
  /* Chain the next phase on the transition's OWN end event, not on a timer set to the same
     duration. A setTimeout always fires a little after the time it was given -- more under load --
     so timer-chained phases leave a dead gap between one finishing and the next starting, and that
     gap is exactly what reads as the movement "setting down" instead of flowing. transitionend
     fires on the frame the transition actually completes. The timer stays only as a fallback for
     the cases where no transitionend ever comes (a zero-length change, or a background tab that
     never ran the animation at all). */
  function galAfter(prop, ms, fn){
    var spent = false;
    function go(e){
      if (e && (e.target !== elSuggGrid || e.propertyName !== prop)) return;
      if (spent) return;
      spent = true;
      elSuggGrid.removeEventListener('transitionend', go);
      fn();
    }
    elSuggGrid.addEventListener('transitionend', go);
    _galOff.push(function(){ spent = true; elSuggGrid.removeEventListener('transitionend', go); });
    galLater(go, ms + 40);
  }
  function galReset(){
    elSuggGrid.style.transition = '';
    elSuggGrid.style.height = '';
    elSuggGrid.style.overflow = '';
    elSuggGrid.style.opacity = '';
    elSuggGrid.style.transform = '';
    elSuggGrid.style.contain = '';
    elSuggGrid.style.clipPath = '';
    elSuggGrid.style.willChange = '';
    /* Die Bewegung ist vorbei -- was sich waehrenddessen angesammelt hat, laeuft jetzt. */
    _galBusy = false;
    galRunIdle();
  }
  /* EINE durchgehende Bewegung, kein Ablauf aus Phasen mehr.

     Vorher liefen drei Schritte hintereinander -- Inhalt ausblenden, tauschen und Hoehe
     schieben, Inhalt einblenden -- und jeder wurde am transitionend des vorigen gestartet. Das
     heisst: zwischen den Schritten liegt jedes Mal ein Sprung zurueck ins JavaScript, und der
     kostet mindestens einen Frame, in dem sich nichts bewegt. Zwei solche Nahtstellen in einer
     Bewegung von 250ms sind genau das, was man als Stocken sieht. Die Trennung war urspruenglich
     die Antwort auf ein Ueberlappen, das ebenfalls unruhig aussah; die Loesung ist aber keins
     von beidem, sondern gar keine Naht.

     Jetzt: einmal in JavaScript alles setzen, dann laeuft der Browser die Sache allein zu Ende.
     Der Tausch passiert sofort, geklippt auf die alte Hoehe -- sichtbar wird davon nichts, weil
     die Deckkraft im selben Zug auf 0 steht. Hoehe und Deckkraft starten danach GEMEINSAM aus
     einer einzigen transition-Deklaration. Kein transitionend-Handler dazwischen, keine Timer-
     Kette, nichts, was mitten in der Bewegung noch eine Entscheidung trifft.

     contain:layout waehrend der Bewegung: die Hoehe ist die einzige Eigenschaft hier, die
     wirklich neu layoutet, und ohne Containment zieht dieses Layout bei jedem Frame den Rest
     der Seite mit durch. Mit Containment bleibt es im Block. Kommt am Ende wieder weg, damit
     ein Element, das die meiste Zeit still steht, keine Sonderregel behaelt.

     Die Deckkraft ist kuerzer als die Hoehe und startet mit einem kleinen Versatz: der Inhalt
     soll auftauchen, waehrend die Box schon unterwegs ist, und vor ihr fertig sein -- sonst
     sieht man am Ende noch etwas nachziehen, obwohl die Bewegung steht. */
  var GAL_SLIDE = 220, GAL_FADE = 150, GAL_FADE_DELAY = 40;
  /* Nicht `ease`. `ease` ist vorne schwer und verbringt sein letztes Drittel fast im Stillstand,
     was bei einer Hoehe aussieht, als kroeche die Box die letzten Pixel. Diese Kurve zieht sanft
     an und bremst ins Ziel -- dieselbe, die die Composer-Schublade schon benutzt. */
  var GAL_EASE = 'cubic-bezier(.4,0,.2,1)';
  function renderGallery(){
    if (!elSuggGrid || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)){
      return renderGalleryNow();
    }
    var h0 = elSuggGrid.getBoundingClientRect().height;
    galClearTimers();
    /* Nichts Messbares zu bewegen (erster Anstrich, oder der Startbildschirm ist noch verborgen)
       -- direkt rendern und das Element in Ruhe lassen, statt ihm eine Hoehe aufzuzwingen. */
    if (!h0){ galReset(); return renderGalleryNow(); }

    /* Ab hier laeuft eine Bewegung: alles, was per galWhenIdle angemeldet wird, wartet auf ihr
       Ende. Gesetzt NACH dem h0-Ausstieg, denn der rendert ohne Animation durch. */
    _galBusy = true;

    /* ---- Tausch, unsichtbar und auf die alte Hoehe geklippt ----
       Geklippt wird mit clip-path, nicht mit overflow allein, und das ist der Kern der Sache:
       der Topics-Picker in der Reporting-Leiste ruft beim Mount UC.unclipAncestors(). Das laeuft
       vom Picker nach oben und setzt overflow:visible auf jeden Vorfahren, der klippt -- also
       auch auf genau diesen Block, mitten in der Bewegung. Die Hoehe animierte dann zwar, aber
       nichts wurde abgeschnitten: man sah eine wandernde Kante bei stehendem Inhalt statt eines
       Slides, und darunter sprang das Layout. Kein Wettlauf mit einem !important, sondern eine
       Eigenschaft, die der Sweep gar nicht anfasst. overflow bleibt zusaetzlich stehen, es
       schadet nicht und traegt den Fall, in dem gar nicht unclipped wird. */
    elSuggGrid.style.transition = 'none';
    elSuggGrid.style.overflow = 'hidden';
    elSuggGrid.style.clipPath = 'inset(0)';
    elSuggGrid.style.contain = 'layout';
    elSuggGrid.style.willChange = 'height, opacity';
    elSuggGrid.style.height = h0 + 'px';
    elSuggGrid.style.opacity = '0';

    renderGalleryNow();

    /* Neue Hoehe frei messen, dann die alte zurueckschreiben, damit es einen Wert gibt, VON dem
       aus animiert werden kann. Beide Schreibvorgaenge landen vor dem naechsten Anstrich, und
       der Inhalt ist ohnehin unsichtbar -- der ungepinnte Moment ist nie zu sehen. */
    elSuggGrid.style.height = '';
    var h1 = elSuggGrid.getBoundingClientRect().height;
    elSuggGrid.style.height = h0 + 'px';
    /* Erzwungener Reflow, nicht kosmetisch: ohne ihn fasst der Browser Start- und Endwert zu
       einem Style-Recalc zusammen und springt ohne Uebergang auf das Ziel. */
    void elSuggGrid.offsetHeight;

    /* ---- die eine Bewegung ---- */
    elSuggGrid.style.transition =
      'height ' + GAL_SLIDE + 'ms ' + GAL_EASE + ', ' +
      'opacity ' + GAL_FADE + 'ms ease ' + GAL_FADE_DELAY + 'ms';
    elSuggGrid.style.height = h1 + 'px';
    elSuggGrid.style.opacity = '1';

    /* Aufraeumen am Ende der laengeren der beiden, mit Timer als Rueckfall fuer den Fall, dass
       nie ein transitionend kommt (Laenge null, oder ein Hintergrund-Tab). */
    galAfter('height', GAL_SLIDE, galReset);
  }

  function renderGalleryNow(){
    var label = root.querySelector('#am-suggested-label');
    var g = L().gallery || [];
    if (_galleryCat === null){
      if (label){
        label.style.display = '';
        /* Die Kopfzeile ist der Schalter -- Text links, Winkelzeichen rechts, und ein Klick
           irgendwo darauf klappt den Block zu. Deshalb gebaut und nicht als textContent. */
        label.innerHTML = '<span class="am-sugg-lbl">' + esc(L().galleryLabel || L().tryAsking) + '</span>' +
                          '<span class="am-sugg-chev">' + ICON.chevron + '</span>';
        label.setAttribute('role', 'button');
        label.setAttribute('tabindex', '0');
        label.setAttribute('aria-expanded', _catClosed ? 'false' : 'true');
      }
      function catCardHTML(cat, i, full){
        return '<button class="am-cat-card'+(full ? ' am-cat-card-full' : '')+'" type="button" data-cat="'+i+'">'+
          '<span class="am-cat-ic">'+(GALLERY_ICONS[i] || ICON.trend)+'</span>'+
          '<span class="am-cat-name">'+esc(cat.name)+'</span>'+
          '<span class="am-cat-chev"><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" /></svg></span>'+
        '</button>';
      }
      var repIdx = -1;
      for (var _k = 0; _k < g.length; _k++){ if (g[_k] && g[_k].reporting){ repIdx = _k; break; } }
      var html = '';
      if (repIdx >= 0){
        html += '<button class="am-cat-card am-cat-card-full am-cat-card-report" type="button" data-cat="'+repIdx+'">'+
          '<span class="am-cat-ic">'+(GALLERY_ICONS[repIdx] || ICON.fileText)+'</span>'+
          '<span class="am-cat-text"><span class="am-cat-label">'+esc(g[repIdx].name)+'</span>'+
            '<span class="am-cat-desc">'+esc(g[repIdx].desc || 'Full reports on your AI visibility')+'</span></span>'+
          '<span class="am-cat-chev"><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" /></svg></span>'+
        '</button>';
      }
      html += '<div class="am-cat-grid">' + g.map(function(cat, i){
        return (i === repIdx) ? '' : catCardHTML(cat, i, false);
      }).join('') + '</div>';
      /* Zwei Huellen und nicht eine: die AEUSSERE ist das Raster, das von 1fr auf 0fr laeuft, die
         INNERE haelt den Inhalt und schneidet ihn ab. Braucht die aeussere mehr als ein Kind, legt
         der Browser eine zweite Reihe automatisch an, und die bleibt beim Zuklappen stehen.
         Die Bewegung sitzt hier und NICHT an #am-suggested-grid: dort animiert renderGallery
         schon Hoehe und Deckkraft mit eigenen Inline-Stilen, und zwei Bewegungen an einem Element
         geraten sich in die Quere. */
      elSuggGrid.innerHTML = '<div class="am-sugg-fold"><div class="am-sugg-foldin">' + html + '</div></div>';
      if (elSugg) elSugg.classList.toggle('is-catclosed', _catClosed);
      return;
    }
    var cat = g[_galleryCat];
    /* renderGalleryNow, not renderGallery: this is the same render correcting its own stale
       category index, not a second open -- re-entering the animated wrapper here would measure a
       half-built block as the "before" height. */
    if (!cat){ _galleryCat = null; return renderGalleryNow(); }
    if (label) label.style.display = 'none';
    if (cat.reporting){
      var de = (L() === STR.de);
      var opts = repRangeOptions();
      var menu = '';
      var prevGroup = 'd';
      opts.forEach(function(o){
        var grp = o.group || 'd';
        if (grp !== prevGroup){ menu += '<div class="am-rep-range-sep"></div>'; prevGroup = grp; }
        menu += '<button class="am-rep-range-opt'+(o.id===_reportRange?' is-sel':'')+'" type="button" data-rep-range="'+escAttr(o.id)+'">'+esc(o.label)+
          '<span class="am-rep-range-check"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></svg></span></button>';
      });
      var rhtml = '<div class="am-gallery-head am-rep-head">'+
        '<button class="am-gallery-back" type="button" data-gallery-back><svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" /></svg><span>'+esc(L().galleryBack || 'All categories')+'</span></button>'+
        '<span class="am-gallery-cat-title">'+esc(cat.name)+'</span>'+
        '<span class="am-rep-spacer"></span>'+
        repTopicsMarkup(de)+
        '<div class="am-rep-range-wrap">'+
          '<button class="am-rep-range" type="button" data-rep-range-toggle>'+
            '<svg class="am-rep-cal" viewBox="0 0 24 24"><path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>'+
            '<span class="am-rep-range-lbl">'+esc(repRangeLabel())+'</span>'+
            '<svg class="am-rep-range-chev" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg>'+
          '</button>'+
          '<div class="am-rep-range-menu">'+menu+'</div>'+
        '</div>'+
      '</div>';
      rhtml += '<div class="am-rep-cards">'+ (cat.reports || []).map(function(r, i){
        return '<button class="am-rep-card" type="button" data-rep-idx="'+i+'">'+
          '<span class="am-rep-ic">'+(ICON[r.icon] || ICON.trend)+'</span>'+
          '<span class="am-rep-text"><span class="am-rep-label">'+esc(r.label)+'</span><span class="am-rep-desc">'+esc(r.desc || '')+'</span></span>'+
          '<span class="am-rep-edit" data-rep-edit role="button" tabindex="-1" aria-label="Edit prompt" title="Edit prompt">'+ICON.pencil+'</span>'+
          '<span class="am-rep-go"><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" /></svg></span>'+
        '</button>';
      }).join('') + '</div>';
      elSuggGrid.innerHTML = rhtml;
      /* The reporting branch returns HERE -- it never reaches the end of this function. That is
         where the picker actually lives, so the hand-over has to happen on this path too. */
      syncRepTopics();
      return;
    }
    var html = '<div class="am-gallery-head">'+
      '<button class="am-gallery-back" type="button" data-gallery-back><svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" /></svg><span>'+esc(L().galleryBack || 'All categories')+'</span></button>'+
      '<span class="am-gallery-cat-title">'+esc(cat.name)+'</span>'+
    '</div>';
    html += (cat.subs || []).map(function(sub){
      return '<div class="am-gallery-sub"><p class="am-gallery-subhead">'+esc(sub.name)+'</p><div class="am-gallery-prompts">'+
        (sub.prompts || []).map(function(q){
          var label = (q && typeof q === 'object') ? (q.label || q.prompt || '') : q;
          var prompt = (q && typeof q === 'object') ? (q.prompt || q.label || '') : q;
          return '<button class="am-gallery-prompt" type="button" data-q="'+escAttr(prompt)+'"><span>'+esc(label)+'</span>'+
            '<span class="am-gallery-prompt-chev"><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" /></svg></span></button>';
        }).join('')+
      '</div></div>';
    }).join('');
    elSuggGrid.innerHTML = html;
    /* The picker was just rebuilt with the rest of the gallery -- hand it the list and the
       current selection again. Both setters are silent, so this cannot echo back. */
    syncRepTopics();
  }

  /* ---- Grok-style looping placeholder ---- */
  var phIdx = 0, phTimer = null;
  function loopActive(){ return !root.classList.contains('has-messages') && !elTextarea.value.trim(); }
  function phStart(){
    phStop();
    if (!loopActive()) return;
    phIdx = 0;
    elPhText.style.transition = 'none';
    elPhText.classList.remove('is-out','is-in');
    elPhText.textContent = L().suggested[0] || L().placeholder;
    void elPhText.offsetWidth; elPhText.style.transition = '';
    phTimer = setInterval(phTick, 4000);
  }
  function phStop(){ if (phTimer){ clearInterval(phTimer); phTimer = null; } }
  function phTick(){
    var items = L().suggested; if (!items.length) return;
    var t = elPhText;
    t.classList.add('is-out');                 // current slides up + fades out
    setTimeout(function(){
      phIdx = (phIdx + 1) % items.length;
      t.style.transition = 'none';
      t.classList.remove('is-out'); t.classList.add('is-in');  // jump below, hidden
      t.textContent = items[phIdx];
      void t.offsetWidth;                        // reflow
      t.style.transition = '';
      t.classList.remove('is-in');               // animate up into place
    }, 240);
  }
  function updateLoopState(){
    var on = loopActive();
    elComposer.classList.toggle('loop-on', on);
    // native placeholder only when not looping (e.g. inside an existing chat)
    elTextarea.setAttribute('placeholder', (!on && !elTextarea.value.trim()) ? L().placeholder : '');
    if (on){ if (!phTimer) phStart(); } else { phStop(); }
  }

  /* Resize-Zuhoerer mit Drossel. Nimmt UC.aufResize, wenn core da ist -- und laeuft sonst
     unveraendert weiter, damit ein fehlendes core hier nichts abschaltet. Der Grund fuer die
     Drossel: die drei Handler lesen Groessen und schreiben danach Klassen. An jedem Bild einer
     Ziehbewegung ist das je ein erzwungenes Layout; gemessen war ask-mira mit 1138 von 12888
     Lesezugriffen der zweitgroesste Posten. */
  function amAufResize(fn, cfg){
    var k = window.UpstreemCore;
    if (k && k.aufResize) return k.aufResize(fn, cfg);
    window.addEventListener('resize', fn);
  }

  /* ---- Loading text cycle (every 6s, smooth) ---- */
  var loadIdx = 0, loadTimer = null;
  function currentThinkText(){ var a = L().loading; return a[loadIdx % a.length] || ''; }
  function nextLoadIdx(){ var n = (L().loading || []).length; if (n <= 1) return 0; var k; do { k = Math.floor(Math.random() * n); } while (k === loadIdx); return k; }
  function setThinkText(txt){
    var t = root.querySelector('.am-think-text'); if (!t) return;
    t.classList.add('is-out');
    setTimeout(function(){
      var e = root.querySelector('.am-think-text'); if (!e) return;
      e.style.transition = 'none';
      e.classList.remove('is-out'); e.classList.add('is-in');
      e.textContent = txt;
      void e.offsetWidth;
      e.style.transition = '';
      e.classList.remove('is-in');
    }, 240);
  }
  function updateLoopText(){ setThinkText(currentThinkText()); }
  /* Der Hinweis "Tiefe Suche" nach 55 Sekunden ist raus. Die Schrittliste sagt inzwischen selbst,
     woran gearbeitet wird -- ein zweiter Hinweis daneben erklaerte dasselbe noch einmal, nur
     dramatischer. Sein Glanz ist geblieben und liegt jetzt auf dem Text des laufenden Schritts. */
  function loadStart(){
    loadStop();
    /* the first line is already shown by the render — don't immediately re-set it
       (that produced an instant text-swap animation the moment the loader appeared) */
    loadTimer = setInterval(function(){ loadIdx = nextLoadIdx(); updateLoopText(); }, 7500);
  }
  function loadStop(){
    if (loadTimer){ clearInterval(loadTimer); loadTimer = null; }
  }

  /* ---------------- Tool loading states (graphic + typewriter) ---------------- */
  var _TOOL_STATE = {
    company_lookup:'brand', brand_overview:'brand', brand_variations:'brand',
    tag_lookup:'prompts', prompt_insights:'prompts', prompt_lookup:'prompts', get_knowledge:'prompts',
    citation_overview:'sources', source_mentions_overview:'sources', url_detail:'sources', source_recommendations:'sources',
    response_mentions:'responses', response_detail:'responses'
  };
  var _TOOL_TEXT = {
    company_lookup:['Identifying your brand and competitors','Mapping out the companies in play','Pinning down the brands to track'],
    brand_overview:["Reading your brand's visibility data",'Checking how often you show up','Sizing up your overall presence'],
    brand_variations:['Catching every spelling of your name','Gathering all your brand variations'],
    tag_lookup:['Sorting prompts into topics','Grouping prompts by theme','Organizing prompts by category'],
    prompt_insights:['Digging into prompt-level performance','Seeing which prompts mention you','Tracing visibility across prompts'],
    prompt_lookup:['Finding the right prompts to inspect','Pulling the prompts into view'],
    get_knowledge:['Grounding the answer in the basics','Pulling up the relevant concepts'],
    citation_overview:['Scanning the sources AI cites','Mapping which domains get referenced'],
    source_mentions_overview:['Seeing who gets mentioned where','Following mentions across the web'],
    url_detail:['Reading what this page actually says','Inspecting that URL up close'],
    source_recommendations:['Spotting sources worth pursuing','Hunting for citation opportunities'],
    response_mentions:['Reading how AI answers describe you','Scanning the actual AI replies'],
    /* Nicht "eine einzelne Antwort": Mira liest hier den vollen Wortlaut der Antworten, statt nur
       ihre Kennzahlen -- "one reply" beschrieb den Schritt falsch. */
    response_detail:['Reading the full answer text','Looking at what the answers actually say']
  };
  var _STATE_TEXT = {
    brand:['Reading your brand data'],
    prompts:['Working through your prompts'],
    sources:['Scanning the sources'],
    responses:['Reading the AI responses']
  };
  function _tlBrandList(){ return (S.brandLogos || []).slice(0, 20); }   // [{src,fb_src,label,color}]
  function _tlFaviconList(){ return (S.favicons || []).slice(0, 20); }   // [{src,label}]
  function _tlModelList(){
    var out = [], k, m;
    for (k in S.models){ if (!Object.prototype.hasOwnProperty.call(S.models, k)) continue; m = S.models[k];
      if (m && m.logo_url) out.push({ src: m.logo_url, label: m.display_name || m.key || k }); }
    return out.slice(0, 20);
  }
  function _tlTopicList(){
    return (S.topics || []).slice(0, 20).map(function(t){ return { name: t.name || '', color: (t.hex_light || t.hex_dark || '#6b7280') }; });
  }
  function _tlChip(cls, src, fbSrc, label, color){
    var w = document.createElement('span'); w.className = cls;
    if (src){
      var im = document.createElement('img'); im.alt = ''; im.referrerPolicy = 'no-referrer';
      var triedFb = false;
      im.onerror = function(){
        if (fbSrc && !triedFb){ triedFb = true; im.src = fbSrc; return; }   // try the favicon fallback first
        w.classList.add('is-fb'); w.style.setProperty('--fb', color || '#9ca3af'); w.textContent = String(label || '?').charAt(0).toUpperCase();
      };
      im.src = src; w.appendChild(im);
    } else { w.style.background = 'var(--am-soft)'; }   // placeholder chip when no asset
    return w;
  }
  function _tlShuffle(a){ a = a.slice(); for (var i = a.length - 1; i > 0; i--){ var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  /* ---------------- Arbeitsprotokoll: Uhr + Liste der Arbeitsschritte ----------------
     Vorher zeigte der Ladezustand immer nur den EINEN Schritt, an dem Mira gerade arbeitet -- was
     davor lief, war weg, und wie lange sie schon sucht, stand nirgends. Jetzt fuehrt die Komponente
     Protokoll: oben die laufende Uhr, darunter je Arbeitsschritt eine Zeile. Die laufende Zeile
     traegt einen Spinner und steht in der zweiten Textfarbe; beim Abschluss geht der Spinner weich
     weg und der Text wechselt in die erste. So waechst waehrend der Antwort eine Liste.

     Die Liste lebt NUR in dieser Sitzung und gehoert immer zur LETZTEN Antwort -- nach einem
     Neuladen steht wieder die einzelne "Thought for"-Zeile aus latency_ms da, wie vorher. */
  var RUN = { valid:false, live:false, startTs:0, endTs:0, steps:[] };
  var _runClock = null;        // Intervall der Uhr
  var _runQ = [];              // wartende Zustaende, in der Reihenfolge, in der sie kamen
  var _runQT = null;           // Timer, der den naechsten Schritt freigibt
  var _runStepTs = 0;          // Beginn des laufenden Schritts -- Grundlage der Mindeststandzeit
  var _runEmitted = false;     // wurde der Block in diesem Render schon ueber eine Antwort gesetzt?
  /* Mindeststandzeit je Schritt. Vorher waren es 5s, und wer waehrend der Sperre kam, wurde
     VERSCHLUCKT: gemerkt wurde nur der jeweils letzte Wunsch. Jetzt wartet eine Schlange, statt zu
     vergessen -- also darf die Zeit kurz sein, und trotzdem faellt kein Schritt aus der Liste. */
  var _RUN_DWELL = 1500;
  var _RUN_MOMENT = 10000;     // kuerzer gedacht -> "a moment" statt einer Zahl

  function runClockText(){
    /* Ohne Startzeit stuende hier fuer immer "0s". Das darf im laufenden Zustand nicht vorkommen
       -- lieber ab jetzt zaehlen als gar nicht. */
    if (RUN.live && !RUN.startTs) RUN.startTs = Date.now();
    var ms = RUN.startTs ? ((RUN.endTs || Date.now()) - RUN.startTs) : 0;
    return (RUN.live ? L().runNow : L().runDone) + ' ' + runDauer(ms);
  }
  /* Der laufende Block, nicht der erste im Chat. root.querySelector('.am-run') traf ab der ZWEITEN
     Frage die Uhr der schon fertigen Antwort weiter oben (.am-run.is-bare traegt dieselbe Klasse) --
     die Uhr des Ladeblocks wurde nie angefasst und stand fuer immer auf "0s". Beim ersten Mal fiel
     es nicht auf, weil oben noch nichts stand. */
  function runBox(){
    return elMessages.querySelector('.am-msg-loading .am-run') ||
           elMessages.querySelector('.am-run:not(.is-bare)');
  }
  function runClockTick(){
    var box = runBox(); if (!box) return;
    var el = box.querySelector('.am-run-clock'); if (el) el.textContent = runClockText();
  }
  /* Der Text eines Schritts wird EINMAL beim Anlegen gezogen und aendert sich nie wieder: die Zeile
     steht spaeter als Protokoll da, und ein Protokoll, das sich nachtraeglich umschreibt, ist keins.
     Schon benutzte Texte kommen nicht zweimal vor, solange die Auswahl reicht. */
  function runStepText(kind, key){
    var pool = (_TOOL_TEXT[key] && _TOOL_TEXT[key].length) ? _TOOL_TEXT[key] : (_STATE_TEXT[kind] || ['Working on it']);
    var used = {}, i;
    for (i = 0; i < RUN.steps.length; i++){ if (RUN.steps[i].text) used[RUN.steps[i].text] = 1; }
    var frei = pool.filter(function(t){ return !used[t]; });
    var arr = frei.length ? frei : pool;
    return arr[Math.floor(Math.random() * arr.length)];
  }
  /* Die Logos vorn: eine zufaellige Auswahl, EINMAL gezogen und dann fest -- sie rotieren nicht.
     Die Modelle bleiben in ihrer Reihenfolge, die ist eine Rangliste und keine Auswahl. */
  /* Wie viele Chips die Zeile traegt: 3 bis 5, je Schritt neu gezogen. Eine feste Zahl liess jede
     Zeile gleich aussehen; mehr als 5 schiebt den Text auf schmalen Breiten weg. */
  function runLogoZahl(){ return 3 + Math.floor(Math.random() * 3); }
  function runLogos(kind){
    var n = runLogoZahl();
    if (kind === 'brand')     return _tlShuffle(_tlBrandList()).slice(0, n);
    if (kind === 'sources')   return _tlShuffle(_tlFaviconList()).slice(0, n);
    if (kind === 'responses') return _tlModelList().slice(0, n);
    /* Prompts tragen KEINE Chips: ein Thema hat kein Logo, und drei Farbflecken haben nichts
       gesagt ausser "hier waeren Chips". Das Zeichen vor dem Text sagt den Schritt. */
    return [];
  }
  /* Das Zeichen vor dem Text -- dasselbe, das der Punkt in der Seitenleiste traegt (Brands,
     Prompt Insights, Citations); Responses nimmt das des Prompts-Seitenkopfs. Kein Kasten
     darum, zweite Textfarbe: es beschriftet die Zeile, es ist kein Chip. */
  var _RUN_IC = { brand:'squareStack', prompts:'zap', sources:'globe', responses:'scan' };
  function runZeichen(st){
    var kern = window.UpstreemCore;
    var el = document.createElement('span');
    if (st.kind === 'thought'){
      /* Die Denkzeile ist Mira selbst: der Kasten in der ersten Textfarbe, das Zeichen darin in
         der ersten Textfarbe des ANDEREN Themas -- also immer der kraeftigste Gegensatz, den das
         Thema hat, und in beiden Themen derselbe Eindruck. */
      el.className = 'am-run-ic is-mira';
      el.innerHTML = (kern && kern.icon) ? kern.icon('blend', 2) : '';
      return el;
    }
    el.className = 'am-run-ic';
    el.innerHTML = (kern && kern.icon) ? kern.icon(_RUN_IC[st.kind] || 'zap', 2) : '';
    return el;
  }
  function runLead(lead, st){
    lead.innerHTML = '';
    var l = st.logos || [];
    if (!l.length) return;                             /* keine Logos -> keine leeren Kaesten */
    l.forEach(function(it, i){
      var c = (st.kind === 'responses')
        ? _tlChip('am-tload-ai', it.src, '', it.label, '#9ca3af')
        : _tlChip('am-tload-logo', it.src, it.fb_src, it.label, it.color);
      c.style.transitionDelay = (i * 70) + 'ms';       /* die drei Logos kommen nacheinander */
      lead.appendChild(c);
    });
  }
  function runThoughtLabel(st){
    var ms = (st.endTs || Date.now()) - st.ts;
    return (ms < _RUN_MOMENT) ? L().thoughtMoment : formatThought(ms);
  }

  /* ---- Eine Zeile bauen ----
     "frisch" heisst: dieser Schritt ist gerade abgeschlossen worden. Dann wird die Zeile NICHT
     schon fertig gebaut, sondern laufend -- und der Abgang gleich danach neu angestossen. Sonst
     verschluckt der naechste Renderdurchgang (die Antwort kommt an) genau die Bewegung, die man
     sehen soll: Spinner weg, Text von der zweiten in die erste Farbe. */
  function runRow(st){
    var frisch = !!st.endTs && (Date.now() - st.endTs) < 520;
    var row = document.createElement('div');
    row.className = 'am-run-step' + (st.endTs && !frisch ? ' is-done is-cold' : '');
    var inner = document.createElement('div'); inner.className = 'am-run-inner'; row.appendChild(inner);
    /* Der Abstand nach oben sitzt eine Ebene TIEFER als der Klipper: haengt er am Klipper selbst,
       bleibt die zugefaltete Zeile 11px hoch und die Liste springt beim Auftritt. */
    var line = document.createElement('div'); line.className = 'am-run-line'; inner.appendChild(line);
    var sp = document.createElement('span'); sp.className = 'am-run-spin'; sp.setAttribute('aria-hidden', 'true');
    sp.innerHTML = '<i></i>';                          /* innen dreht es, aussen blendet es -- sonst kaempfen Animation und Uebergang um transform */
    line.appendChild(sp);
    line.appendChild(runZeichen(st));
    var txt = document.createElement('span'); txt.className = 'am-run-txt';
    if (st.kind === 'thought'){
      /* Die Denkzeile benutzt die Lauf-Mechanik, die es schon gibt (am-think-loop/-text): der Text
         wechselt waehrend des Denkens und am Ende auf "Thought for ..." -- mit derselben Auf-/Ab-
         Bewegung wie vorher, statt hart umzuspringen. */
      txt.classList.add('am-think-loop');
      txt.innerHTML = '<span class="am-think-text"></span>';
      txt.querySelector('.am-think-text').textContent = st.endTs ? st.text : (st.text || currentThinkText());
    } else {
      txt.textContent = st.text;
    }
    line.appendChild(txt);
    /* Die Logos stehen HINTER dem Text: vorne sagt das Zeichen, worum es geht, hinten zeigen die
       Chips, an welchen Daten gerade gearbeitet wird. */
    var lead = document.createElement('span'); lead.className = 'am-run-lead'; line.appendChild(lead);
    runLead(lead, st);
    st.el = row;
    if (frisch) setTimeout(function(){ runMarkDone(st, false); }, 30);
    return row;
  }
  function runMarkDone(st, umblenden){
    var el = st.el; if (!el) return;
    el.classList.remove('is-cold');
    el.classList.add('is-done');
    if (st.kind === 'thought' && umblenden) setThinkText(st.text);
    /* Wenn der Spinner unsichtbar ist, hoert er auch auf zu drehen -- eine unsichtbare
       Dauer-Animation je Zeile kostet in einer langen Liste sonst dauerhaft Rechenzeit. */
    setTimeout(function(){ if (st.el === el) el.classList.add('is-cold'); }, 480);
  }
  function runReveal(st, verzug){
    st.shown = true;
    var el = st.el; if (!el) return;
    void el.offsetHeight;                              /* Lage erzwingen, sonst faellt der Uebergang aus */
    /* setTimeout und nicht requestAnimationFrame: in einem verdeckten Tab feuert rAF nie, und dann
       stuende die Zeile fuer immer auf 0fr -- also unsichtbar. */
    setTimeout(function(){ if (st.el) st.el.classList.add('is-in'); }, 20 + (verzug || 0));
  }
  /* Die Liste waechst nach unten. Wenn ihr Ende aus dem Blick rutscht, wird genau um den fehlenden
     Betrag nachgescrollt -- nicht ans Ende des Verlaufs, denn beim Senden wird darunter Platz
     reserviert, und "ganz nach unten" wuerde in diese Leere springen. */
  function runFollow(){
    var box = runBox(); if (!box) return;
    var r = box.getBoundingClientRect(), c = elChat.getBoundingClientRect();
    if (r.top < c.top || r.top > c.bottom) return;     /* Block nicht im Blick -> der Nutzer liest woanders */
    var fehlt = r.bottom - c.bottom + 22;
    if (fehlt <= 0) return;
    elChat.scrollTo({ top: elChat.scrollTop + fehlt, behavior: 'smooth' });
  }

  /* ---- Block aufbauen ---- */
  function runFill(box){
    box.innerHTML = '';
    box.classList.toggle('is-live', !!RUN.live);
    var head = document.createElement('div'); head.className = 'am-run-head';
    var clock = document.createElement('span'); clock.className = 'am-run-clock';
    clock.textContent = runClockText();
    head.appendChild(clock); box.appendChild(head);
    var steps = document.createElement('div'); steps.className = 'am-run-steps'; box.appendChild(steps);
    RUN.steps.forEach(function(st){
      var row = runRow(st);
      if (st.shown) row.classList.add('is-in');         /* war schon da -> ohne Auftritt, sonst laeuft er bei jedem Render neu */
      steps.appendChild(row);
      if (!st.shown) runReveal(st);
    });
  }
  function runMount(){
    /* :not(.is-bare) -- die nackte Uhr ueber einer GELADENEN Antwort ist fertiges Markup und kein
       Platzhalter. Ohne die Ausnahme hat runFill sie ueberschrieben und die Uhr des leeren Laufs
       hineingeschrieben (gemessen: "Worked for 29798674m 59s", die Zeit seit 1970). */
    var box = elMessages.querySelector('.am-run:not(.is-bare)');
    if (box) runFill(box);
  }

  /* ---- Ablauf ---- */
  function runReset(){
    if (_runClock){ clearInterval(_runClock); _runClock = null; }
    if (_runQT){ clearTimeout(_runQT); _runQT = null; }
    _runQ = [];
  }
  function runDrop(){
    runReset();
    RUN = { valid:false, live:false, startTs:0, endTs:0, steps:[] };
  }
  function runStart(){
    runReset();
    /* Die Uhr laeuft ab dem Absenden und nicht ab diesem Aufruf: dazwischen liegt der Weg durch
       Bubble, und der gehoert zur Wartezeit, die der Nutzer erlebt. */
    var start = _sendStartTs || Date.now();
    /* DIESELBE Frage setzt die Uhr NICHT zurueck. setLoading(true) kommt fuer eine Antwort
       mehrfach, und dazwischen kann ein setLoading(false) stehen: askMiraSetMessages ruft
       setLoading(letzte Nachricht laeuft noch), und solange die laufende Antwort in einem
       Durchlauf fehlt, kippt der Wert kurz auf false. Ohne diese Weiche begann RUN dann von vorn
       -- die Uhr sprang bei jedem Durchlauf auf 0 zurueck und stand damit dauerhaft auf "0s",
       waehrend die Schritte weiterliefen. Genau das Bild ab der zweiten Frage.
       Der Anker ist _sendStartTs: er wird je Frage einmal gesetzt (send()), also heisst gleicher
       Zeitstempel "gleiche Frage". */
    /* Zweiter Anker fuer den Fall, dass die Frage NICHT ueber das Eingabefeld kam (die App setzt
       den Zustand auch von aussen, dann gibt es kein _sendStartTs): ein Lauf, der weniger als vier
       Sekunden nach dem Ende des vorigen beginnt, ist die Fortsetzung desselben und kein neuer.
       Eine echte neue Frage bringt einen frischen _sendStartTs mit -- und der schlaegt diese
       Regel, sonst wuerde eine schnell gestellte zweite Frage die Uhr der ersten weiterzaehlen. */
    var neueFrage = _sendStartTs && _sendStartTs !== RUN.startTs;
    var kurzNachEnde = RUN.valid && RUN.steps.length && RUN.endTs && (Date.now() - RUN.endTs < 4000);
    if (!neueFrage && RUN.valid && RUN.steps.length && (RUN.startTs === start || kurzNachEnde)){
      RUN.live = true; RUN.endTs = 0;
    } else {
      RUN = { valid:true, live:true, startTs:start, endTs:0, steps:[] };
      runPush('thought', '');
    }
    _runClock = setInterval(runClockTick, 1000);
  }
  function runPush(kind, key){
    var vor = RUN.steps[RUN.steps.length - 1];
    if (vor && !vor.endTs) runClose(vor);
    var st = { kind: kind, tool: key || '', ts: Date.now(), endTs: 0, shown: false,
               text: (kind === 'thought') ? '' : runStepText(kind, key),
               logos: (kind === 'thought') ? [] : runLogos(kind), el: null };
    RUN.steps.push(st);
    _runStepTs = st.ts;
    var steps = elMessages.querySelector('.am-msg-loading .am-run-steps');
    if (steps){ steps.appendChild(runRow(st)); runReveal(st); setTimeout(runFollow, 460); }
    return st;
  }
  function runClose(st){
    if (!st || st.endTs) return;
    st.endTs = Date.now();
    if (st.kind === 'thought'){
      /* Die Denkphase ist vorbei: der wandernde Text und der Deep-Hinweis hoeren auf. Ohne das
         schreibt die Rotation nach 7,5s ihren naechsten Satz in die fertige Zeile. */
      loadStop();
      st.text = runThoughtLabel(st);
    }
    runMarkDone(st, true);
  }
  function runFinish(){
    if (!RUN.live) return;
    /* Was noch in der Schlange steht, wird nachgetragen statt weggeworfen -- sonst fehlten in der
       fertigen Liste genau die Schritte, die kurz vor der Antwort noch kamen. */
    while (_runQ.length){
      var nx = _runQ.shift();
      runClose(runPush(nx.st, nx.key));
    }
    var letzt = RUN.steps[RUN.steps.length - 1];
    if (letzt) runClose(letzt);
    RUN.live = false; RUN.endTs = Date.now();
    runReset();
    var box = runBox(); if (box) box.classList.remove('is-live');
    runClockTick();
  }
  /* Der Typ, der zuletzt gezeigt wurde ODER schon in der Schlange steht. Kommt derselbe noch
     einmal, aendert sich nichts: EIN Typ ergibt EINE Zeile, egal wie viele Werkzeuge dahinter
     laufen (brand_overview nach brand_variations bleibt eine Zeile "Brand"). */
  function runTail(){
    if (_runQ.length) return _runQ[_runQ.length - 1].st;
    var last = RUN.steps[RUN.steps.length - 1];
    if (!last) return '';
    return (last.kind === 'thought') ? '' : last.kind;
  }
  function runDrain(){
    if (_runQT || !_runQ.length || !RUN.live) return;
    var warte = Math.max(0, _RUN_DWELL - (Date.now() - _runStepTs));
    _runQT = setTimeout(function(){
      _runQT = null;
      if (!RUN.live) return;
      var nx = _runQ.shift();
      if (nx) runPush(nx.st, nx.key);
      runDrain();
    }, warte);
  }
  /* Kommen die Logos erst NACH dem Beginn des Schritts an (askMiraSetBrandLogos/-Favicons nach
     askMiraSetTool), traegt die laufende Zeile sie nach -- vorher stand da der Rueckfall. */
  function runRefreshLogos(kind){
    var st = RUN.steps[RUN.steps.length - 1];
    if (!st || st.endTs || st.kind !== kind) return;
    if (st.logos && st.logos.length) return;
    st.logos = runLogos(kind);
    if (!st.logos.length || !st.el) return;
    var lead = st.el.querySelector('.am-run-lead');
    if (lead) runLead(lead, st);
  }

  /* Nur die Ladezeile tauschen -- nie den ganzen Verlauf neu zeichnen
     (das erzeugte das sichtbare "Neuladen" / Nochmal-Tippen der letzten Antwort). */
  function _updateLoadingUI(){
    var ex = elMessages.querySelector('.am-msg-loading');
    if (!S.isLoading){
      if (ex && ex.parentNode) ex.parentNode.removeChild(ex);
      return;
    }
    if (!ex){
      elMessages.insertAdjacentHTML('beforeend',
        '<div class="am-msg is-assistant am-msg-loading"><div class="am-msg-main">' +
        '<div class="am-run is-live"></div></div></div>');
    }
    runMount();
  }


  function amTruthy(v){
    if (v === true || v === 1) return true;
    var s = String(v == null ? '' : v).trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' || s === 'y' || s === 't';
  }
  function escAttr(v){ return esc(v).replace(/"/g, '&quot;'); }
  function chatItemHTML(c){
    var active = (String(c.id) === String(S.activeChatId)) ? ' is-active' : '';
    var isP = amTruthy(c.is_pinned);
    var pinned = isP ? ' is-pinned' : '';
    var title = c.title || 'Untitled chat';
    return '<div class="am-prev-item'+active+pinned+'" draggable="true" data-chat-id="'+escAttr(c.id)+'" data-project-id="'+escAttr(c.project_id || '')+'">'+
      '<span class="am-prev-pin-ind" title="Pinned">'+ICON.pin+'</span>'+
      '<span class="am-prev-item-title">'+esc(title)+'</span>'+
      '<input class="am-prev-item-input" type="text" value="'+escAttr(title)+'" maxlength="120" aria-label="Chat name">'+
      '<span class="am-prev-actions">'+
        /* Die drei Punkte kommen aus core (moreHorizontal, dasselbe Zeichen wie im Kebab jeder
           Tabelle und in den Quick Actions). Die eigene Karte hier trug dieselben Pfade, aber
           ohne fill/stroke -- wie sie aussehen, entschied dann die CSS der Komponente, und das
           lief auseinander. */
        '<button class="am-prev-mini am-prev-menu-btn" type="button" data-prev-act="menu" title="More" aria-label="More">'+
          (window.UpstreemCore && window.UpstreemCore.icon ? window.UpstreemCore.icon('moreHorizontal', 2) : ICON.dots)+'</button>'+
      '</span>'+
      '<span class="am-prev-edit-actions">'+
        '<button class="am-prev-mini" type="button" data-prev-act="save" title="Save">'+ICON.check+'</button>'+
        '<button class="am-prev-mini" type="button" data-prev-act="discard" title="Discard">'+ICON.x+'</button>'+
      '</span>'+
    '</div>';
  }
  function sortPinnedFirst(arr){
    return arr.map(function(c,i){ return { c:c, i:i }; })
      .sort(function(a,b){ var d=(amTruthy(b.c.is_pinned)?1:0)-(amTruthy(a.c.is_pinned)?1:0); return d!==0 ? d : a.i-b.i; })
      .map(function(o){ return o.c; });
  }
  function renderPrevious(){
    if (!_prevLoaded){ elPrevList.innerHTML = _prevSkeletonHTML(); return; }   // sessions still loading at page load
    var sessions = (S.previousChats || []).slice(0, 200);
    var projects = (S.projects || []);
    var byProject = {}, recents = [];
    sessions.forEach(function(c){
      if (c.project_id){ (byProject[c.project_id] = byProject[c.project_id] || []).push(c); }
      else recents.push(c);
    });
    var projHTML = projects.map(function(p){
      var collapsed = !!S.collapsedProjects[p.id];
      var chats = sortPinnedFirst(byProject[p.id] || []);
      var body = chats.length ? chats.map(chatItemHTML).join('') : '<div class="am-prev-proj-empty">No chats yet</div>';
      return '<div class="am-prev-project'+(collapsed?' is-collapsed':'')+'" data-project-id="'+escAttr(p.id)+'">'+
        '<div class="am-prev-proj-head">'+
          '<span class="am-prev-proj-folder"><span class="am-fo">'+ICON.folderOpen+'</span><span class="am-fc">'+ICON.folder+'</span></span>'+
          '<span class="am-prev-proj-title">'+esc(p.title || 'Project')+'</span>'+
          '<input class="am-prev-proj-input" type="text" value="'+escAttr(p.title || '')+'" maxlength="120" aria-label="Project name">'+
          '<span class="am-prev-proj-actions">'+
            '<button class="am-prev-mini" type="button" data-proj-act="edit" title="Rename project">'+ICON.pencil+'</button>'+
            '<button class="am-prev-mini" type="button" data-proj-act="delete" title="Delete project">'+ICON.trash+'</button>'+
          '</span>'+
          '<span class="am-prev-proj-edit-actions">'+
            '<button class="am-prev-mini" type="button" data-proj-act="save" title="Save">'+ICON.check+'</button>'+
            '<button class="am-prev-mini" type="button" data-proj-act="discard" title="Discard">'+ICON.x+'</button>'+
          '</span>'+
        '</div>'+
        '<div class="am-prev-proj-body">'+body+'</div>'+
      '</div>';
    }).join('');

    var recentsHTML = sortPinnedFirst(recents).map(chatItemHTML).join('');
    if (!recentsHTML) recentsHTML = '<div class="am-prev-proj-empty">No recent chats</div>';

    elPrevList.innerHTML =
      '<div class="am-prev-section'+(S.collapsed.projects?' is-collapsed':'')+'" data-section="projects">'+
        '<div class="am-prev-sec-head" data-sec="projects">'+
          '<span class="am-prev-sec-label">Projects</span>'+
          '<span class="am-prev-sec-chev">'+ICON.chevron+'</span>'+
          '<span class="am-prev-sec-spacer"></span>'+
          '<button class="am-prev-add-proj" type="button" data-add-project title="New project">'+ICON.plus+'</button>'+
        '</div>'+
        '<div class="am-prev-sec-body">'+projHTML+'</div>'+
      '</div>'+
      '<div class="am-prev-section'+(S.collapsed.recents?' is-collapsed':'')+'" data-section="recents">'+
        '<div class="am-prev-sec-head" data-sec="recents">'+
          '<span class="am-prev-sec-label">Recents</span>'+
          '<span class="am-prev-sec-chev">'+ICON.chevron+'</span>'+
        '</div>'+
        '<div class="am-prev-sec-body">'+recentsHTML+'</div>'+
      '</div>';
    if (window.__amRenderChatTitlebar) window.__amRenderChatTitlebar();
  }

  /* ---------------- Segmented control ---------------- */
  function moveThumb(){ /* answer detail is now a dropdown; segmented thumb removed */ }
  var DETAIL_LABELS = { en: { short:'Short', balanced:'Balanced', detailed:'Detailed' }, de: { short:'Kurz', balanced:'Ausgewogen', detailed:'Ausführlich' } };
  var elDetailBtn  = root.querySelector('#am-detail-btn');
  var elDetailName = root.querySelector('#am-detail-name');
  var elDetailMenu = root.querySelector('#am-detail-menu');
  function _detailLabels(){ return DETAIL_LABELS.en; }   // answer detail stays English (like the old segmented), regardless of UI lang
  function _buildDetailMenu(){
    if (!elDetailMenu) return;
    var lb = _detailLabels();
    elDetailMenu.innerHTML = ['short','balanced','detailed'].map(function(k){
      return '<button class="am-model-opt am-detail-opt" type="button" role="menuitemradio" data-detail="'+k+'">'+
        '<span class="am-model-opt-main"><span class="am-model-opt-name">'+esc(lb[k])+'</span></span>'+
        '<svg class="am-model-check" viewBox="0 0 24 24" fill="none"><path d="M20 6 9 17l-5-5" /></svg>'+
      '</button>';
    }).join('');
  }
  function setDetail(value, silent){
    if (['short','balanced','detailed'].indexOf(value) < 0) value = 'balanced';
    S.answerDetail = value;
    var lb = _detailLabels();
    if (elDetailName) elDetailName.textContent = lb[value];
    if (elDetailMenu) elDetailMenu.querySelectorAll('.am-model-opt').forEach(function(o){ o.classList.toggle('is-active', o.getAttribute('data-detail') === value); });
    _ddCloseAll();
  }

  /* ---------------- Model selector (Mira Pro / Mira Flash) ---------------- */
  var MIRA_LOGO_SVG = '<svg viewBox="0 0 44 43" fill="none"><path d="M25.8 33.1C22.3 31.8 18.7 31.6 15.4 32.5C13.1 33.1 10.9 34.3 8.90002 35.8L7.5 37L7.10001 37.4L8 38.2C8.1 38.2 8.10001 38.3 8.20001 38.4C8.40001 38.6 8.60002 38.7 8.90002 38.9L9.5 39.3L10.1 38.8C10.2 38.7 10.4 38.5 10.6 38.4C12.4 36.9 14.4 35.9 16.5 35.4C19.2 34.7 22.1 34.8 25 35.9C27.4 36.8 32.3 37.9 38.2 35.4L38.4 35.3L38.7 35C38.7 34.9 38.8 34.9 38.9 34.8C39.4 34.2 39.9 33.6 40.3 32.9L42.3 29.8L39.1 31.6C34.4 34.2 30.1 34.7 25.8 33.1Z" fill="currentColor"/><path d="M12.1 22.3C14.8 21.6 17.7 21.7 20.6 22.8C23.8 24 32 25.7 41.2 17.4L42.7 15.9L42.8 15.8L43.2 15.4L43 14.9C42.9 14.5 42.7 14 42.5 13.5L42 12.1L41 13.1C40.9 13.3 40.7 13.4 40.5 13.6C36.1 18.1 29.3 22.7 21.5 19.9C18 18.6 14.4 18.4 11.1 19.3C7.90001 20.2 5.1 21.9 2.5 24.3V24.2L1 25.8C1 25.9 0.900018 25.9 0.800018 26L0.5 26.3L0.600006 26.7C0.700006 27.2 0.9 27.7 1 28.2L1.60001 29.8L2.60001 28.5C2.70001 28.3 2.9 28.2 3 28C5.1 26.1 8.00001 23.4 12.1 22.3Z" fill="currentColor"/><path d="M2.40002 20.5C4.70002 18.1 7.30001 16.6 10.1 15.8C12.8 15.1 15.7 15.2 18.6 16.3C27.6 19.6 35.4 14.2 38.8 11.3L40.1 10L40.6 9.59998L40.2 9C39.9 8.7 39.7 8.29999 39.4 7.89999L38.8 7.09998L38.1 7.79999C38 7.89999 37.8 8.09998 37.7 8.19998C33.5 12.2 27 16.3 19.6 13.5C16.1 12.2 12.5 12 9.20001 12.9C7.10001 13.5 5.10001 14.5 3.10001 15.8L1 17.5C0.8 17.7 0.7 17.8 0.5 18L0.300018 18.2V18.5C0.200018 19.2 0.200006 19.9 0.100006 20.5L0 23L1.70001 21.2C1.90001 21 2.10002 20.7 2.40002 20.5Z" fill="currentColor"/><path d="M28.7 39.9L28.5 40.5L28.7 39.9C28.4 39.8 28.2 39.7 27.9 39.6C24.4 38.3 20.8 38.1 17.5 39C16.8 39.2 16.1 39.4 15.4 39.7L13 40.8L12.4 41.1L14.4 41.8C15 42 15.6 42.2 16.2 42.4L16.5 42.5L16.8 42.4C17.1 42.3 17.4 42.1 17.7 42.1C17.9 42.1 18.1 42 18.3 41.9C20.7 41.3 23.3 41.3 26.1 42.2C26.4 42.3 26.6 42.4 26.9 42.5L27.4 42.7L27.7 42.6C28.4 42.4 29.2 42.2 29.8 41.9L32.6 40.9L29.7 40.2C29.4 40.1 29 40 28.7 39.9Z" fill="currentColor"/><path d="M44 19.2L42.5 20.7C42.3 20.9 42.1 21.1 41.9 21.3C37.8 25.2 31.2 29.4 23.8 26.6C20.3 25.3 16.7 25.1 13.4 26C10.3 26.9 7.5 28.5 5 30.9L3.70001 32.3L3.30002 32.8L3.70001 33.4C4.00001 33.8 4.20002 34.1 4.40002 34.5L5 35.4L5.70001 34.5C5.80001 34.4 6.00001 34.2 6.10001 34.1C8.50001 31.5 11.1 29.9 14.1 29.1C16.8 28.4 19.7 28.5 22.6 29.6C25.1 30.5 27.7 30.8 30.3 30.5C34.9 30 39.5 27.4 42.9 24.5C43.1 24.3 43.3 24.2 43.5 24L43.8 23.7V23.4C43.8 22.8 43.9 22.1 43.9 21.5L44 19.2Z" fill="currentColor"/><path d="M6 10L5.70001 9.39999L6 10C6.6 9.7 7.30002 9.49999 7.90002 9.29999C10.6 8.59999 13.5 8.69999 16.4 9.79999C18.3 10.5 20.2 10.8 22.3 10.8C26.5 10.8 30.7 9.29999 34.6 6.39999L36.1 5.19998L36.6 4.79999L35.7 4.09998C35.4 3.79998 35 3.49999 34.6 3.29999L34 2.89999L33.5 3.29999C33.3 3.39999 33.2 3.59998 33 3.69998C27.7 7.69998 22.4 8.79999 17.4 6.89999C13.8 5.59999 10.2 5.29999 6.60001 6.39999C6.30001 6.49999 6.00001 6.59998 5.60001 6.69998L5.40002 6.79999L5.10001 7.09998C5.10001 7.19998 5.00002 7.19999 4.90002 7.29999C4.50002 7.89999 4.00001 8.4 3.60001 9L1.70001 11.9L4.80002 10.3C5.30002 10.3 5.7 10.1 6 10Z" fill="currentColor"/><path d="M14.2 3.19998L14.5 3.29999C15.8 3.79999 17.8 4.29999 20.3 4.29999C22.9 4.29999 25.4 3.69998 27.9 2.69998L31 1.19998L28.9 0.5C28.3 0.3 27.7 0.1 27 0H26.7L26.4 0.0999756C26.1 0.199976 25.8 0.4 25.5 0.5C22.5 1.6 19.5 1.8 16.6 1C16.3 0.9 16 0.799982 15.7 0.699982L15.4 0.599976L15.1 0.699982C14.5 0.899982 13.9 1.09999 13.3 1.39999L11 2.39999L13.4 3.09998C13.6 2.99998 13.9 3.09998 14.2 3.19998Z" fill="currentColor"/></svg>';
  var FLASH_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 1.5 4.2 13.1c-.34.45-.02 1.1.55 1.1H10l-1.1 8.05c-.09.66.77.98 1.16.43L20 9.9c.34-.45.02-1.1-.55-1.1H14l1.15-6.9c.11-.66-.75-1-1.15-.4z"/></svg>';
  var MODELS = {
    pro:   { name: 'Mira Pro',   icon: MIRA_LOGO_SVG, desc: 'Detailed answers for bigger tasks, with sources and links.' },
    flash: { name: 'Mira Flash', icon: FLASH_SVG,      desc: 'Fast, lightweight answers for quick everyday questions.' }
  };
  var elModel      = root.querySelector('#am-model');
  var elModelBtn   = root.querySelector('#am-model-btn');
  var elModelIc    = root.querySelector('#am-model-ic');
  var elModelName  = root.querySelector('#am-model-name');
  var elModelMenu  = root.querySelector('#am-model-menu');
  function _modelOptHtml(key){
    var m = MODELS[key];
    return '<button class="am-model-opt" type="button" role="menuitemradio" data-model="'+key+'">'+
      '<span class="am-model-opt-ic">'+m.icon+'</span>'+
      '<span class="am-model-opt-main"><span class="am-model-opt-name">'+esc(m.name)+'</span>'+
        (m.desc ? '<span class="am-model-opt-desc">'+esc(m.desc)+'</span>' : '')+
      '</span>'+
      '<svg class="am-model-check" viewBox="0 0 24 24" fill="none"><path d="M20 6 9 17l-5-5" /></svg>'+
    '</button>';
  }
  if (elModelMenu) elModelMenu.innerHTML = _modelOptHtml('pro') + _modelOptHtml('flash');
  _buildDetailMenu();
  // generic dropdown open/close (works for both the model and the answer-detail dropdown)
  function _ddClose(dd){ if (!dd) return; dd.classList.remove('is-open'); var b = dd.querySelector('.am-model-btn'); if (b) b.setAttribute('aria-expanded','false'); }
  var _ddClipT = 0;
  function _ddCloseAll(){
    Array.prototype.slice.call(root.querySelectorAll('.am-model')).forEach(_ddClose);
    // keep overflow visible until the menu has finished fading out, then re-clip (otherwise it flashes)
    clearTimeout(_ddClipT);
    _ddClipT = setTimeout(function(){ if (elSettingsPanel) elSettingsPanel.classList.remove('has-model-menu'); root.classList.remove('is-model-open'); }, 200);
  }
  function _ddToggle(dd){
    if (!dd) return;
    var open = dd.classList.contains('is-open');
    _ddCloseAll();
    if (!open){
      clearTimeout(_ddClipT);   // opening again: cancel the pending re-clip
      dd.classList.add('is-open');
      if (elSettingsPanel) elSettingsPanel.classList.add('has-model-menu');
      root.classList.add('is-model-open');
      var b = dd.querySelector('.am-model-btn'); if (b) b.setAttribute('aria-expanded','true');
    }
  }
  function closeModelMenu(){ _ddCloseAll(); }
  function toggleModelMenu(){ _ddToggle(elModel); }
  function setModel(model, silent){
    if (model !== 'pro' && model !== 'flash') model = 'pro';
    S.model = model;
    var m = MODELS[model];
    if (elModelIc) elModelIc.innerHTML = m.icon;
    if (elModelName) elModelName.textContent = m.name;
    if (elModelMenu) elModelMenu.querySelectorAll('.am-model-opt').forEach(function(o){ o.classList.toggle('is-active', o.getAttribute('data-model') === model); });
    if (model === 'flash'){
      root.classList.add('is-flash');
      setDetail('short', true);                 // Flash is locked to Short
    } else {
      root.classList.remove('is-flash');
      if (!silent) setDetail('balanced', true);  // back to Pro -> Balanced
    }
    _ddCloseAll();
  }

  /* ---------------- Composer ---------------- */
  function autosize(){ elTextarea.style.height = 'auto'; elTextarea.style.height = Math.min(elTextarea.scrollHeight, 200) + 'px'; }
  function canSend(){ return !S.isLoading && (elTextarea.value.trim().length > 0 || !!getQuoteValue()); }
  function refreshSend(){ elSend.disabled = !canSend(); }

  function sendMessage(text){
    var explicit = (text != null);
    var typed = String(explicit ? text : elTextarea.value).trim();
    if (S.isLoading) return;
    var quote = explicit ? '' : getQuoteValue();
    if (!typed && !quote) return;
    /* Vom Startschirm aus geht der Fokus mit dem Absenden aus dem Feld. Dort wandert der Composer
       gleich darauf nach unten in die Chatansicht, und ein blinkender Cursor in einem Kasten, der
       sich bewegt, sieht falsch aus -- auf dem Telefon bleibt ausserdem die Tastatur stehen und
       verdeckt die Antwort. IN der Chatansicht bleibt der Fokus: dort will man weitertippen. */
    var warSchonImChat = root.classList.contains('has-messages');
    if (!warSchonImChat && elTextarea) elTextarea.blur();
    if (elSettingsPanel && elSettingsPanel.classList.contains('is-open')) toggleSettings(false);   // collapse the tray on first send
    var full = quote ? ('"' + quote + '"' + (typed ? ('\n\n' + typed) : '')) : typed;

    // optimistic user message (backend should add only the assistant reply)
    var userMsg = { id: 'local_'+Date.now(), role: 'user', content: full, created_at: new Date().toISOString() };
    S.messages.push(userMsg);
    elTextarea.value = ''; clearQuote(); autosize(); refreshSend();
    _pendingAnswer = true;
    _lastSendTs = Date.now();
    /* VOR setLoading: runStart liest diesen Zeitstempel und erkennt daran, ob es dieselbe Frage
       ist. Stand er danach, sah der erste Lauf ihn noch nicht -- und jeder weitere Durchlauf sah
       einen anderen Wert als der Lauf davor. */
    _sendStartTs = Date.now();
    setLoading(true);
    renderMessages();

    var payload = { chat_id: S.activeChatId, message: full, answer_detail: S.answerDetail, model: S.model };
    if (window.bubble_fn_ask_mira_send) window.bubble_fn_ask_mira_send(JSON.stringify(payload));
    else { window.dispatchEvent(new CustomEvent('askmira:send', { detail: payload })); }
  }

  /* ===== "Ask Mira" selection -> quoted gray chip (prompt_research X-delete mechanic) ===== */
  var QUOTE_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18" /> <path d="m6 6 12 12" /></svg>';

  function getQuoteValue(){
    if (!elQuoteSlot) return '';
    var c = elQuoteSlot.querySelector('.am-inline-quote');
    return c ? String(c.getAttribute('data-quote') || '') : '';
  }
  function clearQuote(){
    if (!elQuoteSlot) return;
    elQuoteSlot.innerHTML = '';
    elComposer.classList.remove('has-quote');
  }
  function buildQuoteChip(value){
    var span = document.createElement('span');
    span.className = 'am-inline-quote';
    span.setAttribute('data-quote', value);
    span.innerHTML =
      '<span class="am-inline-quote-body">' +
        '<span class="am-inline-quote-label">\u201c' + esc(value) + '\u201d</span>' +
        '<span class="am-inline-quote-remove" role="button" tabindex="-1" aria-label="Zitat entfernen" title="Entfernen">' + QUOTE_X + '</span>' +
      '</span>';
    return span;
  }
  function setQuote(value){
    value = String(value || '').replace(/\s+/g, ' ').trim();
    if (!value || !elQuoteSlot) return;
    elQuoteSlot.innerHTML = '';
    elQuoteSlot.appendChild(buildQuoteChip(value));
    elComposer.classList.add('has-quote');
  }
  if (elQuoteSlot){
    // X-on-hover removal — same behaviour as the prompt_research tags
    elQuoteSlot.addEventListener('mousedown', function(e){
      if (e.target.closest && e.target.closest('.am-inline-quote-remove')) e.preventDefault();
    });
    elQuoteSlot.addEventListener('click', function(e){
      var rm = e.target.closest && e.target.closest('.am-inline-quote-remove');
      if (!rm) return;
      e.preventDefault(); e.stopPropagation();
      clearQuote(); autosize(); refreshSend(); updateLoopState(); elTextarea.focus();
    });
  }

  /* floating "Ask Mira" button above a selection inside an assistant answer */
  var elAskSel = document.createElement('button');
  elAskSel.type = 'button';
  elAskSel.className = 'am-ask-sel';
  elAskSel.id = 'am-ask-sel';
  elAskSel.innerHTML = '<svg class="am-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" /></svg><span>Ask Mira</span>';
  root.appendChild(elAskSel);

  var _askSelText = '';
  function hideAskSel(){ elAskSel.classList.remove('is-on'); _askSelText = ''; }
  function selInAssistant(sel){
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    function bubbleOf(n){
      var e = n && (n.nodeType === 1 ? n : n.parentElement);
      if (!e || !e.closest) return null;
      if (e.closest('.am-msg-loading')) return null;   // never offer "Ask Mira" for selections inside a loading state
      return e.closest('.am-msg.is-assistant .am-bubble');
    }
    var b1 = bubbleOf(sel.anchorNode), b2 = bubbleOf(sel.focusNode);
    return (b1 && b2) ? b1 : null;
  }
  function showAskSel(){
    var sel = window.getSelection();
    var inBubble = selInAssistant(sel);
    var text = sel ? String(sel.toString()).replace(/\s+/g, ' ').trim() : '';
    if (!inBubble || text.length < 2){ hideAskSel(); return; }
    var range = sel.getRangeAt(0);
    var rects = range.getClientRects();
    var r = (rects && rects.length) ? rects[0] : range.getBoundingClientRect();
    var rootRect = root.getBoundingClientRect();
    _askSelText = text;
    elAskSel.classList.add('is-on');
    var bw = elAskSel.offsetWidth || 96, bh = elAskSel.offsetHeight || 30;
    var left = (r.left + r.right) / 2 - rootRect.left;
    var top  = r.top - rootRect.top - 8;
    left = Math.max(bw / 2 + 6, Math.min(left, rootRect.width - bw / 2 - 6));
    top  = Math.max(bh + 4, top);
    elAskSel.style.left = left + 'px';
    elAskSel.style.top  = top + 'px';
  }
  elAskSel.addEventListener('mousedown', function(e){ e.preventDefault(); }); // keep the selection alive
  elAskSel.addEventListener('click', function(e){
    e.preventDefault(); e.stopPropagation();
    var t = _askSelText;
    hideAskSel();
    try { window.getSelection().removeAllRanges(); } catch(_){}
    if (!t) return;
    elTextarea.value = '';          // clear whatever was typed before
    setQuote(t);                    // insert the quoted gray chip
    autosize(); refreshSend(); updateLoopState();
    elTextarea.focus();
  });
  document.addEventListener('selectionchange', function(){ requestAnimationFrame(showAskSel); });
  elChat.addEventListener('mouseup', function(){ setTimeout(showAskSel, 0); });
  elChat.addEventListener('scroll', hideAskSel, { passive: true });
  window.addEventListener('resize', hideAskSel);
  document.addEventListener('mousedown', function(e){
    if (e.target.closest && e.target.closest('.am-ask-sel')) return;
    setTimeout(function(){ if (!selInAssistant(window.getSelection())) hideAskSel(); }, 0);
  });

  /* ---------------- Public API ---------------- */
  function setLoading(v){
    S.isLoading = !!v;
    root.classList.toggle('is-loading', S.isLoading);
    elStatusText.textContent = S.isLoading ? 'Analyzing your workspace' : 'Ready';
    refreshSend();
    if (S.isLoading){
      /* setLoading(true) kommt fuer DIESELBE Antwort mehrfach: askMiraSetMessages ruft es bei jedem
         Durchlauf mit laufendem Status, askMiraAddMessage bei jeder unfertigen Antwort. Ein neuer
         Lauf darf deshalb nur beginnen, wenn keiner laeuft -- sonst faengt die Liste jedes Mal von
         vorn an, und alle bisherigen Schritte sind weg. */
      if (RUN.live){ renderMessages(); return; }
      S.toolState = ''; S.currentTool = '';
      loadIdx = Math.floor(Math.random() * ((L().loading||['']).length));   // vary the opening line, set ONCE before render (no instant swap)
      runStart();                                                           // das Protokoll beginnt mit der Denkzeile
      renderMessages(); loadStart();
    } else {
      /* Erst abschliessen, dann zeichnen: runFinish schliesst den letzten Schritt im JETZIGEN Baum,
         und der naechste Render setzt genau diesen Abgang fort (runRow, "frisch"). */
      runFinish(); loadStop(); S.toolState = ''; S.currentTool = ''; renderMessages();
    }
  }

  function asArrayLoose(v){
    if (Array.isArray(v)) return v;
    if (typeof v === 'string'){
      var r = looseJsonParse(v);
      return Array.isArray(r) ? r : [];
    }
    return [];
  }
  // Escape raw control chars (newlines/tabs) that appear INSIDE JSON string literals
  function escapeRawControlsInStrings(s){
    var out = '', inStr = false, esc = false;
    for (var i = 0; i < s.length; i++){
      var c = s.charAt(i);
      if (esc){ out += c; esc = false; continue; }
      if (c === '\\'){ out += c; esc = true; continue; }
      if (c === '"'){ inStr = !inStr; out += c; continue; }
      if (inStr){
        if (c === '\n'){ out += '\\n'; continue; }
        if (c === '\r'){ out += '\\r'; continue; }
        if (c === '\t'){ out += '\\t'; continue; }
      }
      out += c;
    }
    return out;
  }
  // Re-escape quotes that appear UNescaped inside string values. This happens when a
  // Bubble backtick template literal swallows the backslashes of \"…\" before the element
  // ever sees the text. Heuristic: while inside a string, a " only closes it when the next
  // non-space char is one of  : , } ]  (or end) — otherwise it's literal content -> escape it.
  function repairUnescapedQuotes(s){
    var out = '', inStr = false, esc = false;
    for (var i = 0; i < s.length; i++){
      var c = s.charAt(i);
      if (esc){ out += c; esc = false; continue; }
      if (c === '\\'){ out += c; esc = true; continue; }
      if (c === '"'){
        if (!inStr){ inStr = true; out += c; continue; }
        var j = i + 1;
        while (j < s.length && (s.charAt(j) === ' ' || s.charAt(j) === '\t' || s.charAt(j) === '\n' || s.charAt(j) === '\r')) j++;
        var nxt = j < s.length ? s.charAt(j) : '';
        var ende = (nxt === ':' || nxt === '}' || nxt === ']' || nxt === '');
        /* Das Komma allein reicht NICHT als Beleg fuer ein Stringende. Genau daran ist ein Chat
           gescheitert: im Text stand  ...im Prompt "beste lead agentur solar", obwohl 65%...
           Das schliessende Anfuehrungszeichen der Phrase steht direkt vor einem Komma, also hielt
           die Heuristik es fuer das Ende des Wertes -- ab da war alles verschoben und der ganze
           Datensatz unlesbar.
           Nach einem ECHTEN Wertende folgt immer der naechste Schluessel oder Wert, nie ein
           Buchstabe: ein Schluessel steht in Anfuehrungszeichen, ein Wert beginnt mit " { [ einer
           Ziffer oder true/false/null. Steht dort ein Wort wie "obwohl", ist das Komma Teil des
           Textes und das Anfuehrungszeichen gehoert escaped. */
        if (!ende && nxt === ','){
          var k = j + 1;
          while (k < s.length && (s.charAt(k) === ' ' || s.charAt(k) === '\t' ||
                                  s.charAt(k) === '\n' || s.charAt(k) === '\r')) k++;
          var danach = k < s.length ? s.charAt(k) : '';
          ende = (danach === '"' || danach === '{' || danach === '[' ||
                  danach === '}' || danach === ']' || danach === '' ||
                  danach === '-' || (danach >= '0' && danach <= '9') ||
                  s.substr(k, 4) === 'true' || s.substr(k, 4) === 'null' ||
                  s.substr(k, 5) === 'false');
        }
        if (ende){ inStr = false; out += c; }
        else { out += '\\"'; }   // literal quote inside the value -> escape it
        continue;
      }
      out += c;
    }
    return out;
  }
  // Decode a UTF-8 base64 string (handles ä ö ü – „" etc.)
  function b64DecodeUtf8(b64){
    var clean = String(b64).replace(/\s+/g, '');
    var bin = atob(clean);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    try { return new TextDecoder('utf-8').decode(bytes); }
    catch(e){ return decodeURIComponent(escape(bin)); }
  }
  // Tolerant parser: handles a b64: prefix (bulletproof transport), missing outer [ ],
  // raw newlines/tabs inside strings, and quotes un-escaped by Bubble backtick templates.
  function looseJsonParse(str){
    if (typeof str !== 'string') return Array.isArray(str) ? str : null;
    var s = str.trim(); if (!s) return null;
    // Bulletproof path: payload was base64-encoded in Bubble and prefixed with "b64:".
    // This sidesteps ALL quote / newline / special-char issues in transport.
    if (s.slice(0, 4).toLowerCase() === 'b64:'){
      try { s = b64DecodeUtf8(s.slice(4)).trim(); }
      catch(e){ console.warn('[AskMira] b64: payload could not be base64-decoded.'); return null; }
    }
    try { return JSON.parse(s); } catch(e){}
    var wrapped = (s.charAt(0) === '{') ? ('[' + s + ']') : s;
    try { return JSON.parse(wrapped); } catch(e){}
    try { return JSON.parse(escapeRawControlsInStrings(wrapped)); } catch(e){}
    try { return JSON.parse(escapeRawControlsInStrings(s)); } catch(e){}
    // last resort: backticks may have un-escaped inner quotes -> repair quotes, then controls
    try { return JSON.parse(escapeRawControlsInStrings(repairUnescapedQuotes(wrapped))); } catch(e){}
    try { return JSON.parse(escapeRawControlsInStrings(repairUnescapedQuotes(s))); } catch(e){}
    return null;
  }
  function normalizeMessage(m){
    if (!m || typeof m !== 'object') return m;
    if (m.metadata && typeof m.metadata === 'object'){
      if (m.evidence == null && m.metadata.evidence != null) m.evidence = m.metadata.evidence;
      var hasItems = Array.isArray(m.evidence_items) && m.evidence_items.length;
      if (!hasItems && m.metadata.evidence_items != null) m.evidence_items = m.metadata.evidence_items;
      if (m.opportunities == null && m.metadata.opportunities != null) m.opportunities = m.metadata.opportunities;  // RPC nests these under metadata
      if (m.actions == null && m.metadata.actions != null) m.actions = m.metadata.actions;
    }
    if ('evidence_items' in m) m.evidence_items = asArrayLoose(m.evidence_items);
    if ('opportunities' in m) m.opportunities = asArrayLoose(m.opportunities);   // cards (array, or JSON string)
    if ('actions' in m) m.actions = asArrayLoose(m.actions);                     // buttons (array, or JSON string)
    if ('evidence' in m){
      if (typeof m.evidence === 'string'){
        var parsed = looseJsonParse(m.evidence);
        m.evidence = Array.isArray(parsed) ? parsed : (m.evidence.trim() ? m.evidence.split(',').map(function(x){ return x.trim(); }).filter(Boolean) : []);
      } else if (!Array.isArray(m.evidence)) { m.evidence = []; }
    }
    return m;
  }

  function isPendingAssistant(m){
    if (!m || m.role !== 'assistant') return false;
    var st = String(m.status || '').toLowerCase().trim();
    if (st === 'running' || st === 'pending' || st === 'processing' || st === 'streaming' ||
        st === 'in_progress' || st === 'queued' || st === 'thinking' || st === 'generating') return true;
    var terminal = (st === 'success' || st === 'done' || st === 'complete' || st === 'completed' ||
        st === 'error' || st === 'failed' || st === 'cancelled' || st === 'canceled');
    var empty = !String(m.content || '').trim() && !String(m.content_html || '').trim();
    return !!(empty && st && !terminal);
  }
  // If messages get restored but we don't actually know which chat is active (no activeChatId), the UI
  // ends up inconsistent: stale chat visible, title stuck on the skeleton, nothing selected in the sidebar.
  // In that case just fall back to the main/start page. Debounced so a setActiveChat call that arrives
  // right after setMessages (normal restore order) still wins.
  function _maybeHomeIfUnknownChat(){
    clearTimeout(_unknownChatTimer);
    _unknownChatTimer = setTimeout(function(){
      if (S.activeChatId) return;                                   // we DO know the chat
      if (S.isLoading || _pendingAnswer) return;                    // an answer is in flight
      if (!S.messages.length) return;                               // already at the start page
      if (_lastSendTs && (Date.now() - _lastSendTs) < 20000) return; // a fresh live session -> keep it
      S.messages = [];                                              // unknown chat -> show the main page
      renderMessages();
    }, 140);
  }
  var _chatLoadT = 0;
  window.askMiraSetMessages = function(messages){
    S.chatLoading = false; clearTimeout(_chatLoadT);   // real messages arrived -> drop the loading skeletons
    if (typeof messages === 'string'){
      var parsed = looseJsonParse(messages);
      if (parsed == null){
        console.warn('[AskMira] askMiraSetMessages: could not parse the payload — leaving messages unchanged. '+
          'Likely the JSON was truncated in transport or contains characters that broke it. '+
          'Ein unescaptes Anfuehrungszeichen im Text repariert die Komponente selbst; haelt der Payload trotzdem nicht, ist er unterwegs abgeschnitten worden. (Laenge='+messages.length+')');
        return; // keep whatever is currently shown instead of blanking the chat
      }
      messages = parsed;
    }
    var _incoming = (Array.isArray(messages) ? messages : []);
    try {
      var _li = _incoming[_incoming.length - 1] || {};
      // pin down WHAT the opportunities field looks like on the last assistant message (before any coercion)
      var _la = null; for (var _i=_incoming.length-1; _i>=0; _i--){ if (_incoming[_i] && _incoming[_i].role==='assistant'){ _la = _incoming[_i]; break; } }
      if (_la){
        var _opN = _msgOpps(_la).length, _acN = _msgActs(_la).length;
        var _src = (_la.metadata && (_la.metadata.opportunities || _la.metadata.actions)) ? ' (read from metadata)' : '';
      }
    } catch(e){}
    S.messages = _incoming.map(normalizeMessage);
    try {
      var _oppN = 0, _actN = 0, _withOpp = 0;
      S.messages.forEach(function(m){ var o = _msgOpps(m).length, a = _msgActs(m).length; _oppN += o; _actN += a; if (o) _withOpp++; });
    } catch(e){}
    // A trailing assistant message with status "running" = the answer is still being generated.
    // Show the loading/thinking state instead of an empty bubble (survives reloads / re-fetches).
    var _last = S.messages[S.messages.length - 1];
    var _running = isPendingAssistant(_last);
    _pendingAnswer = _running;
    if (_running){ S.messages.pop(); }
    // If a live answer arrives via setMessages without latency_ms, use the measured time.
    if (S.isLoading && _sendStartTs && !_running){
      for (var i = S.messages.length - 1; i >= 0; i--){
        if (S.messages[i] && S.messages[i].role === 'assistant'){
          var lr = S.messages[i].latency_ms;
          var ln = parseFloat(String(lr == null ? '' : lr).replace(',', '.').replace(/[^0-9.]/g, ''));
          if (!isFinite(ln) || ln <= 0) S.messages[i].latency_ms = Date.now() - _sendStartTs;
          break;
        }
      }
      _sendStartTs = 0;
    }
    _scrollMode = 'bottom';
    setLoading(_running); // toggles the loading state to match the RPC status and re-renders
    _maybeHomeIfUnknownChat();   // no active chat known -> fall back to the main page
  };
  window.askMiraAddMessage = function(message){
    if (typeof message === 'string'){ var p = looseJsonParse(message); if (!p) return; message = Array.isArray(p) ? p[0] : p; }
    if (!message || typeof message !== 'object') return;
    var nm = normalizeMessage(message);
    if (nm.role === 'assistant'){
      if (isPendingAssistant(nm)){ _pendingAnswer = true; setLoading(true); return; }
      // If the live answer didn't include latency_ms, fall back to the time we measured since send.
      var latRaw = nm.latency_ms != null ? nm.latency_ms : (nm.metadata && nm.metadata.latency_ms);
      var latNum = parseFloat(String(latRaw == null ? '' : latRaw).replace(',', '.').replace(/[^0-9.]/g, ''));
      if ((!isFinite(latNum) || latNum <= 0) && _sendStartTs){ nm.latency_ms = Date.now() - _sendStartTs; }
      _sendStartTs = 0;
      _pendingAnswer = false;
      setLoading(false);
    }
    S.messages.push(nm);
    renderMessages();
  };
  /* Explicit typing controls — use these when you deliver answers by RELOADING the whole
     message list (so the component can't tell a new answer from a chat-open on its own).
     • askMiraExpectAnswer(): call this RIGHT BEFORE you reload/insert the messages. The next
       render will type out its last Mira message (no flash, since it's hidden from the start).
     • askMiraTypeLastAnswer(): call this RIGHT AFTER the messages are in the DOM to type the
       last Mira message immediately. Returns true if it started typing. */
  window.askMiraExpectAnswer = function(){
    _forceTypeNext = true;
    if (_forceTimer) clearTimeout(_forceTimer);
    _forceTimer = setTimeout(function(){ _forceTypeNext = false; _forceTimer = null; }, 8000);
  };
  window.askMiraTypeLastAnswer = function(){
    var tries = 0;
    function attempt(){
      tries++;
      try {
        var asstEls = root.querySelectorAll('.am-msg.is-assistant:not(.am-msg-loading)');
        var lastEl = asstEls.length ? asstEls[asstEls.length - 1] : null;
        if (lastEl){
          var bub = lastEl.querySelector('.am-bubble');
          var id = lastEl.getAttribute('data-id') || '';
          var dkey = 'dom:' + (id || (bub ? (bub.textContent || '').replace(/\s+/g,' ').slice(0, 60) : ''));
          if (bub && !_typedKeys[dkey] && !bub.querySelector('.am-rv-w')){
            _typedKeys[dkey] = true;
            var units = _prepTyping(bub);
            if (units.length){ _startTyping(bub, units); }
            return;
          }
          if (bub && _typedKeys[dkey]){ return; }
        }
      } catch(e){}
      if (tries < 30) setTimeout(attempt, 70);   // wait up to ~2s for an async reload to land
    }
    attempt();
    return true;
  };
  // Inject Opportunity cards + action buttons into messages that are ALREADY in the DOM
  // (for setups that render the message list themselves and don't pass it through askMiraSetMessages).
  // Call it like askMiraTypeLastAnswer(): after your reload, pass the same messages array.
  window.askMiraSetExtras = function(messages){
    if (typeof messages === 'string'){ var p = looseJsonParse(messages); messages = Array.isArray(p) ? p : null; }
    if (!Array.isArray(messages)){ try { console.warn('[AskMira] askMiraSetExtras: expected an array of message objects (or its JSON string)'); } catch(e){} return 0; }

    function injectInto(el, m){
      if (!el) return false;
      var bub = el.querySelector('.am-bubble'); if (!bub) return false;
      var hasPh = !!bub.querySelector('[data-mira-opportunity]');
      var btnHtml = actionButtonsHtml(m);
      if (!hasPh && !btnHtml) return false;
      var place = function(){
        if (hasPh) mountInlineCards(bub, m);                                  // inline cards at their placeholders
        var b2 = bub.querySelector('.am-msg-buttons'); if (b2) b2.remove();   // idempotent: re-add action buttons at the end
        if (btnHtml) bub.insertAdjacentHTML('beforeend', btnHtml);
        var added = bub.querySelectorAll('.am-opps, .am-msg-buttons');        // fade the new blocks in
        for (var i=0;i<added.length;i++){ added[i].classList.add('am-rv-b'); }
        void bub.offsetWidth;
        for (var j=0;j<added.length;j++){ added[j].classList.add('on'); }
      };
      var msgEl = bub.closest ? bub.closest('.am-msg') : el;
      if (msgEl && msgEl.classList.contains('am-typing')){                    // wait for the answer to finish typing, then mount
        var waited = 0;
        (function w(){ if (!msgEl.classList.contains('am-typing') || waited > 12000){ place(); return; } waited += 120; setTimeout(w, 120); })();
      } else { place(); }
      return true;
    }

    var allAsst = messages.filter(function(m){ return m && String(m.role || 'assistant') === 'assistant'; });
    var withExtras = allAsst.filter(function(m){ return _msgOpps(m).length || _msgActs(m).length; });
    if (!withExtras.length){ return 0; }

    var applied = 0; var doneEls = [];
    // 1) match each message to its DOM row by data-id (preferred, order-independent)
    withExtras.forEach(function(m){
      var id = m.id != null ? String(m.id) : ''; if (!id) return;
      var safe = (window.CSS && CSS.escape) ? CSS.escape(id) : id.replace(/["\\]/g, '\\$&');
      var el = root.querySelector('.am-msg.is-assistant[data-id="' + safe + '"]');
      if (el && doneEls.indexOf(el) < 0 && injectInto(el, m)){ applied++; doneEls.push(el); }
    });
    // 2) anything not matched by id -> align the assistant rows by order (from the newest)
    var matchedAll = applied >= withExtras.length;
    if (!matchedAll){
      var domAsst = Array.prototype.slice.call(root.querySelectorAll('.am-msg.is-assistant:not(.am-msg-loading)'));
      var k = Math.min(allAsst.length, domAsst.length);
      for (var i = 0; i < k; i++){
        var mm = allAsst[allAsst.length - 1 - i];
        var ee = domAsst[domAsst.length - 1 - i];
        if (doneEls.indexOf(ee) >= 0) continue;
        if (_msgOpps(mm).length || _msgActs(mm).length){
          if (injectInto(ee, mm)){ applied++; doneEls.push(ee); }
        }
      }
    }
    return applied;
  };
  window.askMiraSetLoading = function(v){
    if (typeof v === 'string') v = (v === 'true' || v === '1' || v === 'yes');
    if (!v && _pendingAnswer){
      return;
    }
    setLoading(v);
  };
  window.askMiraSetPreviousChats = function(chats){
    if (typeof chats === 'string'){
      var parsed = looseJsonParse(chats);
      if (parsed == null){
        console.warn('[AskMira] askMiraSetPreviousChats: Payload nicht lesbar. Ein unescaptes Anfuehrungszeichen im Text repariert die Komponente selbst; haelt der Payload trotzdem nicht, ist er unterwegs abgeschnitten worden. (Laenge='+chats.length+')');
        return;
      }
      chats = parsed;
    }
    S.previousChats = Array.isArray(chats) ? chats.slice() : [];
    _prevLoaded = true;
    renderPrevious();
  };
  window.askMiraSetProjects = function(projects){
    if (typeof projects === 'string'){
      var parsed = looseJsonParse(projects);
      if (parsed == null){
        console.warn('[AskMira] askMiraSetProjects: Payload nicht lesbar. Ein unescaptes Anfuehrungszeichen im Text repariert die Komponente selbst; haelt der Payload trotzdem nicht, ist er unterwegs abgeschnitten worden.');
        return;
      }
      projects = parsed;
    }
    S.projects = Array.isArray(projects) ? projects.slice() : [];
    renderPrevious();
    tryEnterNewProjectEdit();
  };
  window.askMiraSetTopics = function(topics){
    if (typeof topics === 'string'){
      var parsed = looseJsonParse(topics);
      if (parsed == null){
        console.warn('[AskMira] askMiraSetTopics: Payload nicht lesbar. Ein unescaptes Anfuehrungszeichen im Text repariert die Komponente selbst; haelt der Payload trotzdem nicht, ist er unterwegs abgeschnitten worden.');
        return;
      }
      topics = parsed;
    }
    S.topics = Array.isArray(topics) ? topics.filter(function(t){ return t && t.is_active !== false; }) : [];
    // drop any selected ids that no longer exist
    var ids = {}; S.topics.forEach(function(t){ ids[String(t.id)] = 1; });
    _reportTopics = _reportTopics.filter(function(id){ return ids[String(id)]; });
    if (_galleryCat != null) renderGallery();
  };
  // ---- DOM-based setters: read the JSON from a hidden element so dynamic text is
  // NEVER inlined into Run-JS (no quotes/newlines/umlauts can break the script). ----
  function _amReadEl(sel){
    var el = (typeof sel === 'string')
      ? (document.getElementById(sel) || (root && root.querySelector(sel)) || document.querySelector(sel))
      : sel;
    if (!el){ console.warn('[AskMira] element not found:', sel); return null; }
    var raw = ('value' in el && el.value != null && el.value !== '') ? el.value : (el.textContent || '');
    return raw;
  }
  window.askMiraSetMessagesFromEl      = function(sel){
    var r = _amReadEl(sel); if (r == null) return;
    try {
      var hasOpp = (typeof r === 'string') && r.indexOf('"opportunities"') >= 0;
      var ok = true, err = '';
      if (typeof r === 'string'){ try { JSON.parse(r); } catch(e){ ok = false; err = String((e && e.message) || e); } }
      if (typeof r === 'string' && hasOpp && !ok){
        var mp = /position (\d+)/.exec(err);
        if (mp){ var pos = +mp[1]; console.warn('[AskMira] FromEl: invalid JSON near -> …'+ r.slice(Math.max(0,pos-70), pos+70).replace(/\n/g,'\\n') +'…'); }
      }
      if (typeof r === 'string' && hasOpp && !ok){
        var mp = /position (\d+)/.exec(err);
        if (mp){ var pos = +mp[1]; console.warn('[AskMira] FromEl: invalid JSON near -> …'+ r.slice(Math.max(0,pos-70), pos+70).replace(/\n/g,'\\n') +'…'); }
        console.warn('[AskMira] Der Rohtext enthaelt opportunities, ist aber kein gueltiges JSON. Ein unescaptes Anfuehrungszeichen im Text repariert die Komponente selbst; haelt der Payload trotzdem nicht, ist er unterwegs abgeschnitten worden.');
      }
    } catch(e){}
    window.askMiraSetMessages(r);
  };
  window.askMiraSetTopicsFromEl        = function(sel){ var r = _amReadEl(sel); if (r != null) window.askMiraSetTopics(r); };
  window.askMiraSetPreviousChatsFromEl = function(sel){ var r = _amReadEl(sel); if (r != null) window.askMiraSetPreviousChats(r); };
  window.askMiraSetProjectsFromEl      = function(sel){ var r = _amReadEl(sel); if (r != null) window.askMiraSetProjects(r); };

  // ---- Auto-bind: the component reads its data from hidden elements and re-reads on change.
  // Drop your dynamic JSON into a hidden <textarea id="mira-msgs-data">…</textarea> (and the
  // topics/chats/projects equivalents) in Bubble — NO Run-JS needed, nothing is ever inlined
  // into JS, so backticks/quotes/umlauts/newlines can never break anything. ----
  function _amAutoBind(){
    var map = [
      ['mira-msgs-data',     window.askMiraSetMessages],
      ['mira-topics-data',   window.askMiraSetTopics],
      ['mira-chats-data',    window.askMiraSetPreviousChats],
      ['mira-projects-data', window.askMiraSetProjects],
      ['mira-favicons-data', window.askMiraSetFavicons],
      ['mira-brandlogos-data', window.askMiraSetBrandLogos],
      ['mira-tool-data', window.askMiraSetTool],
      ['mira-title-pending-data', window.askMiraSetTitlePending]
    ];
    map.forEach(function(pair){
      var id = pair[0], fn = pair[1];
      var el = document.getElementById(id);
      if (!el || el.__amBound) return;
      el.__amBound = true;
      var last = null;
      var read = function(){ return ('value' in el && el.value != null && el.value !== '') ? el.value : (el.textContent || ''); };
      var apply = function(){ var v = read(); if (v == null) return; v = String(v); if (v === last) return; if (!v.trim()) return; last = v; try { fn(v); } catch(e){ try { console.warn('[AskMira] auto-bind '+id+' failed', e); } catch(_){} } };
      apply(); // initial read
      try { new MutationObserver(apply).observe(el, { childList: true, characterData: true, subtree: true }); } catch(e){}
    });
  }
  window.askMiraSetActiveChat = function(chatId, fireEvent){
    S.activeChatId = chatId;
    var _c = chatId ? findChat(chatId) : null;
    if (_c && _c.title) S.titlePending = false;   // opened a chat that already has a title -> show it (no skeleton)
    renderPrevious();
    if (window.__amRenderChatTitlebar) window.__amRenderChatTitlebar();
    if (fireEvent && window.bubble_fn_ask_mira_select_chat) window.bubble_fn_ask_mira_select_chat(chatId);
  };
  // Title skeleton control. Call askMiraSetTitlePending(true) whenever a message is sent; the component
  // only actually shows the skeleton if it's the FIRST message of the chat (i.e. no title exists yet).
  // For a follow-up message in an already-titled chat the title just stays. Call askMiraSetTitlePending(false)
  // once the generated title is available (and has been pushed via setPreviousChats/setActiveChat).
  window.askMiraSetTitlePending = function(pending){
    if (amTruthy(pending)){
      var c = S.activeChatId ? findChat(S.activeChatId) : null;
      var firstMessage = !(c && c.title);         // no title yet == first message / title being generated
      S.titlePending = firstMessage;              // not the first message -> keep the existing title
    } else {
      S.titlePending = false;
    }
    if (window.__amRenderChatTitlebar) window.__amRenderChatTitlebar();
  };
  window.askMiraSetTitlePendingFromEl = function(sel){ var r = _amReadEl(sel); if (r != null) window.askMiraSetTitlePending(r); };
  window.askMiraSetExportPending = function(messageId, pending){ setExportPending(messageId, amTruthy(pending)); };
  window.askMiraClearInput = function(){ elTextarea.value = ''; clearQuote(); autosize(); refreshSend(); updateLoopState(); };
  window.askMiraSetTheme = function(theme){
    var t = String(theme||'').toLowerCase();
    window.__askMiraTheme = (t === 'dark' || t === 'light') ? t : null;
    if (t === 'dark' || t === 'light') root.setAttribute('data-theme', t);
    else root.removeAttribute('data-theme'); // fall back to prefers-color-scheme
  };
  window.askMiraSetMarket = function(market){
    S.market = String(market||'').trim().toLowerCase() || S.market;
    window.__askMiraMarket = S.market;
    resolveLang();
    renderSuggested();
    phStart();          // restart loop in the new language
    updateLoopState();
    if (S.isLoading) setThinkText(currentThinkText());
  };
  window.askMiraSetSettings = function(input){
    var obj = input;
    if (typeof input === 'string'){ try { obj = JSON.parse(input); } catch(e){ obj = null; } }
    if (!obj || typeof obj !== 'object') return;
    if (!S.settings) S.settings = { brand:'logo', citation:'icon', response:'logo' };
    var bv = String(obj.brand||'').toLowerCase();
    var cv = String(obj.citation||'').toLowerCase();
    var rv = String(obj.response||'').toLowerCase();
    if (bv === 'logo' || bv === 'icon' || bv === 'none') S.settings.brand = bv;
    if (cv === 'favicon' || cv === 'icon' || cv === 'none') S.settings.citation = cv;
    if (rv === 'logo' || rv === 'icon' || rv === 'none') S.settings.response = rv;
    if (typeof syncSettingsUI === 'function') syncSettingsUI();
    renderMessages();
  };
  // Provide the model -> logo registry used by the response chips.
  // Accepts { models:[{key, logo_url, provider, is_active, display_name}, ...] }, an array, or a JSON string.
  window.askMiraSetModels = function(input){
    var obj = input;
    if (typeof input === 'string'){ try { obj = JSON.parse(input); } catch(e){ obj = null; } }
    var list = obj && obj.models ? obj.models : (Array.isArray(obj) ? obj : []);
    var map = {};
    (Array.isArray(list) ? list : []).forEach(function(m){
      if (!m) return;
      var k = String(m.key || m.model || m.model_key || '').trim();
      if (!k) return;
      map[k.toLowerCase()] = {
        key: k,
        logo_url: m.logo_url || m.logo || '',
        provider: m.provider || '',
        display_name: m.display_name || m.name || k,
        is_active: (String(m.is_active) === 'yes' || m.is_active === true)
      };
    });
    S.models = map;
    renderMessages();   // refresh so response chips pick up the logos
  };

  // ---- loading-state asset pools ----
  // favicons pool (sources loader). Accepts an array / JSON string. Each item may be a
  // plain domain/url string, or { url|favicon_url|icon_url|src, domain, label|name }.
  function _normFavicon(it){
    if (it == null) return null;
    if (typeof it === 'string'){
      var s = it.trim(); if (!s) return null;
      var src = /^https?:\/\//i.test(s) ? s : ('https://www.google.com/s2/favicons?sz=64&domain=' + s);
      return { src: src, label: s };
    }
    var d = it.domain || it.url || '';
    var src2 = it.favicon_url || it.icon_url || it.src || it.url ||
      (it.domain ? ('https://www.google.com/s2/favicons?sz=64&domain=' + it.domain) : '');
    if (!src2) return null;
    return { src: src2, label: it.label || it.name || d || '' };
  }
  window.askMiraSetFavicons = function(input){
    var arr = input;
    if (typeof input === 'string'){ var p = looseJsonParse(input); arr = (p == null) ? [] : p; }
    if (arr && !Array.isArray(arr)) arr = arr.domains || arr.favicons || arr.sources || [];
    S.favicons = (Array.isArray(arr) ? arr : []).map(_normFavicon).filter(Boolean).slice(0, 20);
    if (S.isLoading) runRefreshLogos('sources');
  };
  // brand-logos pool (brand loader). Accepts an array / JSON string. Each item may be a
  // plain domain string, or { logo_url|logo|icon_url|src|url, domain, name|label, color }.
  function _normBrandLogo(it){
    if (it == null) return null;
    if (typeof it === 'string'){
      var s = it.trim(); if (!s) return null;
      if (/^https?:\/\//i.test(s)) return { src: s, fb_src: '', label: s, color: '' };
      return { src: 'https://www.google.com/s2/favicons?sz=64&domain=' + s, fb_src: '', label: s, color: '' };   // domain -> favicon (reliable, matches the chat)
    }
    var dom = it.domain || it.website || it.url_domain || '';
    var explicit = it.logo_url || it.logo || it.icon_url || it.image_url || it.image || it.favicon_url || it.src || it.url || '';
    var favi = dom ? ('https://www.google.com/s2/favicons?sz=64&domain=' + dom) : '';
    var src = explicit || favi;
    if (!src) return null;
    return { src: src, fb_src: (explicit && favi && explicit !== favi) ? favi : '', label: it.name || it.label || dom || '', color: it.color || '' };
  }
  window.askMiraSetBrandLogos = function(input){
    var arr = input;
    if (typeof input === 'string'){ var p = looseJsonParse(input); arr = (p == null) ? [] : p; }
    if (arr && !Array.isArray(arr)) arr = arr.companies || arr.brands || arr.brandLogos || [];
    S.brandLogos = (Array.isArray(arr) ? arr : []).map(_normBrandLogo).filter(Boolean).slice(0, 20);
    if (S.isLoading) runRefreshLogos('brand');
  };
  window.askMiraSetCompanies = window.askMiraSetBrandLogos;   // alias for the "companies" payload
  /* Der gerade laufende Werkzeugschritt -> einer von vier Zustaenden -> eine Zeile im Protokoll.
     Zweimal derselbe Zustand hintereinander bleibt EINE Zeile: die laufende bleibt unveraendert
     stehen, samt ihrem Text und ihren Logos. Erst ein anderer Zustand macht eine neue auf. */
  window.askMiraSetTool = function(tool){
    var key = String(tool == null ? '' : tool).trim().toLowerCase();
    var st = _TOOL_STATE[key] || '';
    if (!S.isLoading){ S.currentTool = key; S.toolState = st; return; }
    if (!st) return;                       // unbekannter Name: die Liste bleibt, wie sie ist
    S.currentTool = key;
    if (st === runTail()) return;          // derselbe Typ -> nichts aendert sich
    S.toolState = st;
    _runQ.push({ st: st, key: key });
    runDrain();
  };
  window.askMiraSetFaviconsFromEl   = function(sel){ var r = _amReadEl(sel); if (r != null) window.askMiraSetFavicons(r); };
  window.askMiraSetBrandLogosFromEl = function(sel){ var r = _amReadEl(sel); if (r != null) window.askMiraSetBrandLogos(r); };
  window.askMiraSetToolFromEl       = function(sel){ var r = _amReadEl(sel); if (r != null) window.askMiraSetTool(r); };

  window.askMiraGetState = function(){ return JSON.stringify(S); };

  /* ---------------- Events ---------------- */
  elTextarea.addEventListener('input', function(){ autosize(); refreshSend(); updateLoopState(); });
  elTextarea.addEventListener('keydown', function(e){
    if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); sendMessage(); }
  });
  elSend.addEventListener('click', function(){ sendMessage(); });

  // dropdowns: model + answer-detail (both use the .am-model structure)
  root.addEventListener('click', function(e){
    if (!e.target.closest) return;
    var opt = e.target.closest('.am-model-opt');
    if (opt){
      e.preventDefault(); e.stopPropagation();
      var dd = opt.closest('.am-model');
      if (dd && dd.classList.contains('am-detail-dd')) setDetail(opt.getAttribute('data-detail'));
      else setModel(opt.getAttribute('data-model'));
      return;
    }
    var btn = e.target.closest('.am-model-btn');
    if (btn){ e.preventDefault(); e.stopPropagation(); _ddToggle(btn.closest('.am-model')); return; }
    if (!e.target.closest('.am-model-menu')) _ddCloseAll();
  });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') _ddCloseAll(); });

  // flash tooltip: let it escape the settings panel's overflow while hovering the (locked) answer-detail row
  var elDetailRow = root.querySelector('.am-detail-row'), _tipT = 0;
  if (elDetailRow){
    elDetailRow.addEventListener('mouseenter', function(){ clearTimeout(_tipT); if (root.classList.contains('is-flash') && elSettingsPanel) elSettingsPanel.classList.add('has-tip'); });
    elDetailRow.addEventListener('mouseleave', function(){ clearTimeout(_tipT); _tipT = setTimeout(function(){ if (elSettingsPanel) elSettingsPanel.classList.remove('has-tip'); }, 240); });   // wait for the fade-out before re-clipping
  }

  function toggleSettings(force){
    var open = (typeof force === 'boolean') ? force : !elSettingsPanel.classList.contains('is-open');
    elSettingsPanel.classList.toggle('is-open', open);
    var shell = root.querySelector('#am-composer-shell'); if (shell) shell.classList.toggle('is-settings-open', open);
    elSettingsToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) setTimeout(moveThumb, 30); // measure once visible
    else { closeModelMenu(); if (elSettingsPanel) elSettingsPanel.classList.remove('has-tip'); }   // closing the panel closes the model menu + tooltip overflow too
  }
  elSettingsToggle.addEventListener('click', function(e){ e.stopPropagation(); toggleSettings(); });
  // note: the tray stays open until the fader is clicked again or the first message is sent
  // (deliberately NOT closing on outside/input clicks).

  elSuggGrid.addEventListener('click', function(e){
    var back = e.target.closest('[data-gallery-back]');
    if (back){ _galleryCat = null; renderGallery(); return; }
    // reporting: date-range dropdown toggle
    var rtog = e.target.closest('[data-rep-range-toggle]');
    if (rtog){ e.stopPropagation(); var wrap = rtog.closest('.am-rep-range-wrap');
      if (wrap) wrap.classList.toggle('is-open'); return; }
    // reporting: range selected
    var ropt = e.target.closest('[data-rep-range]');
    if (ropt){ _reportRange = ropt.getAttribute('data-rep-range'); renderGallery(); return; }
    /* Open/close, row toggling, search, Or/And and Clear are all the component's own doing now --
       and crucially it does NOT re-render the gallery for any of them, which the old panel had to,
       losing focus and scroll position on every single click. */
    // reporting: edit affordance -> fill the composer and focus so the user can edit before sending
    var redit = e.target.closest('[data-rep-edit]');
    if (redit){
      e.stopPropagation();
      var ecard = redit.closest('[data-rep-idx]');
      var ecat = (L().gallery || [])[_galleryCat];
      var erep = ecat && ecat.reports && ecard ? ecat.reports[parseInt(ecard.getAttribute('data-rep-idx'),10)] : null;
      if (!erep) return;
      var ede = (L() === STR.de);
      var eq = String(erep.prompt || '').replace('{TIMEFRAME}', repTimeframe(_reportRange)) + repTopicClause(ede);
      elTextarea.value = eq;
      elTextarea.dispatchEvent(new Event('input', { bubbles: true }));   // autosize + refreshSend + stop looping placeholder
      elTextarea.focus();
      try { elTextarea.setSelectionRange(eq.length, eq.length); } catch(_e){}
      return;
    }
    // reporting: report card -> build prompt with timeframe + topics
    var rcard = e.target.closest('[data-rep-idx]');
    if (rcard){
      var cat = (L().gallery || [])[_galleryCat];
      var rep = cat && cat.reports ? cat.reports[parseInt(rcard.getAttribute('data-rep-idx'),10)] : null;
      if (!rep) return;
      var de = (L() === STR.de);
      var q = String(rep.prompt || '').replace('{TIMEFRAME}', repTimeframe(_reportRange)) + repTopicClause(de);
      if (window.bubble_fn_ask_mira_suggested_question) window.bubble_fn_ask_mira_suggested_question(q);
      sendMessage(q);
      return;
    }
    var catc = e.target.closest('.am-cat-card');
    if (catc){ _galleryCat = parseInt(catc.getAttribute('data-cat'), 10); renderGallery(); return; }
    var pr = e.target.closest('.am-gallery-prompt');
    if (!pr) return;
    var q = pr.getAttribute('data-q');
    if (window.bubble_fn_ask_mira_suggested_question) window.bubble_fn_ask_mira_suggested_question(q);
    sendMessage(q); // send directly (premium feel); change to fill-only if you prefer
  });
  // mobile quick actions -> reuse the same prompts (with timeframe) and send
  var elQuick = root.querySelector('#am-quick');
  if (elQuick){
    elQuick.addEventListener('click', function(e){
      var it = e.target.closest('.am-quick-item'); if (!it) return;
      var q = String(it.getAttribute('data-qa') || '').replace('{TIMEFRAME}', repTimeframe(_reportRange));
      if (window.bubble_fn_ask_mira_suggested_question) window.bubble_fn_ask_mira_suggested_question(q);
      sendMessage(q);
    });
  }
  // report cards: reveal the edit affordance after ~1s of hover
  var _repEditTimer = null, _repEditCard = null;
  if (elSuggGrid){
    elSuggGrid.addEventListener('mouseover', function(e){
      var card = e.target.closest('.am-rep-card');
      if (!card || card === _repEditCard) return;
      if (_repEditCard) _repEditCard.classList.remove('is-editable');
      clearTimeout(_repEditTimer);
      _repEditCard = card;
      _repEditTimer = setTimeout(function(){ if (_repEditCard) _repEditCard.classList.add('is-editable'); }, 750);
    });
    elSuggGrid.addEventListener('mouseout', function(e){
      var card = e.target.closest('.am-rep-card');
      if (!card) return;
      if (e.relatedTarget && card.contains(e.relatedTarget)) return;   // still inside the same card
      clearTimeout(_repEditTimer);
      card.classList.remove('is-editable');
      if (_repEditCard === card) _repEditCard = null;
    });
  }
  document.addEventListener('click', function(e){
    if (!elSuggGrid) return;
    var open = elSuggGrid.querySelector('.am-rep-range-wrap.is-open');
    if (open && !e.target.closest('.am-rep-range-wrap')) open.classList.remove('is-open');
  });

  /* ---- Message hover actions: copy / thumbs up / thumbs down ---- */
  function htmlToText(html){
    var d = document.createElement('div'); d.innerHTML = String(html||'');
    return (d.textContent || d.innerText || '').replace(/\n{3,}/g,'\n\n').trim();
  }
  function messageText(m){
    if (!m) return '';
    if (m.content && String(m.content).trim()) return String(m.content);
    if (m.content_html) return htmlToText(m.content_html);
    return '';
  }
  function copyText(text){
    text = String(text||'');
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function(resolve, reject){
      try { var ta = document.createElement('textarea'); ta.value = text; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); resolve(); }
      catch(err){ reject(err); }
    });
  }
  function flashCopied(btn){
    var original = btn.innerHTML;
    btn.innerHTML = ICON.check; btn.classList.add('is-copied');
    setTimeout(function(){ btn.innerHTML = original; btn.classList.remove('is-copied'); }, 1300);
  }
  function fireFeedback(messageId, rating){
    var payload = { chat_id: S.activeChatId, message_id: messageId, rating: rating };
    if (window.bubble_fn_ask_mira_feedback) window.bubble_fn_ask_mira_feedback(JSON.stringify(payload));
    else { window.dispatchEvent(new CustomEvent('askmira:feedback', { detail: payload })); console.log('Ask Mira feedback:', payload); }
  }
  function fireExportPdf(messageId){
    var payload = { assistant_message_id: messageId, session_id: S.activeChatId };
    if (window.bubble_fn_ask_mira_export_pdf) window.bubble_fn_ask_mira_export_pdf(JSON.stringify(payload));
    else { window.dispatchEvent(new CustomEvent('askmira:export-pdf', { detail: payload })); console.log('Ask Mira export to pdf:', payload); }
  }
  function setExportPending(messageId, pending){
    var id = String(messageId == null ? '' : messageId);
    if (!id) return;
    if (pending) exportPendingMap[id] = true; else delete exportPendingMap[id];
    var btn = null, rows = elMessages.querySelectorAll('.am-msg');
    for (var i=0;i<rows.length;i++){ if (String(rows[i].getAttribute('data-id')) === id){ btn = rows[i].querySelector('.am-act-btn[data-act="export"]'); break; } }
    if (!btn) return; // not in DOM right now — map still holds state for the next render
    if (pending){ btn.classList.add('is-exporting'); btn.disabled = true; btn.innerHTML = '<span class="am-act-spinner" aria-hidden="true"></span>'; }
    else { btn.classList.remove('is-exporting'); btn.disabled = false; btn.innerHTML = ICON.download; }
  }

  /* ---- URL choice popover (Visit vs. Open detail page) ---- */
  var urlPop = document.createElement('div');
  urlPop.className = 'am-url-pop';
  root.appendChild(urlPop);
  var urlPopWrap = null;
  function hideUrlPop(){ if (urlPopWrap){ urlPop.classList.remove('is-open'); urlPopWrap = null; } }
  function visitUrlFor(wrap){
    var a = wrap.closest('a[href]');
    if (a && a.getAttribute('href')) return a.getAttribute('href');
    return wrap.getAttribute('data-entity-key') || wrap.getAttribute('data-entity-url') || wrap.getAttribute('data-url') || '';
  }
  function urlPreview(u, n){
    var s = String(u||'').replace(/^https?:\/\/(www\.)?/i, '').replace(/\/+$/, '');
    n = n || 15;
    return s.length > n ? s.slice(0, n) + '…' : s;
  }
  function openEvidenceFor(wrap){
    var row0 = wrap.closest('.am-msg');
    var payload = {
      chat_id: S.activeChatId || '',
      message_id: row0 ? (row0.getAttribute('data-id') || '') : '',
      entity_id: wrap.getAttribute('data-entity-id') || '',
      type: wrap.getAttribute('data-type') || '',
      action: wrap.getAttribute('data-action') || '',
      evidence_id: wrap.getAttribute('data-ev-id') || '',
      entity_key: wrap.getAttribute('data-entity-key') || '',
      entity_url: wrap.getAttribute('data-entity-url') || '',
      url: wrap.getAttribute('data-url') || '',
      domain: wrap.getAttribute('data-domain') || '',
      title: wrap.getAttribute('data-title') || ''
    };
    if (window.bubble_fn_ask_mira_open_evidence) window.bubble_fn_ask_mira_open_evidence(JSON.stringify(payload));
    else { window.dispatchEvent(new CustomEvent('askmira:open_evidence', { detail: payload })); console.log('Ask Mira open evidence:', payload); }
  }
  function showUrlPop(wrap){
    var visit = visitUrlFor(wrap);
    var iconVisit = '<svg viewBox="0 0 24 24"><path d="M15 3h6v6" /> <path d="M10 14 21 3" /> <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>';
    var iconDetail = '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
    urlPop.innerHTML =
      '<button type="button" data-pop="detail" class="is-primary">'+iconDetail+'<span>'+esc(L().urlDetail)+'</span></button>' +
      '<button type="button" data-pop="visit">'+iconVisit+'<span>'+esc(urlPreview(visit, 34))+'</span></button>';
    urlPopWrap = wrap;
    urlPop.classList.add('is-open');
    var r = wrap.getBoundingClientRect();
    var rr = root.getBoundingClientRect();
    urlPop.style.top = (r.bottom - rr.top + 6) + 'px';
    urlPop.style.left = (r.left - rr.left) + 'px';
    requestAnimationFrame(function(){
      var maxLeft = root.clientWidth - urlPop.offsetWidth - 8;
      var left = r.left - rr.left;
      if (left > maxLeft) urlPop.style.left = Math.max(8, maxLeft) + 'px';
    });
  }
  urlPop.addEventListener('click', function(e){
    var btn = e.target.closest('button[data-pop]'); if (!btn || !urlPopWrap) return;
    var wrap = urlPopWrap, kind = btn.getAttribute('data-pop');
    hideUrlPop();
    if (kind === 'visit'){
      var u = visitUrlFor(wrap);
      if (u) window.open(u, '_blank', 'noopener');
    } else { openEvidenceFor(wrap); }
  });
  // dismiss on outside click / scroll / escape
  document.addEventListener('click', function(e){
    if (urlPopWrap && !e.target.closest('.am-url-pop') && !e.target.closest('.am-logo-wrap')) hideUrlPop();
  }, true);
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') hideUrlPop(); });
  if (typeof elChat !== 'undefined' && elChat) elChat.addEventListener('scroll', hideUrlPop, true);

  elMessages.addEventListener('click', function(e){
    var moreBtn = e.target.closest ? e.target.closest('.am-user-more') : null;
    if (moreBtn){
      var ubody = moreBtn.closest('.am-user-body');
      var urow = moreBtn.closest('.am-msg');
      var uid = urow ? urow.getAttribute('data-id') : null;
      if (ubody){
        var nowClamped = ubody.classList.toggle('is-clamped');
        moreBtn.textContent = nowClamped ? 'Mehr anzeigen' : 'Weniger anzeigen';
        if (uid){ if (nowClamped) delete userExpandedMap[uid]; else userExpandedMap[uid] = true; }
      }
      return;
    }
    var wrap = e.target.closest('.am-logo-wrap');
    if (wrap){
      var _wtype = wrap.getAttribute('data-type');
      var _visit = visitUrlFor(wrap);
      // ALWAYS offer the choice for URL links (detail page stays primary, but the URL can be
      // opened directly). Domains keep opening their detail page directly.
      if (_wtype === 'url' && _visit){
        e.preventDefault();      // stop any native <a target="_blank"> navigation
        e.stopPropagation();
        if (urlPopWrap === wrap) { hideUrlPop(); }
        else { showUrlPop(wrap); }
        return;
      }
      // brands / competitors / anything without a visitable URL -> open detail directly
      openEvidenceFor(wrap);
      return;
    }
    var btn = e.target.closest('.am-act-btn'); if (!btn) return;
    var row = btn.closest('.am-msg'); if (!row) return;
    var id = row.getAttribute('data-id');
    var m = null; for (var i=0;i<S.messages.length;i++){ if (String(S.messages[i].id)===String(id)){ m = S.messages[i]; break; } }
    var act = btn.getAttribute('data-act');

    if (act === 'export'){ setExportPending(id, true); fireExportPdf(id); return; }

    if (act === 'copy'){ copyText(messageText(m)).then(function(){ flashCopied(btn); }).catch(function(){}); return; }

    if (act === 'up' || act === 'down'){
      var current = feedbackMap[id] || '';
      var next = (current === act) ? '' : act; // toggle off if same
      feedbackMap[id] = next;
      var group = btn.parentNode;
      var upBtn = group.querySelector('[data-act="up"]');
      var downBtn = group.querySelector('[data-act="down"]');
      if (upBtn) upBtn.classList.toggle('is-active', next === 'up');
      if (downBtn) downBtn.classList.toggle('is-active', next === 'down');
      fireFeedback(id, next || 'none');
    }
  });

  /* ---- Evidence hover -> explainer popover ----
     Same body-mounted widget the table column-header info icons use (light preview panel style,
     flips above the trigger when there isn't room below). The evidence row used to hover a
     window.RichTooltip widget that was never actually defined anywhere in this codebase, so in
     practice nothing showed on hover -- this is the first working version of it. */
  var EV_TIP_TITLE = 'Connected data points';
  var EV_TIP_TEXT = 'Mira used these parts of your AI Search data to build this answer. The listed items show which connected data types supported the response.';
  if (window.UpstreemCore && window.UpstreemCore.makeExplain){
    window.UpstreemCore.makeExplain({
      root: root,
      getIsDark: function(){ return root.getAttribute('data-theme') === 'dark'; },
      html: function(){
        return '<div class="up-explain-h">' + esc(EV_TIP_TITLE) + '</div>' +
               '<div class="up-explain-t">' + esc(EV_TIP_TEXT) + '</div>';
      }
    });
  }

  /* Die Leiste ist eine ECHTE Seitenleiste: sie draengt den Inhalt zur Seite, statt ihn zu
     ueberdecken. Ihr Zustand ueberlebt den Seitenwechsel, und die Vorgabe ist OFFEN -- deshalb
     "kein Eintrag" ausdruecklich als offen gelesen und nicht als geschlossen. */
  var SIDE_KEY = 'am_side_open';
  function seiteOffen(){
    try { var v = localStorage.getItem(SIDE_KEY); return v === null ? true : v === '1'; }
    catch(e){ return true; }   /* privates Fenster wirft schon beim Lesen */
  }
  function seiteMerken(offen){ try { localStorage.setItem(SIDE_KEY, offen ? '1' : '0'); } catch(e){} }

  function openPrev(){ renderPrevious(); root.classList.add('prev-open'); elPrevPanel.setAttribute('aria-hidden','false'); elPrevScrim.hidden = false; if (elPrevList) elPrevList.scrollTop = 0; seiteMerken(true); }
  function closePrev(){ root.classList.remove('prev-open'); elPrevPanel.setAttribute('aria-hidden','true'); if (typeof openHlPanel === 'function') openHlPanel(false); seiteMerken(false); }
  function togglePrev(){ if (root.classList.contains('prev-open')) closePrev(); else openPrev(); }
  /* Der Knopf im Kopfbereich UMSCHALTET jetzt. Vorher hat er nur geoeffnet, und das war richtig,
     solange die Leiste ueber dem Inhalt lag und sich immer selbst wieder schloss. Jetzt ist sie
     standardmaessig offen -- ein Knopf, der bei offener Leiste nichts tut, sieht kaputt aus. */
  elOpenPrev.addEventListener('click', togglePrev);
  elClosePrev.addEventListener('click', closePrev);
  elPrevScrim.addEventListener('click', closePrev);
  /* Escape schliesst nur, solange die Leiste ueber dem Inhalt liegt -- am Telefon. Auf dem Schirm
     ist sie Teil des Layouts, und dort waere Escape ein Layoutwechsel aus dem Nichts. */
  document.addEventListener('keydown', function(e){
    if (e.key !== 'Escape' || !root.classList.contains('prev-open')) return;
    if (window.matchMedia && window.matchMedia('(max-width: 720px)').matches) closePrev();
  });

  /* ---------------- die Leiste zur echten Leiste machen ----------------
     Drei Dinge, und alle drei hier und nicht in bubble/*.html: die Vorlage ist die Vorlage fuer
     eine NEUinstallation, ein bereits eingebautes Element bekaeme neues Markup nie.
       1. Die Leiste steht als Kind IN der Schale. Als Geschwister der Schale kann die Wurzel
          beide als Flex-Zeile nebeneinander legen -- das ist der ganze Unterschied zwischen
          "liegt darueber" und "draengt zur Seite".
       2. Der Kopfbereich wird neu gebaut: Umschalter links, Logo rechts. Gespiegelt zu einer
          linken Leiste, weil diese hier rechts sitzt.
       3. Die zwei Knoepfe der Werkzeugleiste werden zu Menuezeilen. Ihre KNOTEN bleiben
          dieselben -- ihre Zuhoerer haengen an genau diesen Elementen, ein Neubau haette sie
          stumm gemacht. */
  (function seitenleiste(){
    var schale = root.querySelector('.am-shell');
    if (!elPrevPanel || !schale) return;
    if (elPrevPanel.parentNode !== root) root.appendChild(elPrevPanel);

    var kopf = elPrevPanel.querySelector('.am-prev-head');
    if (kopf && !kopf.getAttribute('data-side')){
      kopf.setAttribute('data-side', '1');
      kopf.innerHTML = '';
      var um = document.createElement('button');
      um.type = 'button'; um.className = 'up-iconbtn am-side-toggle';
      um.setAttribute('aria-label', 'Collapse sidebar');
      /* window.UpstreemCore und nicht UC: das Kuerzel gilt nur im Bootblock oben, hier nicht --
         der erste Versuch hat an dieser Zeile geworfen und den Kopfbereich leer gelassen. Die
         Nachbarschaft macht es genauso (siehe moreHorizontal weiter oben). */
      var kern = window.UpstreemCore;
      um.innerHTML = (kern && kern.icon) ? kern.icon('sidebarPanels') : '';
      um.addEventListener('click', closePrev);
      /* DASSELBE Markenzeichen wie oben links im Kopf: .am-brand aus Zeichen (blend) und
         Schriftzug "mira". Nicht ein anderes Zeichen in kleiner -- die Klassen sind die des
         Kopfes, die Leiste setzt nur die Groessen herunter. Ein zweites Logo waere ein zweites
         Logo, auch wenn es aehnlich aussieht. */
      /* NUR der Schriftzug, ohne Zeichen: in einer 250px-Leiste neben einem Umschalter ist das
         Zeichen ein zweites Signal fuer dieselbe Sache. Die Klasse bleibt die des Kopfes
         (.am-wordmark), die Leiste setzt nur die Groesse. */
      var logo = document.createElement('span');
      logo.className = 'am-brand am-side-logo';
      logo.innerHTML = '<span class="am-wordmark">mira</span>';
      kopf.appendChild(um); kopf.appendChild(logo);
    }

    var leiste = elPrevPanel.querySelector('.am-prev-toolbar');
    if (leiste) leiste.classList.add('am-side-nav');
    /* up-filter-item ist die geteilte Menuezeile aus core -- dasselbe Bauteil wie in den
       Menuepunkten von prompt-research. am-side-item ergaenzt nur, was ein <button> selbst
       mitbringt und was die alten Karten-Regeln dieser zwei Knoepfe ueberschreiben muss. */
    if (elNewChat) elNewChat.classList.add('up-filter-item', 'am-side-item');
    if (elHlBtn) elHlBtn.classList.add('up-filter-item', 'am-side-item');

    /* ---- Breite verstellbar, wie die erste Spalte einer Tabelle ----
       Der GRIFF ist der aus core (.up-grip): dieselbe Trefferzone von 9px, derselbe col-resize,
       derselbe 2px-Strich im Hover. Die LOGIK ist eine eigene -- die des Kits haengt an
       Spaltenspuren, Mindestbreiten und autoFit, davon gibt es hier nichts. Was uebernommen ist,
       ist ihr Muster: pointermove auf ein Bild pro Rahmen zusammenfassen (ein Trackpad feuert
       bis 120 Hz, also mehrmals je Bild), die letzte Position beim Loslassen noch schreiben, und
       is-resizing an die Wurzel, damit der Zeiger ueberall col-resize bleibt.
       Nach LINKS ziehen macht breiter, weil die Leiste rechts sitzt -- daher das Minus. */
    var W_KEY = 'am_side_w', W_MIN = 200, W_MAX = 350, W_VOR = 250;
    function breiteLesen(){
      var v = NaN;
      try { v = parseInt(localStorage.getItem(W_KEY), 10); } catch(e){}
      if (!isFinite(v)) return W_VOR;
      return Math.max(W_MIN, Math.min(W_MAX, v));
    }
    function breiteSetzen(px, merken){
      var w = Math.max(W_MIN, Math.min(W_MAX, Math.round(px)));
      root.style.setProperty('--am-side-w', w + 'px');
      if (merken){ try { localStorage.setItem(W_KEY, String(w)); } catch(e){} }
      return w;
    }
    breiteSetzen(breiteLesen(), false);
    if (!elPrevPanel.querySelector('.am-side-grip')){
      var griff = document.createElement('span');
      griff.className = 'up-grip am-side-grip';
      griff.setAttribute('aria-hidden', 'true');
      elPrevPanel.appendChild(griff);
      griff.addEventListener('pointerdown', function(e){
        if (e.button !== 0) return;
        var startX = e.clientX, startW = elPrevPanel.getBoundingClientRect().width;
        griff.classList.add('is-active');
        root.classList.add('is-resizing');
        var raf = null, letztesX = null;
        function schreiben(){ if (letztesX == null) return; breiteSetzen(startW - (letztesX - startX), false); }
        function bewegen(ev){
          letztesX = ev.clientX;
          if (raf) return;
          raf = requestAnimationFrame(function(){ raf = null; schreiben(); });
        }
        function los(){
          if (raf){ cancelAnimationFrame(raf); raf = null; }
          schreiben();
          document.removeEventListener('pointermove', bewegen);
          document.removeEventListener('pointerup', los);
          root.classList.remove('is-resizing');
          griff.classList.remove('is-active');
          breiteSetzen(elPrevPanel.getBoundingClientRect().width, true);
        }
        document.addEventListener('pointermove', bewegen);
        document.addEventListener('pointerup', los);
        e.preventDefault();
      });
    }

    /* Die Blende erst freigeben, wenn der Anfangszustand steht: sonst faehrt die Leiste beim
       Laden einmal herein, und das sieht aus wie ein Fehler statt wie eine Einstellung.
       Uhr neben requestAnimationFrame, weil rAF in einem VERDECKTEN Tab gar nicht laeuft und
       Mira in Bubble regelmaessig in einem noch nicht vorderen Tab haengt -- dieselbe Lektion
       wie beim Hintergrundbild. classList.add ist idempotent. */
    if (seiteOffen()){
      root.classList.add('prev-open');
      elPrevPanel.setAttribute('aria-hidden', 'false');
      /* UND einmal zeichnen. Vorher lief das nur ueber openPrev(), also erst beim Klick -- mit
         standardmaessig offener Leiste haette die Liste bis zum ersten Datenpaket LEER gestanden,
         nicht einmal das Skelett waere da gewesen. Gemessen: keine .am-prev-skel im DOM. */
      renderPrevious();
    }
    function frei(){ root.classList.add('side-ready'); }
    requestAnimationFrame(function(){ requestAnimationFrame(frei); });
    setTimeout(frei, 120);
  })();

  /* ---------------- Laufender Text bei abgeschnittenen Namen ----------------
     Warum nicht als CSS-Animation: die Strecke haengt vom Text ab. Eine Keyframe-Prozentangabe
     laeuft bei kurzen Namen zu weit und bei langen nicht weit genug -- also wird die Strecke
     gemessen und als transform gesetzt, mit einer Dauer, die zur Strecke passt.
     Und warum der Text erst im Hover eingepackt wird, statt dauerhaft in einem Span zu stecken:
     die Auslassungspunkte. text-overflow: ellipsis greift nur an Inline-Inhalt, den es
     abschneiden kann -- steckt der Text in einem inline-block, bleibt der Ruhezustand ohne
     Punkte. Also traegt das Etikett im Ruhezustand seinen Text direkt (Punkte da), und nur
     solange der Zeiger darauf steht, liegt er in einem Span, der sich schieben laesst.
     Nebenwirkung, die dafuer spricht: an anderer Stelle wird titleEl.textContent neu gesetzt
     (Umbenennen) -- ein dauerhafter Span waere dabei stillschweigend verschwunden. */
  var LAUF_WARTE = 700;        /* nicht jeder Zeiger, der ueber die Liste streicht, soll etwas bewegen */
  var LAUF_PX_PRO_S = 85;      /* lesbares Tempo, unabhaengig von der Laenge: 216px Ueberhang
                                  brauchen damit 2,5s. 55 waren mit 3,9s zu langsam, 120 mit
                                  1,8s zu schnell. */
  var LAUF_MIN_MS = 480;
  var _laufUhr = null, _laufEl = null;
  function laufStop(){
    if (_laufUhr){ clearTimeout(_laufUhr); _laufUhr = null; }
    _laufWartetAuf = null;
    var el = _laufEl; _laufEl = null;
    if (!el) return;
    el.classList.remove('is-laufen');
    var innen = el.querySelector('.am-lauf');
    if (innen) el.textContent = innen.textContent;
  }
  function laufStart(el){
    if (!el || el.querySelector('.am-lauf')) return;
    /* Passt der Text hinein, gibt es nichts zu schieben. Gemessen am Etikett selbst, VOR dem
       Umbau -- danach ist scrollWidth die Breite des Spans und die Frage waere eine andere. */
    if (el.scrollWidth - el.clientWidth <= 1) return;
    var text = el.textContent || '';
    var innen = document.createElement('span');
    innen.className = 'am-lauf'; innen.textContent = text;
    el.textContent = ''; el.appendChild(innen);
    el.classList.add('is-laufen');
    _laufEl = el;
    var ueber = innen.scrollWidth - el.clientWidth;
    if (ueber <= 1){ laufStop(); return; }
    var dauer = Math.max(LAUF_MIN_MS, Math.round(ueber / LAUF_PX_PRO_S * 1000));
    innen.style.transition = 'transform ' + dauer + 'ms ease-out';
    /* Ein Bild warten: der Span ist gerade erst eingesetzt, sein Startwert ist noch nicht
       angewandt, und ein im selben Bild gesetzter Uebergang laeuft nicht. */
    /* Uhr NEBEN requestAnimationFrame, aus demselben Grund wie beim Hintergrundbild: rAF laeuft
       in einem verdeckten Tab gar nicht. Beides setzt denselben Wert, der zweite Aufruf ist ein
       Nichts. */
    function los(){ if (_laufEl === el) innen.style.transform = 'translateX(-' + ueber + 'px)'; }
    requestAnimationFrame(los);
    setTimeout(los, 24);
  }
  var LAUF_SEL = '.am-prev-item-title, .am-prev-proj-title';
  /* Ausgeloest wird ueber die ZEILE, nicht ueber das Etikett. Zwei Gruende, und beide waren im
     ersten Anlauf der Grund fuer das unzuverlaessige Verhalten:
       - Das Etikett ist ein schmales Ziel. Wer die Zeile ueberstreicht, trifft es oft nur kurz
         oder gar nicht, und der Lauf blieb aus.
       - Der Umbau des Etiketts entfernt den Textknoten UNTER dem Zeiger und loest damit selbst
         ein mouseout aus. relatedTarget ist dabei null -- die alte Pruefung hat den Lauf also
         im Moment des Starts wieder abgeschaltet. Deshalb wird jetzt gefragt, ob der Zeiger noch
         auf der Zeile steht (:hover), statt relatedTarget zu deuten. */
  var LAUF_ZEILE = '.am-prev-item, .am-prev-proj-head';
  var _laufWartetAuf = null;
  elPrevPanel.addEventListener('mouseover', function(e){
    var zeile = e.target && e.target.closest ? e.target.closest(LAUF_ZEILE) : null;
    if (!zeile) return;
    var ziel = zeile.querySelector(LAUF_SEL);
    if (!ziel || ziel === _laufEl || ziel === _laufWartetAuf) return;
    laufStop();
    _laufWartetAuf = ziel;
    _laufUhr = setTimeout(function(){ _laufUhr = null; _laufWartetAuf = null; laufStart(ziel); }, LAUF_WARTE);
  });
  elPrevPanel.addEventListener('mouseout', function(e){
    var zeile = e.target && e.target.closest ? e.target.closest(LAUF_ZEILE) : null;
    if (!zeile) return;
    try { if (zeile.matches(':hover')) return; } catch(err){}
    _laufWartetAuf = null;
    laufStop();
  });

  /* ---------------- events helper ---------------- */
  function amFire(fn, payload, dom){
    var f = window['bubble_fn_ask_mira_'+fn];
    if (f) f(JSON.stringify(payload));
    else { window.dispatchEvent(new CustomEvent('askmira:'+dom, { detail: payload })); console.log('Ask Mira '+dom+':', payload); }
  }
  function findChat(id){ return (S.previousChats||[]).filter(function(c){ return String(c.id)===String(id); })[0]; }
  function findProject(id){ return (S.projects||[]).filter(function(p){ return String(p.id)===String(id); })[0]; }

  /* ---- chat rename / delete / pin ---- */
  function prevExitEdit(item){ if (item) item.classList.remove('is-editing'); }
  function prevEnterEdit(item){
    if (!item) return;
    elPrevList.querySelectorAll('.is-editing').forEach(function(x){ if (x !== item) x.classList.remove('is-editing'); });
    item.classList.add('is-editing');
    var inp = item.querySelector('.am-prev-item-input');
    var titleEl = item.querySelector('.am-prev-item-title');
    if (inp){ inp.value = titleEl ? titleEl.textContent : inp.value; inp.focus(); try { inp.select(); } catch(e){} }
  }
  function prevSave(item){
    if (!item) return;
    var id = item.getAttribute('data-chat-id');
    var inp = item.querySelector('.am-prev-item-input');
    var newTitle = (inp ? inp.value : '').trim();
    if (!newTitle){ prevExitEdit(item); return; }
    var c = findChat(id); if (c) c.title = newTitle;
    var titleEl = item.querySelector('.am-prev-item-title'); if (titleEl) titleEl.textContent = newTitle;
    prevExitEdit(item);
    amFire('rename_chat', { chat_id: id, title: newTitle }, 'rename-chat');
  }
  function prevDelete(item){
    if (!item) return;
    var id = item.getAttribute('data-chat-id');
    var wasActive = String(S.activeChatId) === String(id);
    S.previousChats = (S.previousChats || []).filter(function(c){ return String(c.id) !== String(id); });
    if (wasActive){ S.activeChatId = null; S.messages = []; runDrop(); renderMessages(); }
    renderPrevious();
    amFire('delete_chat', { chat_id: id }, 'delete-chat');
  }
  function prevTogglePin(item){
    var id = item.getAttribute('data-chat-id');
    var c = findChat(id); if (!c) return;
    var now = !amTruthy(c.is_pinned);
    c.is_pinned = now;
    renderPrevious();
    amFire(now ? 'pin_chat' : 'unpin_chat', { chat_id: id }, now ? 'pin-chat' : 'unpin-chat');
  }

  /* ---- project rename / delete / create ---- */
  function projExitEdit(el){ if (el) el.classList.remove('is-editing'); }
  function projEnterEdit(el){
    if (!el) return;
    elPrevList.querySelectorAll('.is-editing').forEach(function(x){ if (x !== el) x.classList.remove('is-editing'); });
    el.classList.add('is-editing');
    var inp = el.querySelector('.am-prev-proj-input');
    var titleEl = el.querySelector('.am-prev-proj-title');
    if (inp){ inp.value = titleEl ? titleEl.textContent : inp.value; inp.focus(); try { inp.select(); } catch(e){} }
  }
  function projSave(el){
    if (!el) return;
    var id = el.getAttribute('data-project-id');
    var inp = el.querySelector('.am-prev-proj-input');
    var newTitle = (inp ? inp.value : '').trim();
    if (!newTitle){ projExitEdit(el); return; }
    var p = findProject(id); if (p) p.title = newTitle;
    var titleEl = el.querySelector('.am-prev-proj-title'); if (titleEl) titleEl.textContent = newTitle;
    projExitEdit(el);
    amFire('rename_project', { project_id: id, title: newTitle }, 'rename-project');
  }
  function projDelete(el){
    if (!el) return;
    var id = el.getAttribute('data-project-id');
    S.projects = (S.projects || []).filter(function(p){ return String(p.id) !== String(id); });
    (S.previousChats || []).forEach(function(c){ if (String(c.project_id) === String(id)){ c.project_id = null; c.project_title = null; } });
    delete S.collapsedProjects[id];
    renderPrevious();
    amFire('delete_project', { project_id: id }, 'delete-project');
  }
  var _awaitNewProjectEdit = false, _prevProjectIds = null, _newProjEditTimer = null;
  function _projIdSet(){ var s = {}; (S.projects || []).forEach(function(p){ if (p) s[String(p.id)] = 1; }); return s; }
  // call right before firing a "create project" event; remembers which projects already exist so the
  // newly returned one (via askMiraSetProjects) can be dropped straight into edit mode + focused.
  function armNewProjectEdit(){
    _prevProjectIds = _projIdSet();
    _awaitNewProjectEdit = true;
    clearTimeout(_newProjEditTimer);
    _newProjEditTimer = setTimeout(function(){ _awaitNewProjectEdit = false; _prevProjectIds = null; }, 20000);
  }
  function tryEnterNewProjectEdit(){
    if (!_awaitNewProjectEdit) return;
    var prev = _prevProjectIds || {};
    var neu = (S.projects || []).filter(function(p){ return p && !prev[String(p.id)]; });
    if (!neu.length) return;                                  // creation hasn't come back yet
    var target = neu[neu.length - 1];                         // the freshly created project
    _awaitNewProjectEdit = false; _prevProjectIds = null; clearTimeout(_newProjEditTimer);
    var doEdit = function(){
      var idStr = String(target.id);
      var sel = (window.CSS && CSS.escape) ? CSS.escape(idStr) : idStr;
      var el = elPrevList.querySelector('.am-prev-project[data-project-id="' + sel + '"]');
      if (el){ try { el.scrollIntoView({ block: 'nearest' }); } catch(e){} projEnterEdit(el); }
    };
    // if the sidebar is closed, open it the normal way first and only focus once the slide-in has
    // finished — focusing an off-screen (translated) input would otherwise shove the layout sideways
    if (!root.classList.contains('prev-open')){
      openPrev();
      setTimeout(doEdit, 300);
    } else {
      requestAnimationFrame(doEdit);
    }
  }
  function createProject(){ armNewProjectEdit(); amFire('create_project', {}, 'create-project'); }

  function moveChat(chatId, newPid){
    var c = findChat(chatId); if (!c) return;
    var oldPid = c.project_id || '';
    newPid = newPid || '';
    if (String(oldPid) === String(newPid)) return;
    c.project_id = newPid || null;
    var np = newPid ? findProject(newPid) : null;
    c.project_title = np ? np.title : null;
    renderPrevious();
    amFire('move_chat', { chat_id: chatId, old_project_id: oldPid || null, new_project_id: newPid || null }, 'move-chat');
  }

  /* Die Kopfzeile der Kategorien: Klick irgendwo darauf, nicht nur auf das Winkelzeichen.
     Der Wachhund am Element und nicht am Zaehler: UC.watchRoots laeuft die Init erneut durch,
     wenn Bubble die Auszeichnung austauscht -- ist das Element dasselbe, haengt sonst ein zweiter
     Zuhoerer daran und der Block klappt zu und sofort wieder auf. */
  if (elSuggLbl && !elSuggLbl.__amCatBound){
    elSuggLbl.__amCatBound = true;
    elSuggLbl.addEventListener('click', function(){ if (_galleryCat === null) catKlappen(); });
    elSuggLbl.addEventListener('keydown', function(e){
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
      e.preventDefault();                      // Leertaste rollt sonst die Seite
      if (_galleryCat === null) catKlappen();
    });
  }

  /* ---- click delegation ---- */
  elPrevList.addEventListener('click', function(e){
    if (e.target.closest('[data-add-project]')){ e.stopPropagation(); createProject(); return; }
    var pAct = e.target.closest('[data-proj-act]');
    if (pAct){
      e.stopPropagation();
      var projEl = pAct.closest('.am-prev-project'); var a = pAct.getAttribute('data-proj-act');
      if (a === 'edit') projEnterEdit(projEl); else if (a === 'discard') projExitEdit(projEl);
      else if (a === 'save') projSave(projEl); else if (a === 'delete') projDelete(projEl);
      return;
    }
    var cAct = e.target.closest('[data-prev-act]');
    if (cAct){
      e.stopPropagation();
      var item0 = cAct.closest('.am-prev-item'); var act = cAct.getAttribute('data-prev-act');
      if (act === 'edit') prevEnterEdit(item0); else if (act === 'discard') prevExitEdit(item0);
      else if (act === 'save') prevSave(item0); else if (act === 'delete') prevDelete(item0);
      else if (act === 'pin') prevTogglePin(item0);
      else if (act === 'menu') openChatMenu(item0, cAct);
      return;
    }
    if (e.target.closest('.am-prev-item-input') || e.target.closest('.am-prev-proj-input')) return;
    var pHead = e.target.closest('.am-prev-proj-head');
    if (pHead){
      var pEl = pHead.closest('.am-prev-project');
      if (pEl.classList.contains('is-editing')) return;
      var pid = pEl.getAttribute('data-project-id');
      S.collapsedProjects[pid] = !S.collapsedProjects[pid];
      pEl.classList.toggle('is-collapsed', !!S.collapsedProjects[pid]);
      return;
    }
    var secHead = e.target.closest('.am-prev-sec-head');
    if (secHead){
      var sec = secHead.getAttribute('data-sec');
      S.collapsed[sec] = !S.collapsed[sec];
      secHead.closest('.am-prev-section').classList.toggle('is-collapsed', !!S.collapsed[sec]);
      return;
    }
    var item = e.target.closest('.am-prev-item'); if (!item) return;
    if (item.classList.contains('is-editing')) return;
    var id = item.getAttribute('data-chat-id');
    S.chatLoading = true;                              // show the chat + skeletons right away
    S.messages = [];                                   // drop the previous chat's messages so the skeleton shows
    runDrop();                                         // anderer Chat -> das Protokoll der letzten Antwort gilt nicht mehr
    clearTimeout(_chatLoadT); _chatLoadT = setTimeout(function(){ if (S.chatLoading){ S.chatLoading = false; renderMessages(); renderChatTitlebar(); } }, 12000);
    window.askMiraSetActiveChat(id, false);
    renderMessages(); renderChatTitlebar();
    if (window.bubble_fn_ask_mira_select_chat) window.bubble_fn_ask_mira_select_chat(id);
    else window.dispatchEvent(new CustomEvent('askmira:select-chat', { detail: { chat_id: id } }));
    closePrev();
  });
  elPrevList.addEventListener('keydown', function(e){
    var inp = e.target.closest('.am-prev-item-input');
    if (inp){ var item = inp.closest('.am-prev-item');
      if (e.key === 'Enter'){ e.preventDefault(); prevSave(item); } else if (e.key === 'Escape'){ e.preventDefault(); prevExitEdit(item); } return; }
    var pinp = e.target.closest('.am-prev-proj-input');
    if (pinp){ var pel = pinp.closest('.am-prev-project');
      if (e.key === 'Enter'){ e.preventDefault(); projSave(pel); } else if (e.key === 'Escape'){ e.preventDefault(); projExitEdit(pel); } }
  });

  /* ---- drag & drop: move chats into projects / recents ---- */
  var amDragChatId = null;
  function clearDrop(){ elPrevList.querySelectorAll('.is-drop-target').forEach(function(x){ x.classList.remove('is-drop-target'); }); }
  elPrevList.addEventListener('dragstart', function(e){
    var item = e.target.closest('.am-prev-item'); if (!item) return;
    amDragChatId = item.getAttribute('data-chat-id');
    item.classList.add('is-dragging');
    try { e.dataTransfer.setData('text/plain', amDragChatId); e.dataTransfer.effectAllowed = 'move'; } catch(_){}
  });
  elPrevList.addEventListener('dragend', function(e){
    var item = e.target.closest('.am-prev-item'); if (item) item.classList.remove('is-dragging');
    amDragChatId = null; clearDrop();
  });
  function dropTargetFor(node){
    if (!node || !node.closest) return null;
    var ph = node.closest('.am-prev-proj-head'); if (ph) return ph;
    var rec = node.closest('.am-prev-section[data-section="recents"]'); if (rec) return rec;
    return null;
  }
  elPrevList.addEventListener('dragover', function(e){
    if (amDragChatId == null) return;
    var t = dropTargetFor(e.target); if (!t) return;
    e.preventDefault();
    try { e.dataTransfer.dropEffect = 'move'; } catch(_){}
    if (!t.classList.contains('is-drop-target')){ clearDrop(); t.classList.add('is-drop-target'); }
  });
  elPrevList.addEventListener('dragleave', function(e){
    var t = dropTargetFor(e.target); if (t && !t.contains(e.relatedTarget)) t.classList.remove('is-drop-target');
  });
  elPrevList.addEventListener('drop', function(e){
    if (amDragChatId == null) return;
    var t = dropTargetFor(e.target); if (!t) return;
    e.preventDefault();
    var newPid = '';
    if (t.classList.contains('am-prev-proj-head')) newPid = t.closest('.am-prev-project').getAttribute('data-project-id');
    moveChat(amDragChatId, newPid);
    amDragChatId = null; clearDrop();
  });

  /* ---- chat three-dots context menu ---- */
  var elChatMenu = document.createElement('div');
  elChatMenu.className = 'am-cm'; elChatMenu.id = 'am-chat-menu';
  root.appendChild(elChatMenu);
  var cmChatId = null;
  var cmFromTopbar = false;   // true while the menu was opened from the chat-view topbar chevron

  function closeChatMenu(){
    elChatMenu.classList.remove('is-open');
    var open = elPrevList.querySelector('.am-prev-item.is-menu-open');
    if (open) open.classList.remove('is-menu-open');
    var tb = root.querySelector('.am-chat-titlebar.is-menu-open');
    if (tb) tb.classList.remove('is-menu-open');
    cmChatId = null; cmFromTopbar = false;
  }
  function buildChatMenu(c){
    var inProj = c.project_id || '';
    var projName = c.project_title || (inProj ? ((findProject(inProj)||{}).title || '') : '');
    var pinned = amTruthy(c.is_pinned);
    var others = (S.projects || []).filter(function(p){ return String(p.id) !== String(inProj); });
    var sub = others.map(function(p){
      return '<button class="am-cm-opt" type="button" data-cm-move="'+escAttr(p.id)+'"><span>'+esc(p.title || 'Project')+'</span></button>';
    }).join('');
    sub += '<button class="am-cm-opt" type="button" data-cm-act="create-move">'+ICON.plus+'<span>Create new Project</span></button>';
    if (inProj){
      sub += '<div class="am-cm-sep"></div>'+
        '<button class="am-cm-opt" type="button" data-cm-move=""><span>Remove from &quot;'+esc(projName || 'project')+'&quot;</span></button>';
    }
    return '<button class="am-cm-opt" type="button" data-cm-act="rename">'+ICON.pencil+'<span>Rename</span></button>'+
      '<div class="am-cm-sub">'+
        '<button class="am-cm-opt" type="button" data-cm-act="movewrap">'+ICON.folder+'<span>Move to Project</span><span class="am-cm-caret">'+ICON.chevronRight+'</span></button>'+
        '<div class="am-cm-submenu">'+sub+'</div>'+
      '</div>'+
      '<div class="am-cm-sep"></div>'+
      '<button class="am-cm-opt" type="button" data-cm-act="pin">'+(pinned?ICON.pinOff:ICON.pin)+'<span>'+(pinned?'Unpin Chat':'Pin Chat')+'</span></button>'+
      '<button class="am-cm-opt am-cm-danger" type="button" data-cm-act="delete">'+ICON.trash+'<span>Delete</span></button>';
  }
  function openChatMenu(item, btn){
    var id = item.getAttribute('data-chat-id');
    var c = findChat(id); if (!c) return;
    if (cmChatId === id && elChatMenu.classList.contains('is-open')){ closeChatMenu(); return; }
    cmChatId = id;
    elChatMenu.innerHTML = buildChatMenu(c);
    elPrevList.querySelectorAll('.am-prev-item.is-menu-open').forEach(function(x){ x.classList.remove('is-menu-open'); });
    item.classList.add('is-menu-open');
    // position below the anchor, kept strictly within the component's bounds (never spills out)
    elChatMenu.style.visibility = 'hidden'; elChatMenu.classList.add('is-open');
    var r = (btn || item).getBoundingClientRect();
    var rootRect = root.getBoundingClientRect();
    var mw = elChatMenu.offsetWidth, mh = elChatMenu.offsetHeight;
    // topbar chevron sits far left -> extend the menu to the RIGHT (left edge under the chevron);
    // sidebar dots -> keep the menu's right edge aligned with the button.
    var left = cmFromTopbar ? r.left : (r.right - mw);
    var minL = rootRect.left + 8, maxL = rootRect.right - mw - 8;
    if (maxL < minL) maxL = minL;
    if (left < minL) left = minL;
    if (left > maxL) left = maxL;
    var top = r.bottom + 4;
    if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 4);   // flip up if needed
    elChatMenu.style.left = Math.round(left) + 'px';
    elChatMenu.style.top = Math.round(top) + 'px';
    // submenu: always fly RIGHT in the topbar (menu is already far left); otherwise flip when the left is tight
    var sub = elChatMenu.querySelector('.am-cm-sub');
    if (sub){
      var roomLeft = left - rootRect.left;
      if (cmFromTopbar || roomLeft < 200) sub.classList.add('flip-right');
      else sub.classList.remove('flip-right');
    }
    elChatMenu.style.visibility = '';
  }
  elChatMenu.addEventListener('click', function(e){
    var opt = e.target.closest('[data-cm-act],[data-cm-move]'); if (!opt) return;
    e.stopPropagation();
    var item = elPrevList.querySelector('.am-prev-item[data-chat-id="'+(window.CSS&&CSS.escape?CSS.escape(cmChatId):cmChatId)+'"]');
    var moveTo = opt.getAttribute('data-cm-move');
    if (moveTo !== null){ moveChat(cmChatId, moveTo); closeChatMenu(); return; }
    var act = opt.getAttribute('data-cm-act');
    if (act === 'movewrap') return;   // hover opens submenu
    if (act === 'rename'){ var fromTop = cmFromTopbar; closeChatMenu(); if (fromTop) ctEnterEdit(); else if (item) prevEnterEdit(item); }
    else if (act === 'create-move'){ armNewProjectEdit(); amFire('create_project_with_chat', { chat_id: cmChatId }, 'create-project-with-chat'); closeChatMenu(); }
    else if (act === 'pin'){ if (item) prevTogglePin(item); closeChatMenu(); }
    else if (act === 'delete'){ if (item) prevDelete(item); closeChatMenu(); }
  });
  document.addEventListener('click', function(e){
    if (!elChatMenu.classList.contains('is-open')) return;
    if (e.target.closest('#am-chat-menu') || e.target.closest('.am-prev-menu-btn') || e.target.closest('#am-ct-chev')) return;
    closeChatMenu();
  });
  elPrevList.addEventListener('scroll', closeChatMenu);
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeChatMenu(); });

  /* ensure the list always scrolls, even when hovering a chat title / draggable row
     (some embeds let a hovered child swallow the wheel) */
  elPrevList.addEventListener('wheel', function(e){
    if (e.ctrlKey) return;
    if (elPrevList.scrollHeight <= elPrevList.clientHeight) return;
    var dy = e.deltaY * (e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? elPrevList.clientHeight : 1));
    if (!dy) return;
    var atTop = elPrevList.scrollTop <= 0;
    var atBottom = elPrevList.scrollTop + elPrevList.clientHeight >= elPrevList.scrollHeight - 1;
    if ((dy < 0 && atTop) || (dy > 0 && atBottom)) return;  // let the page handle edges
    elPrevList.scrollTop += dy;
    e.preventDefault();
  }, { passive: false });

  function goToStart(){
    S.activeChatId = null; S.messages = []; S.titlePending = false;
    runDrop();
    if (S.isLoading) setLoading(false);   // stop the loader + clear its timers, else has-messages stays on via isLoading
    renderMessages();
    if (window.bubble_fn_ask_mira_new_chat) window.bubble_fn_ask_mira_new_chat();
    else window.dispatchEvent(new CustomEvent('askmira:new-chat', {}));
    closePrev();
  }
  elNewChat.addEventListener('click', goToStart);
  /* The component always dispatches this, whether or not it also calls Bubble -- in local mode it
     is the only channel. Delegated on the root so a rebuilt picker keeps being heard. */
  root.addEventListener('utf-topics', function(e){
    var d = e && e.detail; if (!d || d.instance_id !== REP_TOPICS_ID) return;
    _reportTopics = String(d.topic_ids || '').split(',').map(function(x){ return x.trim(); }).filter(Boolean);
    _reportTopicMode = (d.tag_mode === 'and') ? 'and' : 'or';
  });

  var elHeroText = root.querySelector('.am-hero-text');
  if (elHeroText) elHeroText.addEventListener('click', goToStart);

  /* Hier stand die Meta-Zeile ueber dem mira-Schriftzug: Markenlogo plus "<Marke> Workspace",
     dieselbe Zeile, die jede Seitenkopfzeile der App traegt. Auf Wunsch entfernt -- Mira ist
     kein Seitenkopf, und die Zeile hat den Hero um eine Ebene beschwert, ohne etwas zu sagen,
     das nicht ohnehin auf der Seite steht. Mit ihr faellt der MutationObserver auf
     data-brand-name / data-brand-logo weg; die Attribute duerfen am Wurzel-Div stehen bleiben,
     Mira liest sie nur nicht mehr. */

  /* Mira draws the top-left of its page itself, so it carries the mobile sidebar clearance.
     window.UpstreemCore, not a local UC: this runs at IIFE level, where the UC binding the boot
     function makes is out of scope -- referencing it here would throw. */
  root.classList.add('up-sidebar-clear');
  if (window.UpstreemCore && window.UpstreemCore.widthTiers) window.UpstreemCore.widthTiers(root);

  /* ---------------- Chat-view topbar (chat name + chevron + inline rename) ---------------- */
  function cssEsc(v){ return (window.CSS && CSS.escape) ? CSS.escape(String(v)) : String(v).replace(/["\\]/g, '\\$&'); }
  var _heroEl       = root.querySelector('.am-hero');
  var _composerAreaEl = root.querySelector('.am-composer-area');
  var elChatTitlebar= root.querySelector('#am-chat-titlebar');
  var elCtBack      = root.querySelector('#am-ct-back');
  var elCtName      = root.querySelector('#am-ct-name');
  var elCtText      = root.querySelector('#am-ct-text');
  var elCtChev      = root.querySelector('#am-ct-chev');
  var elCtInput     = root.querySelector('#am-ct-input');
  var elCtSave      = root.querySelector('#am-ct-save');
  var elCtDiscard   = root.querySelector('#am-ct-discard');
  var _heroReady = false;

  function renderChatTitlebar(){
    if (!elChatTitlebar) return;
    if (!root.classList.contains('has-messages')){ elChatTitlebar.classList.remove('is-editing'); return; }
    if (elChatTitlebar.classList.contains('is-editing')) return;   // don't clobber an active edit
    var id = S.activeChatId;
    var c = id ? findChat(id) : null;
    var title = (c && c.title) ? String(c.title) : '';
    // The skeleton is driven by title_pending: while a title is being generated we show the loader; once
    // title_pending is false the title is ready and shown. (No title yet + not pending = data still loading
    // -> keep the skeleton as a graceful fallback rather than an empty bar.)
    if (S.titlePending || !title){
      elChatTitlebar.classList.add('is-loading');
      if (elCtText) elCtText.textContent = '';
    } else {
      elChatTitlebar.classList.remove('is-loading');
      if (elCtText) elCtText.textContent = title;
      if (elCtInput) elCtInput.value = title;
    }
  }

  function ctEnterEdit(){
    if (!elChatTitlebar || !root.classList.contains('has-messages')) return;
    if (elChatTitlebar.classList.contains('is-loading')) return;   // nothing to rename yet
    var id = S.activeChatId; var c = id ? findChat(id) : null; if (!c) return;
    if (elCtInput) elCtInput.value = (elCtText ? elCtText.textContent : '') || (c.title || '');
    closeChatMenu();
    elChatTitlebar.classList.add('is-editing');
    setTimeout(function(){ if (elCtInput){ elCtInput.focus(); try { elCtInput.select(); } catch(e){} } }, 0);
  }
  function ctDiscard(){ if (elChatTitlebar) elChatTitlebar.classList.remove('is-editing'); renderChatTitlebar(); }
  function ctSave(){
    if (!elChatTitlebar) return;
    var id = S.activeChatId; if (!id){ ctDiscard(); return; }
    var newTitle = (elCtInput ? elCtInput.value : '').trim();
    if (!newTitle){ ctDiscard(); return; }
    var c = findChat(id); if (c) c.title = newTitle;
    if (elCtText) elCtText.textContent = newTitle;
    var sideTitle = elPrevList.querySelector('.am-prev-item[data-chat-id="'+cssEsc(id)+'"] .am-prev-item-title');
    if (sideTitle) sideTitle.textContent = newTitle;
    elChatTitlebar.classList.remove('is-editing');
    amFire('rename_chat', { chat_id: id, title: newTitle }, 'rename-chat');   // same event as the sidebar
  }
  function openActiveChatMenu(anchor){
    var id = S.activeChatId; if (!id) return;
    var item = elPrevList.querySelector('.am-prev-item[data-chat-id="'+cssEsc(id)+'"]');
    if (!item) return;   // active chat not in the list yet -> no menu
    cmFromTopbar = true;
    if (elChatTitlebar) elChatTitlebar.classList.add('is-menu-open');
    openChatMenu(item, anchor);   // reuse the exact same dropdown as the sidebar three-dots
  }

  if (elCtBack)    elCtBack.addEventListener('click', goToStart);   // back to the Mira start screen
  if (elCtName)    elCtName.addEventListener('click', ctEnterEdit);
  if (elCtChev)    elCtChev.addEventListener('click', function(e){ e.stopPropagation(); openActiveChatMenu(elCtChev); });
  if (elCtSave)    elCtSave.addEventListener('click', ctSave);
  if (elCtDiscard) elCtDiscard.addEventListener('click', ctDiscard);
  if (elCtInput){
    elCtInput.addEventListener('keydown', function(e){
      if (e.key === 'Enter'){ e.preventDefault(); ctSave(); }
      else if (e.key === 'Escape'){ e.preventDefault(); ctDiscard(); }
    });
    elCtInput.addEventListener('blur', function(){
      setTimeout(function(){ if (elChatTitlebar && elChatTitlebar.classList.contains('is-editing')) ctSave(); }, 120);
    });
  }

  // Toggle chat view + animate the hero collapse/expand (200ms). First (load-time) toggle is instant.
  function setHasMessages(on){
    on = !!on;
    if (on){ if (elSettingsPanel && elSettingsPanel.classList.contains('is-open')) toggleSettings(false); }   // a loaded chat / first message -> tray stays closed
    if (root.classList.contains('has-messages') === on) return;
    if (!_heroEl || !_heroReady){ root.classList.toggle('has-messages', on); renderChatTitlebar(); return; }
    var from = _heroEl.getBoundingClientRect().height;
    // hero (the topbar) never changes Y position -- it's pinned flush to the top always, in both
    // states -- only its HEIGHT flips (hero-text vs. chat-titlebar content). The composer DOES
    // change Y position (start screen centres it, chat view pins it to the bottom) -- FLIP that
    // one: measure before, toggle, then animate the delta away with a transform so it reads as one
    // smooth 200ms move instead of a jump.
    var composerFrom = _composerAreaEl ? _composerAreaEl.getBoundingClientRect().top : null;
    root.classList.toggle('has-messages', on);
    _heroEl.style.transition = 'none'; _heroEl.style.height = '';
    var to = _heroEl.getBoundingClientRect().height;
    _heroEl.style.height = from + 'px';
    void _heroEl.offsetWidth;                                    // reflow so the start height sticks
    _heroEl.style.transition = 'height 200ms ease, padding 200ms ease';
    _heroEl.style.height = to + 'px';
    clearTimeout(_heroEl._amT);
    _heroEl._amT = setTimeout(function(){ _heroEl.style.transition = ''; _heroEl.style.height = ''; }, 240);
    if (_composerAreaEl && composerFrom != null){
      var composerTo = _composerAreaEl.getBoundingClientRect().top;
      var dy = composerFrom - composerTo;
      if (Math.abs(dy) > 1){
        _composerAreaEl.style.transition = 'none';
        _composerAreaEl.style.transform = 'translateY(' + dy + 'px)';
        void _composerAreaEl.offsetWidth;
        _composerAreaEl.style.transition = 'transform 200ms ease';
        _composerAreaEl.style.transform = '';
        clearTimeout(_composerAreaEl._amT);
        _composerAreaEl._amT = setTimeout(function(){ _composerAreaEl.style.transition = ''; }, 240);
      }
    }
    renderChatTitlebar();
  }
  window.__amSetHasMessages = setHasMessages;
  window.__amRenderChatTitlebar = renderChatTitlebar;
  window.__amHeroReady = function(){ _heroReady = true; };

  /* ---------------- Highlight settings ---------------- */
  /* Zeichen UND Etikett in einem: der Knopf ist jetzt eine Menuezeile wie "New Chat" darueber,
     und diese Zeile ist die einzige Stelle, die seinen Inhalt setzt -- ein zweiter Ort haette
     das Etikett beim naechsten Aufbau wieder weggeworfen. */
  if (elHlBtn) elHlBtn.innerHTML = ICON.settings + '<span class="am-side-lbl">Settings</span>';
  var DD_LABELS = { logo:'Logo', icon:'Icon', none:'No Highlight', favicon:'Favicon' };
  function ddSync(dd, value){
    if (!dd) return;
    var valEl = dd.querySelector('.am-dd-value'); if (valEl) valEl.textContent = DD_LABELS[value] || value;
    dd.querySelectorAll('.am-dd-opt').forEach(function(o){ o.classList.toggle('is-selected', o.getAttribute('data-value') === value); });
  }
  function syncSettingsUI(){
    ddSync(elDdBrand, (S.settings && S.settings.brand) || 'logo');
    ddSync(elDdCitation, (S.settings && S.settings.citation) || 'icon');
    ddSync(elDdResponse, (S.settings && S.settings.response) || 'logo');
  }
  /* Open/close, outside-click, Escape and mutual exclusion come from UC.makePopover, the same
     kit every dropdown in the app uses — the two document-level listeners the standalone kept for
     this are gone with it. The CSS is untouched: makePopover puts .is-open on the wrap, which is
     exactly what ".am-dd.is-open .am-dd-menu" already keys off. Selecting a value still runs the
     identical ddSync + applySetting path, so the settings-change event is unchanged. */
  var _ddPops = [];
  function ddClose(dd){ if (dd && dd.__amPop) dd.__amPop.close(); }
  function ddCloseAll(){ _ddPops.forEach(function(p){ p.close(); }); }
  function wireDropdown(dd){
    if (!dd) return;
    var key = dd.getAttribute('data-set');
    var trigger = dd.querySelector('.am-dd-trigger');
    var menu = dd.querySelector('.am-dd-menu');
    var UC = window.UpstreemCore;
    if (UC && UC.makePopover && menu){
      dd.__amPop = UC.makePopover({ wrap: dd, menu: menu, opener: trigger, group: 'am-hl-settings' });
      _ddPops.push(dd.__amPop);
    } else {
      /* core.js older than this file: keep working with the standalone's own toggle rather than
         losing the settings dropdowns entirely. */
      dd.__amPop = {
        close: function(){ dd.classList.remove('is-open'); if (trigger) trigger.setAttribute('aria-expanded','false'); },
        toggle: function(){ var o = !dd.classList.contains('is-open'); ddCloseAll(); dd.classList.toggle('is-open', o); if (trigger) trigger.setAttribute('aria-expanded', o ? 'true' : 'false'); }
      };
      _ddPops.push(dd.__amPop);
    }
    if (trigger) trigger.addEventListener('click', function(e){ e.stopPropagation(); dd.__amPop.toggle(); });
    dd.querySelectorAll('.am-dd-opt').forEach(function(opt){
      opt.addEventListener('click', function(e){
        e.stopPropagation();
        var v = opt.getAttribute('data-value');
        ddSync(dd, v); ddClose(dd); applySetting(key, v);
      });
    });
  }
  function openHlPanel(open){
    if (!elHlPanel) return;
    var show = (typeof open === 'boolean') ? open : !elHlPanel.classList.contains('is-open');
    elHlPanel.classList.toggle('is-open', show);
    if (!show) ddCloseAll();
    if (elHlBtn){ elHlBtn.classList.toggle('is-open', show); elHlBtn.setAttribute('aria-expanded', show ? 'true' : 'false'); }
  }
  if (elHlBtn) elHlBtn.addEventListener('click', function(e){ e.stopPropagation(); openHlPanel(); });
  function applySetting(key, value){
    if (!S.settings) S.settings = { brand:'logo', citation:'icon', response:'logo' };
    S.settings[key] = value;
    var payload = { brand: S.settings.brand, citation: S.settings.citation, response: S.settings.response };
    if (window.bubble_fn_ask_mira_settings_change) window.bubble_fn_ask_mira_settings_change(JSON.stringify(payload));
    else { window.dispatchEvent(new CustomEvent('askmira:settings-change', { detail: payload })); console.log('Ask Mira settings change:', payload); }
    renderMessages();   // refresh active chat so highlights update
  }
  wireDropdown(elDdBrand); wireDropdown(elDdCitation); wireDropdown(elDdResponse);
  syncSettingsUI();

  /* Button tooltips on the component chrome (hero, chat titlebar, settings) — core's delegated
     [data-tip] chip, so Mira's buttons behave like every other button in the app instead of
     waiting on the browser's native title delay. Scoped to the root, and only the chrome carries
     data-tip: the chat area keeps its own rich evidence tooltip untouched. */
  if (window.UpstreemCore && window.UpstreemCore.makeTooltips){
    window.UpstreemCore.makeTooltips(root, function(){
      return root.getAttribute('data-theme') === 'dark';
    });
  }

  amAufResize(function(){ moveThumb(); }, { hoehe: true });

  /* ---------------- Init ---------------- */
  /* Das Hintergrundbild des Startschirms ist entfernt, in beiden Themen. Es wurde hier gebaut und
     nicht in bubble/*.html, also verschwindet es mit dieser Datei auch aus einem bereits
     eingebauten Element -- ohne Handgriff in Bubble. Die Klasse is-bgart entfaellt damit ebenso;
     sie gab nur die Blende frei. Die Ebenen .up-bgart-* in core.css bleiben: dieselbe Grafik
     liegt hinter dem Onboarding. */
  /* Das Logo im Kopf: dasselbe Symbol wie in der Leiste. Hier gebaut und nicht in der
     Bubble-Vorlage -- die erreicht ein bereits eingebautes Element nicht.
     Liefert der Kern kein galaxy (eine aeltere core.js an einem anderen Pin), bleibt die Klasse
     aus und das gezeichnete Zeichen der Vorlage wird sichtbar. Ein leeres Feld waere die
     schlechtere Antwort auf eine alte Datei. */
  /* Das Zeichen im Knopf "All Chats": die Seitenleiste aus core, gespiegelt. Ausgetauscht wird es
     hier und nicht in der Vorlage, weil eine Aenderung an der Vorlage ein bereits eingebautes
     Element nicht erreicht -- derselbe Grund wie beim Logo darunter. */
  (function chatlisteZeichen(){
    var b = root.querySelector('.am-prev-btn');
    var kern = window.UpstreemCore;
    if (!b || !kern || !kern.icon) return;
    var alt = b.querySelector('svg');
    if (!alt) return;
    var huelle = document.createElement('div');
    huelle.innerHTML = kern.icon('panelLeft', 2);
    var neu = huelle.firstChild;
    if (!neu) return;
    neu.setAttribute('class', 'am-ic am-prev-ic');
    alt.parentNode.replaceChild(neu, alt);
  })();
  (function logoSetzen(){
    var m = root.querySelector('.am-logo-mark');
    if (!m || m.classList.contains('is-icon')) return;
    var kern = window.UpstreemCore;
    var svg = (kern && kern.icon) ? kern.icon('blend', 1.8) : '';
    if (!svg) return;
    m.innerHTML = svg;
    m.classList.add('is-icon');
  })();
  if (window.__askMiraMarket && !S.market) S.market = String(window.__askMiraMarket).toLowerCase();
  if (window.__askMiraTheme) window.askMiraSetTheme(window.__askMiraTheme);
  resolveLang();
  renderSuggested();
  setDetail(S.answerDetail || 'balanced', true);
  setModel(S.model || 'pro', true);
  renderPrevious();
  // Fallback: if no sessions payload ever arrives (e.g. user genuinely has no chats), stop the skeletons after a bit.
  setTimeout(function(){ if (!_prevLoaded){ _prevLoaded = true; renderPrevious(); } }, 6000);
  renderMessages();
  if (window.__amHeroReady) window.__amHeroReady();   // enable hero collapse animation only after first paint
  autosize(); refreshSend();
  updateLoopState();                       // starts the looping placeholder when empty
  setTimeout(moveThumb, 60);
  _amAutoBind();                            // pick up hidden data elements now…
  setTimeout(_amAutoBind, 300);            // …and again once Bubble has rendered/populated them

  /* #3 — collapse header on small element height (desktop), like mobile */
  function updateCompact(){
    if (document.activeElement === elTextarea) return;   // don't re-evaluate while typing (keyboard shrinks the box)
    var h = root.getBoundingClientRect().height || root.clientHeight || 0;
    root.classList.toggle('is-compact', h > 0 && h < 560);
  }
  updateCompact();
  amAufResize(updateCompact, { hoehe: true });
  /* Auch der Beobachter an der eigenen Wurzel gedrosselt: beim Ziehen aendert sich Miras Kasten
     mit jedem Bild, und updateCompact misst und schreibt. */
  (function(){
    var kern = window.UpstreemCore;
    if (kern && kern.beobachteGroesse) return kern.beobachteGroesse(root, updateCompact, { hoehe: true });
    if (typeof ResizeObserver !== 'undefined'){ try { new ResizeObserver(updateCompact).observe(root); } catch(_){} }
  })();

  /* HARD RULE: the whole Mira element must NEVER scroll — only the chat area (#am-chat) does.
     An overflow:hidden ancestor can still be scrolled by the browser (focus / scroll-anchoring),
     which was occasionally pushing the header/composer out of view when navigating to Mira.
     Pin root + shell scroll to 0 at all times so only .am-chat ever scrolls. */
  (function pinWrapperScroll(){
    var elShell = root.querySelector('.am-shell');
    var guards = [root, elShell].filter(Boolean);
    function reset(){
      for (var i = 0; i < guards.length; i++){
        var el = guards[i];
        if (el.scrollTop) el.scrollTop = 0;
        if (el.scrollLeft) el.scrollLeft = 0;
      }
    }
    guards.forEach(function(el){ el.addEventListener('scroll', reset, { passive: true, capture: true }); });
    // focusing a descendant (e.g. the textarea on mount) makes the browser scroll hidden ancestors — undo it
    root.addEventListener('focusin', function(){ reset(); requestAnimationFrame(reset); setTimeout(reset, 0); });
    // whenever Mira (re)appears in the host app, make sure we start pinned
    if (typeof IntersectionObserver !== 'undefined'){
      try { new IntersectionObserver(function(ents){ ents.forEach(function(e){ if (e.isIntersecting){ reset(); requestAnimationFrame(reset); } }); }).observe(root); } catch(_){}
    }
    reset(); requestAnimationFrame(reset); setTimeout(reset, 60); setTimeout(reset, 250);
  })();

  /* ===== right-edge message navigation (scroll spy over user messages) ===== */
  (function msgNav(){
    if (!elMessages || !elChat) return;
    var nav = document.createElement('div'); nav.className = 'am-msgnav';
    var menu = document.createElement('div'); menu.className = 'am-msgnav-menu'; menu.setAttribute('role','menu');
    var ticks = document.createElement('div'); ticks.className = 'am-msgnav-ticks';
    nav.appendChild(menu); nav.appendChild(ticks);
    root.appendChild(nav);

    var MAX = 10, items = [], raf = 0;
    function textFor(id, el){
      var m = null; for (var i=0;i<S.messages.length;i++){ if (String(S.messages[i].id) === String(id)){ m = S.messages[i]; break; } }
      var t = m ? ((m.pending_voice && !m.content) ? 'Voice message' : String(m.content||'')) : (el ? el.textContent : '');
      return String(t).replace(/\s+/g,' ').trim() || 'Message';
    }
    function collect(){
      var els = Array.prototype.slice.call(elMessages.querySelectorAll('.am-msg.is-user')).slice(-MAX);
      items = els.map(function(el){ var id = el.getAttribute('data-id'); return { id:id, el:el, text: textFor(id, el) }; });
    }
    function build(){
      ticks.innerHTML = items.map(function(u,i){ return '<span class="am-msgnav-tick" data-idx="'+i+'"></span>'; }).join('');
      menu.innerHTML = items.map(function(u,i){ return '<button class="am-msgnav-item" type="button" data-idx="'+i+'" title="'+_escAttr(u.text)+'">'+esc(u.text)+'</button>'; }).join('');
    }
    function updateVisible(){
      var wide = root.getBoundingClientRect().width >= 900;   // only when there's enough width
      root.classList.toggle('has-msgnav', wide && items.length >= 2);   // ...and from the 2nd user message on
    }
    function setActive(){
      raf = 0;
      if (!items.length) return;
      var active;
      if ((elChat.scrollTop + elChat.clientHeight) >= (elChat.scrollHeight - 4)){
        active = items.length - 1;   // at the very bottom -> the last message's section is current
      } else {
        var chatTop = elChat.getBoundingClientRect().top;
        var anchor = chatTop + elChat.clientHeight - 8;   // bottom of the viewport -> the LATEST message in view wins
        active = 0;
        for (var i=0;i<items.length;i++){ if (items[i].el.getBoundingClientRect().top <= anchor) active = i; else break; }
      }
      for (var t=0;t<ticks.children.length;t++) ticks.children[t].classList.toggle('is-active', t===active);
      for (var k=0;k<menu.children.length;k++) menu.children[k].classList.toggle('is-active', k===active);
    }
    function onScroll(){ if (!raf) raf = requestAnimationFrame(setActive); }
    function refresh(){ collect(); build(); updateVisible(); setActive(); }

    menu.addEventListener('mouseover', function(e){ var it=e.target.closest('.am-msgnav-item'); if(!it) return; var t=ticks.children[+it.getAttribute('data-idx')]; if(t) t.classList.add('is-hover'); });
    menu.addEventListener('mouseout',  function(e){ var it=e.target.closest('.am-msgnav-item'); if(!it) return; var t=ticks.children[+it.getAttribute('data-idx')]; if(t) t.classList.remove('is-hover'); });
    menu.addEventListener('click', function(e){
      var it=e.target.closest('.am-msgnav-item'); if(!it) return;
      var u=items[+it.getAttribute('data-idx')];
      if (u && u.el){ var top = u.el.getBoundingClientRect().top - elChat.getBoundingClientRect().top + elChat.scrollTop - 14; elChat.scrollTo({ top: Math.max(0, top), behavior:'smooth' }); }
    });

    // keep the menu open while moving from the ticks across the gap onto the menu
    var hideT = 0;
    function showMenu(){ clearTimeout(hideT); nav.classList.add('is-hover'); }
    function hideMenu(){ clearTimeout(hideT); hideT = setTimeout(function(){ nav.classList.remove('is-hover'); }, 160); }
    nav.addEventListener('mouseenter', showMenu);
    nav.addEventListener('mouseleave', hideMenu);
    menu.addEventListener('mouseenter', showMenu);
    menu.addEventListener('mouseleave', hideMenu);

    if (typeof MutationObserver !== 'undefined'){ try { new MutationObserver(function(){ refresh(); }).observe(elMessages, { childList:true }); } catch(_){} }
    elChat.addEventListener('scroll', onScroll, { passive:true });
    (function(){
      var kern = window.UpstreemCore;
      function nach(){ updateVisible(); onScroll(); }
      if (kern && kern.beobachteGroesse) return kern.beobachteGroesse(root, nach, { hoehe: true });
      if (typeof ResizeObserver !== 'undefined'){ try { new ResizeObserver(nach).observe(root); } catch(_){} }
    })();
    window.addEventListener('resize', function(){ updateVisible(); onScroll(); });
    refresh();
  })();

  /* ===== Voice input: mic -> live waveform -> cancel/confirm, all via JS events ===== */
  (function voiceInput(){
    var micBtn    = root.querySelector('#am-mic');
    var composer  = root.querySelector('#am-composer');
    var recEl     = root.querySelector('#am-rec');
    var canvas    = root.querySelector('#am-rec-canvas');
    var timeEl    = root.querySelector('#am-rec-time');
    var cancelBtn = root.querySelector('#am-rec-cancel');
    var confirmBtn= root.querySelector('#am-rec-confirm');
    var noteEl    = root.querySelector('#am-rec-note');
    if (!micBtn || !composer || !recEl) return;

    var stream=null, ac=null, analyser=null, source=null, recorder=null, chunks=[], raf=0, tick=0, startedAt=0, levels=[], recording=false, maxTimer=0;
    var VOICE_MAX_MS = 30000;   // hard cap: auto-send after 30s

    function fireVoice(name, payload){
      payload = payload || {};
      var fn = { start:'bubble_fn_ask_mira_voice_start', cancel:'bubble_fn_ask_mira_voice_cancel', submit:'bubble_fn_ask_mira_voice', error:'bubble_fn_ask_mira_voice_error' }[name];
      if (fn && typeof window[fn] === 'function') window[fn](JSON.stringify(payload));
      else { window.dispatchEvent(new CustomEvent('askmira:voice-'+name, { detail: payload })); console.log('Ask Mira voice '+name+':', payload); }
    }
    function showNote(msg){ if (!noteEl) return; noteEl.textContent = msg; noteEl.classList.add('is-on'); clearTimeout(noteEl._t); noteEl._t = setTimeout(function(){ noteEl.classList.remove('is-on'); }, 4500); }
    function hideNote(){ if (noteEl) noteEl.classList.remove('is-on'); }
    function fmtTime(ms){ var s = Math.floor(ms/1000); return Math.floor(s/60)+':'+('0'+(s%60)).slice(-2); }

    function drawWave(){
      if (!analyser || !canvas){ raf = requestAnimationFrame(drawWave); return; }
      var buf = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(buf);
      var sum=0; for (var i=0;i<buf.length;i++){ var v=(buf[i]-128)/128; sum+=v*v; }
      levels.push(Math.sqrt(sum/buf.length));
      var W = canvas.clientWidth||256, H = canvas.clientHeight||30, dpr = window.devicePixelRatio||1;
      if (canvas.width !== Math.round(W*dpr)){ canvas.width=Math.round(W*dpr); canvas.height=Math.round(H*dpr); }
      var ctx = canvas.getContext('2d'); if (!ctx){ raf=requestAnimationFrame(drawWave); return; }
      ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,W,H);
      var barW=2, gap=2, step=barW+gap, n=Math.floor(W/step), mid=H/2;
      while (levels.length>n) levels.shift();
      ctx.fillStyle = (getComputedStyle(root).getPropertyValue('--am-text').trim() || '#1f1f1b');
      for (var b=0;b<levels.length;b++){
        var amp = Math.min(1, levels[b]*2.6), h = Math.max(2, amp*(H-4)), x = W-(levels.length-b)*step, y=mid-h/2, r=barW/2;
        ctx.globalAlpha = 0.32 + 0.68*amp;
        ctx.beginPath(); ctx.moveTo(x, y+r); ctx.arcTo(x, y, x+r, y, r); ctx.arcTo(x+barW, y, x+barW, y+r, r);
        ctx.lineTo(x+barW, y+h-r); ctx.arcTo(x+barW, y+h, x+barW-r, y+h, r); ctx.arcTo(x, y+h, x, y+h-r, r); ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha=1;
      raf = requestAnimationFrame(drawWave);
    }
    function stopAll(){
      recording=false;
      if (maxTimer){ clearTimeout(maxTimer); maxTimer=0; }
      if (raf){ cancelAnimationFrame(raf); raf=0; }
      if (tick){ clearInterval(tick); tick=0; }
      try { if (source) source.disconnect(); } catch(_){}
      try { if (analyser) analyser.disconnect(); } catch(_){}
      try { if (ac && ac.state!=='closed') ac.close(); } catch(_){}
      if (stream){ stream.getTracks().forEach(function(t){ try{t.stop();}catch(_){} }); }
      stream=null; ac=null; analyser=null; source=null; levels=[];
      composer.classList.remove('is-recording'); recEl.setAttribute('aria-hidden','true');
    }
    function startRecording(){
      if (recording) return;
      hideNote();
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
        showNote('Voice input isn\u2019t supported in this browser.');
        fireVoice('error', { reason:'unsupported', message:'getUserMedia unavailable' });
        return;
      }
      navigator.mediaDevices.getUserMedia({ audio:true }).then(function(s){
        stream=s; recording=true; chunks=[]; levels=[]; startedAt=Date.now();
        composer.classList.add('is-recording'); recEl.setAttribute('aria-hidden','false');
        var mime='';
        try { if (window.MediaRecorder && MediaRecorder.isTypeSupported){ ['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg'].some(function(m){ if (MediaRecorder.isTypeSupported(m)){ mime=m; return true; } return false; }); } } catch(_){}
        try { recorder = window.MediaRecorder ? new MediaRecorder(stream, mime?{mimeType:mime}:undefined) : null; } catch(_){ recorder=null; }
        if (recorder){ recorder.ondataavailable=function(e){ if (e.data && e.data.size) chunks.push(e.data); }; try{ recorder.start(); }catch(_){} }
        try {
          ac = new (window.AudioContext||window.webkitAudioContext)();
          source = ac.createMediaStreamSource(stream);
          analyser = ac.createAnalyser(); analyser.fftSize=1024; analyser.smoothingTimeConstant=0.75;
          source.connect(analyser); drawWave();
        } catch(_){}
        if (timeEl) timeEl.textContent='0:00';
        tick=setInterval(function(){ var el = Date.now()-startedAt; if (el > VOICE_MAX_MS) el = VOICE_MAX_MS; if (timeEl) timeEl.textContent=fmtTime(el); }, 250);
        maxTimer=setTimeout(function(){ if (recording) confirmRecording(); }, VOICE_MAX_MS);   // auto-send at 30s
        fireVoice('start', {});
      }).catch(function(err){
        var reason=(err && err.name)||'error', msg;
        if (reason==='NotAllowedError'||reason==='SecurityError') msg='Microphone permission was denied.';
        else if (reason==='NotFoundError'||reason==='DevicesNotFoundError') msg='No microphone was found.';
        else msg='Couldn\u2019t access the microphone.';
        showNote(msg); fireVoice('error', { reason:reason, message:msg });
      });
    }
    function cancelRecording(){ var was=composer.classList.contains('is-recording'); stopAll(); if (was) fireVoice('cancel', {}); }
    function confirmRecording(){
      if (!composer.classList.contains('is-recording')) return;
      if (maxTimer){ clearTimeout(maxTimer); maxTimer=0; }
      var dur = Date.now() - startedAt;
      var mid = 'voice_' + Date.now();

      // 1) instant chat turn: stop the recording visuals, drop in a skeleton user bubble + Mira loading
      if (raf){ cancelAnimationFrame(raf); raf = 0; }
      if (tick){ clearInterval(tick); tick = 0; }
      recording = false;
      composer.classList.remove('is-recording'); recEl.setAttribute('aria-hidden', 'true');
      try {
        S.messages.push({ id: mid, role: 'user', content: '', pending_voice: true, created_at: new Date().toISOString() });
        _pendingAnswer = true; _lastSendTs = Date.now(); _sendStartTs = Date.now();
        setLoading(true); renderMessages();
      } catch(_){}

      // 2) flush the recorder -> base64 -> emit (with the message id), then tear down stream/audio
      function teardown(){
        try { if (source) source.disconnect(); } catch(_){}
        try { if (analyser) analyser.disconnect(); } catch(_){}
        try { if (ac && ac.state !== 'closed') ac.close(); } catch(_){}
        if (stream){ stream.getTracks().forEach(function(t){ try { t.stop(); } catch(_){} }); }
        stream = null; ac = null; analyser = null; source = null; levels = [];
      }
      function finalize(){
        var blob = chunks.length ? new Blob(chunks, { type:(recorder && recorder.mimeType)||'audio/webm' }) : null;
        function emit(b64, mime){
          fireVoice('submit', { message_id: mid, chat_id: S.activeChatId, audio_base64: b64||'', mime_type: mime||'', duration_ms: dur });
          teardown();
        }
        if (blob){ var fr=new FileReader(); fr.onloadend=function(){ var res=String(fr.result||''); emit(res.indexOf(',')>=0?res.slice(res.indexOf(',')+1):res, blob.type); }; fr.onerror=function(){ emit('', blob.type); }; fr.readAsDataURL(blob); }
        else emit('', '');
      }
      if (recorder && recorder.state !== 'inactive'){ recorder.onstop = finalize; try { recorder.stop(); } catch(_){ finalize(); } }
      else finalize();
    }

    micBtn.addEventListener('click', function(e){ e.preventDefault(); startRecording(); });
    if (cancelBtn) cancelBtn.addEventListener('click', function(e){ e.preventDefault(); cancelRecording(); });
    if (confirmBtn) confirmBtn.addEventListener('click', function(e){ e.preventDefault(); confirmRecording(); });

    function _normId(v){ v = String(v == null ? '' : v).trim(); if (v.length >= 2 && ((v.charAt(0)==='"'&&v.charAt(v.length-1)==='"')||(v.charAt(0)==="'"&&v.charAt(v.length-1)==="'"))) v = v.slice(1,-1); return v; }
    function _findPendingVoice(messageId){
      var id = _normId(messageId);
      if (id){ for (var i=0;i<S.messages.length;i++){ if (String(S.messages[i].id) === id) return i; } }
      for (var j=S.messages.length-1;j>=0;j--){ if (S.messages[j].pending_voice) return j; }
      return -1;
    }
    /* Bubble: transcript is back -> fill the skeleton user bubble with the text */
    window.askMiraResolveVoice = function(text, messageId){
      text = String(text == null ? '' : text);
      var idx = _findPendingVoice(messageId);
      if (idx >= 0){
        S.messages[idx].content = text;
        S.messages[idx].pending_voice = false;
        try { renderMessages(); } catch(_){}
        return true;
      }
      // DOM fallback: replace a still-visible skeleton bubble even if state is momentarily out of sync
      try {
        var id = _normId(messageId), host = elMessages || elChat, row = null;
        if (id && host){ row = host.querySelector('.am-msg[data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]'); }
        if (!row && host){ var us = host.querySelectorAll('.am-msg.is-user'); for (var k=us.length-1;k>=0;k--){ if (us[k].querySelector('.am-user-skel')){ row = us[k]; break; } } }
        if (row){ var bubble = row.querySelector('.am-bubble'); if (bubble){ bubble.innerHTML = '<p>' + esc(text).replace(/\n/g,'<br>') + '</p>'; return true; } }
      } catch(_){}
      return false;
    };
    /* Bubble: transcription failed -> remove the pending user bubble + stop the loader */
    window.askMiraRejectVoice = function(messageId){
      var idx = _findPendingVoice(messageId); if (idx >= 0) S.messages.splice(idx, 1);
      _pendingAnswer = false;
      try { setLoading(false); } catch(_){}
      try { renderMessages(); } catch(_){}
    };
    /* Bubble helper: drop a returned transcript into the composer input instead (review-before-send flow) */
    window.askMiraSetTranscript = function(text){
      text = String(text==null?'':text); if (!elTextarea) return;
      var cur = elTextarea.value; elTextarea.value = cur ? (cur.replace(/\s+$/,'') + ' ' + text) : text;
      try { autosize(); } catch(_){} try { refreshSend(); } catch(_){} elTextarea.focus();
    };
    window.askMiraVoiceCancel = function(){ cancelRecording(); };
  })();


  /* #3 — Height. .am-chat can only scroll INSIDE us if we have a definite one. Three hard rules,
     all learned the painful way:

       1. We never touch the host page's scrolling. No window.scrollTo, no resetting an ancestor's
          scrollTop. Mira is ONE component inside a page that scrolls (#main in the Bubble app) —
          where that page is scrolled to is none of our business.
       2. Our height must not depend on where that page is scrolled to. getBoundingClientRect().top
          is viewport-relative, so sizing against it made our height a function of the scroll
          position: scrolling changed our height, our height changed the scroller's scrollHeight,
          and that moved the scroll position again — a feedback loop with the scroller, which made
          the page overshoot its end and snap back. Debouncing only changed how chunky the loop
          felt; the fix was to not couple the two at all.
       3. We must never be taller than the container the host put us in. Every viewport-derived
          height (100vh, innerHeight, innerHeight-minus-something) violates this: the Bubble group
          has its own height, and an element sticking out of its slot adds that overflow to
          #main's scrollHeight — which is how the page ended up scrollable far past the app's own
          content, into empty space. So we do not compute a height at all; we take the one the host
          gives us, and only fall back to a screenful if the container is auto-height and we would
          otherwise collapse to nothing.

     No position:fixed -> also works when a Bubble ancestor has a transform (which breaks fixed). */
  (function(){
    var vv = window.visualViewport;
    // window/visualViewport resize can burst (a resize drag, the keyboard sliding in) -- coalesce
    // those. Nothing here is wired to scroll anymore, so this is only about not doing the same
    // layout work 30x during one gesture.
    var _fitTimer = null;
    function scheduleFit(){
      if (_fitTimer) clearTimeout(_fitTimer);
      _fitTimer = setTimeout(function(){ _fitTimer = null; fit(); }, 120);
    }
    function isSmall(){ return !window.matchMedia || window.matchMedia('(max-width: 720px)').matches; }
    // A hidden element (Bubble group not shown yet) reports rect 0 -> measuring then would compute the
    // height against top:0 and leave it TOO TALL once shown (footer/hint pushed below the screen).
    function visible(){ return !!(root.offsetWidth || root.offsetHeight || root.getClientRects().length); }
    function fit(){
      if (!visible()) return;
      // Phone with the keyboard open: visualViewport shrinks, so take exactly that and the composer
      // stays on screen. This is the ONE case worth overriding the host's height for.
      if (isSmall() && vv && (window.innerHeight - vv.height) > 120){
        var kh = Math.round(vv.height);
        root.style.height = kh + 'px'; root.style.maxHeight = kh + 'px';
        return;
      }
      // Otherwise the HOST owns our height. Drop ours and take whatever the Bubble container gives
      // us. Every earlier version computed a height from the viewport instead, which made us taller
      // than the slot we were placed in -- and an element sticking out of its container is exactly
      // what pushed #main's scrollHeight past the real end of the page and let it scroll into empty
      // space below the app.
      root.style.height = ''; root.style.maxHeight = '';
      if (root.getBoundingClientRect().height >= 320) return;
      // Only reachable when the host container is auto-height and we would collapse to nothing --
      // then, and only then, claim a screenful so the chat is usable at all.
      var vh = Math.round(window.innerHeight);
      root.style.height = vh + 'px'; root.style.maxHeight = vh + 'px';
    }
    // The height math only holds while our top edge and the viewport stay put. Bubble can move us later
    // (late header, async content, a scrolled ancestor, a group being shown) WITHOUT firing resize/scroll —
    // that left the element too tall: the "Mira answers based on..." hint sat below the screen and the page
    // became scrollable, so it looked cut off at the top until you interacted (which fired another fit()).
    // This watcher refits whenever our position or the viewport actually changes, so it self-corrects.
    // Bubble can resize our container later (late content, a group being shown). This watcher
    // refits when that happens -- and it compares only scroll-INDEPENDENT numbers (an element's
    // own height, the viewport), so merely scrolling the page can never trigger a refit. That is
    // what makes a plain 300ms poll safe here.
    var _lp = null, _lh = null;
    function watch(){
      if (!visible()) return;
      var p = root.parentElement ? Math.round(root.parentElement.getBoundingClientRect().height) : 0;
      var h = Math.round(vv ? vv.height : window.innerHeight);
      if (p !== _lp || h !== _lh){ _lp = p; _lh = h; scheduleFit(); }
    }
    fit();
    requestAnimationFrame(fit);
    window.addEventListener('load', function(){ fit(); setTimeout(fit, 60); setTimeout(fit, 200); setTimeout(fit, 450); });
    setTimeout(fit, 120); setTimeout(fit, 400);
    setInterval(watch, 300);
    window.addEventListener('resize', scheduleFit);
    // Deliberately NO window 'scroll' listener and no vv 'scroll' listener: page scrolling must
    // never make us re-measure or re-size. See the feedback-loop note at the top of this block.
    if (window.ResizeObserver){
      /* GEDROSSELT. Drei Beobachter auf Dokument, Body und dem Wirtselement, und jeder ruft
         watch(), das die Hoehe des Elternteils misst -- waehrend einer Ziehbewegung waren das drei
         Messungen je Bild. In der Messung des Nutzers stand Mira damit auf Platz eins: 595 von
         3098 Lesezugriffen. Das Intervall alle 300ms bleibt, es faengt alles ab, was ohne
         Groessenaenderung passiert. */
      var kern = window.UpstreemCore;
      if (kern && kern.beobachteGroesse){
        kern.beobachteGroesse(document.documentElement, watch, { hoehe: true });
        kern.beobachteGroesse(document.body, watch, { hoehe: true });
        if (root.parentElement) kern.beobachteGroesse(root.parentElement, watch, { hoehe: true });
      } else {
        try { new ResizeObserver(watch).observe(document.documentElement); } catch(_){}
        try { new ResizeObserver(watch).observe(document.body); } catch(_){}
        // a sibling Bubble element resizing (its own late content, a group toggling) can shift OUR
        // position without document/body ever changing size -- watch our own host container too.
        try { if (root.parentElement) new ResizeObserver(watch).observe(root.parentElement); } catch(_){}
      }
    }
    window.addEventListener('orientationchange', function(){ setTimeout(fit, 60); setTimeout(fit, 250); });
    if (vv){ vv.addEventListener('resize', scheduleFit); }
    elTextarea.addEventListener('focus', function(){ fit(); setTimeout(fit, 60); setTimeout(fit, 250); setTimeout(fit, 500); });
    elTextarea.addEventListener('blur',  function(){ setTimeout(fit, 60); setTimeout(fit, 300); });
    // Bonus: let Chrome/Android resize the layout viewport for the keyboard instead of panning.
    try {
      var mv = document.querySelector('meta[name="viewport"]');
      if (mv && mv.content.indexOf('interactive-widget') === -1) mv.content = mv.content + ', interactive-widget=resizes-content';
    } catch(_){}
  })();

  }

  amBoot(50);
})();
