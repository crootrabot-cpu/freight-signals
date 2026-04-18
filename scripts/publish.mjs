import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { projectRoot } from './lib/site.mjs';
import { importNextLocalDraft } from './lib/local-drafts.mjs';

const execFileAsync = promisify(execFile);

async function run(command, args) {
  const { stdout, stderr } = await execFileAsync(command, args, { cwd: projectRoot });
  if (stdout.trim()) process.stdout.write(stdout);
  if (stderr.trim()) process.stderr.write(stderr);
}

async function main() {
  const nodeBin = process.execPath;
  const mode = process.env.BLOG_SOURCE_MODE || 'generate-only';
  const useLocalDrafts = mode === 'local-only' || mode === 'local-first';
  const localResult = useLocalDrafts ? await importNextLocalDraft() : { kind: 'none' };

  if (localResult.kind === 'none' && mode === 'local-only') {
    console.log('No pending local drafts to publish.');
    return;
  }

  if (localResult.kind === 'none') {
    await run(nodeBin, [path.join('scripts', 'generate-post.mjs')]);
  } else {
    console.log(`Imported local draft: ${localResult.sourceFile}`);
  }

  await run(nodeBin, [path.join('scripts', 'render-site.mjs')]);
  await run('git', ['add', 'content/posts', 'content/drafts', 'docs', 'config', 'scripts', 'launchd', 'README.md', '.blog.env.example', '.gitignore', 'package.json']);

  try {
    await run('git', ['commit', '-m', `post: ${new Date().toISOString()}`]);
  } catch (error) {
    const message = `${error.stdout || ''}${error.stderr || ''}`;
    if (!message.includes('nothing to commit')) throw error;
  }

  const remote = process.env.BLOG_GIT_REMOTE || 'origin';
  const branch = process.env.BLOG_GIT_BRANCH || 'main';

  async function pushWithRebaseRetry(attempt = 1) {
    try {
      await run('git', ['push', remote, branch]);
      console.log(`Pushed latest post to ${remote}/${branch}`);
    } catch (error) {
      const msg = `${error.stderr || ''}${error.stdout || ''}${error.message || ''}`;
      const nonFF = /non-fast-forward|rejected|fetch first/i.test(msg);
      if (nonFF && attempt <= 2) {
        console.log(`Push rejected (attempt ${attempt}); rebasing on ${remote}/${branch} and retrying`);
        try {
          await run('git', ['fetch', remote, branch]);
          await run('git', ['rebase', `${remote}/${branch}`]);
        } catch (rebaseErr) {
          const rmsg = (rebaseErr.stderr || rebaseErr.message || '').toString().trim();
          console.log(`Rebase failed: ${rmsg}`);
          try { await run('git', ['rebase', '--abort']); } catch {}
          return;
        }
        return pushWithRebaseRetry(attempt + 1);
      }
      console.log(`Push failed: ${msg.trim()}`);
    }
  }

  await pushWithRebaseRetry();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
