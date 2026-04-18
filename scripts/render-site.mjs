import fs from 'node:fs/promises';
import path from 'node:path';
import { docsDir, escapeHtml, formatTimestamp, loadConfig, loadPosts, postUrl, siteBase } from './lib/site.mjs';

function renderPostMeta(post, config) {
  return `<div class="post-meta"><span>${escapeHtml(formatTimestamp(post.createdAt, config.timezone))}</span><span>${escapeHtml(post.topic)}</span><span>${escapeHtml(post.meta?.provider || 'unknown')}</span></div>`;
}

function layout({ title, body, config }) {
  const base = siteBase(config);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} | ${escapeHtml(config.siteName)}</title>
  <meta name="description" content="${escapeHtml(config.tagline)}" />
  <link rel="stylesheet" href="${base}assets/styles.css" />
</head>
<body>
  <div class="page-shell">
    <header class="site-header">
      <div class="site-header-row">
        <a class="brand" href="${base}">${escapeHtml(config.siteName)}</a>
        <p class="tagline">${escapeHtml(config.tagline)}</p>
      </div>
    </header>
    ${body}
    <footer class="site-footer">
      <p>Written by ${escapeHtml(config.author.name)}. Critiqued by the council. Rendered in ${escapeHtml(config.timezone)}.</p>
    </footer>
  </div>
</body>
</html>`;
}

function homePage({ config, posts }) {
  const [lead, ...archive] = posts;
  const archiveMarkup = archive.slice(0, 18).map((post) => `
    <li class="archive-item">
      <p class="archive-date">${escapeHtml(formatTimestamp(post.createdAt, config.timezone))}</p>
      <div>
        <h3><a href="${postUrl(config, post.slug)}">${escapeHtml(post.title)}</a></h3>
        <p>${escapeHtml(post.summary)}</p>
      </div>
    </li>`).join('');

  const councilMarkup = config.council.map((critic) => `
    <li>
      <h3>${escapeHtml(critic.name)}</h3>
      <p class="rail-role">${escapeHtml(critic.role)}</p>
      <p>${escapeHtml(critic.bio)}</p>
    </li>`).join('');

  const leadMarkup = lead ? `
    <article class="lead-story">
      <p class="kicker">Latest dispatch</p>
      <h2><a href="${postUrl(config, lead.slug)}">${escapeHtml(lead.title)}</a></h2>
      <p class="lead-summary">${escapeHtml(lead.summary)}</p>
      ${renderPostMeta(lead, config)}
      <ol class="lead-points">
        ${lead.listicle.slice(0, 3).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
      </ol>
      <p class="lead-link"><a href="${postUrl(config, lead.slug)}">Read the full thread</a></p>
    </article>` : '<p>No posts yet.</p>';

  return layout({
    title: config.siteName,
    config,
    body: `
      <main class="front-page">
        <section class="masthead">
          <p class="issue-line">Issue ${posts.length || 0} · Updated ${escapeHtml(formatTimestamp(posts[0]?.createdAt || new Date().toISOString(), config.timezone))}</p>
          <h1>${escapeHtml(config.siteName)}</h1>
          <p class="masthead-deck">A sharp, skeptical notebook on AI, written for people who want mechanisms instead of slogans. ${escapeHtml(config.author.name)} writes in public, then lets the council pull at the loose threads.</p>
        </section>

        <section class="front-grid">
          <div class="primary-column">
            ${leadMarkup}
            <section class="archive-section">
              <div class="section-label-row">
                <p class="section-label">Archive</p>
                <p class="section-note">Recent pieces, newest first.</p>
              </div>
              <ul class="archive-list">${archiveMarkup}</ul>
            </section>
          </div>

          <aside class="rail">
            <section class="rail-block author-block">
              <p class="section-label">About the columnist</p>
              <h2>${escapeHtml(config.author.name)}</h2>
              <p>${escapeHtml(config.author.bio)}</p>
            </section>

            <section class="rail-block">
              <div class="section-label-row">
                <p class="section-label">Council of critics</p>
                <p class="section-note">Four recurring lenses.</p>
              </div>
              <ul class="council-list">${councilMarkup}</ul>
            </section>

            <section class="rail-block process-block">
              <p class="section-label">Publishing rhythm</p>
              <p>New entries land every ten minutes. The front page stays spare on purpose, so the writing does the work.</p>
            </section>
          </aside>
        </section>
      </main>`
  });
}

function postPage({ config, post }) {
  const critics = post.criticNotes.map((note) => `
    <li>
      <h3>${escapeHtml(note.critic)}</h3>
      <p class="rail-role">${escapeHtml(note.role)}</p>
      <p>${escapeHtml(note.note)}</p>
    </li>`).join('');

  const body = `
    <main class="article-page">
      <p class="back-link"><a href="${siteBase(config)}">← Back to front page</a></p>

      <header class="article-header">
        <p class="kicker">${escapeHtml(formatTimestamp(post.createdAt, config.timezone))}</p>
        <h1>${escapeHtml(post.title)}</h1>
        <p class="article-deck">${escapeHtml(post.summary)}</p>
        ${renderPostMeta(post, config)}
      </header>

      <div class="article-layout">
        <article class="article-main">
          <section class="story-section">
            <div class="section-label-row">
              <p class="section-label">Listicle</p>
              <p class="section-note">Five points, written to be read in one sitting.</p>
            </div>
            <ol class="numbered-list">
              ${post.listicle.map((item, index) => `
                <li>
                  <span class="list-number">${String(index + 1).padStart(2, '0')}</span>
                  <p>${escapeHtml(item)}</p>
                </li>`).join('')}
            </ol>
          </section>

          <section class="story-section">
            <div class="section-label-row">
              <p class="section-label">Thread</p>
              <p class="section-note">Loose ends, counterpoints, and afterthoughts.</p>
            </div>
            <ul class="thread-list">${post.thread.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
          </section>
        </article>

        <aside class="article-rail">
          <section class="rail-block">
            <p class="section-label">Story notes</p>
            <dl class="story-notes">
              <div><dt>Topic</dt><dd>${escapeHtml(post.topic)}</dd></div>
              <div><dt>Provider</dt><dd>${escapeHtml(post.meta?.provider || 'unknown')}</dd></div>
              <div><dt>Approx words</dt><dd>${escapeHtml(String(post.meta?.approxWords || 0))}</dd></div>
            </dl>
          </section>

          <section class="rail-block">
            <div class="section-label-row">
              <p class="section-label">Council reactions</p>
              <p class="section-note">The recurring objections.</p>
            </div>
            <ul class="council-list">${critics}</ul>
          </section>
        </aside>
      </div>
    </main>`;

  return layout({ title: post.title, body, config });
}

const styles = `
:root {
  color-scheme: dark;
  --bg: #14110f;
  --bg-soft: #1b1714;
  --panel: #171311;
  --panel-soft: #201b17;
  --text: #f4efe7;
  --muted: #c9bba8;
  --line: #3d342c;
  --line-soft: #2c2520;
  --accent: #d6a15d;
  --accent-soft: #8b6841;
  --display: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
  --body: "Avenir Next", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
}

* { box-sizing: border-box; }
html { background: var(--bg); }
body {
  margin: 0;
  background:
    linear-gradient(to bottom, rgba(214,161,93,0.04), transparent 220px),
    radial-gradient(circle at top left, rgba(214,161,93,0.07), transparent 28%),
    var(--bg);
  color: var(--text);
  font-family: var(--body);
  line-height: 1.65;
}

a {
  color: inherit;
  text-decoration-color: rgba(214,161,93,0.5);
  text-underline-offset: 0.18em;
}

a:hover {
  color: #f7d7ad;
}

p, li {
  max-width: 72ch;
}

.page-shell {
  width: min(1240px, calc(100% - 40px));
  margin: 0 auto;
  padding: 20px 0 72px;
}

.site-header {
  border-bottom: 1px solid var(--line);
  margin-bottom: 32px;
  padding-bottom: 18px;
}

.site-header-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px 24px;
}

.brand {
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--muted);
  text-decoration: none;
}

