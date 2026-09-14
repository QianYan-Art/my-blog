'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const articleScript = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'articles.js'), 'utf8');
const postScript = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'post.js'), 'utf8');

function loadPaginationApi() {
  const window = {};
  const context = vm.createContext({ window, Promise, URL, URLSearchParams });
  vm.runInContext(articleScript, context, { filename: 'assets/js/articles.js' });
  return window.ArticleList;
}

const paginationApi = loadPaginationApi();

class FakeClassList {
  constructor(value) {
    this.values = new Set(String(value || '').split(/\s+/).filter(Boolean));
  }

  toggle(name, force) {
    const next = force == null ? !this.values.has(name) : Boolean(force);
    if (next) this.values.add(name);
    else this.values.delete(name);
    return next;
  }

  contains(name) {
    return this.values.has(name);
  }
}

class FakeElement {
  constructor(document, tagName, id, className) {
    this.ownerDocument = document;
    this.tagName = String(tagName || 'div').toUpperCase();
    this.id = id || '';
    this.classList = new FakeClassList(className);
    this.dataset = {};
    this.listeners = {};
    this.attributes = {};
    this.innerHTML = '';
    this.textContent = '';
    this.value = '';
    this.hidden = false;
    this.disabled = false;
    this.isContentEditable = false;
    this.isArticleLink = false;
  }

  addEventListener(type, handler) {
    (this.listeners[type] || (this.listeners[type] = [])).push(handler);
  }

  dispatch(type, init) {
    const event = Object.assign({
      type,
      target: this,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      }
    }, init || {});
    (this.listeners[type] || []).forEach((handler) => handler.call(this, event));
    return event;
  }

  focus() {
    this.ownerDocument.activeElement = this;
    this.dispatch('focus');
  }

  blur() {
    if (this.ownerDocument.activeElement !== this) return;
    this.ownerDocument.activeElement = this.ownerDocument.body;
    this.dispatch('blur');
  }

  select() {}

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  contains(element) {
    return element === this || (this === this.ownerDocument.searchBox && [
      this.ownerDocument.searchInput,
      this.ownerDocument.searchClear
    ].includes(element));
  }

  closest(selector) {
    if (selector === '.article-search' && this === this.ownerDocument.searchInput) {
      return this.ownerDocument.searchBox;
    }
    if (selector === '.article-filter' && this.classList.contains('article-filter')) return this;
    if (selector === 'button' && this.tagName === 'BUTTON') return this;
    if (selector === 'a.article-card__link' && this.isArticleLink) return this;
    return null;
  }

  querySelectorAll(selector) {
    if (this === this.ownerDocument.filters && selector === '.article-filter') {
      const buttons = [];
      const pattern = /<button class="article-filter[^\"]*"[^>]*data-filter="([^\"]+)"/g;
      let match;
      while ((match = pattern.exec(this.innerHTML))) {
        const button = new FakeElement(this.ownerDocument, 'button', '', 'article-filter');
        button.dataset.filter = match[1];
        buttons.push(button);
      }
      return buttons;
    }
    return [];
  }

  querySelector(selector) {
    if (this !== this.ownerDocument.paginationPages) return null;
    const match = selector.match(/^\[data-page="(\d+)"\]$/);
    if (!match) return null;
    const button = new FakeElement(this.ownerDocument, 'button', '', 'article-pagination__page');
    button.dataset.page = match[1];
    return button;
  }
}

class FakeDocument {
  constructor() {
    this.listeners = {};
    this.elements = {};
    this.body = new FakeElement(this, 'body', 'body', '');
    this.activeElement = this.body;
  }

  getElementById(id) {
    return this.elements[id] || null;
  }

  addEventListener(type, handler) {
    (this.listeners[type] || (this.listeners[type] = [])).push(handler);
  }

  dispatch(type, init) {
    const event = Object.assign({
      type,
      target: this,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      }
    }, init || {});
    (this.listeners[type] || []).forEach((handler) => handler.call(this, event));
    return event;
  }
}

