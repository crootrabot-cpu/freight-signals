import fs from 'node:fs/promises';
import path from 'node:path';

export const projectRoot = path.resolve(new URL('../../', import.meta.url).pathname);
export const configPath = path.join(projectRoot, 'config', 'site.json');
export const postsDir = path.join(projectRoot, 'content', 'posts');
export const docsDir = path.join(projectRoot, 'docs');

export async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

export async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2) + '\n');
}

export async function loadConfig() {
  return readJson(configPath);
}

export async function loadPosts() {
  await fs.mkdir(postsDir, { recursive: true });
  const files = (await fs.readdir(postsDir)).filter((file) => file.endsWith('.json')).sort();
  const posts = [];
  for (const file of files) {
    posts.push(await readJson(path.join(postsDir, file)));
  }
  return posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function slugify(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function formatTimestamp(dateString, timeZone = 'America/Los_Angeles') {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(new Date(dateString));
}

export function words(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function ensureLeadingSlash(value) {
  if (!value.startsWith('/')) return `/${value}`;
  return value;
}

export function ensureTrailingSlash(value) {
  return value.endsWith('/') ? value : `${value}/`;
}

export function siteBase(config) {
  return ensureTrailingSlash(ensureLeadingSlash(config.sitePath || '/'));
}

export function postUrl(config, slug) {
  return `${siteBase(config)}posts/${slug}/`;
}

export function escapeHtml(value = '') {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
