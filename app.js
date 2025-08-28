/* 건강지킴이 — 홈/세부 라우팅 안정화, 무음 알림, 다이어리(YYYYMMDD + 보기/편집/삭제, 노션형 에디터 + 이미지) */
(() => {
  const $ = (s) => document.querySelector(s);

  // 안전한 show()
  const show = (el, v = true) => { if (!el) return; el.classList.toggle("hidden", !v); };

  const log = (m) => {
    const el = $("#log");
    if (!el) return;
    el.textContent += `[${new Date().toLocaleTimeString()}] ${m}\n`;
    el.scrollTop = el.scrollHeight;
  };

  // 날짜 유틸 (YYYYMMDD)
  const todayYMD = () => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}${mm}${dd}`;
  };
  const isYMD = (s) => /^\d{8}$/.test(s);

  // ===== Router (홈/다이어리/식단/건강지킴이) =====
  const pages = ["home", "diary", "menu", "keeper"];
  function go(id) {
    pages.forEach((p) => show(document.getElementById("page-" + p), p === id));
    history.replaceState(null, "", "#" + id);
  }
  function bootRouter() {
    document.querySelectorAll("[data-nav]").forEach((b) => {
      b.addEventListener("click", () => {
        const target = b.getAttribute("data-nav");
        if (pages.includes(target)) go(target);
      });
    });
    const hash = location.hash.replace("#", "") || "home";
    go(pages.includes(hash) ? hash : "home");
  }

  // ===== User =====
  const user = {
    get name() { return localStorage.getItem("user.name") || "guest"; },
    set name(v) {
      localStorage.setItem("user.name", v);
      const u = $("#userLabel"); if (u) u.textContent = v;
    },
  };

  // ===== Notifications & Service Worker =====
  let swReg = null;
  async function registerSW() {
    if (!("serviceWorker" in navigator)) return;
    try { swReg = await navigator.serviceWorker.register("./sw.js", { scope: "./" }); }
    catch (e) { log("SW 등록 실패: " + e.message); }
  }
  function updateNotifState() {
    const state = "Notification" in window ? Notification.permission : "unsupported";
    const label = state === "granted" ? "알림: 사용중" : state === "denied" ? "알림: 거부됨" : "알림: 확인필요";
    const n1 = $("#notifState"); if (n1) n1.textContent = label;
  }
  async function askPerm() {
    if (!("Notification" in window)) return;
    await Notification.requestPermission();
    updateNotifState();
    if (Notification.permission !== "granted") toast();
  }
  function toast() { const t = $("#toast"); if (!t) return; t.style.display = "block"; setTimeout(() => (t.style.display = "none"), 3000); }
  function notify(title, body) {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") { toast(); return; }
    const persist = $("#requireInteraction")?.value === "1";
    const showN = (reg) =>
      reg?.showNotification
        ? reg.showNotification(title, { body, icon: "https://fav.farm/💙", requireInteraction: persist })
        : new Notification(title, { body });
    if (swReg) showN(swReg); else navigator.serviceWorker.getRegistration().then(showN);
  }

  // ===== Namespaced storage =====
  const ns = (k) => `${user.name}:${k}`;

  // ===== Utils for diary =====
  const makeId = () => `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`;
  const textFromHTML = (html = "") => {
    const tmp = document.createElement("div"); tmp.innerHTML = html; return tmp.textContent || "";
  };
  // 간단 sanitize — IMG/A 허용
  const sanitize = (html = "") => {
    const allow = new Set(["DIV","P","SPAN","STRONG","EM","U","S","BLOCKQUOTE","HR","BR","A","IMG"]);
    const root = document.createElement("div"); root.innerHTML = html;
    const walk = (node) => {
      [...node.children].forEach((el) => {
        if (!allow.has(el.tagName)) { el.replaceWith(...el.childNodes); return; }
        [...el.attributes].forEach((a) => {
          if (el.tagName === "A" && a.name === "href") { /* keep */ }
          else if (el.tagName === "IMG" && (a.name === "src" || a.name === "alt")) { /* keep */ }
          else { el.removeAttribute(a.name); }
        });
        if (el.tagName === "A") { el.setAttribute("target","_blank"); el.setAttribute("rel","noopener noreferrer"); }
        if (el.tagName === "IMG") { el.setAttribute("alt", el.getAttribute("alt") || "image"); }
        walk(el);
      });
    };
    walk(root);
    return root.innerHTML;
  };

  // ===== Diary (id 기반 + 리치 에디터 + 이미지) =====
  let editingId = null; // null: 신규, string: 수정 중
  const loadDiary = () => JSON.parse(localStorage.getItem(ns("diary")) || "[]");
  const saveDiaryList = (list) => { localStorage.setItem(ns("diary"), JSON.stringify(list)); renderDiary(); };

  // 기존 데이터 마이그레이션: id/ts 없으면 부여
  const migrate = () => {
    const list = loadDiary(); let changed = false;
    list.forEach((it) => {
      if (!it.id) { it.id = makeId(); changed = true; }
      if (!it.ts) { it.ts = Date.now(); changed = true; }
    });
    if (changed) localStorage.setItem(ns("diary"), JSON.stringify(list));
  };

  function renderDiary() {
    migrate();
    const wrap = $("#diaryList"); if (!wrap) return;
    wrap.innerHTML = "";

    // 최신 작성 순(ts desc)
    const list = [...loadDiary()].sort((a, b) => (b.ts || 0) - (a.ts || 0));

    list.forEach((it) => {
      const id = it.id;
      const plain = it.contentHTML ? textFromHTML(it.contentHTML) : (it.body || "");
      const summary = plain.slice(0, 180) + (plain.length > 180 ? "…" : "");
      const div = document.createElement("div");
      div.className = "entry";
      div.setAttribute("data-id", id);
      div.innerHTML = `
        <button class="gear" title="옵션" aria-label="옵션" data-gear="${id}">
          <svg viewBox="0 0 24 24" fill="none"><path d="M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z" stroke="#334155" stroke-width="1.6"/><path d="M19.4 13.5a7.5 7.5 0 0 0 0-3l2-.9-1.7-3-2.1.7a7.6 7.6 0 0 0-2.6-1.5L14.7 2h-3.4l-.3 2.3a7.6 7.6 0 0 0-2.6 1.5l-2.1-.7-1.7 3 2 .9a7.5 7.5 0 0 0 0 3l-2 .9 1.7 3 2.1-.7a7.6 7.6 0 0 0 2.6-1.5l2.1.7 1.7-3-2-.9Z" stroke="#94a3b8" stroke-width="1.2"/></svg>
        </button>
        <div class="dropdown" id="dd-${id}">
          <button data-edit="${id}">편집</button>
          <button data-del="${id}">삭제</button>
        </div>
        <h3>${it.title || "(제목 없음)"} <span class="muted">${it.date}</span></h3>
        <p data-open="${id}">${summary}</p>
      `;
      wrap.appendChild(div);
    });
  }

  function openView(it) {
    const modal = $("#viewModal"); if (!modal) return;
    const vt = $("#viewTitle"); const vb = $("#viewBody");
    if (vt) vt.textContent = `${it.title || "(제목 없음)"} — ${it.date}`;
    if (vb) {
      const html = it.contentHTML ? sanitize(it.contentHTML)
                                  : (it.body ? `<p>${(it.body||"").replace(/\n/g,"<br>")}</p>` : "(내용 없음)");
      vb.innerHTML = html;
    }
    modal.style.display = "flex";
  }
  function closeView() { const modal = $("#viewModal"); if (modal) modal.style.display = "none"; }

  // --- Notion-like editor helpers ---
  const insertHTML = (html) => document.execCommand("insertHTML", false, html);
  const wrapSelection = (tag) => {
    const sel = window.getSelection();
    const txt = sel && sel.toString();
    if (txt) insertHTML(`<${tag}>${txt}</${tag}>`);
    else insertHTML(`<${tag}>내용</${tag}>`);
  };

  // 이미지 삽입 유틸 (파일 → dataURL)
  function insertImageFile(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result;
      insertHTML(`<img src="${src}" alt="image">`);
    };
    reader.readAsDataURL(file);
  }

  // 커서 이동 유틸
  function setCaretTo(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function inCallout(node) {
    if (!node) return null;
    let n = node.nodeType === 1 ? node : node.parentElement;
    while (n) {
      if (n.classList && n.classList.contains("callout")) return n;
      n = n.parentElement;
    }
    return null;
  }

  function initDiary() {
    const dDate = $("#dDate"); if (dDate) dDate.value = todayYMD();

    // 툴바 동작 (콜아웃/인용/구분선/링크/이미지)
    document.querySelectorAll(".toolbar .tbtn").forEach((b) => {
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const cmd = b.getAttribute("data-cmd");
        const block = b.getAttribute("data-block");
        $("#dBodyRich")?.focus();

        if (cmd) {
          if (cmd === "link") {
            const url = prompt("링크 주소를 입력하세요 (https:// 포함)");
            if (url) document.execCommand("createLink", false, url);
            return;
          }
          document.execCommand(cmd, false, null);
          return;
        }

        if (block === "quote") wrapSelection("blockquote");
        else if (block === "hr") insertHTML("<hr>");
        else if (block === "callout") insertHTML('<div class="callout"><span>💡</span><div>콜아웃 내용을 입력하세요</div></div>');
        else if (block === "image") {
          $("#imgPicker")?.click();
        }
      });
    });

    // 파일선택 → 이미지 삽입
    $("#imgPicker")?.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) insertImageFile(file);
      e.target.value = "";
    });

    // 드래그&드롭 이미지
    const editor = $("#dBodyRich");
    editor?.addEventListener("dragover", (e) => { e.preventDefault(); });
    editor?.addEventListener("drop", (e) => {
      e.preventDefault();
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) insertImageFile(file);
    });

    // 클립보드 이미지 붙여넣기
    editor?.addEventListener("paste", (e) => {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (const it of items) {
        if (it.type && it.type.startsWith("image/")) {
          const file = it.getAsFile();
          if (file) {
            e.preventDefault();
            insertImageFile(file);
            break;
          }
        }
      }
    });

    // 에디터 키보드 핸들러: 콜아웃 탈출/줄바꿈
    editor?.addEventListener("keydown", (e) => {
      const sel = window.getSelection();
      const anchor = sel?.anchorNode;
      const co = inCallout(anchor);
      if (!co) return; // 콜아웃 외부는 기본 동작

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const p = document.createElement("p");
        p.innerHTML = "<br>";
        co.parentNode.insertBefore(p, co.nextSibling);
        setCaretTo(p);
        return;
      }
      if (e.key === "Enter" && e.shiftKey) {
        e.preventDefault();
        insertHTML("<br>");
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        const p = document.createElement("p");
        p.innerHTML = "<br>";
        co.parentNode.insertBefore(p, co.nextSibling);
        setCaretTo(p);
      }
    });

    // 저장
    $("#btnSaveDiary")?.addEventListener("click", () => {
      const title = $("#dTitle")?.value.trim() || "";
      const date  = $("#dDate")?.value.trim() || "";
      const contentHTML = sanitize(($("#dBodyRich")?.innerHTML || "").trim());

      if (!isYMD(date)) { alert("날짜는 YYYYMMDD 형식으로 입력해 주세요."); return; }

      const list = loadDiary();
      if (!editingId) {
        list.push({ id: makeId(), title, date, contentHTML, body: textFromHTML(contentHTML), ts: Date.now() });
      } else {
        const idx = list.findIndex((x) => x.id === editingId);
        if (idx >= 0) list[idx] = { ...list[idx], title, date, contentHTML, body: textFromHTML(contentHTML), ts: Date.now() };
        editingId = null;
        const btn = $("#btnSaveDiary"); if (btn) btn.textContent = "저장";
      }
      saveDiaryList(list);
      if ($("#dTitle")) $("#dTitle").value = "";
      if ($("#dBodyRich")) $("#dBodyRich").innerHTML = "";
      if ($("#dDate")) $("#dDate").value = todayYMD();
    });

    $("#btnClearDiary")?.addEventListener("click", () => { if ($("#dTitle")) $("#dTitle").value = ""; if ($("#dBodyRich")) $("#dBodyRich").innerHTML = ""; });

    // 목록 클릭 핸들러 (id 기반)
    $("#diaryList")?.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;

      // 상세 보기
      const openEl = target.closest("[data-open]");
      if (openEl) {
        const id = openEl.getAttribute("data-open");
        const it = loadDiary().find((x) => x.id === id);
        if (it) openView(it);
        return;
      }

      // 드롭다운 토글 (충돌 방지)
      const gearEl = target.closest("[data-gear]");
      if (gearEl) {
        e.stopPropagation();
        const id = gearEl.getAttribute("data-gear");
        document.querySelectorAll(".dropdown").forEach((d) => (d.style.display = "none"));
        const dd = document.getElementById("dd-" + id);
        if (dd) dd.style.display = dd.style.display === "block" ? "none" : "block";
        return;
      }

      // 편집
      const editEl = target.closest("[data-edit]");
      if (editEl) {
        const id = editEl.getAttribute("data-edit");
        if (!confirm("이 기록을 편집하시겠습니까?")) { const dd = document.getElementById("dd-" + id); if (dd) dd.style.display = "none"; return; }
        const it = loadDiary().find((x) => x.id === id);
        if (it) {
          if ($("#dTitle")) $("#dTitle").value = it.title || "";
          if ($("#dDate"))  $("#dDate").value  = it.date || todayYMD();
          if ($("#dBodyRich")) $("#dBodyRich").innerHTML = it.contentHTML || (it.body ? `<p>${it.body.replace(/\n/g,"<br>")}</p>` : "");
          editingId = id;
          const btn = $("#btnSaveDiary"); if (btn) btn.textContent = "수정 저장";
          go("diary");
        }
        const dd = document.getElementById("dd-" + id); if (dd) dd.style.display = "none";
        return;
      }

      // 삭제
      const delEl = target.closest("[data-del]");
      if (delEl) {
        const id = delEl.getAttribute("data-del");
        if (confirm("정말 삭제하시겠습니까?")) {
          const list = loadDiary().filter((x) => x.id !== id);
          saveDiaryList(list);
        }
        const dd = document.getElementById("dd-" + id); if (dd) dd.style.display = "none";
        return;
      }
    });

    // 드롭다운 외부 클릭 시 자동 닫기
    document.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      if (t.closest(".dropdown") || t.closest(".gear")) return;
      document.querySelectorAll(".dropdown").forEach((d) => (d.style.display = "none"));
    });

    $("#btnCloseView")?.addEventListener("click", closeView);
    $("#viewModal")?.addEventListener("click", (e) => { if (e.target === e.currentTarget) closeView(); });

    renderDiary();
  }

  // ===== Menu (presets) =====
  const PRESETS = {
    weekday: { b: "", l: "속초식문어국밥, 기장조밥, 김치매밀전병, 야채달갈찜, 단호박샐러드, 고추지무침", d: "" },
    protein: { b: "스크램블에그, 토마토", l: "연어포케, 아보카도", d: "닭가슴살 스테이크, 구운야채" },
    korean:  { b: "밥, 미소국, 김, 나물", l: "비빔밥(나물 위주)", d: "고등어구이, 된장국, 깻잎" },
    lowcarb: { b: "그릭요거트, 견과", l: "샐러드+올리브오일, 치킨브레스트", d: "구운 연어, 버터브로콜리" },
  };
  const loadMenu = () => JSON.parse(localStorage.getItem(ns("menu")) || "{}");
  const saveMenu = (obj) => { localStorage.setItem(ns("menu"), JSON.stringify(obj)); renderMenu(); };
  function renderMenu() {
    const wrap = $("#menuList"); if (!wrap) return; wrap.innerHTML = "";
    const data = loadMenu();
    Object.keys(data).sort().reverse().forEach((date) => {
      const m = data[date];
      const el = document.createElement("div");
      el.className = "entry";
      el.innerHTML = `<h3>${date}</h3>
                      <p>아침: ${m.b || "-"}\n점심: ${m.l || "-"}\n저녁: ${m.d || "-"}</p>
                      <div class="row" style="gap:8px;margin-top:8px">
                        <button class="btn ghost" data-load="${date}">불러오기</button>
                        <button class="btn ghost" data-del="${date}">삭제</button>
                      </div>`;
      wrap.appendChild(el);
    });
  }
  function initMenu() {
    const mDate = $("#mDate"); if (mDate) mDate.value = new Date().toISOString().slice(0, 10);
    $("#btnTodayFill")?.addEventListener("click", () => { const el = $("#mDate"); if (el) el.value = new Date().toISOString().slice(0, 10); });
    $("#btnPreset")?.addEventListener("click", () => {
      const k = $("#presetSelect")?.value || "weekday";
      const p = PRESETS[k] || PRESETS.weekday;
      const b = $("#mBreakfast"), l = $("#mLunch"), d = $("#mDinner");
      if (b) b.value = p.b; if (l) l.value = p.l; if (d) d.value = p.d;
    });
    $("#btnSaveMenu")?.addEventListener("click", () => {
      const date = $("#mDate")?.value || new Date().toISOString().slice(0, 10);
      const obj = loadMenu();
      obj[date] = {
        b: $("#mBreakfast")?.value.trim() || "",
        l: $("#mLunch")?.value.trim() || "",
        d: $("#mDinner")?.value.trim() || "",
      };
      saveMenu(obj);
      ["#mBreakfast","#mLunch","#mDinner"].forEach((id) => { const el = $(id); if (el) el.value = ""; });
    });
    $("#menuList")?.addEventListener("click", (e) => {
      const t = e.target; if (!(t instanceof HTMLElement)) return;
      const d = t.getAttribute("data-del");
      const l = t.getAttribute("data-load");
      if (d) { const obj = loadMenu(); delete obj[d]; saveMenu(obj); }
      if (l) {
        const m = loadMenu()[l];
        if ($("#mDate")) $("#mDate").value = l;
        if ($("#mBreakfast")) $("#mBreakfast").value = m.b || "";
        if ($("#mLunch")) $("#mLunch").value = m.l || "";
        if ($("#mDinner")) $("#mDinner").value = m.d || "";
        go("menu");
      }
    });
    renderMenu();
  }

  // ===== Keeper (알림) =====
  let eyeTimer = null, stretchTimer = null, tickerInt = null;
  function startKeeper() {
    const eyeMins = Math.max(1, Number($("#eyeMins")?.value || 20));
    const stMins  = Math.max(1, Number($("#stretchMins")?.value || 60));
    stopKeeper();
    const loopEye = () => { notify("먼 곳을 바라볼 시간입니다 👀", "개인이 설정한 시간 간격으로 먼 곳을 바라보며 눈의 휴식을 취해보아요 :)"); log("눈 휴식 알림"); eyeTimer = setTimeout(loopEye, eyeMins*60*1000); };
    const loopSt  = () => { notify("스트레칭 시간! 🧘", "스트레칭 시간을 잠시 가져볼까요?"); log("스트레칭 알림"); stretchTimer = setTimeout(loopSt, stMins*60*1000); };
    eyeTimer = setTimeout(loopEye, eyeMins*60*1000);
    stretchTimer = setTimeout(loopSt, stMins*60*1000);
    tick(); tickerInt = setInterval(tick, 1000);
  }
  function stopKeeper() {
    if (eyeTimer) { clearTimeout(eyeTimer); eyeTimer = null; }
    if (stretchTimer) { clearTimeout(stretchTimer); stretchTimer = null; }
    if (tickerInt) { clearInterval(tickerInt); tickerInt = null; }
    const tk = $("#ticker"); if (tk) tk.textContent = "대기 중…";
  }
  function tick() {
    const e = Number($("#eyeMins")?.value || 20);
    const s = Number($("#stretchMins")?.value || 60);
    const tk = $("#ticker"); if (tk) tk.textContent = `알림 동작 중 • 눈 ${e}분 / 스트레칭 ${s}분 간격`;
  }
  function initKeeper() { $("#btnStart")?.addEventListener("click", startKeeper); $("#btnStop")?.addEventListener("click", stopKeeper); }

  // ===== Boot =====
  document.addEventListener("DOMContentLoaded", async () => {
    const u = $("#userLabel"); if (u) u.textContent = user.name;
    $("#btnSetUser")?.addEventListener("click", () => {
      const v = prompt("사용자 이름을 입력하세요", user.name);
      if (v) { user.name = v.trim(); renderDiary(); renderMenu(); }
    });

    bootRouter();
    await registerSW();
    updateNotifState();
    $("#btnAskPerm")?.addEventListener("click", askPerm);

    const dDate = $("#dDate"); if (dDate) dDate.value = todayYMD();
    initDiary();
    initMenu();
    initKeeper();
  });
})();
