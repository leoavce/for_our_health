/* 건강지킴이 — 홈/세부 라우팅, 무음 알림, 다이어리(YYYYMMDD + 보기/편집/삭제) */
(() => {
  const $ = (s) => document.querySelector(s);
  const show = (el, v=true)=> el.classList.toggle('hidden', !v);
  const log = (m)=>{ const el=$("#log"); if(!el) return; el.textContent += `[${new Date().toLocaleTimeString()}] ${m}\n`; el.scrollTop = el.scrollHeight; };

  // 날짜 유틸 (YYYYMMDD)
  const todayYMD = () => {
    const d = new Date();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${d.getFullYear()}${mm}${dd}`;
  };
  const isYMD = (s) => /^\d{8}$/.test(s);

  // Router
  const pages = ["home","diary","menu","keeper"];
  function go(id){ pages.forEach(p => show($("#page-"+p), p===id)); history.replaceState(null,"","#"+id); }
  function bootRouter(){
    document.querySelectorAll("[data-nav]").forEach(b=> b.addEventListener("click", ()=> go(b.getAttribute("data-nav")) ));
    const hash = location.hash.replace("#","") || "home"; go(pages.includes(hash)?hash:"home");
  }

  // User
  const user = {
    get name(){ return localStorage.getItem("user.name") || "guest"; },
    set name(v){ localStorage.setItem("user.name", v); const u=$("#userLabel"); if(u) u.textContent = v; }
  };

  // Notifications & SW
  let swReg=null;
  async function registerSW(){ if(!("serviceWorker" in navigator)) return; try{ swReg = await navigator.serviceWorker.register("./sw.js",{scope:"./"}); } catch(e){ log("SW 등록 실패: "+e.message); } }
  function updateNotifState(){
    const state = ("Notification" in window) ? Notification.permission : "unsupported";
    const label = (state==="granted") ? "알림: 사용중" : (state==="denied" ? "알림: 거부됨" : "알림: 확인필요");
    const n1 = $("#notifState"); if(n1) n1.textContent = label;   // ← null 체크로 에러 방지
  }
  async function askPerm(){ if(!("Notification" in window)) return; await Notification.requestPermission(); updateNotifState(); if(Notification.permission!=="granted") toast(); }
  function toast(){ const t=$("#toast"); if(!t) return; t.style.display="block"; setTimeout(()=>t.style.display="none", 3000); }
  function notify(title, body){
    if(!("Notification" in window)) return;
    if(Notification.permission!=="granted"){ toast(); return; }
    const persist = $("#requireInteraction")?.value === "1";
    const showN = (reg)=> reg?.showNotification ? reg.showNotification(title,{ body, icon:"https://fav.farm/💙", requireInteraction:persist }) : new Notification(title,{ body });
    if(swReg) showN(swReg); else navigator.serviceWorker.getRegistration().then(showN);
  }

  // Namespaced storage
  const ns = (k)=> `${user.name}:${k}`;

  // ===== Diary (YYYYMMDD + 보기/편집/삭제) =====
  let editingIndex = null; // null: 신규, number: 수정 중
  const loadDiary = ()=> JSON.parse(localStorage.getItem(ns("diary"))||"[]");
  const saveDiaryList = (list)=>{ localStorage.setItem(ns("diary"), JSON.stringify(list)); renderDiary(); };

  function renderDiary(){
    const wrap=$("#diaryList"); if(!wrap) return; wrap.innerHTML="";
    const list=loadDiary().sort((a,b)=> b.date.localeCompare(a.date));
    list.forEach((it,idx)=>{
      const div=document.createElement("div"); div.className="entry"; div.dataset.idx = String(idx);

      div.innerHTML = `
        <button class="gear" title="옵션" aria-label="옵션" data-gear="${idx}">
          <svg viewBox="0 0 24 24" fill="none"><path d="M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z" stroke="#334155" stroke-width="1.6"/><path d="M19.4 13.5a7.5 7.5 0 0 0 0-3l2-.9-1.7-3-2.1.7a7.6 7.6 0 0 0-2.6-1.5L14.7 2h-3.4l-.3 2.3a7.6 7.6 0 0 0-2.6 1.5l-2.1-.7-1.7 3 2 .9a7.5 7.5 0 0 0 0 3l-2 .9 1.7 3 2.1-.7a7.6 7.6 0 0 0 2.6 1.5l.3 2.3h3.4l.3-2.3a7.6 7.6 0 0 0 2.6-1.5l2.1.7 1.7-3-2-.9Z" stroke="#94a3b8" stroke-width="1.2"/></svg>
        </button>
        <div class="dropdown" id="dd-${idx}">
          <button data-edit="${idx}">편집</button>
          <button data-del="${idx}">삭제</button>
        </div>
        <h3>${it.title||"(제목 없음)"} <span class="muted">${it.date}</span></h3>
        <p data-open="${idx}">${(it.body||'').slice(0,120)}${(it.body&&it.body.length>120)?'…':''}</p>
      `;
      wrap.appendChild(div);
    });
  }

  function openView(it){
    const modal = $("#viewModal");
    $("#viewTitle").textContent = `${it.title||"(제목 없음)"} — ${it.date}`;
    $("#viewBody").textContent = it.body||"(내용 없음)";
    modal.style.display = "flex";
  }

  function closeView(){ $("#viewModal").style.display="none"; }

  function initDiary(){
    const dDate = $("#dDate"); if(dDate) dDate.value = todayYMD();

    $("#btnSaveDiary").addEventListener("click", ()=>{
      const title = $("#dTitle").value.trim();
      const date  = $("#dDate").value.trim();
      const body  = $("#dBody").value.trim();

      if(!isYMD(date)){ alert("날짜는 YYYYMMDD 형식으로 입력해 주세요."); return; }

      const list = loadDiary();
      if(editingIndex===null){
        list.push({ title, date, body, ts: Date.now() });
      }else{
        list[editingIndex] = { ...list[editingIndex], title, date, body };
        editingIndex = null;
        $("#btnSaveDiary").textContent = "저장";
      }
      saveDiaryList(list);
      $("#dTitle").value=""; $("#dBody").value=""; $("#dDate").value=todayYMD();
    });

    $("#btnClearDiary").addEventListener("click", ()=>{ $("#dTitle").value=""; $("#dBody").value=""; });

    // 목록 클릭: 보기 / 메뉴 열기 / 편집 / 삭제
    $("#diaryList").addEventListener("click", (e)=>{
      const t = e.target; if(!(t instanceof HTMLElement)) return;

      // 본문 클릭 -> 상세 보기
      const openIdx = t.closest("[data-open]")?.getAttribute("data-open");
      if(openIdx!==null && openIdx!==undefined){
        const it = loadDiary()[Number(openIdx)];
        openView(it);
        return;
      }
      // 톱니 클릭 -> 드롭다운 토글
      const gearIdx = t.closest("[data-gear]")?.getAttribute("data-gear");
      if(gearIdx!==null && gearIdx!==undefined){
        const dd = $("#dd-"+gearIdx);
        if(dd) dd.style.display = dd.style.display==='block' ? 'none' : 'block';
        return;
      }
      // 편집
      const edit = t.getAttribute("data-edit");
      if(edit!==null){
        const it = loadDiary()[Number(edit)];
        $("#dTitle").value = it.title||"";
        $("#dDate").value  = it.date||todayYMD();
        $("#dBody").value  = it.body||"";
        editingIndex = Number(edit);
        $("#btnSaveDiary").textContent = "수정 저장";
        go("diary");
        const dd = $("#dd-"+edit); if(dd) dd.style.display='none';
        return;
      }
      // 삭제
      const del = t.getAttribute("data-del");
      if(del!==null){
        if(confirm("정말 삭제하시겠습니까?")){
          const list = loadDiary(); list.splice(Number(del),1); saveDiaryList(list);
        }
        const dd = $("#dd-"+del); if(dd) dd.style.display='none';
        return;
      }
    });

    $("#btnCloseView").addEventListener("click", closeView);
    $("#viewModal").addEventListener("click", (e)=>{ if(e.target===e.currentTarget) closeView(); });

    renderDiary();
  }

  // ===== Menu (presets) =====
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
    const data=loadMenu();
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
    const mDate=$("#mDate"); if(mDate) mDate.value = new Date().toISOString().slice(0,10);
    $("#btnTodayFill").addEventListener("click", ()=> $("#mDate").value = new Date().toISOString().slice(0,10));
    $("#btnPreset").addEventListener("click", ()=>{
      const k=$("#presetSelect").value; const p=PRESETS[k]||PRESETS.weekday;
      $("#mBreakfast").value=p.b; $("#mLunch").value=p.l; $("#mDinner").value=p.d;
    });
    $("#btnSaveMenu").addEventListener("click", ()=>{
      const date=$("#mDate").value || new Date().toISOString().slice(0,10);
      const obj=loadMenu();
      obj[date] = { b:$("#mBreakfast").value.trim(), l:$("#mLunch").value.trim(), d:$("#mDinner").value.trim() };
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

  // ===== Keeper =====
  let eyeTimer=null, stretchTimer=null, tickerInt=null;
  function startKeeper(){
    const eyeMins=Math.max(1, Number($("#eyeMins").value||20));
    const stMins=Math.max(1, Number($("#stretchMins").value||60));
    stopKeeper();
    const loopEye=()=>{ notify("먼 곳을 바라볼 시간입니다 👀","개인이 설정한 시간 간격으로 먼 곳을 바라보며 눈의 휴식을 취해보아요 :)"); log("눈 휴식 알림"); eyeTimer=setTimeout(loopEye, eyeMins*60*1000); };
    const loopSt =()=>{ notify("스트레칭 시간! 🧘","나 스트레칭 시간을 잠시 가져볼까요?"); log("스트레칭 알림"); stretchTimer=setTimeout(loopSt, stMins*60*1000); };
    eyeTimer=setTimeout(loopEye, eyeMins*60*1000);
    stretchTimer=setTimeout(loopSt, stMins*60*1000);
    tick(); tickerInt=setInterval(tick,1000);
  }
  function stopKeeper(){ if(eyeTimer){clearTimeout(eyeTimer);eyeTimer=null;} if(stretchTimer){clearTimeout(stretchTimer);stretchTimer=null;} if(tickerInt){clearInterval(tickerInt);tickerInt=null;} const tk=$("#ticker"); if(tk) tk.textContent="대기 중…"; }
  function tick(){ const e=Number($("#eyeMins").value||20), s=Number($("#stretchMins").value||60); const tk=$("#ticker"); if(tk) tk.textContent=`알림 동작 중 • 눈 ${e}분 / 스트레칭 ${s}분 간격`; }
  function initKeeper(){ $("#btnStart").addEventListener("click", startKeeper); $("#btnStop").addEventListener("click", stopKeeper); $("#btnTest").addEventListener("click", ()=> notify("테스트 알림","권한/표시 확인용입니다.")); }

  // Boot
  document.addEventListener("DOMContentLoaded", async ()=>{
    const u=$("#userLabel"); if(u) u.textContent = user.name;
    $("#btnSetUser").addEventListener("click", ()=>{ const v=prompt("사용자 이름을 입력하세요", user.name); if(v){ user.name=v.trim(); renderDiary(); renderMenu(); } });

    bootRouter();

    await registerSW();
    updateNotifState();
    $("#btnAskPerm").addEventListener("click", askPerm);

    // 초기 값
    const dDate=$("#dDate"); if(dDate) dDate.value = todayYMD();
    initDiary(); initMenu(); initKeeper();
  });
})();
