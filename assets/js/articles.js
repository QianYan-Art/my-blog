(function() {
  var grid = document.getElementById('articleGrid');
  var filters = document.getElementById('articleFilters');
  var count = document.getElementById('articleCount');
  var searchInput = document.getElementById('articleSearch');
  var searchClear = document.getElementById('articleSearchClear');
  var loadStatus = document.getElementById('articleLoadStatus');
  var sentinel = document.getElementById('articleSentinel');
  var articles = [];
  var visibleArticles = [];
  var active = 'all';
  var query = '';
  var renderedCount = 0;
  var observer = null;

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function(char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }

  function formatDate(value) {
    if (!value) return 'Undated';
    var date = parseDateValue(value);
    if (Number.isNaN(date.getTime())) return value;
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return String(date.getDate()).padStart(2, '0') + ' ' + months[date.getMonth()] + ' ' + date.getFullYear();
  }

  function parseDateValue(value) {
    if (!value) return new Date('');
    var normalized = String(value).trim().replace(/\./g, '-').replace(/\//g, '-');
    var matched = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (matched) {
      return new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]));
    }
    return new Date(normalized);
  }

  function compareByDateDesc(a, b) {
    var left = parseDateValue(a.date);
    var right = parseDateValue(b.date);
    var leftTime = left.getTime();
    var rightTime = right.getTime();
    if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime) && leftTime !== rightTime) {
      return rightTime - leftTime;
    }
    if (Number.isNaN(leftTime) && !Number.isNaN(rightTime)) return 1;
    if (!Number.isNaN(leftTime) && Number.isNaN(rightTime)) return -1;
    return String(b.date || '').localeCompare(String(a.date || ''));
  }

  function getCategories(items) {
    return items.reduce(function(result, item) {
      var category = item.category || '未分类';
      if (result.indexOf(category) === -1) result.push(category);
      return result;
    }, []);
  }

  function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
  }

  function getColumns() {
    if (window.matchMedia('(max-width: 720px)').matches) return 1;
    if (window.matchMedia('(max-width: 1100px)').matches) return 2;
    return 3;
  }

  function getInitialBatchSize() {
    var columns = getColumns();
    var cardHeight = columns === 1 ? 260 : columns === 2 ? 300 : 330;
    var rows = Math.max(1, Math.ceil(window.innerHeight / cardHeight));
    var initial = rows * columns;
    if (columns > 1) initial += columns;
    return Math.max(initial, columns * 2);
  }

  function getBatchSize() {
    return getColumns();
  }

  function updateSearchClear() {
    if (!searchClear) return;
    searchClear.hidden = !query;
  }

  function matchesSearch(item) {
    if (!query) return true;
    var haystack = [
      item.title,
      item.summary,
      item.category,
      item.section,
      item.date,
      (item.tags || []).join(' ')
    ].map(normalizeText).join(' ');
    return haystack.indexOf(query) !== -1;
  }

  function renderFilters(items) {
    var categories = getCategories(items);
    categories.sort(function(a, b) {
      var order = { "本地记录": 1, "服务器记录": 2 };
      var orderA = order[a] || 99;
      var orderB = order[b] || 99;
      return orderA - orderB;
    });
    filters.innerHTML = '<button class="article-filter is-active" type="button" data-filter="all">全部</button>' +
      categories.map(function(category) {
        return '<button class="article-filter" type="button" data-filter="' + escapeHtml(category) + '">' + escapeHtml(category) + '</button>';
      }).join('');
  }

  function buildArticleCard(item, index) {
    var tags = (item.tags || []).map(function(tag) {
      return '<span>' + escapeHtml(tag) + '</span>';
    }).join('');
    var featuredClass = item.featured && index === 0 ? ' article-card--featured' : '';
    var href = item.href || '#';
    var cardIndex = index % Math.max(getColumns(), 1);

    return [
      '<article class="article-card' + featuredClass + '" style="--card-index:' + cardIndex + '">',
      '  <a class="article-card__link" href="' + escapeHtml(href) + '">',
      '    <div class="article-card__topline">',
      '      <span>' + escapeHtml(item.category || '未分类') + '</span>',
      '      <span>' + escapeHtml(formatDate(item.date)) + '</span>',
      '    </div>',
      '    <h3>' + escapeHtml(item.title) + '</h3>',
      '    <p>' + escapeHtml(item.summary || '这篇文章还没有摘要，但已经被安静地装进了索引。') + '</p>',
      '    <div class="article-card__foot">',
      '      <div class="article-card__tags">' + tags + '</div>',
      '      <span class="article-card__read">' + escapeHtml(item.section || item.readingTime || 'read') + ' →</span>',
      '    </div>',
      '  </a>',
      '</article>'
    ].join('');
  }

  function updateCount() {
    if (count) count.textContent = String(visibleArticles.length).padStart(2, '0') + ' entries';
  }

  function updateLoadStatus() {
    if (!loadStatus) return;
    if (!visibleArticles.length) {
      loadStatus.textContent = query ? '没有找到匹配的文章。' : '这个分类下暂时没有文章。';
      return;
    }
    if (renderedCount < visibleArticles.length) {
      loadStatus.textContent = '继续下滑，下一行文章会逐步展开。';
      return;
    }
    loadStatus.textContent = '已经读到这份目录的末尾。';
  }

  function renderEmpty(message) {
    grid.innerHTML = '<article class="article-empty"><p>' + message + '</p></article>';
    renderedCount = 0;
    updateCount();
    updateLoadStatus();
  }

  function appendNextBatch(batchSize) {
    if (!visibleArticles.length) {
      renderEmpty(query ? '没有找到匹配的文章。' : '这个分类下暂时没有文章。');
      return;
    }

    var nextCount = Math.min(renderedCount + batchSize, visibleArticles.length);
    var chunk = visibleArticles.slice(renderedCount, nextCount);

    if (!renderedCount) {
      grid.innerHTML = '';
    }

    if (!chunk.length) {
      updateLoadStatus();
      return;
    }

    grid.insertAdjacentHTML('beforeend', chunk.map(function(item, index) {
      return buildArticleCard(item, renderedCount + index);
    }).join(''));

    renderedCount = nextCount;
    updateCount();
    updateLoadStatus();
  }

  function refreshVisible(resetToInitial) {
    visibleArticles = articles.filter(function(item) {
      var categoryMatched = active === 'all' || (item.category || '未分类') === active;
      return categoryMatched && matchesSearch(item);
    });

    renderedCount = 0;
    if (!visibleArticles.length) {
      renderEmpty(query ? '没有找到匹配的文章。' : '这个分类下暂时没有文章。');
      return;
    }

    appendNextBatch(resetToInitial ? getInitialBatchSize() : Math.max(renderedCount, getInitialBatchSize()));
  }

  function ensureObserver() {
    if (!sentinel || observer || typeof IntersectionObserver === 'undefined') return;
    observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (!entry.isIntersecting) return;
        if (renderedCount >= visibleArticles.length) return;
        appendNextBatch(getBatchSize());
      });
    }, {
      rootMargin: '0px 0px 240px 0px',
      threshold: 0
    });
    observer.observe(sentinel);
  }

  function setActiveFilter(value) {
    active = value;
    Array.prototype.forEach.call(filters.querySelectorAll('.article-filter'), function(button) {
      button.classList.toggle('is-active', button.dataset.filter === value);
    });
    refreshVisible(true);
  }

  if (filters) {
    filters.addEventListener('click', function(event) {
      var button = event.target.closest('.article-filter');
      if (!button) return;
      setActiveFilter(button.dataset.filter || 'all');
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', function() {
      query = normalizeText(searchInput.value);
      updateSearchClear();
      refreshVisible(true);
    });
  }

  if (searchClear) {
    searchClear.addEventListener('click', function() {
      query = '';
      if (searchInput) searchInput.value = '';
      updateSearchClear();
      refreshVisible(true);
      if (searchInput) searchInput.focus();
    });
  }

  document.addEventListener('keydown', function(event) {
    if (!searchInput) return;
    var activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
      return;
    }
    if (event.key === '/') {
      event.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });

  window.addEventListener('resize', function() {
    if (!visibleArticles.length) return;
    if (renderedCount < getInitialBatchSize()) {
      appendNextBatch(getInitialBatchSize() - renderedCount);
    }
  });

  fetch('/assets/data/articles.json', { cache: 'no-store' })
    .then(function(response) {
      if (!response.ok) throw new Error('文章索引读取失败');
      return response.json();
    })
    .then(function(data) {
      articles = (data.articles || []).slice().sort(compareByDateDesc);
      renderFilters(articles);
      updateSearchClear();
      ensureObserver();
      refreshVisible(true);
      if (typeof IntersectionObserver === 'undefined' && renderedCount < visibleArticles.length) {
        appendNextBatch(visibleArticles.length - renderedCount);
      }
    })
    .catch(function() {
      grid.innerHTML = '<article class="article-empty"><p>文章索引暂时不可用。请确认 <code>/assets/data/articles.json</code> 已生成。</p></article>';
      if (count) count.textContent = '00 entries';
      if (loadStatus) loadStatus.textContent = '文章索引暂时不可用。';
    });
})();
