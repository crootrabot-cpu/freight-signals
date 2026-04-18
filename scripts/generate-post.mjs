import fs from 'node:fs/promises';
import path from 'node:path';
import { loadConfig, loadPosts, postsDir, slugify, words, writeJson } from './lib/site.mjs';
import { generateWithProvider } from './lib/llm.mjs';

function fallbackPost({ topic, config, createdAt, postNumber }) {
  const items = [
    `Operators trust AI faster when it explains what changed at the station, not when it just drops a score. In logistics, context beats confidence theater because frontline teams need usable evidence, not mysterious certainty.`,
    `The best warehouse AI does less pretending and more timestamping. A clean event trail helps supervisors coach faster, defend claims, isolate repeat errors, and see friction before it hardens into cost or customer pain.`,
    `Every automation pitch should survive one blunt question: does it reduce rework on a bad Tuesday? If not, it is probably decoration disguised as transformation, which is expensive language for software that never earns floor trust.`,
    `Vision and language models matter most when they shorten the gap between an exception and a decision. Good tools compress confusion, speed escalation paths, and preserve labor dignity instead of smothering people in ambiguous alerts.`,
    `The winners in logistics AI will be the teams that pair clear proof with humane operations. Better evidence creates calmer floors, tighter handoffs, stronger margins, and a better story when something goes wrong downstream.`
  ];

  const thread = [
    `Thread 1/${4}: ${topic} is really a question about operational trust. Warehouses already know how to spot fluff.`,
    `Thread 2/${4}: Every new system competes with habit, muscle memory, and shift pressure. If it slows the floor, it loses.`,
    `Thread 3/${4}: The quiet superpower is replayability. Teams improve faster when they can revisit what happened without blame theater.`,
    `Thread 4/${4}: That is why AI in logistics becomes real only when it changes coaching, claims, and staffing decisions.`
  ];

  return {
    title: `5 takeaways on ${topic.toLowerCase()}`,
    summary: `A quick field note from ${config.author.name} on ${topic.toLowerCase()}.`,
    listicle: items,
    thread,
    criticNotes: config.council.slice(0, 3).map((critic, index) => ({
      critic: critic.name,
      role: critic.role,
      note: [
        'This only matters if the station lead can act on it mid-shift.',
        'Show the baseline before you celebrate the model.',
        'If the claim rate drops, finance will notice before marketing does.'
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
  return `You are ${config.author.name}, an alter-ego columnist writing about AI and logistics in a sharp trade-journal voice.
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
- title: sharp headline, under 90 characters
- summary: 1 sentence
- listicle: array of exactly 5 bullet strings totaling about 150 words combined
- thread: array of exactly 4 short thread-style follow-up thoughts
- criticNotes: array of exactly 3 objects with keys critic, role, note
- Focus on AI and logistics, concrete operations, no fluff, no hashtags
- Voice: informed, skeptical, vivid, useful
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
