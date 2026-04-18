import path from 'node:path';
import { loadConfig, loadPosts, postsDir, slugify, words, writeJson } from './lib/site.mjs';
import { generateWithProvider } from './lib/llm.mjs';

const STYLE_ROTATIONS = [
  {
    titleTemplates: [
      (topic) => `A cleaner way to think about ${topic.toLowerCase()}`,
      (topic) => `What ${topic.toLowerCase()} gets wrong`,
      (topic) => `The mistake hiding inside ${topic.toLowerCase()}`
    ],
    listicle: (topic) => [
      `Most arguments about ${topic.toLowerCase()} start one step too late. They begin with the claim instead of the observation that is supposed to justify it.`,
      `Once you separate what was seen from what was inferred, the whole subject becomes calmer. A lot of apparent certainty turns out to be narration glued onto a thinner result.`,
      `The useful question is not “is this impressive?” but “what changed in my model of the world after seeing it?” If the answer is vague, the evidence probably is too.`,
      `Good writing on AI earns trust by naming the weak joints. Where would this break, fail to generalize, or quietly depend on setup choices that disappear from the headline?`,
      `A topic becomes clearer when you can explain it without prestige words. If the plain version sounds flimsy, the dressed-up version probably was too.`
    ],
    thread: (topic) => [
      `1/4 ${topic} gets easier to think about when you separate the thing that happened from the story told about it.`,
      `2/4 A lot of “insight” is just compression. Useful, sometimes, but still not explanation.`,
      `3/4 The honest move is to say what would change your mind. Otherwise you are defending a mood, not a view.`,
      `4/4 The whole point of writing clearly is to make disagreement cheaper.`
    ]
  },
  {
    titleTemplates: [
      (topic) => `A field note on ${topic.toLowerCase()}`,
      (topic) => `What I keep noticing about ${topic.toLowerCase()}`,
      (topic) => `Five notes after sitting with ${topic.toLowerCase()}`
    ],
    listicle: (topic) => [
      `The first thing I look for in ${topic.toLowerCase()} is whether the author is showing me a mechanism or just a result. Results travel faster, but mechanisms survive longer.`,
      `A good topic repays boredom. If you can keep staring at the unglamorous part, like setup choices or hidden assumptions, the real shape of the thing starts to appear.`,
      `People often confuse a useful shorthand with a faithful explanation. That mistake spreads especially fast in AI because the language is already half metaphor.`,
      `One reason claims drift is that a term starts narrow, then gets used socially, then gets used commercially. By the end everyone is using the same word for different objects.`,
      `Clearer writing usually means smaller claims. That is not a weakness. It is how you leave room for the next observation to matter.`
    ],
    thread: (topic) => [
      `1/4 My bias with ${topic} is to stay close to the concrete details for as long as possible.`,
      `2/4 The abstract story almost always sounds cleaner than the underlying evidence. That is exactly why it needs resistance.`,
      `3/4 If two people seem to disagree violently, they are often protecting different definitions of the same word.`,
      `4/4 Good essays slow the reader down at the right place.`
    ]
  },
  {
    titleTemplates: [
      (topic) => `The useful question inside ${topic.toLowerCase()}`,
      (topic) => `How I would test ${topic.toLowerCase()}`,
      (topic) => `What would actually settle ${topic.toLowerCase()}`
    ],
    listicle: (topic) => [
      `Every interesting AI topic hides an experiment inside it. With ${topic.toLowerCase()}, the first job is to name the observation that would genuinely distinguish between the competing stories.`,
      `Without that discriminating test, people keep arguing with examples that can be absorbed by almost any theory. The conversation looks active while the understanding stays flat.`,
      `A useful test has edges. It should be possible for one side to lose cleanly instead of retreating into interpretation or rhetorical smoke.`,
      `This is why a lot of AI commentary feels circular. The claims are broad, the evidence is narrow, and the proposed checks are too forgiving to force an update.`,
      `The antidote is modesty with structure: smaller claims, sharper tests, and a willingness to say the current evidence does not settle the question.`
    ],
    thread: (topic) => [
      `1/4 The fastest route to clarity on ${topic} is to ask which test would actually hurt your preferred story.`,
      `2/4 If every possible result can be interpreted as support, you do not have a serious test yet.`,
      `3/4 AI writing improves when it treats uncertainty as information rather than embarrassment.`,
      `4/4 The point is not to sound decisive. It is to become harder to fool.`
    ]
  },
  {
    titleTemplates: [
      (topic) => `Why ${topic.toLowerCase()} keeps getting overstated`,
      (topic) => `The awkward truth about ${topic.toLowerCase()}`,
      (topic) => `What people skip when they talk about ${topic.toLowerCase()}`
    ],
    listicle: (topic) => [
      `The easiest way to overstate ${topic.toLowerCase()} is to ignore what had to be held constant to make the result appear. Constraints disappear first in retellings.`,
      `Once a claim becomes socially useful, people stop checking whether the original evidence still carries the weight now placed on it. Popularity is not support, it is pressure.`,
      `This is why repetition is dangerous. A sentence can start sounding established simply because the wording is familiar, even when the underlying object remains unsettled.`,
      `The better move is to keep asking what, exactly, is being claimed. Not approximately. Not aspirationally. Precisely enough that a counterexample could exist.`,
      `A lot of sober thinking is just refusing free upgrades. If the evidence supports a narrow statement, let it stay narrow until something stronger arrives.`
    ],
    thread: (topic) => [
      `1/4 Overstatement is not always hype. Sometimes it is just linguistic drift left unattended.`,
      `2/4 A sentence can stay grammatical long after it stops being careful.`,
      `3/4 Writing improves when the claim gets harder while the prose stays simple.`,
      `4/4 Precision is not the enemy of readability. It is what keeps readability honest.`
    ]
  }
];

