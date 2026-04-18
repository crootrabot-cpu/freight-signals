import fs from 'node:fs/promises';
import path from 'node:path';
import { docsDir, escapeHtml, formatTimestamp, loadConfig, loadPosts, postUrl, siteBase } from './lib/site.mjs';

function groupPostsByYear(posts) {
  const map = new Map();
  for (const post of posts) {
    const year = new Date(post.createdAt).getFullYear();
    if (!map.has(year)) map.set(year, []);
    map.get(year).push(post);
  }
  return [...map.entries()].sort((a, b) => b[0] - a[0]);
}

function renderHeader(config) {
  return `
    <header class="site-header">
      <a class="brand" href="${siteBase(config)}">${escapeHtml(config.siteName)}</a>
      <p class="tagline">${escapeHtml(config.tagline)}</p>
    </header>`;
}

function renderInline(text = '', config) {
  const pattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let output = '';
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    output += escapeHtml(text.slice(lastIndex, match.index));
    const label = escapeHtml(match[1]);
    const rawHref = match[2].trim();
    const href = rawHref.startsWith('post:') ? postUrl(config, rawHref.slice(5)) : rawHref;
    output += `<a href="${escapeHtml(href)}">${label}</a>`;
    lastIndex = match.index + match[0].length;
  }

  output += escapeHtml(text.slice(lastIndex));
  return output;
}

function renderFooter(config) {
  return `
    <footer class="site-footer">
      <p>${escapeHtml(config.siteName)} is a notebook by ${escapeHtml(config.author.name)}, about technology, culture, and the futures people keep trying to build.</p>
    </footer>`;
}

function layout({ title, body, config }) {
  const pageTitle = title === config.siteName ? config.siteName : `${title} | ${config.siteName}`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(config.tagline)}" />
  <link rel="stylesheet" href="${siteBase(config)}assets/styles.css" />
</head>
<body>
  <div class="page-shell">
    ${renderHeader(config)}
    ${body}
    ${renderFooter(config)}
  </div>
