import fs from 'node:fs/promises';
import path from 'node:path';
import { postsDir, projectRoot, slugify, words, writeJson } from './lib/site.mjs';

const YEAR_PLANS = {
  2018: 4,
  2019: 12,
  2020: 12,
  2021: 15,
  2022: 18,
  2023: 24,
  2024: 30,
  2025: 36,
  2026: 12
};

const ERA_DATA = [
  {
    start: 2018,
    end: 2019,
    label: 'desert optimism',
    concepts: ['maker cities', 'domestic robots', 'solar abundance', 'autonomous transit', 'tiny labs', 'desert prototypes', 'repair culture', 'distributed energy', 'communal tools', 'urban sensors', 'playful automation', 'human-scale robotics'],
    angles: ['before the money hardened around them', 'when everything still felt handmade', 'as an art project with civic consequences', 'before venture language flattened the mood', 'as a rehearsal for a different kind of city'],
    scenes: ['the desert at sunrise', 'a warehouse party full of hacked machines', 'a quiet walk through Oakland after midnight', 'a maker fair where every table felt like a small manifesto', 'an overcaffeinated dinner where everyone had a sketchbook open'],
    tensions: ['the gap between wonder and maintenance', 'how quickly spectacle outruns stewardship', 'the mismatch between prototypes and public life', 'the way optimism can hide a labor model', 'what happens when a dream survives only as branding']
  },
  {
    start: 2020,
    end: 2021,
    label: 'systems strain',
    concepts: ['remote presence', 'delivery logistics', 'contactless interfaces', 'fragile supply chains', 'telepresence rituals', 'warehouse software', 'gig labor algorithms', 'homebound automation', 'remote education tools', 'public health dashboards', 'mutual aid apps', 'coordination systems'],
    angles: ['under pressure', 'when the world stopped pretending slack was infinite', 'while daily life was being rerouted through software', 'after convenience turned into dependency', 'when the infrastructure finally became visible'],
    scenes: ['a kitchen table covered in charging cables', 'an empty downtown street', 'the unnerving quiet of a masked grocery line', 'a video call where everyone looked slightly ghosted by their own webcam', 'a late-night browser tab spiral full of charts and shipping estimates'],
    tensions: ['software stepping into spaces that used to belong to habit', 'how a crisis reveals which systems were decorative', 'the quiet cost of calling desperation efficiency', 'how coordination can feel intimate and brutal at the same time', 'the difference between resilience and improvisation']
  },
  {
    start: 2022,
    end: 2023,
    label: 'generative rupture',
    concepts: ['image models', 'language models', 'synthetic voice', 'prompt rituals', 'research theater', 'chat interfaces', 'AI search', 'model demos', 'open weights', 'safety debates', 'benchmarks', 'tool-using models'],
    angles: ['before the story settled', 'while the hype still outran the evidence', 'as the internet learned a new kind of performance', 'when everyone had a demo but nobody had a shared vocabulary', 'while taste and trust were both up for grabs'],
    scenes: ['a browser window full of generated images', 'a coffee shop conversation that turned into an accidental seminar', 'a quiet hour reading papers with too many grand nouns', 'a group chat melting down over the same screenshot', 'an exhausted midnight walk after too much time online'],
    tensions: ['the difference between surprise and understanding', 'how novelty can impersonate depth', 'the pressure to form a worldview too quickly', 'what gets lost when the demo becomes the argument', 'how language softens around systems we do not yet know how to test']
  },
  {
    start: 2024,
    end: 2025,
    label: 'agentic correction',
    concepts: ['agents', 'memory systems', 'evaluation', 'personal AI', 'workflow automation', 'ambient assistants', 'reasoning models', 'local inference', 'interface trust', 'evidence chains', 'digital twins', 'operator tooling'],
    angles: ['after the magic show', 'once maintenance became the real product', 'when reliability turned out to be the whole game', 'as the tools got more useful and less theatrical', 'while everyone tried to make software feel responsible'],
    scenes: ['a desktop crowded with small useful automations', 'an office where the exciting part was no longer the model but the glue', 'a morning spent comparing outputs instead of admiring them', 'a train ride where the future looked mostly like error handling', 'a whiteboard full of edge cases rather than aspirations'],
    tensions: ['the long argument between autonomy and auditability', 'how trust is built from boring details', 'what happens when a product grows more competent than legible', 'the difference between an assistant and a dependency', 'the strange politics of delegating judgment']
  },
  {
    start: 2026,
    end: 2026,
    label: 'after the wave',
    concepts: ['judgment', 'evidence', 'taste', 'online identity', 'slow writing', 'human attention', 'model reliability', 'private computing', 'cultural memory', 'trustworthy interfaces', 'research honesty', 'the internet after AI'],
    angles: ['now that the noise floor is higher', 'when the novelty tax has mostly been paid', 'after years of moving too quickly', 'while trying to keep a human scale', 'when clarity started to feel like rebellion'],
    scenes: ['a Sunday morning with fewer tabs open than usual', 'an inbox full of synthetic language and one real voice', 'a small desk in good light', 'an afternoon spent editing instead of generating', 'a walk taken specifically to leave the machine behind for an hour'],
    tensions: ['what remains when convenience becomes ambient', 'how to keep a self when every workflow wants to absorb it', 'the difference between being assisted and being flattened', 'the social cost of never pausing to notice what changed', 'why judgment still feels stubbornly local']
  }
];

