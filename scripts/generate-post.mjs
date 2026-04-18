import fs from 'node:fs/promises';
import path from 'node:path';
import { loadConfig, loadPosts, postsDir, slugify, words, writeJson } from './lib/site.mjs';
import { generateWithProvider } from './lib/llm.mjs';

function fallbackPost({ topic, config, createdAt, postNumber }) {
  const items = [
    `Start with the observation, not the claim. What did the model actually do — token by token, example by example — and what would we expect if the story being told about it were true?`,
    `A benchmark is a telescope pointed at one sliver of sky. Useful, but the trap is mistaking the sliver for the whole. Ask what the number cannot see before you ask what it says.`,
    `"The model learned X" is almost always shorthand for "on our eval, outputs look consistent with X." That gap is where most confident AI writing quietly lives, and where most real disagreement hides.`,
    `The honest move is to name the one experiment that would change your mind. If you can't name it, you're not claiming something about the world — you're claiming something about your mood.`,
    `Simplicity is a tell. If a result needs scaffolding, caveats, and a particular prompt to reproduce, that's data. Not bad data — just data about how narrow the finding really is.`
  ];

  const thread = [
    `1/4 ${topic}: before the take, the observation. What are we actually looking at, in plain terms, with nothing assumed?`,
    `2/4 The claim being made is usually broader than the evidence supports. That's not dishonesty — it's the ordinary friction between what we measure and what we mean.`,
    `3/4 A good question to sit with: what would have to be true for this to be wrong? If nothing would make you update, it isn't really a belief, it's a vibe.`,
    `4/4 The Feynman move is to keep asking "but why" until the jargon runs out. Whatever survives that is worth writing down.`
  ];

  return {
    title: `Five plain-language notes on ${topic.toLowerCase()}`,
    summary: `A short, first-principles pass from ${config.author.name} on ${topic.toLowerCase()}.`,
    listicle: items,
    thread,
    criticNotes: config.council.slice(0, 3).map((critic, index) => ({
      critic: critic.name,
      role: critic.role,
      note: [
        'What is the observation underneath the claim? Strip the nouns and look again.',
        'Name the eval, the baseline, and the delta. Without those three, the number is decoration.',
        'If a curious twelve-year-old asked "but why does that work?" — could you answer without jargon?'
      ][index]
    })),
    meta: {
      provider: 'fallback',
      approxWords: words(items.join(' ')),
      sequence: postNumber
    },
    createdAt
  };
}

function promptFor(topic, config, createdAt, postNumber) {
  return `You are ${config.author.name}, an alter-ego columnist writing about AI the way Richard Feynman approached physics: from curiosity, not authority. Plain language, first principles, mechanisms over marketing, "I don't know" over false certainty.
Return only JSON.

Context:
- Site: ${config.siteName}
- Author bio: ${config.author.bio}
- Topic: ${topic}
- Post number: ${postNumber}
- Timestamp: ${createdAt}
- Timezone: ${config.timezone}
- Council of critics: ${config.council.map((critic) => `${critic.name} (${critic.role}, lens: ${critic.lens})`).join('; ')}

Requirements:
- JSON object with keys: title, summary, listicle, thread, criticNotes
- title: sharp, plain-language headline, under 90 characters. No clickbait, no "X things you won't believe".
- summary: 1 sentence, honest and specific
- listicle: array of exactly 5 bullet strings totaling about 150 words combined
- thread: array of exactly 4 short follow-up thoughts that extend the reasoning
- criticNotes: array of exactly 3 objects with keys critic, role, note — each critic pushes back in their own lens
- Subject matter: AI broadly — models, research, evaluation, reasoning, scaling, claims-vs-evidence. Not pack stations, not warehouses, not logistics.
- Voice: curious and careful. Prefer "here is the observation, here is the claim, here is the gap." Use analogies from physics, biology, or everyday life when they actually clarify. Say "I don't know" when that is the truthful answer.
- Avoid: hype language, hashtags, buzzwords, corporate tone, fake-confident pronouncements, filler like "in today's fast-paced world"
`;
}

async function main() {
  const config = await loadConfig();
  const posts = await loadPosts();
  const topicPool = config.topics;
  const topic = topicPool[posts.length % topicPool.length];
  const createdAt = new Date().toISOString();
  const postNumber = posts.length + 1;

  let generated;
  try {
    generated = await generateWithProvider(promptFor(topic, config, createdAt, postNumber));
    generated.meta = {
      ...(generated.meta || {}),
      provider: process.env.BLOG_AI_PROVIDER || (process.env.ARK_API_KEY ? 'ark' : process.env.OPENAI_API_KEY ? 'openai' : process.env.ANTHROPIC_API_KEY ? 'anthropic' : process.env.GEMINI_API_KEY ? 'gemini' : 'fallback'),
      approxWords: words((generated.listicle || []).join(' ')),
      sequence: postNumber
    };
    generated.createdAt = createdAt;
  } catch (error) {
    generated = fallbackPost({ topic, config, createdAt, postNumber });
    generated.meta.error = error.message;
  }

  const slug = `${createdAt.slice(0, 16).replace(/[-:T]/g, '')}-${slugify(generated.title)}`;
  const post = {
    id: slug,
    slug,
    topic,
    ...generated
  };

  const filePath = path.join(postsDir, `${slug}.json`);
  await writeJson(filePath, post);
  console.log(JSON.stringify({ ok: true, filePath, title: post.title, provider: post.meta.provider, words: post.meta.approxWords }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
