(function(root, factory) {
  var api = factory(root && root.document ? root.document : null, root || {});
  if (root) root.ArticleList = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function(doc, win) {
  var DEFAULT_PAGE_SIZE = 20;
  var PAGE_SIZE_OPTIONS = [10, 20, 50];
  var RETURN_STATE_KEY = 'qianyan.article-list-state';

  var grid = doc && doc.getElementById ? doc.getElementById('articleGrid') : null;
  var filters = doc && doc.getElementById ? doc.getElementById('articleFilters') : null;
  var count = doc && doc.getElementById ? doc.getElementById('articleCount') : null;
  var searchInput = doc && doc.getElementById ? doc.getElementById('articleSearch') : null;
  var searchClear = doc && doc.getElementById ? doc.getElementById('articleSearchClear') : null;
  var searchBox = searchInput && searchInput.closest ? searchInput.closest('.article-search') : null;
  var pagination = doc && doc.getElementById ? doc.getElementById('articlePagination') : null;
  var paginationSummary = doc && doc.getElementById ? doc.getElementById('articlePaginationSummary') : null;
  var paginationPrev = doc && doc.getElementById ? doc.getElementById('articlePaginationPrev') : null;
  var paginationPages = doc && doc.getElementById ? doc.getElementById('articlePaginationPages') : null;
  var paginationNext = doc && doc.getElementById ? doc.getElementById('articlePaginationNext') : null;
  var pageSizeSelect = doc && doc.getElementById ? doc.getElementById('articlePageSize') : null;
  /** @type {Array<Record<string, any>>} 文章索引数据。 */
  var articles = [];
  /** @type {Array<Record<string, any>>} 当前筛选结果。 */
  var visibleArticles = [];
  var active = 'all';
  var query = '';
  var pageSize = DEFAULT_PAGE_SIZE;
  var currentPage = 1;
  var isComposing = false;
  var loadError = false;

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || '';
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
    return (items || []).reduce(function(result, item) {
      var category = item.category || '未分类';
      if (result.indexOf(category) === -1) result.push(category);
      return result;
    }, []);
  }

  function normalizeText(value) {
    return String(value == null ? '' : value).trim().toLowerCase();
  }

  function normalizePageNumber(value) {
    var text = String(value == null ? '' : value).trim();
    if (!/^\d+$/.test(text)) return 1;
    var number = Number(text);
    return Number.isFinite(number) && number >= 1 ? Math.floor(number) : 1;
  }

  function normalizePageSize(value) {
    var number = Number(value);
    return PAGE_SIZE_OPTIONS.indexOf(number) === -1 ? DEFAULT_PAGE_SIZE : number;
  }

  function getPageCount(total, size) {
    var safeTotal = Math.max(0, Number(total) || 0);
    return Math.ceil(safeTotal / normalizePageSize(size));
  }

  function clampPage(value, totalPages) {
    var safeTotalPages = Math.max(0, Number(totalPages) || 0);
    var page = normalizePageNumber(value);
    if (!safeTotalPages) return 1;
    return Math.min(page, safeTotalPages);
  }

  function getPageItems(items, page, size) {
    var source = Array.isArray(items) ? items : [];
    var safeSize = normalizePageSize(size);
    var safePage = clampPage(page, getPageCount(source.length, safeSize));
    var start = (safePage - 1) * safeSize;
    return source.slice(start, start + safeSize);
  }

  function getPaginationItems(page, totalPages) {
    var safeTotalPages = Math.max(0, Number(totalPages) || 0);
    if (!safeTotalPages) return [];
    if (safeTotalPages <= 7) {
      return Array.apply(null, { length: safeTotalPages }).map(function(_, index) {
        return index + 1;
      });
    }

    var current = clampPage(page, safeTotalPages);
    var result = [1, 'ellipsis'].slice(0, 1);
    var start = Math.max(2, current - 1);
    var end = Math.min(safeTotalPages - 1, current + 1);
    if (current <= 2) end = Math.min(safeTotalPages - 1, 3);
    if (current >= safeTotalPages - 1) start = Math.max(2, safeTotalPages - 2);
    if (start > 2) result.push('ellipsis');
    for (var number = start; number <= end; number += 1) result.push(number);
    if (end < safeTotalPages - 1) result.push('ellipsis');
    result.push(safeTotalPages);
    return result;
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

  function safeDecodeURIComponent(value) {
    try {
      return decodeURIComponent(value);
    } catch (error) {
      return value;
    }
  }

  function readSearchParams(search) {
    var source = String(search || '').replace(/^\?/, '');
    if (typeof win.URLSearchParams === 'function') {
      return new win.URLSearchParams(source);
    }

    var values = {};
    source.split('&').forEach(function(pair) {
      if (!pair) return;
      var parts = pair.split('=');
      var key = safeDecodeURIComponent((parts.shift() || '').replace(/\+/g, ' '));
      var value = safeDecodeURIComponent(parts.join('=').replace(/\+/g, ' '));
      values[key] = value;
    });
    return {
      has: function(key) { return Object.prototype.hasOwnProperty.call(values, key); },
      get: function(key) { return values[key] == null ? null : values[key]; }
    };
  }

  function parseListState(search) {
    var params = readSearchParams(search);
    var hasState = ['q', 'category', 'page', 'size'].some(function(key) {
      return params.has(key);
    });
    var category = params.has('category') ? String(params.get('category') || '') : 'all';
    return {
      hasUrlState: hasState,
      query: params.has('q') ? normalizeText(params.get('q')) : '',
      active: category || 'all',
      page: params.has('page') ? normalizePageNumber(params.get('page')) : 1,
      pageSize: params.has('size') ? normalizePageSize(params.get('size')) : DEFAULT_PAGE_SIZE
    };
  }

  function serializeListState(state) {
    var source = state || {};
    var parts = [''];
    parts.pop();
    var safePage = normalizePageNumber(source.page);
    var safeSize = normalizePageSize(source.pageSize == null ? source.size : source.pageSize);
    var safeQuery = normalizeText(source.query);
    var safeCategory = String(source.active || source.category || 'all');
    if (safePage > 1) parts.push('page=' + encodeURIComponent(String(safePage)));
    if (safeSize !== DEFAULT_PAGE_SIZE) parts.push('size=' + encodeURIComponent(String(safeSize)));
    if (safeQuery) parts.push('q=' + encodeURIComponent(safeQuery));
    if (safeCategory && safeCategory !== 'all') parts.push('category=' + encodeURIComponent(safeCategory));
    return parts.join('&');
  }

  function getColumns() {
    if (win.matchMedia && win.matchMedia('(max-width: 720px)').matches) return 1;
    if (win.matchMedia && win.matchMedia('(max-width: 1100px)').matches) return 2;
    return 3;
  }

  function updateSearchClear() {
    if (!searchClear) return;
    searchClear.hidden = !query;
  }

  function setSearchOpen(open) {
    if (!searchBox) return;
    searchBox.classList.toggle('is-open', Boolean(open));
  }

  function searchHasFocus() {
    return Boolean(searchBox && searchBox.contains(doc.activeElement));
  }

  function updateFilterButtons() {
    if (!filters) return;
    Array.prototype.forEach.call(filters.querySelectorAll('.article-filter'), function(button) {
      button.classList.toggle('is-active', button.dataset.filter === active);
    });
  }

  function renderFilters(items) {
    if (!filters) return;
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
    updateFilterButtons();
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
      '  <a class="article-card__link" data-article-link="true" href="' + escapeHtml(href) + '">',
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

  function emptyMessage() {
    if (loadError) return '文章索引暂时无法读取。';
    if (query) return '没有找到匹配的文章。';
    if (active !== 'all') return '这个分类下暂时没有文章。';
    return '暂时没有文章。';
  }

  function renderEmpty(message) {
    if (grid) {
      grid.innerHTML = '<article class="article-empty"><p>' + escapeHtml(message) + '</p></article>';
      grid.setAttribute('aria-busy', 'false');
    }
    updateCount();
  }

  function renderPagination() {
    if (!pagination) return;
    var total = visibleArticles.length;
    var totalPages = getPageCount(total, pageSize);
    currentPage = clampPage(currentPage, totalPages);
    pagination.hidden = false;

    if (paginationSummary) {
      if (!total) {
        paginationSummary.textContent = '共 0 篇';
      } else {
        var start = (currentPage - 1) * pageSize + 1;
        var end = Math.min(currentPage * pageSize, total);
        paginationSummary.textContent = '共 ' + total + ' 篇 · 第 ' + currentPage + ' / ' + totalPages + ' 页 · 显示 ' + start + '-' + end + ' 篇';
      }
    }

    if (pageSizeSelect) pageSizeSelect.value = String(pageSize);
    if (paginationPrev) {
      paginationPrev.disabled = !totalPages || currentPage <= 1;
      paginationPrev.setAttribute('aria-disabled', String(paginationPrev.disabled));
    }
    if (paginationNext) {
      paginationNext.disabled = !totalPages || currentPage >= totalPages;
      paginationNext.setAttribute('aria-disabled', String(paginationNext.disabled));
    }
    if (paginationPages) {
      paginationPages.innerHTML = getPaginationItems(currentPage, totalPages).map(function(item) {
        if (item === 'ellipsis') {
          return '<span class="article-pagination__ellipsis" aria-hidden="true">...</span>';
        }
        var current = item === currentPage ? ' aria-current="page"' : '';
        var activeClass = item === currentPage ? ' is-current' : '';
        return '<button class="article-pagination__page' + activeClass + '" type="button" data-page="' + item + '" aria-label="第 ' + item + ' 页"' + current + '>' + item + '</button>';
      }).join('');
    }
  }

  function renderPage() {
    var totalPages = getPageCount(visibleArticles.length, pageSize);
    currentPage = clampPage(currentPage, totalPages);
    if (!visibleArticles.length) {
      renderEmpty(emptyMessage());
      renderPagination();
      return;
    }

    var start = (currentPage - 1) * pageSize;
    var pageItems = getPageItems(visibleArticles, currentPage, pageSize);
    grid.innerHTML = pageItems.map(function(item, index) {
      return buildArticleCard(item, start + index);
    }).join('');
    grid.setAttribute('aria-busy', 'false');
    updateCount();
    renderPagination();
  }

  function updateUrl() {
    if (!win.location || !win.history || !win.history.replaceState || typeof win.URLSearchParams !== 'function') return;
    var params = new win.URLSearchParams(win.location.search || '');
    var encoded = serializeListState({
      page: currentPage,
      pageSize: pageSize,
      query: query,
      active: active
    });
    ['page', 'size', 'q', 'category'].forEach(function(key) {
      params.delete(key);
    });
    if (encoded) {
      encoded.split('&').forEach(function(pair) {
        var parts = pair.split('=');
        params.set(decodeURIComponent(parts[0]), decodeURIComponent(parts.slice(1).join('=')));
      });
    }
    var nextSearch = params.toString();
    var next = win.location.pathname + (nextSearch ? '?' + nextSearch : '') + (win.location.hash || '');
    var current = win.location.pathname + (win.location.search || '') + (win.location.hash || '');
    if (next !== current) win.history.replaceState({ articleList: true }, '', next);
  }

  function getSessionStorage() {
    try {
      return win.sessionStorage || null;
    } catch (error) {
      return null;
    }
  }

  function readSessionState() {
    var storage = getSessionStorage();
    if (!storage || !win.location) return null;
    try {
      var raw = storage.getItem(RETURN_STATE_KEY);
      if (!raw) return null;
      var saved = JSON.parse(raw);
      if (!saved || (saved.path && saved.path !== win.location.pathname)) return null;
      return {
        hasUrlState: true,
        query: normalizeText(saved.query),
        active: String(saved.active || 'all'),
        page: normalizePageNumber(saved.page),
        pageSize: normalizePageSize(saved.pageSize)
      };
    } catch (error) {
      return null;
    }
  }

  function rememberReturnState() {
    var storage = getSessionStorage();
    if (!storage || !win.location) return;
    try {
      storage.setItem(RETURN_STATE_KEY, JSON.stringify({
        path: win.location.pathname,
        query: query,
        active: active,
        page: currentPage,
        pageSize: pageSize
      }));
    } catch (error) {
      // 隐私模式或存储配额不足时，URL 状态仍然可以恢复列表。
    }
  }

  function getInitialState() {
    var urlState = parseListState(win.location ? win.location.search : '');
    if (urlState.hasUrlState) return urlState;
    return readSessionState() || urlState;
  }

  function isKnownFilter(value) {
    return value === 'all' || getCategories(articles).indexOf(value) !== -1;
  }

  function refreshVisible(resetToFirst) {
    visibleArticles = /** @type {any[]} */ (articles).filter(function(item) {
      var categoryMatched = active === 'all' || getCategories([item])[0] === active;
      return categoryMatched && matchesSearch(item);
    });
    if (resetToFirst) currentPage = 1;
    renderPage();
    updateUrl();
  }

  function setActiveFilter(value) {
    var next = value || 'all';
    active = isKnownFilter(next) ? next : 'all';
    updateFilterButtons();
    refreshVisible(true);
  }

  function applySearchValue(value) {
    query = normalizeText(value);
    updateSearchClear();
    refreshVisible(true);
  }

  function closeSearch() {
    setSearchOpen(false);
    if (searchBox && searchBox.contains(doc.activeElement) && doc.activeElement.blur) doc.activeElement.blur();
  }

  function focusCurrentPage() {
    if (!paginationPages) return;
    var button = paginationPages.querySelector('[data-page="' + currentPage + '"]');
    if (button && button.focus) button.focus();
  }

  function setPage(value, keepFocus) {
    currentPage = clampPage(value, getPageCount(visibleArticles.length, pageSize));
    renderPage();
    updateUrl();
    if (keepFocus) focusCurrentPage();
  }

  function setPageSize(value) {
    pageSize = normalizePageSize(value);
    currentPage = 1;
    renderPage();
    updateUrl();
  }

  function restoreFromUrl() {
    var state = parseListState(win.location ? win.location.search : '');
    query = state.query;
    pageSize = state.pageSize;
    currentPage = state.page;
    active = isKnownFilter(state.active) ? state.active : 'all';
    if (searchInput) searchInput.value = query;
    updateSearchClear();
    setSearchOpen(Boolean(query) || searchHasFocus());
    updateFilterButtons();
    refreshVisible(false);
  }

  var api = {
    DEFAULT_PAGE_SIZE: DEFAULT_PAGE_SIZE,
    PAGE_SIZE_OPTIONS: PAGE_SIZE_OPTIONS.slice(),
    clampPage: clampPage,
    compareByDateDesc: compareByDateDesc,
    getPageCount: getPageCount,
    getPageItems: getPageItems,
    getPaginationItems: getPaginationItems,
    matchesSearch: function(item, value) {
      var previous = query;
      query = normalizeText(value);
      var matched = matchesSearch(item);
      query = previous;
      return matched;
    },
    normalizePageSize: normalizePageSize,
    normalizeText: normalizeText,
    parseListState: parseListState,
    serializeListState: serializeListState
  };

  if (!grid) return api;

  var initialState = getInitialState();
  query = initialState.query;
  active = initialState.active;
  pageSize = initialState.pageSize;
  currentPage = initialState.page;
  if (searchInput) searchInput.value = query;
  if (pageSizeSelect) pageSizeSelect.value = String(pageSize);
  updateSearchClear();
  setSearchOpen(Boolean(query));
  grid.setAttribute('aria-busy', 'true');

  if (filters) {
    filters.addEventListener('click', function(event) {
      var target = event.target;
      var button = target && target.closest ? target.closest('.article-filter') : null;
      if (!button) return;
      if (!searchHasFocus()) setSearchOpen(false);
      setActiveFilter(button.dataset.filter || 'all');
    });
  }

  if (pagination) {
    pagination.addEventListener('click', function(event) {
      var target = event.target;
      var button = target && target.closest ? target.closest('button') : null;
      if (!button || button.disabled) return;
      if (button.dataset.page) {
        setPage(Number(button.dataset.page), true);
        return;
      }
      if (button.dataset.paginationAction === 'prev') {
        setPage(currentPage - 1, true);
      } else if (button.dataset.paginationAction === 'next') {
        setPage(currentPage + 1, true);
      }
    });
  }

  if (pageSizeSelect) {
    pageSizeSelect.addEventListener('change', function() {
      setPageSize(pageSizeSelect.value);
    });
  }

  if (searchBox) {
    searchBox.addEventListener('pointerenter', function(event) {
      if (!event.pointerType || event.pointerType === 'mouse') setSearchOpen(true);
    });

    searchBox.addEventListener('pointerleave', function(event) {
      if ((!event.pointerType || event.pointerType === 'mouse') && !searchHasFocus()) setSearchOpen(false);
    });

    searchBox.addEventListener('pointerdown', function(event) {
      if (event.pointerType && event.pointerType !== 'mouse') setSearchOpen(true);
    });

    searchBox.addEventListener('click', function() {
      setSearchOpen(true);
      if (searchInput) searchInput.focus();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('compositionstart', function() {
      isComposing = true;
      setSearchOpen(true);
    });

    searchInput.addEventListener('compositionend', function() {
      isComposing = false;
      applySearchValue(searchInput.value);
    });

    searchInput.addEventListener('input', function(event) {
      updateSearchClear();
      if (isComposing || event.isComposing) return;
      applySearchValue(searchInput.value);
    });

    searchInput.addEventListener('search', function() {
      applySearchValue(searchInput.value);
    });

    searchInput.addEventListener('keydown', function(event) {
      if (event.key !== 'Escape' || isComposing || event.isComposing) return;
      event.preventDefault();
      if (searchInput.value || query) {
        searchInput.value = '';
        applySearchValue('');
        return;
      }
      closeSearch();
    });

    searchInput.addEventListener('focus', function() {
      setSearchOpen(true);
    });

    searchInput.addEventListener('blur', function() {
      win.setTimeout(function() {
        if (!searchHasFocus()) setSearchOpen(false);
      }, 0);
    });
  }

  if (searchClear) {
    searchClear.addEventListener('click', function(event) {
      event.preventDefault();
      if (searchInput) searchInput.value = '';
      applySearchValue('');
      setSearchOpen(true);
      if (searchInput) searchInput.focus();
    });
  }

  if (doc.addEventListener) {
    doc.addEventListener('pointerdown', function(event) {
      if (searchBox && !searchBox.contains(event.target)) closeSearch();
    });

    doc.addEventListener('keydown', function(event) {
      if (event.defaultPrevented || event.isComposing) return;
      if (event.key === 'Escape' && searchHasFocus()) {
        event.preventDefault();
        if (searchInput && (searchInput.value || query)) {
          searchInput.value = '';
          applySearchValue('');
          searchInput.focus();
        } else {
          closeSearch();
        }
        return;
      }
      if (!searchInput || event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      var activeEl = doc.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) return;
      event.preventDefault();
      searchInput.focus();
      searchInput.select();
    });
  }

  if (grid) {
    grid.addEventListener('click', function(event) {
      var target = event.target;
      var link = target && target.closest ? target.closest('a.article-card__link') : null;
      if (link) rememberReturnState();
    });
  }

  if (win.addEventListener) {
    win.addEventListener('popstate', restoreFromUrl);
  }

  if (typeof win.fetch === 'function') {
    win.fetch('/assets/data/articles.json', { cache: 'no-store' })
      .then(function(response) {
        if (!response.ok) throw new Error('文章索引读取失败');
        return response.json();
      })
      .then(function(data) {
        articles = (data.articles || []).slice().sort(compareByDateDesc);
        renderFilters(articles);
        if (!isKnownFilter(active)) active = 'all';
        updateFilterButtons();
        updateSearchClear();
        refreshVisible(false);
      })
      .catch(function() {
        loadError = true;
        articles = [];
        active = 'all';
        renderFilters(articles);
        updateSearchClear();
        refreshVisible(false);
      });
  } else {
    loadError = true;
    refreshVisible(false);
  }

  return api;
});
