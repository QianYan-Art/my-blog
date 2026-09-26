/* ──────────────────────────────────────────────
   post.js — 文章阅读页增强
   目录（桌面侧栏 + 窄屏折叠与浮动面板）· 滚动高亮 · 阅读进度
   代码高亮与复制 · 返回顶部
   ────────────────────────────────────────────── */
(function () {
  function setListReturnLink() {
    var back = document.querySelector(".post-back");
    if (!back || !document.referrer || typeof window.URL !== "function") return;

    try {
      var currentUrl = new window.URL(window.location.href);
      var referrerUrl = new window.URL(document.referrer, currentUrl.href);
      // 仅接受同源且严格位于文章列表页的来源，避免外源回跳。
      if (referrerUrl.origin !== currentUrl.origin || referrerUrl.pathname !== "/blog/") return;
      back.setAttribute("href", referrerUrl.pathname + referrerUrl.search + referrerUrl.hash);
    } catch (error) {
      // 无法解析来源时保留模板中的安全默认链接。
    }
  }

  setListReturnLink();

  var content = document.querySelector(".post-content");
  if (!content) return;

  /* ---- 代码高亮 ---- */
  if (window.hljs) {
    var blocks = content.querySelectorAll("pre code");
    for (var i = 0; i < blocks.length; i++) {
      window.hljs.highlightElement(blocks[i]);
    }
  }

  /* ---- 代码块复制按钮 ---- */
  var pres = content.querySelectorAll("pre");
  for (var p = 0; p < pres.length; p++) {
    (function (pre) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "code-copy";
      btn.textContent = "复制";
      btn.setAttribute("aria-label", "复制代码");
      btn.addEventListener("click", function () {
        var text = pre.querySelector("code") ? pre.querySelector("code").innerText : pre.innerText;
        function done(ok) {
          btn.textContent = ok ? "已复制" : "失败";
          btn.classList.toggle("is-copied", ok);
          setTimeout(function () {
            btn.textContent = "复制";
            btn.classList.remove("is-copied");
          }, 1600);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
        } else {
          var ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          var ok = false;
          try { ok = document.execCommand("copy"); } catch (e) {}
          document.body.removeChild(ta);
          done(ok);
        }
      });
      var wrap = document.createElement("div");
      wrap.className = "code-block";
      pre.parentNode.insertBefore(wrap, pre);
      wrap.appendChild(pre);
      wrap.appendChild(btn);
    })(pres[p]);
  }

  /* ---- 滚动容器 ----
     html 与 body 同时设置了 overflow-x: hidden，文章页实际由 body 滚动，window.scrollY 恒为 0。
     这里统一读写真实滚动位置，进度条、返回顶部与目录高亮都依赖它。 */
  function scrollTopNow() {
    return Math.max(window.scrollY || 0, document.documentElement.scrollTop || 0, document.body.scrollTop || 0);
  }
  function scrollMax() {
    var body = document.body, doc = document.documentElement;
    var bodyMax = body.scrollHeight - body.clientHeight;
    var docMax = doc.scrollHeight - window.innerHeight;
    return Math.max(bodyMax, docMax, 0);
  }
  function scrollToY(y, smooth) {
    var opts = { top: y, behavior: smooth ? "smooth" : "auto" };
    window.scrollTo(opts);
    if (document.body.scrollTo) document.body.scrollTo(opts);
  }
  var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- 标题收集与 id 分配 ----
     文章 Markdown 的 ## / ### 渲染为 h3 / h4（总标题在正文外）。取正文中出现的最高两级：
     上级为章节，下级为小节；小节只在所属章节被阅读时展开。 */
  var headingEls = [];
  var allHeadings = content.querySelectorAll("h2, h3, h4");
  for (var hh = 0; hh < allHeadings.length; hh++) {
    if (allHeadings[hh].closest && allHeadings[hh].closest(".footnotes")) continue;
    headingEls.push(allHeadings[hh]);
  }
  var topLevel = 9;
  for (var tl = 0; tl < headingEls.length; tl++) {
    topLevel = Math.min(topLevel, Number(headingEls[tl].tagName.charAt(1)));
  }

  var usedIds = {};
  var sections = [];   // 章节：{ id, num, text, el, subs: [] }
  var flat = [];       // 章节与小节按文档顺序：{ id, el, section }
  for (var h = 0; h < headingEls.length; h++) {
    var el = headingEls[h];
    var level = Number(el.tagName.charAt(1));
    if (level > topLevel + 1) continue;
    if (!el.id) {
      var base = (el.textContent || "sec").trim().toLowerCase()
        .replace(/[^\w一-龥]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48) || "sec";
      var id = base, n = 2;
      while (usedIds[id] || document.getElementById(id)) { id = base + "-" + n; n += 1; }
      usedIds[id] = true;
      el.id = id;
    }
    // 拆出标题里的序号：“0. ” “1）” “（1）”，序号单独成列
    var full = (el.textContent || "").trim();
    var m = full.match(/^(\d+[.．、]|\d+[）)]|[（(]\d+[）)])\s*(.+)$/);
    var entry = { id: el.id, num: m ? m[1] : "", text: m ? m[2] : full, el: el };
    if (level === topLevel || !sections.length) {
      entry.subs = [];
      sections.push(entry);
      flat.push({ id: el.id, el: el, section: sections.length - 1 });
    } else {
      sections[sections.length - 1].subs.push(entry);
      flat.push({ id: el.id, el: el, section: sections.length - 1 });
    }
  }

  /* ---- 目录构建（桌面侧栏、正文前折叠目录、浮动目录面板共用） ---- */
  var registries = [];   // 每份目录：{ root, links: {id: a}, items: [li] }

  function makeLink(entry, cls) {
    var a = document.createElement("a");
    a.className = cls;
    a.href = "#" + entry.id;
    a.dataset.target = entry.id;
    if (entry.num) {
      var num = document.createElement("span");
      num.className = "post-toc__num";
      num.textContent = entry.num.replace(/[.．、]$/, "");
      a.appendChild(num);
    }
    var text = document.createElement("span");
    text.className = "post-toc__text";
    text.textContent = entry.text;
    a.appendChild(text);
    a.title = (entry.num ? entry.num + " " : "") + entry.text;
    return a;
  }

  function buildList() {
    var reg = { links: {}, items: [] };
    var ol = document.createElement("ol");
    ol.className = "post-toc__list";
    for (var i = 0; i < sections.length; i++) {
      var s = sections[i];
      var li = document.createElement("li");
      li.className = "post-toc__item";
      var a = makeLink(s, "post-toc__link");
      li.appendChild(a);
      reg.links[s.id] = a;
      if (s.subs.length) {
        li.classList.add("has-subs");
        var wrap = document.createElement("div");
        wrap.className = "post-toc__subwrap";
        var sub = document.createElement("ol");
        sub.className = "post-toc__sub";
        for (var j = 0; j < s.subs.length; j++) {
          var sli = document.createElement("li");
          var sa = makeLink(s.subs[j], "post-toc__sublink");
          sli.appendChild(sa);
          sub.appendChild(sli);
          reg.links[s.subs[j].id] = sa;
        }
        wrap.appendChild(sub);
        li.appendChild(wrap);
      }
      ol.appendChild(li);
      reg.items.push(li);
    }
    reg.root = ol;
    registries.push(reg);
    return ol;
  }

  function makeHead(label, metaClass) {
    var head = document.createElement("div");
    head.className = "post-toc__head";
    head.innerHTML = '<span class="post-toc__label">' + label + '</span><span class="post-toc__rule" aria-hidden="true"></span>' +
      '<span class="' + metaClass + '"></span>';
    return head;
  }

  // 目录点击：平滑滚动 + replaceState，不往 history 压栈（否则“返回”会退回上一个章节）
  function jumpTo(id) {
    var target = document.getElementById(id);
    if (!target) return;
    var y = scrollTopNow() + target.getBoundingClientRect().top - 84;
    scrollToY(Math.max(0, y), !reducedMotion);
    if (history.replaceState) history.replaceState(null, "", "#" + id);
  }
  function bindClicks(container, after) {
    container.addEventListener("click", function (e) {
      var a = e.target.closest ? e.target.closest("a[data-target]") : null;
      if (!a) return;
      e.preventDefault();
      if (after) after();
      jumpTo(a.dataset.target);
    });
  }

  var tocAside = null, tocInner = null, tocMarker = null, tocPct = null;
  var fab = null, sheet = null, sheetCount = null;

  if (sections.length >= 2) {
    var total = sections.length;

    // 1) 桌面（≥1340px）：右侧悬浮侧栏，墨条沿竖线跟随当前章节
    tocAside = document.createElement("aside");
    tocAside.className = "post-toc";
    tocAside.setAttribute("aria-label", "文章目录");
    tocInner = document.createElement("div");
    tocInner.className = "post-toc__inner";
    tocInner.appendChild(makeHead("目录", "post-toc__pct"));
    tocPct = tocInner.querySelector(".post-toc__pct");
    var track = document.createElement("div");
    track.className = "post-toc__track";
    tocMarker = document.createElement("span");
    tocMarker.className = "post-toc__marker";
    tocMarker.setAttribute("aria-hidden", "true");
    track.appendChild(tocMarker);
    track.appendChild(buildList());
    tocInner.appendChild(track);
    tocAside.appendChild(tocInner);
    var shell = document.querySelector(".post-shell");
    if (shell) {
      shell.classList.add("post-shell--with-toc");
      shell.appendChild(tocAside);
    }
    bindClicks(tocAside);

    // 2) 窄屏：正文前的折叠目录（章节总览）
    var details = document.createElement("details");
    details.className = "post-toc-mobile";
    var summary = document.createElement("summary");
    summary.appendChild(makeHead("目录", "post-toc__count"));
    summary.querySelector(".post-toc__count").textContent = total + " 节";
    details.appendChild(summary);
    details.appendChild(buildList());
    content.parentNode.insertBefore(details, content);
    bindClicks(details, function () { details.removeAttribute("open"); });

    // 3) 窄屏：滚过正文前目录后出现的浮动目录按钮 + 面板（手机为底部抽屉，平板为右下弹层）
    fab = document.createElement("button");
    fab.type = "button";
    fab.className = "post-toc-fab";
    fab.setAttribute("aria-label", "打开目录");
    fab.setAttribute("aria-expanded", "false");
    fab.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
      '<path d="M2 3.5h1.5M2 8h1.5M2 12.5h1.5M6 3.5h8M6 8h8M6 12.5h5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';
    document.body.appendChild(fab);

    sheet = document.createElement("div");
    sheet.className = "post-toc-sheet";
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-label", "文章目录");
    sheet.hidden = true;
    var scrim = document.createElement("div");
    scrim.className = "post-toc-sheet__scrim";
    var panel = document.createElement("div");
    panel.className = "post-toc-sheet__panel";
    var sheetHead = makeHead("目录", "post-toc__count");
    sheetCount = sheetHead.querySelector(".post-toc__count");
    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "post-toc-sheet__close";
    closeBtn.setAttribute("aria-label", "关闭目录");
    closeBtn.textContent = "×";
    sheetHead.appendChild(closeBtn);
    panel.appendChild(sheetHead);
    var sheetBody = document.createElement("div");
    sheetBody.className = "post-toc-sheet__body";
    sheetBody.appendChild(buildList());
    panel.appendChild(sheetBody);
    sheet.appendChild(scrim);
    sheet.appendChild(panel);
    document.body.appendChild(sheet);

    var closeTimer = 0;
    function openSheet() {
      clearTimeout(closeTimer);
      sheet.hidden = false;
      requestAnimationFrame(function () { sheet.classList.add("is-open"); });
      fab.setAttribute("aria-expanded", "true");
      var active = sheetBody.querySelector(".is-active");
      if (active) sheetBody.scrollTop = Math.max(0, active.offsetTop - sheetBody.clientHeight / 3);
      (active || closeBtn).focus({ preventScroll: true });
    }
    function closeSheet(returnFocus) {
      sheet.classList.remove("is-open");
      fab.setAttribute("aria-expanded", "false");
      closeTimer = setTimeout(function () { sheet.hidden = true; }, reducedMotion ? 0 : 260);
      if (returnFocus) fab.focus({ preventScroll: true });
    }
    fab.addEventListener("click", function () { sheet.hidden ? openSheet() : closeSheet(true); });
    scrim.addEventListener("click", function () { closeSheet(true); });
    closeBtn.addEventListener("click", function () { closeSheet(true); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !sheet.hidden) closeSheet(true);
    });
    bindClicks(sheetBody, function () { closeSheet(false); });
  }

  /* ---- 当前章节：滚动时统一计算，同步到所有目录 ---- */
  var currentId = null;
  function computeCurrent() {
    if (!flat.length) return null;
    var cur = null;
    for (var i = 0; i < flat.length; i++) {
      if (flat[i].el.getBoundingClientRect().top <= 120) cur = flat[i];
      else break;
    }
    // 已滚到底：最后一节即使标题在视口中部也视为当前
    if (scrollMax() - scrollTopNow() < 4) cur = flat[flat.length - 1];
    return cur;
  }

  function moveMarker() {
    if (!tocMarker || !tocAside || getComputedStyle(tocAside).display === "none") return;
    var link = currentId && registries[0].links[currentId];
    if (!link) { tocMarker.style.opacity = "0"; return; }
    var trackTop = tocMarker.parentNode.getBoundingClientRect().top;
    var r = link.getBoundingClientRect();
    tocMarker.style.opacity = "1";
    tocMarker.style.transform = "translateY(" + (r.top - trackTop) + "px)";
    tocMarker.style.height = r.height + "px";
    // 长目录：让当前项保持在侧栏可视范围内
    var box = tocInner.getBoundingClientRect();
    if (r.top < box.top + 48 || r.bottom > box.bottom - 24) {
      tocInner.scrollTop += (r.top - box.top) - box.height / 3;
    }
  }

  function applyCurrent(cur) {
    var id = cur ? cur.id : null;
    var secIdx = cur ? cur.section : -1;
    if (id === currentId) return;
    currentId = id;
    for (var r = 0; r < registries.length; r++) {
      var reg = registries[r];
      for (var k in reg.links) reg.links[k].classList.toggle("is-active", k === id);
      for (var i = 0; i < reg.items.length; i++) {
        reg.items[i].classList.toggle("is-read", i < secIdx);
        reg.items[i].classList.toggle("is-current", i === secIdx);
      }
    }
    // 小节展开有过渡，墨条在过渡中和结束后各对位一次
    moveMarker();
    setTimeout(moveMarker, 320);
    if (sheetCount) sheetCount.textContent = (secIdx >= 0 ? secIdx + 1 : 0) + " / " + sections.length;
  }

  /* ---- 阅读进度条 ---- */
  var progress = document.createElement("div");
  progress.className = "post-progress";
  progress.innerHTML = "<span></span>";
  document.body.appendChild(progress);
  var bar = progress.firstChild;

  /* ---- 返回顶部 ---- */
  var topBtn = document.createElement("button");
  topBtn.type = "button";
  topBtn.className = "post-top";
  topBtn.setAttribute("aria-label", "返回顶部");
  topBtn.innerHTML = "↑";
  topBtn.addEventListener("click", function () {
    scrollToY(0, !reducedMotion);
  });
  document.body.appendChild(topBtn);

  var mobileToc = document.querySelector(".post-toc-mobile");
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var y = scrollTopNow();
      var max = scrollMax();
      var ratio = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
      bar.style.transform = "scaleX(" + ratio + ")";
      topBtn.classList.toggle("is-visible", y > 600);
      if (tocPct) tocPct.textContent = Math.round(ratio * 100) + "%";
      if (fab) {
        // 正文前的折叠目录滚出视口后才出现浮动按钮，避免两个入口同时可见
        var passed = !mobileToc || mobileToc.getBoundingClientRect().bottom < 0;
        fab.classList.toggle("is-visible", passed);
      }
      applyCurrent(computeCurrent());
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  document.body.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", function () { moveMarker(); onScroll(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(moveMarker);
  onScroll();
})();