const TITLE_PATTERNS = [
  ({ concept, angle }) => `On ${concept} ${angle}`,
  ({ concept }) => `What ${concept} taught me about building futures`,
  ({ concept, tension }) => `The problem with ${concept} is usually ${tension}`,
  ({ concept, angle }) => `A note on ${concept} ${angle}`,
  ({ concept }) => `I keep coming back to ${concept}`
];

const SUMMARY_PATTERNS = [
  ({ concept, tension }) => `A personal essay about ${concept}, and the longer argument hidden inside ${tension}.`,
  ({ concept, angle }) => `A post about ${concept} ${angle}, written against the temptation to make the future sound cleaner than it is.`,
  ({ concept }) => `A reflection on ${concept} and the kind of world it quietly assumes.`,
  ({ concept, tension }) => `An essay on ${concept}, with one eye on the machinery and one eye on the people asked to live with it.`
];

function formatMonthYear(dateString) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(dateString));
}

function between(date, start, end) {
  return date >= start && date <= end;
}

function getEra(year) {
  return ERA_DATA.find((era) => year >= era.start && year <= era.end) || ERA_DATA[ERA_DATA.length - 1];
}

function uniquePush(target, value) {
  if (!target.some((item) => item.slug === value.slug)) target.push(value);
}

function seededPick(array, seed) {
  return array[Math.abs(seed) % array.length];
}

function scheduleDatesForYear(year, count) {
  if (year === 2018) {
    return ['2018-09-04T16:00:00Z', '2018-10-10T17:00:00Z', '2018-11-14T18:00:00Z', '2018-12-19T18:00:00Z'].slice(0, count).map((item) => new Date(item));
  }

  const start = new Date(`${year}-01-11T17:00:00Z`);
  const end = year === 2026 ? new Date('2026-04-18T17:00:00Z') : new Date(`${year}-12-18T18:00:00Z`);
  const span = end.getTime() - start.getTime();
  const dates = [];
  for (let i = 0; i < count; i += 1) {
    const ratio = count === 1 ? 0 : i / (count - 1);
    const jitterDays = year === 2026 && i === count - 1 ? 0 : ((i % 3) - 1) * 1.6;
    const rawMs = start.getTime() + span * ratio + jitterDays * 24 * 60 * 60 * 1000;
    const ms = Math.min(end.getTime(), Math.max(start.getTime(), rawMs));
    dates.push(new Date(ms));
  }
  return dates;
}

