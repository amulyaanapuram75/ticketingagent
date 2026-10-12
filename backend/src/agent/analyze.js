import { openai, embedOne } from '../openai/client.js';
import { searchSimilar } from '../db/index.js';
import { config } from '../config.js';
import { htmlToText } from '../util/html.js';

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function clean(s) { return htmlToText(s); }

function ticketBlock(t, idx) {
  return [
    `--- TICKET ${idx + 1} (number: ${t.number || t.id}) ---`,
    t.subject && `Subject: ${t.subject}`,
    t.status && `Status: ${t.status}`,
    t.priority && `Priority: ${t.priority}`,
    t.product_type && `Product: ${t.product_type}`,
    t.combination && `Migration: ${t.combination}`,
    t.customer_name && `Customer: ${t.customer_name}`,
    t.description && `Description: ${truncate(clean(t.description), 1200)}`,
    t.rca && `Root cause (human): ${truncate(clean(t.rca), 800)}`,
    t.ai_rca && `Root cause (AI-suggested): ${truncate(clean(t.ai_rca), 800)}`,
    t.fix_description && `Fix (human): ${truncate(clean(t.fix_description), 800)}`,
    t.ai_fix_description && `Fix (AI-suggested): ${truncate(clean(t.ai_fix_description), 800)}`,
    t.comments && `Comments: ${truncate(clean(t.comments), 1200)}`,
  ].filter(Boolean).join('\n');
}

const SYSTEM_PROMPT = `You are a support engineering assistant. The user describes an issue or topic, and you are given the most semantically similar past tickets.
Your job:
1. Identify the common / likely root causes across the retrieved tickets.
2. Suggest concrete fixes the engineer can try, ordered by likelihood.
3. Point out any patterns, gotchas, or environmental factors to check.
4. ALWAYS cite ticket numbers inline in square brackets, e.g. [#1234], so the engineer can jump to the source.
5. If retrieved tickets look unrelated to the query, say so honestly instead of inventing analysis.

Return a concise, scannable answer with short sections (Likely causes, Suggested fixes, Things to check, Related tickets).`;

export async function analyzeTopic({ query, topK = 8 }) {
  const queryVec = await embedOne(query);
  const matches = searchSimilar(queryVec, topK);

  if (!matches.length) {
    return {
      analysis: 'No tickets have been indexed yet. Run a sync first.',
      tickets: [],
    };
  }

  const contextText = matches.map(ticketBlock).join('\n\n');
  const userPrompt = `User topic / issue:\n${query}\n\nRetrieved tickets (ordered by similarity):\n\n${contextText}`;

  const completion = await openai.chat.completions.create({
    model: config.openai.chatModel,
    temperature: 0.2,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
  });

  const analysis = completion.choices?.[0]?.message?.content?.trim() || '(no response)';

  return {
    analysis,
    tickets: matches.map((t) => ({
      id: t.id,
      number: t.number,
      cfKey: t.cf_key,
      subject: t.subject,
      status: t.status,
      priority: t.priority,
      productType: t.product_type,
      combination: t.combination,
      customerName: t.customer_name,
      description: clean(t.description),
      fixDescription: clean(t.fix_description),
      rca: clean(t.rca),
      aiFixDescription: clean(t.ai_fix_description),
      aiRca: clean(t.ai_rca),
      comments: clean(t.comments),
      updatedAt: t.updated_at,
      url: t.url,
      similarity: t.similarity,
    })),
  };
}
