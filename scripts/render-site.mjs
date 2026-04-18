import fs from 'node:fs/promises';
import path from 'node:path';
import { docsDir, escapeHtml, formatTimestamp, loadConfig, loadPosts, postUrl, siteBase } from './lib/site.mjs';

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
  <div class="shell">
    <header class="site-header">
      <a class="brand" href="${base}">${escapeHtml(config.siteName)}</a>
      <p class="tagline">${escapeHtml(config.tagline)}</p>
    </header>
    ${body}
  </div>
</body>
</html>`;
}

function homePage({ config, posts }) {
  const hero = `
  <section class="hero card">
    <div>
      <p class="eyebrow">Alter ego dispatch</p>
      <h1>${escapeHtml(config.siteName)}</h1>
      <p class="lede">${escapeHtml(config.author.name)} writes on AI and logistics every 10 minutes, with a critic council keeping the takes honest.</p>
      <div class="meta-row">
        <span>Author: ${escapeHtml(config.author.name)}</span>
        <span>Cadence: every 10 min</span>
        <span>Timezone: ${escapeHtml(config.timezone)}</span>
      </div>
    </div>
    <div class="author-card">
      <h2>${escapeHtml(config.author.name)}</h2>
      <p>${escapeHtml(config.author.bio)}</p>
    </div>
  </section>`;

  const council = `
  <section class="card">
    <div class="section-head">
      <p class="eyebrow">Council of critics</p>
      <h2>Four lenses, no mercy</h2>
    </div>
    <div class="grid critics">
      ${config.council.map((critic) => `<article class="critic"><h3>${escapeHtml(critic.name)}</h3><p class="role">${escapeHtml(critic.role)}</p><p>${escapeHtml(critic.bio)}</p></article>`).join('')}
    </div>
  </section>`;

  const postCards = posts.map((post) => `
    <article class="post-card card">
      <p class="eyebrow">${escapeHtml(formatTimestamp(post.createdAt, config.timezone))}</p>
      <h2><a href="${postUrl(config, post.slug)}">${escapeHtml(post.title)}</a></h2>
      <p>${escapeHtml(post.summary)}</p>
      <p class="muted">${post.listicle.length} list points, ${post.thread.length} follow-up thoughts, provider: ${escapeHtml(post.meta?.provider || 'unknown')}</p>
    </article>`).join('');

  return layout({
    title: config.siteName,
    config,
    body: `
      ${hero}
      ${council}
      <section class="posts">
        <div class="section-head">
          <p class="eyebrow">Latest threads</p>
          <h2>Fresh dispatches from the dock</h2>
        </div>
        <div class="stack">${postCards}</div>
      </section>`
  });
}

function postPage({ config, post }) {
  const critics = post.criticNotes.map((note) => `<li><strong>${escapeHtml(note.critic)}</strong> (${escapeHtml(note.role)}): ${escapeHtml(note.note)}</li>`).join('');
  const body = `
    <article class="post-page card">
      <p class="eyebrow">${escapeHtml(formatTimestamp(post.createdAt, config.timezone))}</p>
      <h1>${escapeHtml(post.title)}</h1>
      <p class="lede">${escapeHtml(post.summary)}</p>
      <section>
        <h2>Listicle</h2>
        <ol class="listicle">${post.listicle.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol>
      </section>
      <section>
        <h2>More thoughts</h2>
        <ul class="thread">${post.thread.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      </section>
      <section>
        <h2>Council reactions</h2>
        <ul class="critics-list">${critics}</ul>
      </section>
      <p class="muted">Topic: ${escapeHtml(post.topic)} · Provider: ${escapeHtml(post.meta?.provider || 'unknown')} · Approx words: ${escapeHtml(String(post.meta?.approxWords || 0))}</p>
      <p><a href="${siteBase(config)}">← Back to home</a></p>
    </article>`;

  return layout({ title: post.title, body, config });
}

const styles = `
:root {
  color-scheme: dark;
  --bg: #05070b;
  --panel: #0f141d;
  --panel-2: rgba(255,255,255,0.03);
  --text: #eef2f8;
  --muted: #9aa5b5;
  --line: rgba(255,255,255,0.08);
  --accent: #8ac7ff;
}
* { box-sizing: border-box; }
body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif; background: radial-gradient(circle at top, rgba(138,199,255,0.12), transparent 25%), var(--bg); color: var(--text); }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
.shell { width: min(1100px, calc(100% - 32px)); margin: 0 auto; padding: 32px 0 72px; }
.site-header { padding: 12px 4px 28px; }
.brand { font-size: 14px; text-transform: uppercase; letter-spacing: 0.16em; color: var(--muted); }
.tagline { color: var(--muted); margin: 8px 0 0; }
.card { background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02)); border: 1px solid var(--line); border-radius: 24px; padding: 28px; box-shadow: 0 20px 60px rgba(0,0,0,0.25); }
.hero { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; margin-bottom: 24px; }
.author-card { background: var(--panel-2); border: 1px solid var(--line); border-radius: 18px; padding: 20px; }
.eyebrow { text-transform: uppercase; letter-spacing: 0.16em; color: var(--muted); font-size: 12px; }
h1 { font-size: clamp(48px, 10vw, 86px); line-height: 0.95; margin: 8px 0 16px; letter-spacing: -0.06em; }
h2 { font-size: clamp(24px, 3vw, 36px); margin: 6px 0 12px; }
h3 { margin-bottom: 4px; }
.lede { font-size: 20px; color: #dce4f0; max-width: 720px; }
.meta-row { display: flex; flex-wrap: wrap; gap: 12px; color: var(--muted); margin-top: 20px; }
.grid { display: grid; gap: 16px; }
.critics { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
.critic, .post-card { background: var(--panel-2); border: 1px solid var(--line); border-radius: 18px; padding: 20px; }
.role, .muted { color: var(--muted); }
.stack { display: grid; gap: 16px; }
.posts { margin-top: 24px; }
.section-head { margin-bottom: 16px; }
.post-page h1 { font-size: clamp(38px, 8vw, 72px); }
.listicle, .thread, .critics-list { display: grid; gap: 14px; color: #e8eef6; }
li { line-height: 1.6; }
@media (max-width: 800px) { .hero { grid-template-columns: 1fr; } .shell { width: min(100% - 20px, 1100px); } .card { padding: 20px; } }
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
