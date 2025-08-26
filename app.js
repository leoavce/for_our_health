/* 건강지킴이 기능 스크립트 (무음) — GitHub Pages 전용 */
(() => {
  // ===== 공통 =====
  const $ = (s) => document.querySelector(s);
  const nowDateInput = () => new Date().toISOString().slice(0, 10);
  const log = (m) => {
    const el = $("#log");
    if (!el) return;
    el.textContent += `[${new Date().toLocaleTimeString()}] ${m}\n`;
    el.scrollTop = el.scrollHeight;
  };

  // ===== 사용자 네임스페이스 (기기 로컬 저장) =====
  const user = {
    get name() { return localStorage.getItem("user.name") || "guest"; },
    set name(v) { localStorage.setItem("user.name", v); renderUser(); }
  };
  const ns = (key) => `${user.name}:${key}`;
  const renderUser = () => { const el = $("#userLabel"); if (el) el.textContent = user.name; };

  // ===== 탭 라우팅 =====
  const tabs = ["diary", "menu", "keeper"];
  function showTab(id) {
    tabs.forEach((t) => {
      const sec = $("#" + t);
      const btn = document.querySelector(`[data-tab="${t}"]`);
      if (sec) sec.style.display = t === id ? "grid" : "none";
      if (btn) btn.classList.toggle("active", t === id);
    });
    location.hash = id;
  }
  window.addEventListener("hashchange", () => {
    const t = location.hash.replace("#", "") || "diary";
    if (tabs.includes(t)) showTab(t);
  });

  // ===== 알림 권한/서비스워커 =====
  let swReg = null;
  async function registerSW() {
    if (!("serviceWorker" in navigator)) { log("이 브라우저는 서비스워커를 지원하지 않습니다."); return; }
    try {
      // ★ 프로젝트 페이지에서도 404 안 나도록 상대경로 등록
      swReg = await navigator.serviceWorker.register("./sw.js", { scope: "./" });
      log("서비스워커 등록 완료");
    } catch (e) {
      log("서비스워커 등록 실패: " + e.message);
    }
  }
  async function checkPerm() {
    const el = $("#notifState");
    let state = "unsupported";
    if ("Notification" in window) state = Notification.permission;
    if (!el) return state;
    if (state === "granted") el.textContent = "알림: 사용중";
    else if (state === "denied") el.textContent = "알림: 거부됨";
    else el.textContent = "알림: 확인필요";
    return state;
  }
  async function askPerm() {
    if (!("Notification" in window)) return;
    const p = await Notification.requestPermission();
    await checkPerm();
    if (p !== "granted") toast();
  }
  function toast() {
    const t = $("#toast");
    if (!t) return;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 3200);
  }
  function notify(title, body) {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") { toast(); return; }
    const show = (reg) => {
      if (reg && reg.showNotification) reg.showNotification(title, { body, icon: "https://fav.farm/💙", requireInteraction: true });
      else new Notification(title, { body });
    };
    if (swReg) show(swReg);
    else navigator.serviceWorker.getRegistration().then(show);
  }

  // ===== 다이어리 =====
  const loadDiary = () => JSON.parse(localStorage.getItem(ns("diary")) || "[]");
  const saveDiaryList = (list) => { localStorage.setItem(ns("diary"), JSON.stringify(list)); renderDiary(); };
  function renderDiary() {
    const list = loadDiary().sort((a, b) => b.date.localeCompare(a.date));
    const wrap = $("#diaryList");
    if (!wrap) return;
    wrap.innerHTML = "";
    list.forEach((it, idx) => {
      const el = document.createElement("div");
      el.className = "entry";
      el.innerHTML =
        `<h3>${it.title || "(제목 없음)"} <span class="muted">${it.date}</span></h3>
         <p>${it.body || ""}</p>
         <div class="row" style="margin-top:10px">
           <button class="btn ghost" data-edit="${idx}">불러오기</button>
           <button class="btn ghost" data-del="${idx}">삭제</button>
         </div>`;
      wrap.appendChild(el);
    });
  }
  function initDiary() {
    const dDate = $("#dDate"); if (dDate) dDate.value = nowDateInput();
    $("#btnSaveDiary")?.addEventListener("click", () => {
      const item = {
        title: $("#dTitle")?.value.trim() || "",
        date: $("#dDate")?.value || nowDateInput(),
        body: $("#dBody")?.value.trim() || "",
        ts: Date.now()
      };
      const list = loadDiary(); list.push(item); saveDiaryList(list);
      if ($("#dTitle")) $("#dTitle").value = "";
      if ($("#dBody")) $("#dBody").value = "";
      if ($("#dDate")) $("#dDate").value = nowDateInput();
    });
    $("#btnClearDiary")?.addEventListener("click", () => {
      if ($("#dTitle")) $("#dTitle").value = "";
      if ($("#dBody")) $("#dBody").value = "";
    });
    $("#diaryList")?.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const del = t.getAttribute("data-del");
      const edit = t.getAttribute("data-edit");
      if (del !== null) { const list = loadDiary(); list.splice(Number(del), 1); saveDiaryList(list); }
      if (edit !== null) {
        const it = loadDiary()[Number(edit)];
        if ($("#dTitle")) $("#dTitle").value = it.title || "";
        if ($("#dDate")) $("#dDate").value = it.date || nowDateInput();
        if ($("#dBody")) $("#dBody").value = it.body || "";
        showTab("diary");
      }
    });
    renderDiary();
  }

  // ===== 식단 =====
  const loadMenu = () => JSON.parse(localStorage.getItem(ns("menu")) || "{}");
  const saveMenu = (obj) => { localStorage.setItem(ns("menu"), JSON.stringify(obj)); renderMenu(); };
  function renderMenu() {
    const data = loadMenu();
    const wrap = $("#menuList"); if (!wrap) return;
    wrap.innerHTML = "";
    Object.keys(data).sort().reverse().forEach((date) => {
      const m = data[date];
      const el = document.createElement("div");
      el.className = "entry";
      el.innerHTML =
        `<h3>${date}</h3>
         <p>아침: ${m.b || "-"}\n점심: ${m.l || "-"}\n저녁: ${m.d || "-"}</p>
         <div class="row" style="margin-top:10px">
           <button class="btn ghost" data-load="${date}">불러오기</button>
           <button class="btn ghost" data-del="${date}">삭제</button>
         </div>`;
      wrap.appendChild(el);
    });
  }
  function initMenu() {
    const mDate = $("#mDate"); if (mDate) mDate.value = nowDateInput();
    $("#btnTodayFill")?.addEventListener("click", () => { const m = $("#mDate"); if (m) m.value = nowDateInput(); });
    $("#btnSaveMenu")?.addEventListener("click", () => {
      const date = $("#mDate")?.value || nowDateInput();
      const obj = loadMenu();
      obj[date] = {
        b: $("#mBreakfast")?.value.trim() || "",
        l: $("#mLunch")?.value.trim() || "",
        d: $("#mDinner")?.value.trim() || ""
      };
      saveMenu(obj);
      ["#mBreakfast", "#mLunch", "#mDinner"].forEach(id => { const el = $(id); if (el) el.value = ""; });
    });
    $("#menuList")?.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const d = t.getAttribute("data-del");
      const l = t.getAttribute("data-load");
      if (d) { const obj = loadMenu(); delete obj[d]; saveMenu(obj); }
      if (l) {
        const m = loadMenu()[l];
        if ($("#mDate")) $("#mDate").value = l;
        if ($("#mBreakfast")) $("#mBreakfast").value = m.b || "";
        if ($("#mLunch")) $("#mLunch").value = m.l || "";
        if ($("#mDinner")) $("#mDinner").value = m.d || "";
        showTab("menu");
      }
    });
    renderMenu();
  }

  // ===== 건강지킴이(간격 알림) =====
  let eyeTimer = null, stretchTimer = null, tickerInt = null;
  function startKeeper() {
    const eyeMins = Math.max(1, Number($("#eyeMins")?.value || 20));
    const stMins  = Math.max(1, Number($("#stretchMins")?.value || 60));
    stopKeeper();
    function loopEye() {
      notify("먼 곳을 바라볼 시간입니다 👀", "개인이 설정한 시간 간격으로 먼 곳을 바라보며 눈의 휴식을 취해보아요 :)");
      log("눈 휴식 알림 발송");
      eyeTimer = setTimeout(loopEye, eyeMins * 60 * 1000);
    }
    function loopSt() {
      notify("스트레칭 시간! 🧘", "나 스트레칭 시간을 잠시 가져볼까요?");
      log("스트레칭 알림 발송");
      stretchTimer = setTimeout(loopSt, stMins * 60 * 1000);
    }
    eyeTimer = setTimeout(loopEye, eyeMins * 60 * 1000);
    stretchTimer = setTimeout(loopSt, stMins * 60 * 1000);
    localStorage.setItem(ns("keeper"), JSON.stringify({ eyeMins, stMins, running: true }));
    tick(); tickerInt = setInterval(tick, 1000);
  }
  function stopKeeper() {
    if (eyeTimer) { clearTimeout(eyeTimer); eyeTimer = null; }
    if (stretchTimer) { clearTimeout(stretchTimer); stretchTimer = null; }
    if (tickerInt) { clearInterval(tickerInt); tickerInt = null; }
    const tk = $("#ticker"); if (tk) tk.textContent = "대기 중…";
    localStorage.setItem(ns("keeper"), JSON.stringify({ running: false }));
  }
  function tick() {
    const e = Number($("#eyeMins")?.value || 20);
    const s = Number($("#stretchMins")?.value || 60);
    const tk = $("#ticker"); if (tk) tk.textContent = `알림 동작 중 • 눈 ${e}분 / 스트레칭 ${s}분 간격`;
  }
  function initKeeper() {
    const prev = JSON.parse(localStorage.getItem(ns("keeper")) || "{}");
    if (prev.eyeMins && $("#eyeMins")) $("#eyeMins").value = prev.eyeMins;
    if (prev.stMins && $("#stretchMins")) $("#stretchMins").value = prev.stMins;
    if (prev.running) startKeeper();
    $("#btnStart")?.addEventListener("click", startKeeper);
    $("#btnStop")?.addEventListener("click", stopKeeper);
  }

  // ===== 부팅 =====
  document.addEventListener("DOMContentLoaded", async () => {
    renderUser();
    await registerSW();
    await checkPerm();

    document.querySelectorAll(".tabbar button[data-tab]")
      .forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
    showTab(location.hash.replace("#", "") || "diary");

    $("#btnSetUser")?.addEventListener("click", () => {
      const v = prompt("사용자 이름을 입력하세요", user.name);
      if (v) { user.name = v.trim(); renderDiary(); renderMenu(); }
    });
    $("#btnAskPerm")?.addEventListener("click", askPerm);

    initDiary();
    initMenu();
    initKeeper();
  });
})();