</body>
</html>`;
}

function paragraphsFromPost(post) {
  if (Array.isArray(post.body) && post.body.length) return post.body;
  return [
    ...(post.listicle || []),
    ...(post.thread || [])
  ];
}

function renderLead(config, post) {
  if (!post) return '<p>No posts yet.</p>';
  const paragraphs = paragraphsFromPost(post).slice(0, 2);
  return `
    <article class="lead-story">
      <p class="section-kicker">Latest post</p>
      <h2><a href="${postUrl(config, post.slug)}">${escapeHtml(post.title)}</a></h2>
      <p class="lead-date">${escapeHtml(formatTimestamp(post.createdAt, config.timezone))}</p>
      <p class="lead-summary">${renderInline(post.summary, config)}</p>
      <div class="lead-body">
        ${paragraphs.map((paragraph) => `<p>${renderInline(paragraph, config)}</p>`).join('')}
      </div>
      <p class="read-link"><a href="${postUrl(config, post.slug)}">Continue reading</a></p>
    </article>`;
}

function renderStartHere(config, postsBySlug) {
  if (!Array.isArray(config.startHere) || !config.startHere.length) return '';
  return `
    <section class="start-here">
      <div class="section-heading">
        <p class="section-kicker">Start here</p>
        <p class="section-note">A few good entry points if you want the shape of the archive fast.</p>
      </div>
      <ol class="start-list">
        ${config.startHere.map((item) => {
          const post = postsBySlug.get(item.slug);
          const title = post?.title || item.title || item.slug;
          return `
            <li>
              <h3><a href="${postUrl(config, item.slug)}">${escapeHtml(title)}</a></h3>
              ${item.note ? `<p>${renderInline(item.note, config)}</p>` : ''}
            </li>`;
        }).join('')}
      </ol>
    </section>`;
}

function renderArchive(config, posts) {
  const byYear = groupPostsByYear(posts);
  return byYear.map(([year, yearPosts]) => `
    <section class="year-block">
      <h3>${year}</h3>
      <ul class="year-list">
        ${yearPosts.map((post) => `
          <li>
            <span class="archive-date">${escapeHtml(formatTimestamp(post.createdAt, config.timezone))}</span>
            <div class="archive-copy">
              <h4><a href="${postUrl(config, post.slug)}">${escapeHtml(post.title)}</a></h4>
              <p>${renderInline(post.summary, config)}</p>
            </div>
          </li>`).join('')}
      </ul>
    </section>`).join('');
}

function homePage({ config, posts }) {
  const [lead, ...archive] = posts;
  const postsBySlug = new Map(posts.map((post) => [post.slug, post]));
  return layout({
    title: config.siteName,
    config,
    body: `
      <main class="front-page">
        <section class="masthead">
          <p class="issue-line">${escapeHtml(config.homeKicker || `A notebook by ${config.author.name}`)}</p>
          <h1>${escapeHtml(config.siteName)}</h1>
          <p class="masthead-deck">${renderInline(config.homeIntro || config.author.bio, config)}</p>
        </section>

        <section class="front-grid">
          <div class="main-column">
            ${renderStartHere(config, postsBySlug)}
            ${renderLead(config, lead)}
            <section class="archive-section">
              <div class="section-heading">
                <p class="section-kicker">Archive</p>
                <p class="section-note">An older internet rhythm, rebuilt from 2018 forward.</p>
              </div>
              ${renderArchive(config, archive)}
            </section>
          </div>

          <aside class="sidebar">
            ${config.homeNote ? `
            <section class="sidebar-block note-block">
              <p class="section-kicker">Editor's note</p>
              <p>${renderInline(config.homeNote, config)}</p>
            </section>` : ''}
            <section class="sidebar-block">
              <p class="section-kicker">About</p>
              <h2>About this notebook</h2>
              <p>${renderInline(config.author.bio, config)}</p>
            </section>
          </aside>
        </section>
      </main>`
  });
}

function displayTopic(topic = '') {
  for (const marker of [' when ', ' as ', ' after ', ' once ', ' while ', ' now that ']) {
    if (topic.includes(marker)) return topic.split(marker)[0];
  }
  return topic;
}

function renderRelated(config, post) {
  if (!Array.isArray(post.references) || !post.references.length) return '';
  return `
    <section class="related-section">
      <div class="section-heading compact">
        <p class="section-kicker">Earlier on the blog</p>
      </div>
      <ul class="related-list">
        ${post.references.map((ref) => `
          <li>
            <a href="${postUrl(config, ref.slug)}">${escapeHtml(ref.title)}</a>
            ${ref.note ? `<p>${renderInline(ref.note, config)}</p>` : ''}
          </li>`).join('')}
      </ul>
    </section>`;
}

function articlePage({ config, post }) {
  const paragraphs = paragraphsFromPost(post);
  return layout({
    title: post.title,
    config,
    body: `
      <main class="article-page">
        <p class="back-link"><a href="${siteBase(config)}">← Back to the notebook</a></p>
        <header class="article-header">
          <p class="section-kicker">${escapeHtml(formatTimestamp(post.createdAt, config.timezone))}</p>
          <h1>${escapeHtml(post.title)}</h1>
          <p class="article-deck">${renderInline(post.summary, config)}</p>
        </header>

        <div class="article-layout">
          <article class="article-body">
            ${paragraphs.map((paragraph) => `<p>${renderInline(paragraph, config)}</p>`).join('')}
            ${renderRelated(config, post)}
          </article>

          <aside class="sidebar article-sidebar">
            <section class="sidebar-block">
              <p class="section-kicker">Filed under</p>
              <p>${escapeHtml(displayTopic(post.topic))}</p>
            </section>
            <section class="sidebar-block">
              <p class="section-kicker">Published</p>
              <p>${escapeHtml(formatTimestamp(post.createdAt, config.timezone))}</p>
            </section>
          </aside>
        </div>
      </main>`
  });
}

const styles = `
:root {
  color-scheme: light;
  --page: #f6f1e8;
  --paper: #fffdf8;
  --paper-soft: #f1e6d8;
  --ink: #211c17;
  --muted: #6d6257;
  --line: #d6cab9;
  --accent: #7a4e2a;
  --display: Charter, 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  --body: Charter, 'Iowan Old Style', Georgia, serif;
  --sans: 'Avenir Next', 'Helvetica Neue', 'Segoe UI', Arial, sans-serif;
}

@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
    --page: #17130f;
    --paper: #201a15;
    --paper-soft: #261f19;
    --ink: #f4eee6;
    --muted: #b6a898;
    --line: #3d342b;
    --accent: #d0a070;
  }
}

* { box-sizing: border-box; }
html { background: var(--page); }
body {
  margin: 0;
  background: var(--page);
  color: var(--ink);
  font-family: var(--body);
  line-height: 1.8;
}

a {
  color: inherit;
  text-decoration-color: color-mix(in srgb, var(--accent) 45%, transparent);
  text-underline-offset: 0.16em;
}

a:hover { color: var(--accent); }

p, li { max-width: 70ch; }

.page-shell {
  width: min(1140px, calc(100% - 28px));
  margin: 0 auto;
  padding: 24px 0 64px;
}

.site-header,
.site-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px 20px;
  border-bottom: 1px solid var(--line);
  padding-bottom: 14px;
}

.site-header { margin-bottom: 30px; }
.site-footer {
  border-bottom: 0;
  border-top: 1px solid var(--line);
  padding-top: 14px;
  margin-top: 48px;
}

.site-header p,
.site-footer p,
.masthead-deck,
.lead-date,
.lead-summary,
.article-deck,
.read-link,
.archive-copy p,
.related-list p,
.sidebar-block p,
.article-body p,
.back-link,
.section-note,
.archive-date,
.start-list p { margin: 0; }

.brand,
.tagline,
.issue-line,
.section-kicker,
.archive-date,
.back-link {
  font-family: var(--sans);
}

.brand {
  font-size: 0.84rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  text-decoration: none;
}

