/* 건강지킴이 기능 (무음). HTML은 UI만, 이 파일이 모든 로직을 담당 */
(() => {
  // ---------- 공통 ----------
  const $ = (s) => document.querySelector(s);
  const nowDateInput = () => new Date().toISOString().slice(0, 10);
  const log = (m) => { const el = $("#log"); if(!el) return; el.textContent += `[${new Date().toLocaleTimeString()}] ${m}\n`; el.scrollTop = el.scrollHeight; };

  // 사용자 네임스페이스 (기기별 저장)
  const user = {
    get name(){ return localStorage.getItem("user.name") || "guest"; },
    set name(v){ localStorage.setItem("user.name", v); $("#userLabel").textContent = v; }
  };
  const ns = (key) => `${user.name}:${key}`;

  // ---------- 탭 ----------
  const tabs = ["diary","menu","keeper"];
  function showTab(id){
    tabs.forEach(t=>{
      const sec=$("#"+t), btn=document.querySelector(`[data-tab="${t}"]`);
      if(sec) sec.style.display = (t===id)?"grid":"none";
      if(btn) btn.classList.toggle("active", t===id);
    });
    location.hash = id;
  }
  window.addEventListener("hashchange", ()=>{ const t = location.hash.replace("#","")||"diary"; if(tabs.includes(t)) showTab(t); });

  // ---------- 알림 권한 & SW ----------
  let swReg=null;
  async function registerSW(){
    if(!("serviceWorker" in navigator)) { log("서비스워커 미지원 브라우저"); return; }
    try{
      swReg = await navigator.serviceWorker.register("./sw.js", { scope: "./" });
      log("SW 등록 완료");
    }catch(e){ log("SW 등록 실패: "+e.message); }
  }
  async function checkPerm(){
    const state = ("Notification" in window) ? Notification.permission : "unsupported";
    const el = $("#notifState");
    if(el){
      el.textContent = (state==="granted") ? "알림: 사용중" : (state==="denied" ? "알림: 거부됨" : "알림: 확인필요");
    }
    return state;
  }
  async function askPerm(){
    if(!("Notification" in window)) return;
    const p = await Notification.requestPermission();
    await checkPerm(); if(p!=="granted") toast();
  }
  function toast(){ const t=$("#toast"); if(!t) return; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),3200); }
  function notify(title, body){
    if(!("Notification" in window)) return;
    if(Notification.permission!=="granted"){ toast(); return; }
    const persist = $("#requireInteraction")?.value === "1";
    const show = (reg)=> reg?.showNotification
      ? reg.showNotification(title,{ body, icon:"https://fav.farm/💙", requireInteraction:persist })
      : new Notification(title,{ body });
    if(swReg) show(swReg); else navigator.serviceWorker.getRegistration().then(show);
  }

  // ---------- 다이어리 ----------
  const loadDiary = () => JSON.parse(localStorage.getItem(ns("diary")) || "[]");
  const saveDiaryList = (list) => { localStorage.setItem(ns("diary"), JSON.stringify(list)); renderDiary(); };
  function renderDiary(){
    const list = loadDiary().sort((a,b)=>b.date.localeCompare(a.date));
    const wrap = $("#diaryList"); if(!wrap) return; wrap.innerHTML="";
    list.forEach((it,idx)=>{
      const el=document.createElement("div"); el.className="entry";
      el.innerHTML = `<h3>${it.title||"(제목 없음)"} <span class="muted">${it.date}</span></h3>
                      <p>${it.body||""}</p>
                      <div class="row" style="margin-top:10px">
                        <button class="btn outline" data-edit="${idx}">불러오기</button>
                        <button class="btn outline" data-del="${idx}">삭제</button>
                      </div>`;
      wrap.appendChild(el);
    });
  }
  function initDiary(){
    $("#dDate").value = nowDateInput();
    $("#btnSaveDiary").addEventListener("click", ()=>{
      const item = { title: $("#dTitle").value.trim(), date: $("#dDate").value, body: $("#dBody").value.trim(), ts: Date.now() };
      const list=loadDiary(); list.push(item); saveDiaryList(list);
      $("#dTitle").value=""; $("#dBody").value=""; $("#dDate").value=nowDateInput();
    });
    $("#btnClearDiary").addEventListener("click", ()=>{ $("#dTitle").value=""; $("#dBody").value=""; });
    $("#diaryList").addEventListener("click",(e)=>{
      const t=e.target; if(!(t instanceof HTMLElement)) return;
      const del=t.getAttribute("data-del"); const edit=t.getAttribute("data-edit");
      if(del!==null){ const list=loadDiary(); list.splice(Number(del),1); saveDiaryList(list); }
      if(edit!==null){ const it=loadDiary()[Number(edit)]; $("#dTitle").value=it.title||""; $("#dDate").value=it.date||nowDateInput(); $("#dBody").value=it.body||""; showTab("diary"); }
    });
    renderDiary();
  }

  // ---------- 식단 (하드코딩 프리셋 + 저장/목록) ----------
  const PRESETS = {
    weekday: { b:"오트밀+우유, 블루베리", l:"닭가슴살 샐러드, 통밀빵", d:"현미밥, 두부부침, 채소무침" },
    protein: { b:"스크램블 에그, 토마토", l:"연어포케, 아보카도", d:"스테이크(소량), 구운야채" },
    korean:  { b:"밥, 미소국, 김, 나물", l:"비빔밥(나물 위주)", d:"고등어구이, 된장국, 깻잎" },
    lowcarb: { b:"그릭요거트, 견과", l:"샐러드+올리브오일, 치킨브레스트", d:"구운연어, 버터소테브로콜리" }
  };
  const loadMenu = () => JSON.parse(localStorage.getItem(ns("menu")) || "{}");
  const saveMenu = (obj) => { localStorage.setItem(ns("menu"), JSON.stringify(obj)); renderMenu(); };
  function renderMenu(){
    const data = loadMenu(); const wrap = $("#menuList"); if(!wrap) return; wrap.innerHTML="";
    Object.keys(data).sort().reverse().forEach(date=>{
      const m = data[date];
      const el = document.createElement("div"); el.className = "entry";
      el.innerHTML = `<h3>${date}</h3>
                      <p>아침: ${m.b||"-"}\n점심: ${m.l||"-"}\n저녁: ${m.d||"-"}</p>
                      <div class="row" style="margin-top:10px">
                        <button class="btn outline" data-load="${date}">불러오기</button>
                        <button class="btn outline" data-del="${date}">삭제</button>
                      </div>`;
      wrap.appendChild(el);
    });
  }
  function initMenu(){
    $("#mDate").value = nowDateInput();
    $("#btnTodayFill").addEventListener("click", ()=> $("#mDate").value = nowDateInput());
    $("#btnPreset").addEventListener("click", ()=>{
      const key = $("#presetSelect").value;
      const p = PRESETS[key] || PRESETS.weekday;
      $("#mBreakfast").value = p.b; $("#mLunch").value = p.l; $("#mDinner").value = p.d;
    });
    $("#btnSaveMenu").addEventListener("click", ()=>{
      const date = $("#mDate").value || nowDateInput();
      const obj = loadMenu();
      obj[date] = { b: $("#mBreakfast").value.trim(), l: $("#mLunch").value.trim(), d: $("#mDinner").value.trim() };
      saveMenu(obj);
      ["#mBreakfast","#mLunch","#mDinner"].forEach(id=>$(id).value="");
    });
    $("#menuList").addEventListener("click",(e)=>{
      const t=e.target; if(!(t instanceof HTMLElement)) return;
      const d=t.getAttribute("data-del"); const l=t.getAttribute("data-load");
      if(d){ const obj=loadMenu(); delete obj[d]; saveMenu(obj); }
      if(l){ const m=loadMenu()[l]; $("#mDate").value=l; $("#mBreakfast").value=m.b||""; $("#mLunch").value=m.l||""; $("#mDinner").value=m.d||""; showTab("menu"); }
    });
    renderMenu();
  }

  // ---------- 건강지킴이 (간격 알림) ----------
  let eyeTimer=null, stretchTimer=null, tickerInt=null;
  function startKeeper(){
    const eyeMins = Math.max(1, Number($("#eyeMins").value||20));
    const stMins  = Math.max(1, Number($("#stretchMins").value||60));
    stopKeeper();
    const loopEye = ()=>{ notify("먼 곳을 바라볼 시간입니다 👀","개인이 설정한 시간 간격으로 먼 곳을 바라보며 눈의 휴식을 취해보아요 :)"); log("눈 휴식 알림"); eyeTimer=setTimeout(loopEye, eyeMins*60*1000); };
    const loopSt  = ()=>{ notify("스트레칭 시간! 🧘","나 스트레칭 시간을 잠시 가져볼까요?"); log("스트레칭 알림"); stretchTimer=setTimeout(loopSt, stMins*60*1000); };
    eyeTimer = setTimeout(loopEye, eyeMins*60*1000);
    stretchTimer = setTimeout(loopSt, stMins*60*1000);
    localStorage.setItem(ns("keeper"), JSON.stringify({eyeMins, stMins, running:true}));
    tick(); tickerInt=setInterval(tick,1000);
  }
  function stopKeeper(){
    if(eyeTimer){clearTimeout(eyeTimer); eyeTimer=null;}
    if(stretchTimer){clearTimeout(stretchTimer); stretchTimer=null;}
    if(tickerInt){clearInterval(tickerInt); tickerInt=null;}
    $("#ticker").textContent = "대기 중…";
    localStorage.setItem(ns("keeper"), JSON.stringify({running:false}));
  }
  function tick(){
    const e = Number($("#eyeMins").value||20), s = Number($("#stretchMins").value||60);
    $("#ticker").textContent = `알림 동작 중 • 눈 ${e}분 / 스트레칭 ${s}분 간격`;
  }
  function initKeeper(){
    const prev = JSON.parse(localStorage.getItem(ns("keeper"))||"{}");
    if(prev.eyeMins) $("#eyeMins").value = prev.eyeMins;
    if(prev.stMins)  $("#stretchMins").value = prev.stMins;
    if(prev.running) startKeeper();
    $("#btnStart").addEventListener("click", startKeeper);
    $("#btnStop").addEventListener("click", stopKeeper);
    $("#btnTest").addEventListener("click", ()=> notify("테스트 알림", "권한/표시 확인용입니다."));
  }

  // ---------- 부팅 ----------
  document.addEventListener("DOMContentLoaded", async ()=>{
    $("#userLabel").textContent = user.name;

    // 탭 이동 버튼(히어로 CTA)
    document.querySelectorAll("[data-tab-jump]").forEach(b=>{
      b.addEventListener("click", ()=> showTab(b.getAttribute("data-tab-jump")));
    });

    await registerSW();
    await checkPerm();
    $("#btnAskPerm").addEventListener("click", askPerm);

    // 상단 탭 버튼
    document.querySelectorAll(".tabbar button[data-tab]").forEach(b => b.addEventListener("click", ()=>showTab(b.dataset.tab)));
    showTab(location.hash.replace("#","")||"diary");

    // 사용자
    $("#btnSetUser").addEventListener("click", ()=>{
      const v = prompt("사용자 이름을 입력하세요", user.name);
      if(v){ user.name = v.trim(); renderDiary(); renderMenu(); }
    });

    // 모듈 초기화
    $("#dDate").value = nowDateInput();
    $("#mDate").value = nowDateInput();
    initDiary();
    initMenu();
    initKeeper();
  });
})();