.tagline {
  margin: 0;
  color: var(--muted);
  font-size: 0.95rem;
}

.masthead {
  border-bottom: 1px solid var(--line);
  padding-bottom: 32px;
  margin-bottom: 34px;
}

.issue-line,
.kicker,
.section-label,
.archive-date,
.post-meta,
.section-note,
.rail-role,
.back-link {
  color: var(--muted);
  font-size: 0.83rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1,
h2,
h3 {
  font-family: var(--display);
  font-weight: 600;
  line-height: 1.02;
  letter-spacing: -0.02em;
  margin: 0;
}

.masthead h1 {
  font-size: clamp(4rem, 10vw, 8.2rem);
  margin: 12px 0 14px;
}

.masthead-deck {
  font-size: clamp(1.18rem, 2vw, 1.5rem);
  color: #efe4d5;
  margin: 0;
  max-width: 46rem;
}

.front-grid,
.article-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.8fr) minmax(280px, 0.95fr);
  gap: 38px;
}

.primary-column,
.article-main {
  min-width: 0;
}

.lead-story {
  padding-bottom: 28px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 36px;
}

.lead-story h2,
.article-header h1 {
  font-size: clamp(2.5rem, 5vw, 4.5rem);
  margin: 10px 0 16px;
}

.lead-summary,
.article-deck {
  font-size: 1.2rem;
  color: #efe4d5;
  margin: 0 0 18px;
}

