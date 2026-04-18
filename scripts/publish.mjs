import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { projectRoot } from './lib/site.mjs';

const execFileAsync = promisify(execFile);

async function run(command, args) {
  const { stdout, stderr } = await execFileAsync(command, args, { cwd: projectRoot });
  if (stdout.trim()) process.stdout.write(stdout);
  if (stderr.trim()) process.stderr.write(stderr);
}

async function main() {
  await run('node', [path.join('scripts', 'generate-post.mjs')]);
  await run('node', [path.join('scripts', 'render-site.mjs')]);
  await run('git', ['add', 'content/posts', 'docs', 'config', 'scripts', 'launchd', 'README.md', '.blog.env.example', '.gitignore', 'package.json']);

  try {
    await run('git', ['commit', '-m', `post: ${new Date().toISOString()}`]);
  } catch (error) {
    const message = `${error.stdout || ''}${error.stderr || ''}`;
    if (!message.includes('nothing to commit')) throw error;
  }

  const remote = process.env.BLOG_GIT_REMOTE || 'origin';
  const branch = process.env.BLOG_GIT_BRANCH || 'main';

  try {
    await run('git', ['push', remote, branch]);
    console.log(`Pushed latest post to ${remote}/${branch}`);
  } catch (error) {
    console.log(`Push skipped or failed: ${(error.stderr || error.message).trim()}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
