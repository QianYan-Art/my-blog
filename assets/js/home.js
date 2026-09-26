(function() {
  var dateEl = document.getElementById('footDate');
  var resizeRaf = 0;

  if (dateEl) {
    var d = new Date();
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    dateEl.textContent = String(d.getDate()).padStart(2,'0') + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
  }

  function fitTextBlock(target, options) {
    if (!target) return;
    var max = options.max;
    var min = options.min;
    var step = options.step || 1;

    target.style.fontSize = '';
    target.style.letterSpacing = '';

    if (window.innerWidth > 720) return;

    var size = max;
    target.style.fontSize = size + 'px';

    while (size > min && target.scrollWidth > target.clientWidth + 1) {
      size -= step;
      target.style.fontSize = size + 'px';
    }

    if (target.scrollWidth > target.clientWidth + 1) {
      target.style.letterSpacing = '-0.1em';
      while (size > min && target.scrollWidth > target.clientWidth + 1) {
        size -= step;
        target.style.fontSize = size + 'px';
      }
    }
  }

  function fitNavRow() {
    var nav = document.querySelector('.site-nav');
    var brand = document.querySelector('.site-nav__brand');
    var meta = document.querySelector('.site-nav__meta');
    var github = document.querySelector('.site-nav__github');
    var githubLabel = document.querySelector('.site-nav__github-label');
    if (!nav || !brand || !meta || !github) return;

    brand.style.fontSize = '';
    meta.style.fontSize = '';
    meta.style.letterSpacing = '';
    github.style.fontSize = '';
    if (meta.dataset && meta.dataset.full) {
      meta.textContent = meta.dataset.full;
    }
    if (githubLabel && githubLabel.dataset && githubLabel.dataset.full) {
      githubLabel.textContent = githubLabel.dataset.full;
    }

    if (window.innerWidth > 720) return;

    if (githubLabel && githubLabel.dataset && githubLabel.dataset.short) {
      githubLabel.textContent = githubLabel.dataset.short;
    }

    var brandSize = 17;
    var metaSize = 7;
    var githubSize = 12;
    brand.style.fontSize = brandSize + 'px';
    meta.style.fontSize = metaSize + 'px';
    github.style.fontSize = githubSize + 'px';

    var guard = 0;
    while (guard < 40) {
      guard += 1;
      var totalWidth = brand.scrollWidth + meta.scrollWidth + github.scrollWidth + 26;
      if (totalWidth <= nav.clientWidth) {
        break;
      }
      if (meta.dataset && meta.dataset.short && meta.textContent !== meta.dataset.short) {
        meta.textContent = meta.dataset.short;
        continue;
      }
      if (meta.dataset && meta.dataset.mini && meta.textContent !== meta.dataset.mini) {
        meta.textContent = meta.dataset.mini;
        continue;
      }
      if (meta.dataset && meta.dataset.micro && meta.textContent !== meta.dataset.micro) {
        meta.textContent = meta.dataset.micro;
        continue;
      }
      if (githubLabel && githubLabel.dataset && githubLabel.dataset.short && githubLabel.textContent !== githubLabel.dataset.short) {
        githubLabel.textContent = githubLabel.dataset.short;
        continue;
      }
      if (metaSize > 5) {
        metaSize -= 0.25;
        meta.style.fontSize = metaSize + 'px';
      } else if (githubSize > 9) {
        githubSize -= 0.25;
        github.style.fontSize = githubSize + 'px';
      } else if (brandSize > 13) {
        brandSize -= 0.25;
        brand.style.fontSize = brandSize + 'px';
      } else {
        break;
      }
    }
  }

  function fitHeroTitles() {
    fitTextBlock(document.querySelector('.hero-title'), { max: 48, min: 30, step: 1 });
    fitTextBlock(document.querySelector('.articles-title'), { max: 48, min: 28, step: 1 });
    fitTextBlock(document.querySelector('.post-body h1'), { max: 46, min: 28, step: 1 });
  }

  /* 首页跨栏对齐：
     1) “阅读文章”按钮下缘 ↔ 右侧人物四角边框下框线
     2) “FIG.0.1 功不唐捐”行中心 ↔ 右侧题记块中心
     左右两栏排版独立，字体/视口一变静态 margin 就漂，这里按实际渲染位置校准 */
  function alignHero() {
    var actions = document.querySelector('.hero-actions');
    var cta = actions && actions.querySelector('.cta');
    var pane = document.querySelector('.plate-pane');
    var frameWrap = document.querySelector('.plate__frame-wrap');
    var caption = document.querySelector('.plate__caption');
    var prop = document.querySelector('.plate__prop');
    var figure = document.querySelector('.plate__figure');
    var paneHead = pane && pane.querySelector('.plate__head');
    if (!actions || !cta || !pane || !frameWrap) return;

    var title = document.querySelector('.hero-title');

    var art = frameWrap.querySelector('.plate__art');

    pane.style.marginTop = '';
    if (figure) figure.style.marginTop = '';
    frameWrap.classList.remove('plate__frame-wrap--mat');
    frameWrap.style.maxWidth = '';
    frameWrap.style.width = '';
    frameWrap.style.height = '';
    if (paneHead) { paneHead.style.width = ''; paneHead.style.marginLeft = ''; }
    actions.style.marginTop = '';
    if (caption) caption.style.marginTop = '';
    if (window.innerWidth <= 720) return; // 移动端纵排，无需跨栏对齐

    // 约束零（右栏有编号行时）：插图按“衬纸装裱”排——
    // 四角角框撑满右栏：左竖线在右栏起点外 8px，右竖线落在导航红线右端；
    // 框高 = 大标题顶部到按钮下缘，上下框线分别与两者对齐；方形插图在框内水平居中。
    // 编号行与角框同宽，因此两端同时对齐角框与红线。
    if (paneHead && figure && title && art) {
      var titleTop = title.getBoundingClientRect().top;
      var span = cta.getBoundingClientRect().bottom - titleTop;
      var figW = figure.getBoundingClientRect().width;
      frameWrap.classList.add('plate__frame-wrap--mat');
      frameWrap.style.maxWidth = 'none';
      frameWrap.style.width = (figW - 8) + 'px';
      frameWrap.style.height = Math.max(260, span) + 'px';
      paneHead.style.marginLeft = '-8px';
      paneHead.style.width = (figW + 8) + 'px';
      figure.style.marginTop = (titleTop - frameWrap.getBoundingClientRect().top) + 'px';
    }

    // 约束一：按钮下缘 == 人物四角边框下框线。
    // 按钮偏低 → 插图下移补差（右栏有编号行时只移插图，编号行保持与眉题同行）；
    // 按钮偏高 → 左栏 actions 下移补差。
    var d1 = cta.getBoundingClientRect().bottom - frameWrap.getBoundingClientRect().bottom;
    if (d1 > 0.5) {
      if (paneHead && figure) {
        // 仅在插图因宽度受限而比文字块矮时才会出现，此时保持居中，不再下推
        if (!title) figure.style.marginTop = d1 + 'px';
      } else {
        pane.style.marginTop = d1 + 'px';
      }
    } else if (d1 < -0.5) {
      var base = parseFloat(getComputedStyle(actions).marginTop) || 0;
      var next = base - d1;
      if (next > 0) actions.style.marginTop = next + 'px';
    }

    // 约束二：FIG 行中心 == 题记块中心（在约束一生效后的位置上微调 caption）。
    if (caption && prop) {
      var cRect = caption.getBoundingClientRect();
      var pRect = prop.getBoundingClientRect();
      var d2 = (pRect.top + pRect.height / 2) - (cRect.top + cRect.height / 2);
      var base2 = parseFloat(getComputedStyle(caption).marginTop) || 0;
      var next2 = base2 + d2;
      if (Math.abs(d2) > 0.5 && next2 > 4) {
        caption.style.marginTop = next2 + 'px';
      }
    }
  }

  function applyResponsiveFitting() {
    fitNavRow();
    fitHeroTitles();
    alignHero();
  }

  function scheduleResponsiveFitting() {
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(applyResponsiveFitting);
  }

  // Grid overlay
  var gridCanvas = document.getElementById('grid-overlay');
  if (gridCanvas) {
    var gCtx = gridCanvas.getContext('2d');
    var currentGrid = 'G1'; // 默认开启 G1 点阵网格

    function inkCol(alpha) {
      return 'rgba(40,25,10,' + alpha + ')';
    }
    function vermCol(alpha) {
      return 'rgba(181,57,45,' + alpha + ')';
    }

    function resizeCanvas() {
      gridCanvas.width  = window.innerWidth;
      gridCanvas.height = window.innerHeight;
      drawGrid(currentGrid);
    }

    function drawGrid(type) {
      currentGrid = type;
      var w = gridCanvas.width, h = gridCanvas.height;
      gCtx.clearRect(0, 0, w, h);
      if (type === 'none') return;

      if (type === 'G1') {
        var spacing = 20;
        gCtx.fillStyle = inkCol(0.18);
        for (var x = spacing; x < w; x += spacing) {
          for (var y = spacing; y < h; y += spacing) {
            gCtx.beginPath(); gCtx.arc(x, y, 0.6, 0, Math.PI * 2); gCtx.fill();
          }
        }
      } else if (type === 'G2') {
        gCtx.strokeStyle = inkCol(0.08); gCtx.lineWidth = 0.75;
        for (var y = 28; y < h; y += 28) {
          gCtx.beginPath(); gCtx.moveTo(0, y); gCtx.lineTo(w, y); gCtx.stroke();
        }
      } else if (type === 'G3') {
        gCtx.strokeStyle = inkCol(0.07); gCtx.lineWidth = 0.5;
        for (var x = 24; x < w; x += 24) {
          gCtx.beginPath(); gCtx.moveTo(x, 0); gCtx.lineTo(x, h); gCtx.stroke();
        }
        for (var y = 24; y < h; y += 24) {
          gCtx.beginPath(); gCtx.moveTo(0, y); gCtx.lineTo(w, y); gCtx.stroke();
        }
      } else if (type === 'G4') {
        var sp = 60, arm = 5;
        gCtx.strokeStyle = inkCol(0.20); gCtx.lineWidth = 1;
        for (var x = sp; x < w; x += sp) {
          for (var y = sp; y < h; y += sp) {
            gCtx.beginPath(); gCtx.moveTo(x - arm, y); gCtx.lineTo(x + arm, y); gCtx.stroke();
            gCtx.beginPath(); gCtx.moveTo(x, y - arm); gCtx.lineTo(x, y + arm); gCtx.stroke();
          }
        }
      } else if (type === 'G5') {
        for (var y = 20; y < h; y += 20) {
          var thick = (y % 80 === 0);
          gCtx.strokeStyle = thick ? inkCol(0.10) : inkCol(0.055);
          gCtx.lineWidth   = thick ? 0.8 : 0.5;
          gCtx.beginPath(); gCtx.moveTo(0, y); gCtx.lineTo(w, y); gCtx.stroke();
        }
      } else if (type === 'G6') {
        var divX = Math.round(w * 0.35);
        gCtx.strokeStyle = inkCol(0.07); gCtx.lineWidth = 0.6;
        for (var y = 28; y < h; y += 28) {
          gCtx.beginPath(); gCtx.moveTo(0, y); gCtx.lineTo(divX, y); gCtx.stroke();
        }
        gCtx.strokeStyle = vermCol(0.30); gCtx.lineWidth = 1;
        gCtx.beginPath(); gCtx.moveTo(divX, 0); gCtx.lineTo(divX, h); gCtx.stroke();
      }
    }

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('resize', scheduleResponsiveFitting);
    if (document.readyState === 'complete') {
      resizeCanvas();
    } else {
      window.addEventListener('load', resizeCanvas);
    }
  } else {
    window.addEventListener('resize', scheduleResponsiveFitting);
  }

  if (document.readyState === 'complete') {
    scheduleResponsiveFitting();
  } else {
    window.addEventListener('load', scheduleResponsiveFitting);
  }

  // 插画加载、字体就绪、入场动画结束后各补一次对齐（位置都会变）
  var plateArt = document.querySelector('.plate__art');
  if (plateArt && !plateArt.complete) {
    plateArt.addEventListener('load', scheduleResponsiveFitting);
  }
  if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
    document.fonts.ready.then(scheduleResponsiveFitting);
  }
  setTimeout(scheduleResponsiveFitting, 1200);
})();

