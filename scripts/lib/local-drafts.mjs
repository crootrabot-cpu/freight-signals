import fs from 'node:fs/promises';
import path from 'node:path';
import { loadConfig, loadPosts, postsDir, projectRoot, slugify, words, writeJson } from './site.mjs';

const draftsDir = path.join(projectRoot, 'content', 'drafts');
const publishedDraftsDir = path.join(draftsDir, 'published');

function parseHeader(lines) {
  const meta = {};
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }
    if (line.startsWith('## ')) break;
    const match = line.match(/^([A-Za-z]+):\s*(.+)$/);
    if (!match) break;
    meta[match[1].toLowerCase()] = match[2].trim();
    index += 1;
  }

  return { meta, index };
}

function parseSections(lines, startIndex) {
  const sections = {};
  let current = null;

  for (let i = startIndex; i < lines.length; i += 1) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (trimmed.startsWith('## ')) {
      current = trimmed.slice(3).trim().toLowerCase();
      sections[current] = [];
      continue;
    }
    if (!current) continue;
    if (!trimmed) continue;
    sections[current].push(trimmed);
  }

  return sections;
}

function parseBullets(lines = []) {
  return lines
    .map((line) => line.replace(/^[-*]\s+/, '').replace(/^\d+[.)]\s+/, '').trim())
    .filter(Boolean);
}

function defaultCriticNotes(config) {
  return config.council.slice(0, 3).map((critic) => ({
    critic: critic.name,
    role: critic.role,
    note: {
      throughput: 'The shift should be able to act on this without waiting for a staff meeting.',
      evidence: 'Good claim, now show the baseline and the failure mode.',
      economics: 'This gets real when the savings survive a finance review.',
      handoffs: 'Watch what happens at the carrier and customer boundary, not just inside the building.'
    }[critic.lens] || 'Make the operational consequence explicit.'
  }));
}

function parseCritics(lines, config) {
  const parsed = parseBullets(lines).map((line) => {
    const [critic, role, note] = line.split('|').map((part) => part?.trim()).filter(Boolean);
    if (!critic || !note) return null;
    return {
      critic,
      role: role || 'Council critic',
      note
    };
  }).filter(Boolean);

  return parsed.length ? parsed : defaultCriticNotes(config);
}

function normalizeTimestamp(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

async function nextDraftFile() {
  await fs.mkdir(draftsDir, { recursive: true });
  const entries = await fs.readdir(draftsDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && !entry.name.startsWith('_'))
    .map((entry) => entry.name)
    .sort();

  return files.length ? path.join(draftsDir, files[0]) : null;
}

async function moveToPublished(sourceFile, slug) {
  await fs.mkdir(publishedDraftsDir, { recursive: true });
  const destination = path.join(publishedDraftsDir, `${path.basename(sourceFile, '.md')}.${slug}.md`);
  await fs.rename(sourceFile, destination);
  return destination;
}

export async function importNextLocalDraft() {
  const sourceFile = await nextDraftFile();
  if (!sourceFile) return { kind: 'none' };

  const [config, posts, raw] = await Promise.all([
    loadConfig(),
    loadPosts(),
    fs.readFile(sourceFile, 'utf8')
  ]);

  const lines = raw.split(/\r?\n/);
  const { meta, index } = parseHeader(lines);
  const sections = parseSections(lines, index);

  const title = meta.title;
  const listicle = parseBullets(sections.listicle);
  const thread = parseBullets(sections.thread);

  if (!title) throw new Error(`Draft is missing Title: ${sourceFile}`);
  if (!listicle.length) throw new Error(`Draft is missing a ## Listicle section: ${sourceFile}`);
  if (!thread.length) throw new Error(`Draft is missing a ## Thread section: ${sourceFile}`);

  const createdAt = normalizeTimestamp(meta.date);
  const slug = `${createdAt.slice(0, 16).replace(/[-:T]/g, '')}-${slugify(title)}`;
  const post = {
    id: slug,
    slug,
    title,
    summary: meta.summary || `A field note from ${config.author.name}.`,
    topic: meta.topic || title,
    listicle,
    thread,
    criticNotes: parseCritics(sections.critics, config),
    meta: {
      provider: 'local-draft',
      approxWords: words(listicle.join(' ')),
      sequence: posts.length + 1,
      sourceFile: path.relative(projectRoot, sourceFile)
    },
    createdAt
  };

  await writeJson(path.join(postsDir, `${slug}.json`), post);
  const archivedFile = await moveToPublished(sourceFile, slug);

  return {
    kind: 'imported',
    sourceFile: path.relative(projectRoot, sourceFile),
    archivedFile: path.relative(projectRoot, archivedFile),
    post
  };
}
