/* 건강지킴이 — 미니멀 UI + 홈/기능 라우팅 + 무음 알림 */
(() => {
  // ---------- 공통 ----------
  const $ = (s) => document.querySelector(s);
  const nowDateInput = () => new Date().toISOString().slice(0, 10);
  const show = (el, v=true)=> el.classList.toggle('hidden', !v);
  const log = (m)=>{ const el=$("#log"); if(!el) return; el.textContent += `[${new Date().toLocaleTimeString()}] ${m}\n`; el.scrollTop = el.scrollHeight; };

  // ---------- 라우터 ----------
  const pages = ["home","diary","menu","keeper"];
  function go(id){
    pages.forEach(p => show($("#page-"+p), p===id));
    history.replaceState(null, "", "#"+id);
  }
  function bootRouter(){
    document.querySelectorAll("[data-nav]").forEach(b=>{
      b.addEventListener("click", ()=> go(b.getAttribute("data-nav")));
    });
    const hash = location.hash.replace("#","") || "home";
    go(pages.includes(hash)?hash:"home");
  }

  // ---------- 사용자 ----------
  const user = {
    get name(){ return localStorage.getItem("user.name") || "guest"; },
    set name(v){ localStorage.setItem("user.name", v); $("#userLabel").textContent = v; }
  };

  // ---------- 알림 / 서비스워커 ----------
  let swReg = null;
  async function registerSW(){
    if(!("serviceWorker" in navigator)) return;
    try{ swReg = await navigator.serviceWorker.register("./sw.js", { scope:"./" }); }
    catch(e){ log("SW 등록 실패: "+e.message); }
  }
  function updateNotifState(){
    const state = ("Notification" in window) ? Notification.permission : "unsupported";
    const label = (state==="granted" ? "알림: 사용중" : state==="denied" ? "알림: 거부됨" : "알림: 확인필요");
    $("#notifState").textContent = label;
    $("#notifState2").textContent = label;
  }
  async function askPerm(){
    if(!("Notification" in window)) return;
    await Notification.requestPermission(); updateNotifState();
    if(Notification.permission!=="granted") toast();
  }
  function toast(){ const t=$("#toast"); t.style.display="block"; setTimeout(()=>t.style.display="none", 3000); }
  function notify(title, body){
    if(!("Notification" in window)) return;
    if(Notification.permission!=="granted"){ toast(); return; }
    const persist = $("#requireInteraction")?.value === "1";
    const show = (reg)=> reg?.showNotification ? reg.showNotification(title,{ body, icon:"https://fav.farm/💙", requireInteraction:persist }) : new Notification(title,{ body });
    if(swReg) show(swReg); else navigator.serviceWorker.getRegistration().then(show);
  }

  // ---------- 다이어리 ----------
  const ns = (k)=> `${user.name}:${k}`;
  const loadDiary = ()=> JSON.parse(localStorage.getItem(ns("diary"))||"[]");
  const saveDiaryList = (list)=>{ localStorage.setItem(ns("diary"), JSON.stringify(list)); renderDiary(); };
  function renderDiary(){
    const wrap = $("#diaryList"); if(!wrap) return; wrap.innerHTML="";
    const list = loadDiary().sort((a,b)=> b.date.localeCompare(a.date));
    list.forEach((it, idx)=>{
      const div = document.createElement("div"); div.className="entry";
      div.innerHTML = `<h3>${it.title||"(제목 없음)"} <span class="muted">${it.date}</span></h3>
                       <p>${it.body||""}</p>
                       <div class="row" style="gap:8px;margin-top:8px">
                        <button class="btn ghost" data-edit="${idx}">불러오기</button>
                        <button class="btn ghost" data-del="${idx}">삭제</button>
                       </div>`;
      wrap.appendChild(div);
    });
  }
  function initDiary(){
    $("#dDate").value = nowDateInput();
    $("#btnSaveDiary").addEventListener("click", ()=>{
      const item = { title: $("#dTitle").value.trim(), date: $("#dDate").value, body: $("#dBody").value.trim(), ts: Date.now() };
      const list = loadDiary(); list.push(item); saveDiaryList(list);
      $("#dTitle").value=""; $("#dBody").value=""; $("#dDate").value=nowDateInput();
    });
    $("#btnClearDiary").addEventListener("click", ()=>{ $("#dTitle").value=""; $("#dBody").value=""; });
    $("#diaryList").addEventListener("click",(e)=>{
      const t=e.target; if(!(t instanceof HTMLElement)) return;
      const del=t.getAttribute("data-del"); const edit=t.getAttribute("data-edit");
      if(del!==null){ const list=loadDiary(); list.splice(Number(del),1); saveDiaryList(list); }
      if(edit!==null){ const it=loadDiary()[Number(edit)]; $("#dTitle").value=it.title||""; $("#dDate").value=it.date; $("#dBody").value=it.body||""; go("diary"); }
    });
    renderDiary();
  }

  // ---------- 식단 (프리셋 + 저장/목록) ----------
  const PRESETS = {
    weekday:{ b:"오트밀+우유, 블루베리", l:"닭가슴살 샐러드, 통밀빵", d:"현미밥, 두부, 채소무침" },
    protein:{ b:"스크램블에그, 토마토", l:"연어포케, 아보카도", d:"닭가슴살 스테이크, 구운야채" },
    korean:{  b:"밥, 미소국, 김, 나물", l:"비빔밥(나물 위주)", d:"고등어구이, 된장국, 깻잎" },
    lowcarb:{ b:"그릭요거트, 견과", l:"샐러드+올리브오일, 치킨브레스트", d:"구운 연어, 버터브로콜리" }
  };
  const loadMenu = ()=> JSON.parse(localStorage.getItem(ns("menu"))||"{}");
  const saveMenu = (obj)=>{ localStorage.setItem(ns("menu"), JSON.stringify(obj)); renderMenu(); };
  function renderMenu(){
    const wrap=$("#menuList"); if(!wrap) return; wrap.innerHTML="";
    const data = loadMenu();
    Object.keys(data).sort().reverse().forEach(date=>{
      const m=data[date];
      const el=document.createElement("div"); el.className="entry";
      el.innerHTML = `<h3>${date}</h3>
                      <p>아침: ${m.b||"-"}\n점심: ${m.l||"-"}\n저녁: ${m.d||"-"}</p>
                      <div class="row" style="gap:8px;margin-top:8px">
                        <button class="btn ghost" data-load="${date}">불러오기</button>
                        <button class="btn ghost" data-del="${date}">삭제</button>
                      </div>`;
      wrap.appendChild(el);
    });
  }
  function initMenu(){
    $("#mDate").value = nowDateInput();
    $("#btnTodayFill").addEventListener("click", ()=> $("#mDate").value = nowDateInput());
    $("#btnPreset").addEventListener("click", ()=>{
      const k = $("#presetSelect").value;
      const p = PRESETS[k] || PRESETS.weekday;
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
      if(l){ const m=loadMenu()[l]; $("#mDate").value=l; $("#mBreakfast").value=m.b||""; $("#mLunch").value=m.l||""; $("#mDinner").value=m.d||""; go("menu"); }
    });
    renderMenu();
  }

  // ---------- 건강지킴이 (간격 알림) ----------
  let eyeTimer=null, stretchTimer=null, tickerInt=null;
  function startKeeper(){
    const eyeMins = Math.max(1, Number($("#eyeMins").value||20));
    const stMins  = Math.max(1, Number($("#stretchMins").value||60));
    stopKeeper();
    const loopEye = ()=>{ notify("먼 곳을 바라볼 시간입니다 👀","개인이 설정한 시간 간격으로 먼 곳을 바라보며 눈의 휴식을 취해보아요 :)"); log("눈 휴식 알림"); eyeTimer = setTimeout(loopEye, eyeMins*60*1000); };
    const loopSt  = ()=>{ notify("스트레칭 시간! 🧘","나 스트레칭 시간을 잠시 가져볼까요?"); log("스트레칭 알림"); stretchTimer = setTimeout(loopSt, stMins*60*1000); };
    eyeTimer = setTimeout(loopEye, eyeMins*60*1000);
    stretchTimer = setTimeout(loopSt, stMins*60*1000);
    tick(); tickerInt = setInterval(tick, 1000);
  }
  function stopKeeper(){
    if(eyeTimer){clearTimeout(eyeTimer); eyeTimer=null;}
    if(stretchTimer){clearTimeout(stretchTimer); stretchTimer=null;}
    if(tickerInt){clearInterval(tickerInt); tickerInt=null;}
    $("#ticker").textContent = "대기 중…";
  }
  function tick(){
    const e = Number($("#eyeMins").value||20), s = Number($("#stretchMins").value||60);
    $("#ticker").textContent = `알림 동작 중 • 눈 ${e}분 / 스트레칭 ${s}분 간격`;
  }
  function initKeeper(){
    $("#btnStart").addEventListener("click", startKeeper);
    $("#btnStop").addEventListener("click", stopKeeper);
    $("#btnTest").addEventListener("click", ()=> notify("테스트 알림","권한/표시 확인용입니다."));
  }

  // ---------- 부팅 ----------
  document.addEventListener("DOMContentLoaded", async ()=>{
    $("#userLabel").textContent = user.name;
    $("#btnSetUser").addEventListener("click", ()=>{
      const v = prompt("사용자 이름을 입력하세요", user.name);
      if(v){ user.name = v.trim(); renderDiary(); renderMenu(); }
    });

    // 라우터/네비
    bootRouter();

    // 알림 버튼(상단+keeper)
    await registerSW();
    updateNotifState();
    $("#btnAskPerm").addEventListener("click", askPerm);
    $("#btnAskPerm2").addEventListener("click", askPerm);

    // 초기화
    $("#dDate").value = nowDateInput();
    $("#mDate").value = nowDateInput();
    initDiary(); initMenu(); initKeeper();
  });
})();