function firstPost(date) {
  const body = [
    `I came home from Burning Man 2018 with alkaline dust in my shoes, a sore throat, and one stubborn thought I could not shake: if we are going to let machines organize more of human life, they should at least earn the right to do it in a world that still feels playful. That year the robot theme was impossible to miss. Everywhere you looked there were chrome costumes, handmade exoskeletons, animatronic contraptions, solar creatures wobbling through whiteout conditions, and people talking about automation as if it might become either our servant or our final mirror. The mood was not efficiency. It was theater, curiosity, and a strangely sincere hope that technology could still be intimate rather than managerial.`,
    `What I loved about the desert version of robotics was how obviously provisional it all was. A machine broke and five strangers crouched around it with zip ties, a bike light, and some wild theory about torque. Nobody there believed the robot was magic. It was a contraption in a temporary city built by people who knew maintenance was part of the fantasy. That matters to me. The future I want is not one where robots replace us so cleanly that the human part disappears. I want a future where the burden of dull work gets lighter, where energy gets cleaner, where logistics feel less cruel, and where the systems around us are designed with enough humility that ordinary people can still understand the seams.`,
    `The harder question is whether that future can stay joyful once it becomes scalable. It is easy to adore a robot when it is dust-covered, solar-powered, and clearly part art project. It is harder when the same logic arrives as surveillance, labor discipline, or a dashboard optimized by someone who has never been hot, tired, and running late. The desert is useful because it exaggerates values. If something is wasteful, flimsy, or fake-generous, the playa reveals it quickly. Sustainability is not a slogan out there. You feel it in water, battery life, shade, repair, and whether the thing you built can survive contact with wind and exhaustion. I wish more of mainstream technology had to pass through that kind of honesty.`,
    `My optimistic version of robotics still looks weirdly simple. Let the machines do the repetitive hauling, the dangerous inspection, the midnight sorting, the ugly heat. Let them make cities quieter, cleaner, and easier to share. Let them help us produce abundance without producing the usual giant pile of waste. But if they are going to run more of the world, then the world they run should be worth inheriting. It should be sustainable first, legible second, and beautiful almost by accident. It should not feel like we traded one extractive system for a more frictionless one. I do not want the smart city as a mall with sensors. I want the smart city as a place where people have more time, less drudgery, and more reasons to trust each other.`,
    `The phrase that kept circling in my head all week was in dust we trust. Not because dust is noble, but because it is democratic. It gets on everything. It levels expensive and handmade objects alike. It reminds you that no machine is above its environment. That may be the principle I want to keep. Build robots, yes. Build software, sure. But build them in a way that admits they live among bodies, weather, repair cycles, limits, and actual communities. If a machine cannot survive a little dust without becoming authoritarian about it, I am not convinced it belongs in charge of much.`,
    `So that is where I am starting this blog: not with a polished thesis, but with a scene. A temporary city. Robot costumes at sunset. Solar chargers humming like a promise. A lot of very smart people still acting as if delight matters. Maybe that is naive. Maybe a few years from now I will read this back and find it impossibly earnest. But I would rather begin with the possibility that technology could serve a livable world than begin with cynicism and call it maturity. If the future is going to be automated, I want to keep asking the same question until it becomes annoying: automated toward what kind of life?`
  ];

  return {
    title: 'In Dust We Trust',
    summary: 'A first post from Burning Man 2018, where robot fantasies only felt worth keeping if they could survive the dust and still point toward a livable world.',
    topic: 'Burning Man 2018, robots, sustainability, and civic imagination',
    body,
    references: [],
    createdAt: date.toISOString(),
    meta: {
      provider: 'archive-rebuild',
      sequence: 1,
      approxWords: words(body.join(' ')),
      era: 'desert optimism'
    }
  };
}

function buildContext(date, index) {
  const year = date.getUTCFullYear();
  const era = getEra(year);
  const concept = seededPick(era.concepts, index * 7 + year);
  const angle = seededPick(era.angles, index * 11 + year);
  const scene = seededPick(era.scenes, index * 13 + year);
  const tension = seededPick(era.tensions, index * 17 + year);
  return { year, era, concept, angle, scene, tension };
}