.tagline,
.issue-line,
.section-kicker,
.archive-date,
.back-link,
.section-note,
.site-footer {
  color: var(--muted);
}

.tagline { font-size: 0.96rem; }
.issue-line,
.section-kicker,
.archive-date,
.back-link {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

h1, h2, h3, h4 {
  margin: 0;
  font-family: var(--display);
  font-weight: 600;
  line-height: 1.08;
  letter-spacing: -0.02em;
}

.masthead {
  border-bottom: 1px solid var(--line);
  padding-bottom: 28px;
  margin-bottom: 32px;
}

.masthead h1 {
  font-size: clamp(3.6rem, 8vw, 6.6rem);
  margin: 10px 0 14px;
}

.masthead-deck,
.lead-summary,
.article-deck {
  font-size: clamp(1.16rem, 2vw, 1.4rem);
}

.front-grid,
.article-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.9fr) minmax(240px, 0.8fr);
  gap: 34px;
}

.main-column,
.article-body { min-width: 0; }

.start-here,
.lead-story,
.sidebar-block,
.year-block,
.related-section {
  background: var(--paper);
  border: 1px solid var(--line);
}

.start-here {
  padding: 22px 24px;
  margin-bottom: 28px;
}

.start-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 14px;
}

.start-list li {
  border-top: 1px solid var(--line);
  padding-top: 14px;
}

.start-list li:first-child {
  border-top: 0;
  padding-top: 0;
}

.start-list h3 {
  font-size: 1.28rem;
  margin-bottom: 4px;
}

.lead-story {
  padding: 26px 28px;
  margin-bottom: 28px;
}

.lead-story h2,
.article-header h1 {
  font-size: clamp(2.1rem, 4.5vw, 3.9rem);
  margin: 12px 0 14px;
}

.lead-date { margin-bottom: 14px; }

.lead-body {
  display: grid;
  gap: 16px;
  margin-top: 20px;
}

.read-link {
  font-family: var(--sans);
  font-size: 0.92rem;
  font-weight: 700;
  margin-top: 18px;
}

.section-heading {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px 18px;
  margin-bottom: 14px;
}

.archive-section {
  display: grid;
  gap: 18px;
}

.year-block {
  padding: 18px 18px 8px;
}

.year-block h3 {
  font-size: 1.7rem;
  margin-bottom: 10px;
}

.year-list,
.related-list { list-style: none; padding: 0; margin: 0; }

.year-list li {
  display: grid;
  grid-template-columns: 148px minmax(0, 1fr);
  gap: 16px;
  padding: 14px 0;
  border-top: 1px solid var(--line);
}

.year-list li:first-child { border-top: 0; }

.archive-copy h4 {
  font-size: 1.28rem;
  margin-bottom: 6px;
}

.sidebar {
  display: grid;
  gap: 18px;
  align-content: start;
}

.sidebar-block {
  padding: 18px;
}

.note-block {
  background: color-mix(in srgb, var(--paper) 82%, var(--paper-soft) 18%);
}

.sidebar-block h2 { font-size: 1.8rem; margin: 8px 0 12px; }

.article-header {
  border-bottom: 1px solid var(--line);
  padding-bottom: 22px;
  margin-bottom: 26px;
}

.article-body {
  padding-right: 6px;
}

.article-body > p {
  font-size: 1.06rem;
  margin-bottom: 18px;
}

.related-section {
  padding: 18px;
  margin-top: 30px;
}

.related-list {
  display: grid;
  gap: 12px;
}

.related-list li {
  padding-top: 12px;
  border-top: 1px solid var(--line);
}

.related-list li:first-child { border-top: 0; padding-top: 0; }

@media (max-width: 980px) {
  .front-grid,
  .article-layout,
  .year-list li {
    grid-template-columns: 1fr;
  }

  .page-shell {
    width: min(100% - 22px, 1140px);
  }
}

@media (max-width: 640px) {
  .page-shell { padding: 16px 0 52px; }
  .start-here,
  .lead-story,
  .sidebar-block,
  .year-block,
  .related-section { padding: 16px; }
}
`;

async function main() {
  const config = await loadConfig();
  const posts = await loadPosts();
  await fs.rm(path.join(docsDir, 'posts'), { recursive: true, force: true });
  await fs.mkdir(path.join(docsDir, 'posts'), { recursive: true });
  await fs.mkdir(path.join(docsDir, 'assets'), { recursive: true });
  await fs.writeFile(path.join(docsDir, 'assets', 'styles.css'), styles.trim() + '\n');
  await fs.writeFile(path.join(docsDir, 'index.html'), homePage({ config, posts }));

  for (const post of posts) {
    const postDir = path.join(docsDir, 'posts', post.slug);
    await fs.mkdir(postDir, { recursive: true });
    await fs.writeFile(path.join(postDir, 'index.html'), articlePage({ config, post }));
  }

  await fs.writeFile(path.join(docsDir, 'feed.json'), JSON.stringify(posts, null, 2) + '\n');
  console.log(JSON.stringify({ ok: true, renderedPosts: posts.length, output: docsDir }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
