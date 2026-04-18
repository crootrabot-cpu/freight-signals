# Freight Signals

A dark editorial blog about AI and logistics, written by the alter ego **Mara Vale** and checked by a fictional council of critics.

## What it does

- renders a static GitHub Pages site from JSON post files
- generates a new post every 10 minutes
- includes a 5-point listicle, 4 follow-up thread thoughts, and critic reactions
- timestamps everything in `America/Los_Angeles`
- commits and pushes after generation when a git remote exists
- can run entirely in fallback mode if no AI provider key is present

## Structure

- `content/posts/*.json` → source posts
- `content/drafts/*.md` → local hand-written drafts waiting to publish
- `docs/` → rendered static site for GitHub Pages
- `scripts/generate-post.mjs` → creates one post
- `scripts/lib/local-drafts.mjs` → imports local markdown drafts into post JSON
- `scripts/render-site.mjs` → rebuilds the site
- `scripts/publish.mjs` → generate or import + render + commit + push
- `launchd/com.croot.freight-signals.plist` → local 10-minute scheduler

## Local setup

1. Copy `.blog.env.example` to `.blog.env`
2. Optional: add one provider key if you want live AI writing:
   - `OPENAI_API_KEY`
   - `ANTHROPIC_API_KEY`
   - `GEMINI_API_KEY`
3. Set `BLOG_SOURCE_MODE`:
   - `local-only` → publish only hand-written drafts from `content/drafts/`
   - `local-first` → publish drafts first, then fall back to generated posts
   - `generate-only` → always generate posts
4. Optional: set `BLOG_AI_PROVIDER=openai|anthropic|gemini|fallback`

## Commands

```bash
npm run generate       # create one post JSON
npm run build          # render docs/
npm run publish:local  # publish the next local draft only
npm run publish:once   # publish according to BLOG_SOURCE_MODE
npm run timer:start    # load launchd timer and run immediately
npm run timer:status   # inspect timer
npm run timer:stop     # stop timer
```

## Writing locally instead of using an API key

Drop a markdown file into `content/drafts/` using this shape:

```md
Title: Your post title
Summary: One sentence summary
Topic: Optional topic label
Date: Optional ISO timestamp

## Listicle
- Point one
- Point two
- Point three
- Point four
- Point five

## Thread
- Follow-up thought one
- Follow-up thought two
- Follow-up thought three
- Follow-up thought four

## Critics
- Rhea Coil | The Floor Lead | This survives contact with the shift.
- Jonah Slate | The Systems Skeptic | Show the baseline before the boast.
- Priya March | The Margin Hawk | Good, now prove the margin impact.
```

Then either:

- run `npm run publish:local` once, or
- set `BLOG_SOURCE_MODE=local-only` and let the timer publish the next pending draft every 10 minutes

Published drafts are moved to `content/drafts/published/` after import.

## GitHub Pages

Create a public repo, push this project, then enable Pages from the `docs/` folder on `main`.
The default site path is `/freight-signals/`. If the repo name changes, update `config/site.json`.

## Notes

- If no provider key exists, generated mode falls back to a deterministic local writer.
- If you want the site to publish only your own writing, use `BLOG_SOURCE_MODE=local-only`.
- Pushes are attempted against `origin main` by default. Override with `BLOG_GIT_REMOTE` and `BLOG_GIT_BRANCH` in `.blog.env`.
- Logs land in `logs/publisher.log`, `logs/launchd.out.log`, and `logs/launchd.err.log`.