function makeTitle(context, usedTitles, index) {
  for (let i = 0; i < TITLE_PATTERNS.length; i += 1) {
    const candidate = TITLE_PATTERNS[(index + i) % TITLE_PATTERNS.length](context).replace(/\s+/g, ' ').trim();
    if (!usedTitles.has(candidate.toLowerCase())) return candidate;
  }
  return `${context.concept} in ${context.year}`;
}

function makeSummary(context, index) {
  return SUMMARY_PATTERNS[index % SUMMARY_PATTERNS.length](context);
}

function makeReferences(posts, index) {
  const refs = [];
  if (!posts.length) return refs;
  uniquePush(refs, posts[Math.max(0, posts.length - 1 - (index % Math.min(posts.length, 6)))]);
  if (posts.length > 8) uniquePush(refs, posts[Math.floor(posts.length * 0.35)]);
  return refs.slice(0, 2).map((post) => ({ slug: post.slug, title: post.title, createdAt: post.createdAt }));
}

function makeParagraphSet(postIndex, date, context, title, references) {
  const style = postIndex % 4;
  const monthYear = formatMonthYear(date.toISOString());
  const refLead = references[0];
  const refTail = references[1];

  const openingVariants = [
    `I wrote this down in ${monthYear} after thinking about ${context.concept} from the vantage point of ${context.scene}. What interested me was not the headline version of the topic, but the more durable question underneath it: what sort of world does this idea assume is waiting for it? With technology, that is usually the first thing to disappear. We talk about capability before context, performance before maintenance, scale before whether the thing makes life feel more inhabitable. ${context.concept[0].toUpperCase() + context.concept.slice(1)} seemed to me like a good way to keep the older question in view.`,
    `There was a version of ${context.concept} circulating in ${monthYear} that sounded inevitable. I have become suspicious of inevitability as a tone. It is usually a story people tell after they have quietly selected the conditions under which a trend looks obvious. Standing inside ${context.scene}, what I noticed instead was contingency: how much of the future depends on atmosphere, labor, trust, and timing, and how often those human variables are treated as background noise once a technical idea starts sounding important.`,
    `My notes on ${context.concept} began with a small irritation in ${monthYear}. Everyone around me seemed to agree that the big story was obvious, and the agreement itself made me uneasy. When consensus arrives too quickly, I start looking for whatever got edited out to make the sentence so clean. In this case the omitted piece was ${context.tension}. That phrase may sound abstract, but on the ground it shows up as ordinary details: who has to maintain the thing, who absorbs its errors, who gets asked to trust it first, and who benefits from calling that trust progress.`
  ];

  const mechanismVariants = [
    `${context.concept[0].toUpperCase() + context.concept.slice(1)} appealed to me because it sat right at the border between practical engineering and cultural fantasy. The engineering part is easier to talk about, because it turns into parts, systems, metrics, and demos. The fantasy part is harder, but it matters just as much. Every tool arrives carrying an image of the person who will use it and the society it hopes to stabilize. If you listen carefully, you can hear those assumptions in the design choices. The question is never just whether a system works. It is also what kind of behavior, dependency, and mood the system quietly normalizes while it works.`,
    `The mechanism that interested me most was not the one usually highlighted in public. Public language likes the visible move: the robot, the interface, the model, the service layer. But most technologies become socially important through a second-order effect. They change pacing. They change who gets to stay generalist and who is forced to become legible to the machine. They change what can be ignored because some hidden workflow now catches it. Once you notice that shift, ${context.concept} stops looking like a gadget and starts looking like a theory of everyday life with a power source attached.`,
    `Part of what keeps this topic interesting is that it resists clean ideological sorting. ${context.concept[0].toUpperCase() + context.concept.slice(1)} can look emancipatory when you focus on drudgery leaving the picture, and unsettling when you look at how quickly convenience hardens into expectation. Both reactions are real. The adult version of the conversation has to hold them at the same time. I do not think skepticism means refusing tools. I think it means asking what the tool is teaching us about obedience, attention, and scale while we are busy admiring how much friction it has removed.`
  ];

  const socialVariants = [
    `In ${context.year}, the social texture around all of this mattered as much as the technical substance. People were not just adopting systems; they were auditioning identities through them. Some wanted to look early. Some wanted to look rigorous. Some wanted relief from tasks that had become exhausting, repetitive, or plainly stupid. I sympathized with all of that. But the cultural story was moving faster than the evidence. The risk there is not only bad prediction. It is that you end up building institutions around a feeling, and institutions are much harder to unwind than a hot take in a group chat.`,
    `What I kept seeing was a gap between prototype conditions and public conditions. In the prototype, everyone knows they are participating in an experiment. In public, people inherit the result as environment. That difference changes the moral burden of design. It is one thing to test a tool among enthusiasts who volunteered for weirdness. It is another to fold the same logic into schools, offices, hospitals, transit, or housing and expect gratitude because the interface looks modern. ${context.tension[0].toUpperCase() + context.tension.slice(1)} becomes sharper whenever a niche tool tries to skip directly into normal life without surviving a long middle period of explanation and repair.`,
    `There is also the old problem of atmosphere. Some technologies make people feel more room around themselves. Others make every surface feel like an input. That difference is easy to underrate because it does not show up cleanly in a benchmark. But mood is one of the outputs. If a system consistently narrows attention, thickens bureaucracy, or turns daily life into a sequence of small permissions, that is not accidental collateral. It is part of what the product is. I have never been persuaded by arguments that treat human texture as a sentimental side issue next to performance.`
  ];

  const shiftLead = refLead
    ? `Looking back from ${monthYear}, I could already feel my own position shifting. ${style % 2 === 0 ? `A few months earlier I had written “${refLead.title},” and the difference between that piece and this one is instructive.` : `I kept thinking about an older post of mine, “${refLead.title},” from ${formatMonthYear(refLead.createdAt)}.`} In that earlier note I was still describing the surface appeal. Here I was more interested in what happens after the applause: the maintenance burden, the political assumptions, the quiet social sorting, the emotional contract being drafted between human beings and the systems now arranging their choices. I do not think that earlier optimism was wrong, exactly. It was just incomplete in a way optimism often is when the machinery has not yet touched enough lives.`
    : `By ${monthYear}, I could already feel my own position shifting from attraction to examination. The appeal of the topic was still there, but I had become more interested in the hidden maintenance layer, the social contract around the tool, and the difference between a seductive demo and a durable public life. That may be the recurring pattern in this archive. The first version of a technology arrives as possibility. The second version arrives as administration. Writing helps me catch the turn.`;

  const shiftReflection = refLead
    ? `What changed most was not my taste for the topic but my threshold for abstraction. After writing “${refLead.title},” I found myself less willing to accept big words without a scene attached to them. If a claim about the future cannot survive contact with somebody's day, their tools, their fatigue, and their incentives, I do not trust the claim to survive for long at all. That has become one of my small private tests. Ask the sentence to descend from altitude. If it lands gracefully, keep it. If it panics on impact, start over.`
    : `Even then, I could sense that this was going to be a long argument rather than a one-post subject. Topics like this do not settle cleanly because the object itself keeps moving. People learn to speak it differently. Institutions adopt it unevenly. Incentives bend the shape. By the time the public agrees on what the thing is called, the thing has usually already changed. That is part of why I kept writing. Not to pin the future down, but to leave a trail of how it kept shifting underfoot.`;

  const shiftVariants = [
    shiftLead,
    `Over time I have learned to pay close attention to what disappears from a story once people start repeating it professionally. Usually it is the same cluster of missing pieces: labor, error handling, emotional load, repair, governance, and the uneven distribution of inconvenience. ${context.concept[0].toUpperCase() + context.concept.slice(1)} looked different to me once I framed it that way. What had first appeared as a sleek solution started to read more like a bundle of trade-offs with a persuasive publicist. That does not make the thing useless. It just makes it legible again, which is often the first real service criticism can provide.`,
    shiftReflection
  ];

  const closingVariants = [
    `What I wanted, and still want, is not purity but proportion. Let the tools be useful. Let them even be strange. But let us stay attentive to the conditions under which usefulness turns into dependence and strangeness gets marketed as destiny. ${context.concept[0].toUpperCase() + context.concept.slice(1)} seemed worth writing about because it carried that tension in plain view. The future is rarely a single invention. More often it is a style of relationship that becomes normal before we have finished deciding whether we like it.`,
    `I do not think the goal is to become anti-technology out of self-defense. The better goal is to become harder to flatter. We can admire good tools without surrendering the right to ask what world they are quietly assembling around themselves. If that sounds like a modest ambition, good. Most of the sanest writing I know begins modestly. It begins by refusing the oversized story until the smaller one proves it deserves to grow. ${refTail ? `That is a lesson I hear again when I reread “${refTail.title}.”` : `It is one of the reasons I keep a blog at all.`}`,
    `Maybe that is the real use of an archive like this one. It lets me see not only what the technologies were doing, but what I was learning to notice. The tools change. The language changes. The market changes its costume every six months. What stays interesting is the slower shift in what feels normal, what feels extractive, and what still feels worth wanting. ${context.concept[0].toUpperCase() + context.concept.slice(1)} sat right in the middle of that drift, which is why I kept turning it over until it revealed more than its own sales pitch.`
  ];

  return [
    seededPick(openingVariants, postIndex),
    seededPick(mechanismVariants, postIndex + 1),
    seededPick(socialVariants, postIndex + 2),
    seededPick(shiftVariants, postIndex + 3),
    seededPick(closingVariants, postIndex + 4),
    `A final note to myself from ${monthYear}: the useful test is not whether a technology makes me feel early, but whether it makes the surrounding world more durable, more legible, and a little more generous. I have become less interested in winning the argument about what comes next than in noticing what a given tool seems to ask of the people nearest to it. If that sounds less glamorous than prediction, good. The glamorous version is usually how we miss the part that matters.`
  ];
}

