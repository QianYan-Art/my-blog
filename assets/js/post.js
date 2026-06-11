/* ──────────────────────────────────────────────
   post.js — 文章阅读页增强
   目录（桌面侧栏 + 移动折叠）· 滚动高亮 · 阅读进度
   代码高亮与复制 · 返回顶部
   ────────────────────────────────────────────── */
(function () {
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

  /* ---- 标题收集与 id 分配 ---- */
  var headings = content.querySelectorAll("h2, h3");
  var usedIds = {};
  var items = [];
  for (var h = 0; h < headings.length; h++) {
    var el = headings[h];
    if (el.closest && el.closest(".footnotes")) continue;
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
    items.push({ id: el.id, text: el.textContent.trim(), level: el.tagName === "H2" ? 2 : 3 });
  }

  /* ---- 目录构建 ---- */
  function buildList() {
    var ul = document.createElement("ul");
    ul.className = "post-toc__list";
    for (var i = 0; i < items.length; i++) {
      var li = document.createElement("li");
      li.className = "post-toc__item post-toc__item--h" + items[i].level;
      var a = document.createElement("a");
      a.href = "#" + items[i].id;
      a.textContent = items[i].text;
      a.dataset.target = items[i].id;
      li.appendChild(a);
      ul.appendChild(li);
    }
    return ul;
  }

  // 目录点击：拦截锚点默认跳转，平滑滚动 + replaceState，
  // 不往 history 压栈（否则“返回上一页”会退回上一个章节）
  function bindTocClicks(container) {
    container.addEventListener("click", function (e) {
      var a = e.target.closest ? e.target.closest("a[data-target]") : null;
      if (!a) return;
      e.preventDefault();
      var el = document.getElementById(a.dataset.target);
      if (!el) return;
      var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      if (history.replaceState) history.replaceState(null, "", "#" + a.dataset.target);
    });
  }

  if (items.length >= 2) {
    // 桌面：右侧悬浮侧栏（label+list 收进同一个 sticky 容器，避免相互叠压）
    var aside = document.createElement("aside");
    aside.className = "post-toc";
    var inner = document.createElement("div");
    inner.className = "post-toc__inner";
    inner.innerHTML = '<p class="post-toc__label">目录</p>';
    inner.appendChild(buildList());
    aside.appendChild(inner);
    var shell = document.querySelector(".post-shell");
    if (shell) {
      shell.classList.add("post-shell--with-toc");
      shell.appendChild(aside);
    }
    bindTocClicks(aside);

    // 移动端：正文前折叠目录
    var details = document.createElement("details");
    details.className = "post-toc-mobile";
    var summary = document.createElement("summary");
    summary.textContent = "目录";
    details.appendChild(summary);
    details.appendChild(buildList());
    content.parentNode.insertBefore(details, content);

    // 点击移动目录项后收起
    bindTocClicks(details);
    details.addEventListener("click", function (e) {
      if (e.target && e.target.tagName === "A") details.removeAttribute("open");
    });

    /* ---- 滚动高亮（scrollspy） ---- */
    var links = aside.querySelectorAll("a[data-target]");
    var linkMap = {};
    for (var l = 0; l < links.length; l++) linkMap[links[l].dataset.target] = links[l];
    var activeId = null;

    function setActive(id) {
      if (id === activeId) return;
      if (activeId && linkMap[activeId]) linkMap[activeId].classList.remove("is-active");
      if (id && linkMap[id]) linkMap[id].classList.add("is-active");
      activeId = id;
    }

    if ("IntersectionObserver" in window) {
      var visible = {};
      var observer = new IntersectionObserver(function (entries) {
        for (var e = 0; e < entries.length; e++) {
          visible[entries[e].target.id] = entries[e].isIntersecting;
        }
        // 取视口内最靠前的标题；若全不在视口，取已滚过的最后一个
        var current = null;
        for (var i = 0; i < items.length; i++) {
          if (visible[items[i].id]) { current = items[i].id; break; }
        }
        if (!current) {
          for (var j = items.length - 1; j >= 0; j--) {
            var el = document.getElementById(items[j].id);
            if (el && el.getBoundingClientRect().top < 120) { current = items[j].id; break; }
          }
        }
        setActive(current);
      }, { rootMargin: "-80px 0px -60% 0px", threshold: 0 });
      for (var o = 0; o < items.length; o++) {
        var target = document.getElementById(items[o].id);
        if (target) observer.observe(target);
      }
    }
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  document.body.appendChild(topBtn);

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      bar.style.transform = "scaleX(" + ratio + ")";
      topBtn.classList.toggle("is-visible", window.scrollY > 600);
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
})();