/* ──────────────────────────────────────────────
   返回页面时清除残留的点击焦点与悬停态
   浏览器从前进后退缓存恢复页面时，会保留离开前被点击的链接焦点，
   鼠标已不在原处却仍显示悬停样式。恢复后先失焦并暂停指针命中，
   指针移动、按下、触摸、滚轮或按键时再恢复，悬停随真实位置重新计算。
   ────────────────────────────────────────────── */
(function () {
  var events = ['pointermove', 'pointerdown', 'touchstart', 'wheel', 'keydown'];

  function release() {
    document.body.classList.remove('is-restoring');
    events.forEach(function (type) { window.removeEventListener(type, release, true); });
  }

  window.addEventListener('pageshow', function (e) {
    var nav = window.performance && performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    if (!e.persisted && !(nav && nav.type === 'back_forward')) return;
    var active = document.activeElement;
    if (active && active !== document.body && active.blur) active.blur();
    document.body.classList.add('is-restoring');
    events.forEach(function (type) { window.addEventListener(type, release, { capture: true, passive: true }); });
  });
})();

/* ──────────────────────────────────────────────
   鼠标跟随墨晕 —— 全站纸感光效驱动
   CSS 已在 base.css(body::after) 与卡片/ledger 中
   使用 --mx/--my，这里负责按指针位置写入。
   ────────────────────────────────────────────── */
(function () {
  var raf = null, mx = 30, my = 70;

  function update() {
    document.body.style.setProperty('--mx', mx + '%');
    document.body.style.setProperty('--my', my + '%');
    raf = null;
  }

  document.addEventListener('mousemove', function (e) {
    mx = (e.clientX / window.innerWidth) * 100;
    my = (e.clientY / window.innerHeight) * 100;
    if (!raf) raf = requestAnimationFrame(update);
  });
})();
