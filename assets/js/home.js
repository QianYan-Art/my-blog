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
    if (!actions || !cta || !pane || !frameWrap) return;

    pane.style.marginTop = '';
    actions.style.marginTop = '';
    if (caption) caption.style.marginTop = '';
    if (window.innerWidth <= 720) return; // 移动端纵排，无需跨栏对齐

    // 约束一：按钮下缘 == 人物四角边框下框线。
    // 按钮偏低 → 右栏整体下移补差；按钮偏高 → 左栏 actions 下移补差。
    var d1 = cta.getBoundingClientRect().bottom - frameWrap.getBoundingClientRect().bottom;
    if (d1 > 0.5) {
      pane.style.marginTop = d1 + 'px';
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