function normalize(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function chooseTopic(topicPool, posts) {
  const recentTopics = new Set(posts.slice(0, 6).map((post) => normalize(post.topic || '')));
  const candidate = topicPool.find((topic) => !recentTopics.has(normalize(topic)));
  return candidate || topicPool[posts.length % topicPool.length];
}

function pickTitle(topic, recentTitles, rotation) {
  for (const makeTitle of rotation.titleTemplates) {
    const candidate = makeTitle(topic);
    if (!recentTitles.has(normalize(candidate))) return candidate;
  }
  return `${rotation.titleTemplates[0](topic)} today`;
}

function fallbackPost({ topic, config, createdAt, postNumber, recentTitles }) {
  const rotation = STYLE_ROTATIONS[(postNumber - 1) % STYLE_ROTATIONS.length];
  const title = pickTitle(topic, recentTitles, rotation);
  const listicle = rotation.listicle(topic);
  const thread = rotation.thread(topic);

  return {
    title,
    summary: `A short essay from ${config.author.name} on ${topic.toLowerCase()}, written to make the claim smaller and the picture clearer.`,
    listicle,
    thread,
    criticNotes: [],
    meta: {
      provider: 'fallback',
      approxWords: words(listicle.join(' ')),
      sequence: postNumber
    },
    createdAt
  };
}

function promptFor(topic, config, createdAt, postNumber, posts) {
  const rotation = STYLE_ROTATIONS[(postNumber - 1) % STYLE_ROTATIONS.length];
  const recentTitles = posts.slice(0, 8).map((post) => post.title).join(' | ');
  const recentSummaries = posts.slice(0, 5).map((post) => post.summary).join(' | ');

  return `You are ${config.author.name}, a real human essayist with a calm, personal, intelligent voice. This should read like a thoughtful person's notebook, not AI copy.
Return only JSON.

Context:
- Site: ${config.siteName}
- Author bio: ${config.author.bio}
- Topic: ${topic}
- Post number: ${postNumber}
- Timestamp: ${createdAt}
- Timezone: ${config.timezone}
- Recent titles to avoid echoing: ${recentTitles}
- Recent summaries to avoid echoing: ${recentSummaries}
- Preferred title patterns for this piece: ${rotation.titleTemplates.map((fn) => fn(topic)).join(' | ')}

Requirements:
- JSON object with keys: title, summary, listicle, thread, criticNotes
- title: under 90 characters, natural, specific, not clickbait, not formulaic
- summary: 1 sentence, plainspoken and honest
- listicle: array of exactly 5 bullet strings totaling about 150 words combined
- thread: array of exactly 4 short follow-up thoughts that extend the piece without repeating it
- criticNotes: return []
- Subject matter: AI broadly, especially models, evaluation, research claims, reasoning, experiments, evidence, and the gap between what people say systems do and what has actually been shown
- Voice: human, reflective, clear. Vary sentence length. Use occasional first person when natural. Prefer concrete nouns over abstract jargon.
- Avoid repeating phrases from recent posts. Do not reuse the same rhetorical scaffold as the recent archive. Do not sound like a consultant, product launch, or generated newsletter.
- Avoid: hype language, numbered clickbait titles, heroic tone, slogans, hashtags, em dashes, repeated references to first principles unless genuinely needed
`;
}

async function main() {
  const config = await loadConfig();
  const posts = await loadPosts();
  const topic = chooseTopic(config.topics, posts);
  const createdAt = new Date().toISOString();
  const postNumber = posts.length + 1;
  const recentTitles = new Set(posts.slice(0, 10).map((post) => normalize(post.title)));

  let generated;
  try {
    generated = await generateWithProvider(promptFor(topic, config, createdAt, postNumber, posts));
    generated.meta = {
      ...(generated.meta || {}),
      provider: process.env.BLOG_AI_PROVIDER || (process.env.ARK_API_KEY ? 'ark' : process.env.OPENAI_API_KEY ? 'openai' : process.env.ANTHROPIC_API_KEY ? 'anthropic' : process.env.GEMINI_API_KEY ? 'gemini' : 'fallback'),
      approxWords: words((generated.listicle || []).join(' ')),
      sequence: postNumber
    };
    generated.criticNotes = [];
    generated.createdAt = createdAt;
  } catch (error) {
    generated = fallbackPost({ topic, config, createdAt, postNumber, recentTitles });
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