class MemoryStorage {
  constructor(source) {
    this.values = source || new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

function makeArticles() {
  return Array.from({ length: 45 }, (_, index) => ({
    id: String(index + 1),
    title: '文章 ' + (index + 1),
    summary: index === 0 ? '首篇记录' : '列表测试内容',
    category: index < 30 ? '本地记录' : '服务器记录',
    tags: ['测试'],
    date: '',
    href: '/posts/kbase/' + (index + 1) + '.html'
  }));
}

function createHarness(options) {
  const document = new FakeDocument();
  const ids = {
    grid: ['div', 'articleGrid', 'article-grid'],
    filters: ['div', 'articleFilters', 'article-filters'],
    count: ['span', 'articleCount', ''],
    searchInput: ['input', 'articleSearch', ''],
    searchClear: ['button', 'articleSearchClear', 'article-search__clear'],
    pagination: ['div', 'articlePagination', 'article-pagination'],
    summary: ['p', 'articlePaginationSummary', 'article-pagination__summary'],
    prev: ['button', 'articlePaginationPrev', 'article-pagination__nav'],
    pages: ['nav', 'articlePaginationPages', 'article-pagination__pages'],
    next: ['button', 'articlePaginationNext', 'article-pagination__nav'],
    pageSize: ['select', 'articlePageSize', '']
  };

  Object.entries(ids).forEach(([name, [tag, id, className]]) => {
    document.elements[id] = new FakeElement(document, tag, id, className);
    document[name] = document.elements[id];
  });
  document.searchBox = new FakeElement(document, 'label', 'articleSearchBox', 'article-search');
  document.searchInput = document.searchInput;
  document.searchClear = document.searchClear;
  document.paginationPages = document.pages;
  document.pagination.hidden = true;
  document.pageSize.value = '20';
  document.prev.dataset.paginationAction = 'prev';
  document.next.dataset.paginationAction = 'next';

  const location = {
    pathname: '/blog/',
    search: options.search || '',
    hash: ''
  };
  const history = {
    replaceState(_state, _title, value) {
      const next = new URL(value, 'https://blog.test');
      location.pathname = next.pathname;
      location.search = next.search;
      location.hash = next.hash;
    }
  };
  const storage = options.storage || new MemoryStorage();
  const window = {
    document,
    location,
    history,
    sessionStorage: storage,
    URLSearchParams,
    fetch() {
      if (options.fetchError) return Promise.reject(new Error('索引读取失败'));
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ articles: options.articles || makeArticles() })
      });
    },
    matchMedia: () => ({ matches: false }),
    setTimeout(callback) {
      callback();
      return 0;
    },
    addEventListener(type, handler) {
      (this.listeners || (this.listeners = {}))[type] = handler;
    }
  };
  if (options.noUrlSearchParams) delete window.URLSearchParams;
  if (options.storageGetterThrows) {
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get() {
        throw new Error('sessionStorage is unavailable');
      }
    });
  }
  document.searchInput.closest = (selector) => selector === '.article-search' ? document.searchBox : null;
  document.searchInput.ownerDocument = document;
  document.searchClear.ownerDocument = document;
  document.paginationPages = document.pages;

  const context = vm.createContext({ window, Promise, URL, URLSearchParams });
  vm.runInContext(articleScript, context, { filename: 'assets/js/articles.js' });
  return { document, window, location, storage };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function testPurePaginationAndSearch() {
  assert.strictEqual(paginationApi.DEFAULT_PAGE_SIZE, 20);
  assert.deepStrictEqual(Array.from(paginationApi.PAGE_SIZE_OPTIONS), [10, 20, 50]);
  assert.strictEqual(paginationApi.normalizePageSize('15'), 20);
  assert.strictEqual(paginationApi.getPageCount(0, 20), 0);
  assert.strictEqual(paginationApi.getPageCount(45, 20), 3);
  assert.strictEqual(paginationApi.clampPage(99, 3), 3);
  assert.strictEqual(paginationApi.clampPage('bad', 3), 1);

  const items = Array.from({ length: 45 }, (_, index) => index + 1);
  assert.deepStrictEqual(Array.from(paginationApi.getPageItems(items, 1, 20)), items.slice(0, 20));
  assert.deepStrictEqual(Array.from(paginationApi.getPageItems(items, 3, 20)), items.slice(40));
  assert.deepStrictEqual(Array.from(paginationApi.getPaginationItems(1, 10)), [1, 2, 3, 'ellipsis', 10]);
  assert.deepStrictEqual(Array.from(paginationApi.getPaginationItems(5, 10)), [1, 'ellipsis', 4, 5, 6, 'ellipsis', 10]);
  assert.deepStrictEqual(Array.from(paginationApi.getPaginationItems(10, 10)), [1, 'ellipsis', 8, 9, 10]);

  const article = { title: 'Deploy Notes', summary: 'Server checklist', category: '服务器记录', tags: ['release'] };
  assert.strictEqual(paginationApi.matchesSearch(article, 'deploy'), true);
  assert.strictEqual(paginationApi.matchesSearch(article, 'RELEASE'), true);
  assert.strictEqual(paginationApi.matchesSearch(article, 'missing'), false);

  const encoded = paginationApi.serializeListState({
    page: 3,
    pageSize: 50,
    query: ' Deploy ',
    active: '服务器记录'
  });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(paginationApi.parseListState('?' + encoded))), {
    hasUrlState: true,
    query: 'deploy',
    active: '服务器记录',
    page: 3,
    pageSize: 50
  });
  assert.strictEqual(paginationApi.parseListState('?q=').hasUrlState, true);
  assert.strictEqual(paginationApi.parseListState('?size=15').pageSize, 20);
  assert.doesNotThrow(() => paginationApi.parseListState('?q=%'));
  assert.strictEqual(paginationApi.parseListState('?q=%').query, '%');
}

