const fs = require("fs");
const path = require("path");
const https = require("https");
const { execFileSync } = require("child_process");
const MarkdownIt = require("markdown-it");
const markdownItTaskLists = require("markdown-it-task-lists");

const ROOT = path.resolve(__dirname, "..");
const OWNER = process.env.KBASE_OWNER || "QianYan-Art";
const REPO = process.env.KBASE_REPO || "QianYan-KBase";
const BRANCH = process.env.KBASE_BRANCH || "main";
const TOKEN = process.env.GITHUB_TOKEN || process.env.KBASE_TOKEN;
const LOCAL_PATH = process.env.KBASE_LOCAL_PATH || path.resolve(ROOT, "..", "QianYan-KBase");
const PUBLIC_DIR = process.env.KBASE_PUBLIC_DIR || "public";
const SOURCE_MODE = process.env.KBASE_SOURCE || (fs.existsSync(LOCAL_PATH) ? "local" : "github");
const OUTPUT = path.join(ROOT, "assets", "data", "articles.json");
const POSTS_DIR = path.join(ROOT, "posts", "kbase");
const TEMP_ROOT = path.join(ROOT, ".tmp", "kbase-sync");

if (SOURCE_MODE === "github" && !TOKEN) {
  console.error("缺少 GITHUB_TOKEN 或 KBASE_TOKEN。不要把 token 写进前端代码，请在本地/CI 环境变量中提供。");
  process.exit(1);
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      headers: {
        "User-Agent": "qianyan-static-blog-sync",
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${TOKEN}`,
        "X-GitHub-Api-Version": "2022-11-28"
      }
    }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`GitHub API ${res.statusCode}: ${body.slice(0, 300)}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

async function getBlobText(sha) {
  const blob = await requestJson(`https://api.github.com/repos/${OWNER}/${REPO}/git/blobs/${sha}`);
  if (blob.encoding === "base64") {
    return Buffer.from(blob.content, "base64").toString("utf8");
  }
  return blob.content || "";
}

function slugify(value) {
  return String(value || "note")
    .trim()
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .pop()
    .replace(/\.[^.]+$/, "")
    .replace(/[^\w\u4e00-\u9fa5-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "note";
}

function uniqueSlug(base, used) {
  let slug = base || "note";
  let index = 2;
  while (used.has(slug)) {
    slug = `${base}-${index}`;
    index += 1;
  }
  used.add(slug);
  return slug;
}

function parseFrontMatter(markdown) {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!match) return {};
  return match[1].split(/\r?\n/).reduce((data, line) => {
    const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!pair) return data;
    const key = pair[1];
    let value = pair[2].trim();
    if ((value.startsWith("[") && value.endsWith("]"))) {
      value = value.slice(1, -1).split(",").map((item) => item.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
    } else {
      value = value.replace(/^['"]|['"]$/g, "");
    }
    data[key] = value;
    return data;
  }, {});
}

function stripFrontMatter(markdown) {
  return markdown.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, "");
}

function titleFromMarkdown(markdown, fallback) {
  return stripFrontMatter(markdown).match(/^#\s+(.+)$/m)?.[1]?.trim() || fallback;
}

function basenameTitleFromPath(filePath) {
  return cleanDisplayTitle(path.basename(String(filePath || ""), path.extname(String(filePath || ""))));
}

function posixBasenameTitleFromPath(filePath) {
  const value = String(filePath || "");
  return cleanDisplayTitle(path.posix.basename(value, path.posix.extname(value)));
}

function cleanDisplayTitle(value) {
  return String(value || "")
    .trim()
    .replace(/^(20\d{2})[._-](\d{1,2})[._-](\d{1,2})(?:\s*[_\- ]\s*|\s+)/, "")
    .replace(/^[_\-\s]+/, "")
    .trim();
}

function titleFromPath(relativePath) {
  const filename = String(relativePath || "").split(/[\\/]+/).filter(Boolean).pop() || "";
  return filename.replace(/\.[^.]+$/, "");
}

function dateFromPath(filePath, stats) {
  const matched = filePath.match(/(20\d{2})[.-](\d{1,2})[.-](\d{1,2})/);
  if (matched) {
    return `${matched[1]}-${matched[2].padStart(2, "0")}-${matched[3].padStart(2, "0")}`;
  }
  return stats.mtime.toISOString().slice(0, 10);
}

function dateHintFromPath(filePath) {
  const matched = String(filePath).match(/(20\d{2})[.-](\d{1,2})[.-](\d{1,2})/);
  if (!matched) return "";
  return `${matched[1]}-${matched[2].padStart(2, "0")}-${matched[3].padStart(2, "0")}`;
}

function readLocalGitDate(filePath) {
  try {
    const relative = path.relative(LOCAL_PATH, filePath).replace(/\\/g, "/");
    const value = execFileSync("git", ["-C", LOCAL_PATH, "log", "-1", "--format=%cs", "--", relative], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
  } catch {
    // ignore and fall back to filename / mtime date
  }
  return "";
}

async function readGithubCommitDate(repoPath) {
  try {
    const commits = await requestJson(`https://api.github.com/repos/${OWNER}/${REPO}/commits?sha=${encodeURIComponent(BRANCH)}&path=${encodeURIComponent(repoPath)}&per_page=1`);
    const value = commits?.[0]?.commit?.committer?.date || commits?.[0]?.commit?.author?.date || "";
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return value.slice(0, 10);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
  } catch {
    // ignore and fall back to filename date
  }
  return "";
}

function kbaseSection(relativePath) {
  const parts = String(relativePath).split(/[\\/]+/).filter(Boolean);
  const root = parts[0] || "";
  if (/^(my[-_]local|local)$/i.test(root)) {
    const trail = parts.slice(1, -1).map((part) => cleanDisplayTitle(part)).filter(Boolean);
    return {
      category: "本地记录",
      sourceType: "local",
      section: trail.length ? trail.join(" · ") : "Local Notes",
      tags: trail.slice(0, 3)
    };
  }
  if (/^(my[-_]server|server)$/i.test(root)) {
    const trail = parts.slice(1, -1).map((part) => cleanDisplayTitle(part)).filter(Boolean);
    return {
      category: "服务器记录",
      sourceType: "server",
      section: trail.length ? trail.join(" · ") : "Server Notes",
      tags: trail.slice(0, 3)
    };
  }
  return { category: "知识库", sourceType: "public", section: "Public Notes", tags: [] };
}

function htmlEscape(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function plainSummary(markdown) {
  const text = stripFrontMatter(markdown)
    .replace(/^\s*#\s+.+(?:\r?\n)+/, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[[^\]]+]\([^)]+\)/g, (match) => match.replace(/^\[|\]\([^)]+\)$/g, ""))
    .replace(/[#>*_`~-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 110) || "这篇文章来自千颜的私有知识库，已在同步阶段生成静态索引。";
}

function parseDateValue(value) {
  if (!value) return NaN;
  const normalized = String(value).trim().replace(/\./g, "-").replace(/\//g, "-");
  const matched = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (matched) {
    return new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3])).getTime();
  }
  const timestamp = new Date(normalized).getTime();
  return Number.isNaN(timestamp) ? NaN : timestamp;
}

function compareByDateDesc(a, b) {
  const left = parseDateValue(a.date);
  const right = parseDateValue(b.date);
  if (!Number.isNaN(left) && !Number.isNaN(right) && left !== right) {
    return right - left;
  }
  if (Number.isNaN(left) && !Number.isNaN(right)) return 1;
  if (!Number.isNaN(left) && Number.isNaN(right)) return -1;
  return String(b.date || "").localeCompare(String(a.date || ""));
}

function markdownToHtml(markdown) {
  const body = stripFrontMatter(markdown).replace(/^\s*#\s+.+(?:\r?\n)+/, "");
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    breaks: false,
    typographer: false
  }).use(markdownItTaskLists, {
    enabled: true,
    label: true,
    labelAfter: true
  });

  function sanitizeHref(rawHref) {
    const value = String(rawHref || "").trim();
    if (!value) return "";
    if (value.startsWith("#") || value.startsWith("/") || value.startsWith("./") || value.startsWith("../")) {
      return value;
    }
    if (/^https?:/i.test(value) || /^mailto:/i.test(value)) {
      return value;
    }
    return "";
  }

  const renderToken = md.renderer.renderToken.bind(md.renderer);
  const defaultLinkOpen = md.renderer.rules.link_open || renderToken;
  const defaultImage = md.renderer.rules.image;
  const defaultHeadingOpen = md.renderer.rules.heading_open || renderToken;
  const defaultHeadingClose = md.renderer.rules.heading_close || renderToken;

  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const hrefIndex = tokens[idx].attrIndex("href");
    const href = hrefIndex >= 0 ? tokens[idx].attrs[hrefIndex][1] : "";
    const safeHref = sanitizeHref(href);
    if (!safeHref) {
      tokens[idx].attrSet("href", "#");
    } else {
      tokens[idx].attrSet("href", safeHref);
    }
    tokens[idx].attrSet("target", "_blank");
    tokens[idx].attrSet("rel", "noopener noreferrer");
    return defaultLinkOpen(tokens, idx, options, env, self);
  };

  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const srcIndex = tokens[idx].attrIndex("src");
    const src = srcIndex >= 0 ? tokens[idx].attrs[srcIndex][1] : "";
    const safeSrc = sanitizeHref(src);
    if (!safeSrc) {
      return md.utils.escapeHtml(tokens[idx].content || "");
    }
    tokens[idx].attrSet("src", safeSrc);
    tokens[idx].attrSet("loading", "lazy");
    return defaultImage ? defaultImage(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options);
  };

  md.renderer.rules.table_open = () => "<div class=\"post-table-wrap\"><table>";
  md.renderer.rules.table_close = () => "</table></div>";

  md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
    const originalLevel = Number(tokens[idx].tag.replace(/^h/, "")) || 1;
    tokens[idx].tag = `h${Math.min(6, originalLevel + 1)}`;
    return defaultHeadingOpen(tokens, idx, options, env, self);
  };

  md.renderer.rules.heading_close = (tokens, idx, options, env, self) => {
    const originalLevel = Number(tokens[idx].tag.replace(/^h/, "")) || 1;
    tokens[idx].tag = `h${Math.min(6, originalLevel + 1)}`;
    return defaultHeadingClose(tokens, idx, options, env, self);
  };

  return md.render(body);
}

function renderPost(article, markdown) {
  const tags = (article.tags || []).map((tag) => `<span>${htmlEscape(tag)}</span>`).join("");
  const title = htmlEscape(article.title);
  const summary = htmlEscape(article.summary);
  const category = htmlEscape(article.category);
  const date = htmlEscape(article.date);
  const readingTime = htmlEscape(article.readingTime);
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} · 千颜</title>
  <meta name="description" content="${summary}">
  <link rel="icon" type="image/svg+xml" href="/assets/img/favicon.svg?v=20260526a">
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/img/favicon-32.png?v=20260526a">
  <link rel="shortcut icon" href="/assets/img/favicon-32.png?v=20260526a">
  <link rel="stylesheet" href="/assets/css/tokens.css">
  <link rel="stylesheet" href="/assets/css/base.css">
  <link rel="stylesheet" href="/assets/css/layout.css">
  <link rel="stylesheet" href="/assets/css/components.css">
  <link rel="stylesheet" href="/assets/css/motion.css">
  <script>
    window.MathJax = {
      tex: { inlineMath: [["$", "$"], ["\\\\(", "\\\\)"]], displayMath: [["$$", "$$"], ["\\\\[", "\\\\]"]] },
      svg: { fontCache: "global" }
    };
  </script>
  <script defer src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script>
</head>
<body class="page page--articles">
  <div class="binding"></div>
  <header class="site-nav">
    <a class="site-nav__brand" href="/"><span class="site-nav__mark" aria-hidden="true"></span><span class="site-nav__title">千颜</span></a>
    <span class="site-nav__meta">QianYan · KBase · Note</span>
    <nav class="site-nav__links"><a href="/blog/">文章</a><a href="/projects/">项目</a><a href="/about/">关于</a></nav>
    <a class="site-nav__github" href="https://github.com/QianYan-Art" target="_blank" rel="noopener" aria-label="GitHub">
      <span class="site-nav__github-label" data-full="GitHub" data-short="GH">GitHub</span><span class="site-nav__github-arrow-text">→</span>
    </a>
    <a class="site-nav__github-mobile" href="https://github.com/QianYan-Art" target="_blank" rel="noopener" aria-label="GitHub">
      <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>
    </a>
  </header>
  <div class="site-nav__rule"></div>
  <main class="page-main post-shell">
    <a class="post-back" href="/blog/">← 返回文章</a>
    <article class="post-body">
      <p class="post-kicker">${category}</p>
      <h1>${title}</h1>
      <div class="post-meta"><span>${date}</span><span>${readingTime}</span></div>
      <div class="article-card__tags">${tags}</div>
      <div class="post-content">${markdownToHtml(markdown)}</div>
    </article>
  </main>
  <script src="/assets/js/home.js"></script>
</body>
</html>`;
}

function walkMarkdownFiles(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === ".obsidian" || entry.name === "node_modules") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...walkMarkdownFiles(fullPath));
    } else if (/\.mdx?$/i.test(entry.name)) {
      result.push(fullPath);
    }
  }
  return result;
}

function readLocalConfig(filePath) {
  const configPath = path.join(path.dirname(filePath), "config.json");
  if (!fs.existsSync(configPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch {
    return {};
  }
}

async function syncLocal(outputDir) {
  if (!fs.existsSync(LOCAL_PATH)) {
    throw new Error(`本地知识库不存在：${LOCAL_PATH}`);
  }
  const publicPath = path.join(LOCAL_PATH, PUBLIC_DIR);
  if (!fs.existsSync(publicPath)) {
    throw new Error(`公开文章目录不存在：${publicPath}`);
  }

  const used = new Set();
  const files = walkMarkdownFiles(publicPath);
  const articles = files.map((filePath) => {
    const markdown = fs.readFileSync(filePath, "utf8");
    const stats = fs.statSync(filePath);
    const relativePath = path.relative(publicPath, filePath);
    const section = kbaseSection(relativePath);
    const config = readLocalConfig(filePath);
    const frontMatter = parseFrontMatter(markdown);
    const meta = { ...frontMatter, ...config };
    const baseSlug = slugify(meta.slug || relativePath);
    const slug = uniqueSlug(baseSlug, used);
    const sectionTags = section.tags || [];
    const metaTags = Array.isArray(meta.tags) ? meta.tags : [];
    const article = {
      id: slug,
      title: basenameTitleFromPath(titleFromPath(relativePath)) || cleanDisplayTitle(meta.title || titleFromMarkdown(markdown, path.basename(filePath, path.extname(filePath)))),
      summary: meta.summary || meta.description || plainSummary(markdown),
      date: dateHintFromPath(relativePath) || meta.date || meta.created || readLocalGitDate(filePath) || dateFromPath(relativePath, stats),
      category: meta.category || section.category,
      tags: Array.from(new Set([...sectionTags, ...metaTags])),
      href: `/posts/kbase/${slug}.html`,
      readingTime: meta.readingTime || `${Math.max(1, Math.ceil(stripFrontMatter(markdown).length / 700))} min`,
      featured: Boolean(meta.featured),
      sourceType: section.sourceType,
      section: section.section,
      sourcePath: relativePath.replace(/\\/g, "/")
    };
    fs.writeFileSync(path.join(outputDir, `${slug}.html`), renderPost(article, markdown), "utf8");
    return article;
  });

  articles.sort(compareByDateDesc);
  return articles;
}

async function syncGithub(outputDir) {
  const tree = await requestJson(`https://api.github.com/repos/${OWNER}/${REPO}/git/trees/${encodeURIComponent(BRANCH)}?recursive=1`);
  const files = tree.tree.filter((item) => item.type === "blob");
  const configs = new Map(files.filter((file) => /(^|\/)config\.json$/i.test(file.path)).map((file) => [path.posix.dirname(file.path), file]));
  const publicPrefix = `${PUBLIC_DIR.replace(/^\/|\/$/g, "")}/`;
  const markdownFiles = files.filter((file) => file.path.startsWith(publicPrefix) && /\.mdx?$/i.test(file.path));
  const used = new Set();
  const articles = [];

  for (const mdFile of markdownFiles) {
    const dir = path.posix.dirname(mdFile.path);
    const relativePath = mdFile.path.slice(publicPrefix.length);
    const section = kbaseSection(relativePath);
    const configFile = configs.get(dir);
    const markdown = await getBlobText(mdFile.sha);
    const frontMatter = parseFrontMatter(markdown);
    let config = {};
    if (configFile) {
      try {
        config = JSON.parse(await getBlobText(configFile.sha));
      } catch {
        console.warn(`[sync:kbase] 跳过损坏配置: ${configFile.path}`);
        config = {};
      }
    }
    const meta = { ...frontMatter, ...config };
    const slug = uniqueSlug(slugify(meta.slug || relativePath), used);
    const commitDate = await readGithubCommitDate(mdFile.path);
    const sectionTags = section.tags || [];
    const metaTags = Array.isArray(meta.tags) ? meta.tags : [];
    const article = {
      id: slug,
      title: posixBasenameTitleFromPath(titleFromPath(relativePath)) || cleanDisplayTitle(meta.title || titleFromMarkdown(markdown, slug)),
      summary: meta.summary || meta.description || plainSummary(markdown),
      date: dateHintFromPath(relativePath) || meta.date || meta.created || commitDate || "",
      category: meta.category || section.category,
      tags: Array.from(new Set([...sectionTags, ...metaTags])),
      href: `/posts/kbase/${slug}.html`,
      readingTime: meta.readingTime || `${Math.max(1, Math.ceil(stripFrontMatter(markdown).length / 700))} min`,
      featured: Boolean(meta.featured),
      sourceType: section.sourceType,
      section: section.section,
      sourcePath: relativePath
    };
    fs.writeFileSync(path.join(outputDir, `${slug}.html`), renderPost(article, markdown), "utf8");
    articles.push(article);
  }

  articles.sort(compareByDateDesc);
  return articles;
}

async function main() {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.rmSync(TEMP_ROOT, { recursive: true, force: true });
  fs.mkdirSync(TEMP_ROOT, { recursive: true });
  const nextPostsDir = path.join(TEMP_ROOT, "posts");
  const nextOutput = path.join(TEMP_ROOT, "articles.json");
  fs.mkdirSync(nextPostsDir, { recursive: true });

  const articles = SOURCE_MODE === "github" ? await syncGithub(nextPostsDir) : await syncLocal(nextPostsDir);

  const groups = articles.reduce((result, article) => {
    const key = article.sourceType || "public";
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});

  fs.writeFileSync(nextOutput, JSON.stringify({
    updatedAt: new Date().toISOString(),
    source: SOURCE_MODE === "github" ? `${OWNER}/${REPO}` : LOCAL_PATH,
    publicDir: PUBLIC_DIR,
    groups,
    articles
  }, null, 2), "utf8");

  fs.rmSync(POSTS_DIR, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(POSTS_DIR), { recursive: true });
  fs.renameSync(nextPostsDir, POSTS_DIR);
  fs.copyFileSync(nextOutput, OUTPUT);
  fs.rmSync(TEMP_ROOT, { recursive: true, force: true });

  console.log(`已从 ${SOURCE_MODE}/${PUBLIC_DIR} 同步 ${articles.length} 篇文章到 ${path.relative(ROOT, OUTPUT)}。`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