.post-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 18px;
  margin: 0 0 22px;
}

.post-meta span:not(:last-child)::after {
  content: "•";
  margin-left: 18px;
  color: var(--accent-soft);
}

.lead-points,
.archive-list,
.council-list,
.thread-list,
.numbered-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.lead-points {
  display: grid;
  gap: 16px;
  margin: 0 0 18px;
}

.lead-points li {
  padding-left: 18px;
  border-left: 2px solid var(--accent-soft);
  color: #f0e7dc;
}

.lead-link {
  margin: 0;
  font-weight: 600;
}

.section-label-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px 18px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line-soft);
  margin-bottom: 18px;
}

.section-note {
  margin: 0;
}

.archive-list {
  display: grid;
  gap: 0;
}

.archive-item {
  display: grid;
  grid-template-columns: 170px minmax(0, 1fr);
  gap: 18px;
  padding: 18px 0;
  border-bottom: 1px solid var(--line-soft);
}

.archive-item h3 {
  font-size: clamp(1.35rem, 2vw, 1.9rem);
  margin-bottom: 8px;
}

.archive-item p {
  margin: 0;
}

.rail,
.article-rail {
  display: grid;
  gap: 20px;
  align-content: start;
}

.rail-block {
  background: rgba(255,255,255,0.02);
  border: 1px solid var(--line-soft);
  padding: 18px 18px 20px;
}

.author-block h2 {
  font-size: 2rem;
  margin: 10px 0 12px;
}

.council-list {
  display: grid;
  gap: 18px;
}

.council-list h3 {
  font-size: 1.18rem;
  margin-bottom: 6px;
}

.council-list p {
  margin: 0;
}

.article-page {
  padding-bottom: 24px;
}

.back-link {
  margin: 0 0 18px;
}

.article-header {
  border-bottom: 1px solid var(--line);
  padding-bottom: 24px;
  margin-bottom: 30px;
}

.story-section + .story-section {
  margin-top: 34px;
}

.numbered-list {
  display: grid;
  gap: 18px;
}

.numbered-list li {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  gap: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--line-soft);
}

.list-number {
  color: var(--accent);
  font-family: var(--body);
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.14em;
}

.numbered-list p,
.thread-list li {
  margin: 0;
  font-size: 1.02rem;
  color: #f0e7dc;
}

.thread-list {
  display: grid;
  gap: 14px;
}

.thread-list li {
  padding-left: 18px;
  border-left: 2px solid var(--line);
}

.story-notes {
  display: grid;
  gap: 14px;
  margin: 0;
}

.story-notes div {
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line-soft);
}

.story-notes dt {
  color: var(--muted);
  font-size: 0.82rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.story-notes dd {
  margin: 0;
  color: var(--text);
}

.site-footer {
  border-top: 1px solid var(--line);
  margin-top: 44px;
  padding-top: 16px;
  color: var(--muted);
  font-size: 0.92rem;
}

.site-footer p {
  margin: 0;
}

@media (max-width: 980px) {
  .front-grid,
  .article-layout,
  .archive-item {
    grid-template-columns: 1fr;
  }

  .page-shell {
    width: min(100% - 24px, 1240px);
  }

  .masthead h1,
  .lead-story h2,
  .article-header h1 {
    line-height: 1.04;
  }
}

@media (max-width: 640px) {
  .page-shell {
    padding-top: 14px;
    padding-bottom: 56px;
  }

  .site-header {
    margin-bottom: 22px;
    padding-bottom: 14px;
  }

  .masthead {
    padding-bottom: 24px;
    margin-bottom: 28px;
  }

  .lead-story {
    margin-bottom: 28px;
    padding-bottom: 22px;
  }

  .rail-block {
    padding: 16px;
  }

  .numbered-list li {
    grid-template-columns: 38px 1fr;
    gap: 12px;
  }
}
`;

async function main() {
  const config = await loadConfig();
  const posts = await loadPosts();
  await fs.mkdir(path.join(docsDir, 'posts'), { recursive: true });
  await fs.mkdir(path.join(docsDir, 'assets'), { recursive: true });
  await fs.writeFile(path.join(docsDir, 'assets', 'styles.css'), styles.trim() + '\n');
  await fs.writeFile(path.join(docsDir, 'index.html'), homePage({ config, posts }));

  for (const post of posts) {
    const postDir = path.join(docsDir, 'posts', post.slug);
    await fs.mkdir(postDir, { recursive: true });
    await fs.writeFile(path.join(postDir, 'index.html'), postPage({ config, post }));
  }

  await fs.writeFile(path.join(docsDir, 'feed.json'), JSON.stringify(posts, null, 2) + '\n');
  console.log(JSON.stringify({ ok: true, renderedPosts: posts.length, output: docsDir }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
