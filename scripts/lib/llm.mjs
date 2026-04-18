function extractJson(text) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in model response');
  return JSON.parse(raw.slice(start, end + 1));
}

async function callOpenAI(prompt) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-5.4-mini',
      input: prompt
    })
  });
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
  const data = await response.json();
  const text = data.output_text || data.output?.map((item) => item.content?.map((part) => part.text || '').join('')).join('\n') || '';
  return extractJson(text);
}

async function callAnthropic(prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  if (!response.ok) throw new Error(`Anthropic ${response.status}: ${await response.text()}`);
  const data = await response.json();
  const text = data.content?.map((part) => part.text || '').join('\n') || '';
  return extractJson(text);
}

async function callGemini(prompt) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });
  if (!response.ok) throw new Error(`Gemini ${response.status}: ${await response.text()}`);
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n') || '';
  return extractJson(text);
}

export async function generateWithProvider(prompt) {
  const override = process.env.BLOG_AI_PROVIDER;
  const providers = override ? [override] : ['openai', 'anthropic', 'gemini'];
  const errors = [];

  for (const provider of providers) {
    try {
      if (provider === 'openai' && process.env.OPENAI_API_KEY) return await callOpenAI(prompt);
      if (provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) return await callAnthropic(prompt);
      if (provider === 'gemini' && process.env.GEMINI_API_KEY) return await callGemini(prompt);
      if (provider === 'fallback') throw new Error('fallback requested');
    } catch (error) {
      errors.push(`${provider}: ${error.message}`);
    }
  }

  throw new Error(errors.join(' | ') || 'No provider configured');
}