async function testBrowserPaginationAndSearch() {
  const articles = makeArticles();
  const harness = createHarness({ articles });
  await flush();

  assert.strictEqual(harness.document.summary.textContent, '共 45 篇 · 第 1 / 3 页 · 显示 1-20 篇');
  assert.strictEqual(harness.document.prev.disabled, true);
  assert.strictEqual(harness.document.next.disabled, false);
  assert.ok(harness.document.grid.innerHTML.includes('文章 1'));
  assert.ok(!harness.document.grid.innerHTML.includes('文章 21'));

  harness.document.pagination.dispatch('click', { target: harness.document.next });
  assert.strictEqual(harness.document.summary.textContent, '共 45 篇 · 第 2 / 3 页 · 显示 21-40 篇');
  assert.ok(harness.document.grid.innerHTML.includes('文章 21'));
  assert.ok(!harness.document.grid.innerHTML.includes('文章 1'));

  harness.document.pageSize.value = '10';
  harness.document.pageSize.dispatch('change', { target: harness.document.pageSize });
  assert.strictEqual(harness.document.summary.textContent, '共 45 篇 · 第 1 / 5 页 · 显示 1-10 篇');

  const page3 = harness.document.pages.querySelector('[data-page="3"]');
  harness.document.pagination.dispatch('click', { target: page3 });
  assert.strictEqual(harness.document.summary.textContent, '共 45 篇 · 第 3 / 5 页 · 显示 21-30 篇');

  const serverFilter = harness.document.filters.querySelectorAll('.article-filter')
    .find((button) => button.dataset.filter === '服务器记录');
  harness.document.filters.dispatch('click', { target: serverFilter });
  assert.strictEqual(harness.document.summary.textContent, '共 15 篇 · 第 1 / 2 页 · 显示 1-10 篇');

  harness.document.pagination.dispatch('click', { target: harness.document.next });
  harness.document.searchInput.value = '服务';
  harness.document.searchInput.dispatch('compositionstart');
  harness.document.searchInput.value = '服务';
  harness.document.searchInput.dispatch('input', { isComposing: true });
  assert.strictEqual(harness.document.summary.textContent, '共 15 篇 · 第 2 / 2 页 · 显示 11-15 篇');
  harness.document.searchInput.dispatch('compositionend');
  assert.strictEqual(harness.document.summary.textContent, '共 15 篇 · 第 1 / 2 页 · 显示 1-10 篇');

  harness.document.searchInput.blur();
  harness.document.searchInput.dispatch('blur');
  harness.document.filters.dispatch('click', { target: serverFilter });
  harness.document.searchBox.dispatch('pointerleave', { pointerType: 'mouse' });
  await flush();
  assert.strictEqual(harness.document.searchBox.classList.contains('is-open'), false);
  assert.strictEqual(harness.document.searchClear.hidden, false);
  assert.notStrictEqual(harness.document.searchInput.value, '');
  harness.document.searchBox.dispatch('pointerenter', { pointerType: 'mouse' });
  assert.strictEqual(harness.document.searchBox.classList.contains('is-open'), true);
  harness.document.dispatch('pointerdown', { target: harness.document.body });
  assert.strictEqual(harness.document.searchBox.classList.contains('is-open'), false);
  harness.document.searchBox.dispatch('click', { target: harness.document.searchBox });
  harness.document.searchClear.focus();
  harness.document.searchBox.dispatch('focusout');
  await flush();
  assert.strictEqual(harness.document.searchBox.classList.contains('is-open'), true);
  harness.document.searchClear.blur();
  harness.document.searchBox.dispatch('focusout');
  await flush();
  assert.strictEqual(harness.document.searchBox.classList.contains('is-open'), false);
  harness.document.searchBox.dispatch('click', { target: harness.document.searchBox });

  harness.document.searchClear.dispatch('click', { target: harness.document.searchClear });
  assert.strictEqual(harness.document.searchInput.value, '');
  assert.strictEqual(harness.document.activeElement, harness.document.searchInput);

  harness.document.searchInput.value = '服务器';
  harness.document.searchInput.dispatch('input');
  harness.document.searchInput.dispatch('keydown', { key: 'Escape' });
  assert.strictEqual(harness.document.searchInput.value, '');
  assert.strictEqual(harness.document.searchBox.classList.contains('is-open'), true);
  harness.document.searchInput.dispatch('keydown', { key: 'Escape' });
  assert.strictEqual(harness.document.searchBox.classList.contains('is-open'), false);

  harness.document.dispatch('keydown', { key: '/' });
  assert.strictEqual(harness.document.activeElement, harness.document.searchInput);
  harness.document.searchBox.dispatch('pointerdown', { pointerType: 'touch' });
  assert.strictEqual(harness.document.searchBox.classList.contains('is-open'), true);
}

