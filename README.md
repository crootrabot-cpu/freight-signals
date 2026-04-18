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
- `docs/` → rendered static site for GitHub Pages
- `scripts/generate-post.mjs` → creates one post
- `scripts/render-site.mjs` → rebuilds the site
- `scripts/publish.mjs` → generate + render + commit + push
- `launchd/com.croot.freight-signals.plist` → local 10-minute scheduler

## Local setup

1. Copy `.blog.env.example` to `.blog.env`
2. Add one provider key if you want live AI writing:
   - `OPENAI_API_KEY`
   - `ANTHROPIC_API_KEY`
   - `GEMINI_API_KEY`
3. Optional: set `BLOG_AI_PROVIDER=openai|anthropic|gemini|fallback`

## Commands

```bash
npm run generate       # create one post JSON
npm run build          # render docs/
npm run publish:once   # generate, render, commit, push
npm run timer:start    # load launchd timer and run immediately
npm run timer:status   # inspect timer
npm run timer:stop     # stop timer
```

## GitHub Pages

Create a public repo, push this project, then enable Pages from the `docs/` folder on `main`.
The default site path is `/freight-signals/`. If the repo name changes, update `config/site.json`.

## Notes

- If no provider key exists, the generator falls back to a deterministic local writer so the timer still produces posts.
- Pushes are attempted against `origin main` by default. Override with `BLOG_GIT_REMOTE` and `BLOG_GIT_BRANCH` in `.blog.env`.
- Logs land in `logs/publisher.log`, `logs/launchd.out.log`, and `logs/launchd.err.log`.
