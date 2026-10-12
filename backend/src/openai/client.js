import OpenAI from 'openai';
import { config } from '../config.js';

export const openai = new OpenAI({ apiKey: config.openai.apiKey });

export async function embedTexts(texts) {
  if (!texts.length) return [];
  const res = await openai.embeddings.create({
    model: config.openai.embeddingModel,
    input: texts,
  });
  return res.data.map((d) => d.embedding);
}

export async function embedOne(text) {
  const [v] = await embedTexts([text]);
  return v;
}

function buildTicketText(t) {
  return [
    t.subject && `Subject: ${t.subject}`,
    t.status && `Status: ${t.status}`,
    t.priority && `Priority: ${t.priority}`,
    t.productType && `Product: ${t.productType}`,
    t.combination && `Migration: ${t.combination}`,
    t.customerName && `Customer: ${t.customerName}`,
    t.description && `Description: ${t.description}`,
    t.rca && `Root cause (human): ${t.rca}`,
    t.aiRca && `Root cause (AI-suggested): ${t.aiRca}`,
    t.fixDescription && `Fix (human): ${t.fixDescription}`,
    t.aiFixDescription && `Fix (AI-suggested): ${t.aiFixDescription}`,
    t.comments && `Comments: ${t.comments}`,
  ].filter(Boolean).join('\n\n').slice(0, 7000);
}

export { buildTicketText };