async function testStateRestoreAndEmptyResult() {
  const storage = new MemoryStorage();
  const first = createHarness({ articles: makeArticles(), storage });
  await flush();
  first.document.pageSize.value = '10';
  first.document.pageSize.dispatch('change', { target: first.document.pageSize });
  first.document.pagination.dispatch('click', { target: first.document.next });
  first.document.searchInput.value = '文章';
  first.document.searchInput.dispatch('input');
  first.document.pagination.dispatch('click', { target: first.document.next });
  const articleLink = new FakeElement(first.document, 'a', '', 'article-card__link');
  articleLink.isArticleLink = true;
  first.document.grid.dispatch('click', { target: articleLink });

  const restored = createHarness({ articles: makeArticles(), storage });
  await flush();
  assert.strictEqual(restored.document.searchInput.value, '文章');
  assert.strictEqual(restored.document.summary.textContent, '共 45 篇 · 第 2 / 5 页 · 显示 11-20 篇');

  const fromUrl = createHarness({
    articles: makeArticles(),
    search: '?page=3&size=10&q=%E6%96%87%E7%AB%A0'
  });
  await flush();
  assert.strictEqual(fromUrl.document.summary.textContent, '共 45 篇 · 第 3 / 5 页 · 显示 21-30 篇');

  const empty = createHarness({
    articles: makeArticles(),
    search: '?q=%E4%B8%8D%E5%AD%98%E5%9C%A8'
  });
  await flush();
  assert.ok(empty.document.grid.innerHTML.includes('没有找到匹配的文章。'));
  assert.strictEqual(empty.document.summary.textContent, '共 0 篇');
  assert.strictEqual(empty.document.prev.disabled, true);
  assert.strictEqual(empty.document.next.disabled, true);
  assert.strictEqual(empty.document.pages.innerHTML, '');

  const malformed = createHarness({
    articles: makeArticles(),
    search: '?q=%',
    noUrlSearchParams: true
  });
  await flush();
  assert.ok(malformed.document.grid.innerHTML.includes('没有找到匹配的文章。'));
  assert.strictEqual(malformed.document.summary.textContent, '共 0 篇');
}

async function testSessionStorageGetterFailure() {
  const disabled = createHarness({ articles: makeArticles(), storageGetterThrows: true });
  await flush();
  assert.strictEqual(disabled.document.summary.textContent, '共 45 篇 · 第 1 / 3 页 · 显示 1-20 篇');
  const articleLink = new FakeElement(disabled.document, 'a', '', 'article-card__link');
  articleLink.isArticleLink = true;
  assert.doesNotThrow(() => disabled.document.grid.dispatch('click', { target: articleLink }));
}

function getPostBackHref(referrer) {
  const back = {
    href: '/blog/',
    setAttribute(name, value) {
      if (name === 'href') this.href = value;
    }
  };
  const document = {
    referrer,
    querySelector(selector) {
      if (selector === '.post-back') return back;
      if (selector === '.post-content') return null;
      return null;
    }
  };
  const window = {
    URL,
    location: { href: 'https://blog.test/posts/kbase/example.html' }
  };
  const context = vm.createContext({ window, document, URL });
  vm.runInContext(postScript, context, { filename: 'assets/js/post.js' });
  return back.href;
}

function testPostBackReferrer() {
  assert.strictEqual(
    getPostBackHref('https://blog.test/blog/?page=3&size=10&q=deploy#top'),
    '/blog/?page=3&size=10&q=deploy#top'
  );
  assert.strictEqual(getPostBackHref('https://outside.test/blog/?page=3'), '/blog/');
  assert.strictEqual(getPostBackHref('https://blog.test/posts/other.html?page=3'), '/blog/');
  assert.strictEqual(getPostBackHref('not a URL'), '/blog/');
}

async function main() {
  testPurePaginationAndSearch();
  await testBrowserPaginationAndSearch();
  await testStateRestoreAndEmptyResult();
  await testSessionStorageGetterFailure();
  testPostBackReferrer();
  console.log('文章分页与搜索测试通过。');
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