async function backupExistingPosts() {
  await fs.mkdir(path.join(projectRoot, 'content', 'backups'), { recursive: true });
  try {
    const files = await fs.readdir(postsDir);
    if (!files.length) return null;
  } catch {
    await fs.mkdir(postsDir, { recursive: true });
    return null;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(projectRoot, 'content', 'backups', `posts-${stamp}`);
  await fs.rename(postsDir, backupDir);
  await fs.mkdir(postsDir, { recursive: true });
  return backupDir;
}

async function main() {
  const backupDir = await backupExistingPosts();
  const usedTitles = new Set();
  const posts = [];
  let sequence = 0;

  for (const [yearText, count] of Object.entries(YEAR_PLANS)) {
    const year = Number(yearText);
    const dates = scheduleDatesForYear(year, count);

    for (const date of dates) {
      sequence += 1;
      let post;
      if (sequence === 1) {
        post = firstPost(date);
      } else {
        const context = buildContext(date, sequence);
        const references = makeReferences(posts, sequence);
        const title = makeTitle(context, usedTitles, sequence);
        const summary = makeSummary(context, sequence);
        const body = makeParagraphSet(sequence, date, context, title, references);
        post = {
          title,
          summary,
          topic: `${context.concept} ${context.angle}`,
          body,
          references: references.map((ref) => ({
            slug: ref.slug,
            title: ref.title,
            note: `Written in ${formatMonthYear(ref.createdAt)}.`
          })),
          createdAt: date.toISOString(),
          meta: {
            provider: 'archive-rebuild',
            sequence,
            approxWords: words(body.join(' ')),
            era: context.era.label
          }
        };
      }

      usedTitles.add(post.title.toLowerCase());
      const slug = `${post.createdAt.slice(0, 10).replace(/-/g, '')}-${slugify(post.title)}`;
      const fullPost = {
        id: slug,
        slug,
        ...post
      };
      await writeJson(path.join(postsDir, `${slug}.json`), fullPost);
      posts.push(fullPost);
    }
  }

  console.log(JSON.stringify({
    ok: true,
    postsGenerated: posts.length,
    firstPost: posts[0]?.title,
    latestPost: posts[posts.length - 1]?.title,
    backupDir
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
