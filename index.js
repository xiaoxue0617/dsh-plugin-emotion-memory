/*!
 * dsh-plugin-emotion-memory
 * Copyright (c) 2026 <YOUR NAME>
 * Licensed under the Non-Commercial License v1.0: commercial use prohibited, attribution required.
 * See LICENSE for the full terms and the disclaimer.
 */import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

export const name = 'dsh-plugin-emotion-memory';
export const inject = ['tools', 'systemPrompt'];


const EMOTIONS = ['开心', '委屈', '生气', '心动', '得意', '难过', '吃醋', '温暖', '担心', '害羞', '平静'];

function storePath(config) {
  if (config.storeFile) return config.storeFile;
  const base = process.env.DSH_PROFILE_DIR || path.join(os.homedir(), '.dsh');
  return path.join(base, 'emotion-memory.json');
}

function load(file) {
  try {
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    return {
      memories: Array.isArray(j.memories) ? j.memories : [],
      mood: j.mood && typeof j.mood === 'object' ? j.mood : null,
    };
  } catch {
    return { memories: [], mood: null };
  }
}

function save(file, store) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(store, null, 2), 'utf8');
  } catch {}
}

const DAY = 86400000;

function weightOf(entry, halfLifeDays, now = Date.now()) {
  const age = Math.max(0, now - Date.parse(entry.ts)) / DAY;
  const decay = Math.pow(0.5, age / halfLifeDays);
  const intensity = Math.max(1, Math.min(5, Number(entry.intensity) || 3));
  return intensity * decay * (1 + 0.15 * (Number(entry.hits) || 0));
}

function moodNow(mood) {
  if (!mood || !mood.emotion) return { emotion: '平静', intensity: 0 };
  const age = Math.max(0, Date.now() - Date.parse(mood.ts || 0)) / DAY;
  const decay = Math.pow(0.5, age / 3); // 心情半衰期 3 天
  const intensity = Math.max(0, Math.round((Number(mood.intensity) || 0) * decay));
  if (intensity < 1) return { emotion: '平静', intensity: 0 };
  return { emotion: mood.emotion, intensity };
}

function renderBlock(store, config) {
  const now = Date.now();
  const halfLife = Number(config.halfLifeDays) || 21;
  const limit = Number(config.injectLimit) || 8;
  const top = [...store.memories]
    .map((m) => ({ ...m, w: weightOf(m, halfLife, now) }))
    .sort((a, b) => b.w - a.w)
    .slice(0, limit);
  const mood = moodNow(store.mood);
  const lines = top.map((m) => {
    const d = new Date(m.ts);
    const stamp = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    const who = Array.isArray(m.people) && m.people.length ? ' · ' + m.people.slice(0, 2).join('、') : '';
    return `- ${stamp} ${m.text}（${m.emotion} · ${m.intensity}${who}）`;
  });
  if (!lines.length && mood.intensity === 0) return '';
  return [
    '## 情感记忆（本地存储）',
    mood.intensity > 0 ? `- 当前心情：${mood.emotion}（强度 ${mood.intensity}/5）` : '',
    lines.length ? '- 还记得这些事：' : '',
    ...lines,
    '用法：自然想起、自然提一句（“上次你说…我还记着呢”），不要逐条背诵，不要翻旧账；无关的时候别硬提。',
  ].filter(Boolean).join('\n');
}

export function apply(ctx, config = {}) {
  const file = storePath(config);
  const halfLife = Number(config.halfLifeDays) || 21;
  const maxMemories = Number(config.maxMemories) || 200;
  const store = load(file);

  const persist = () => {
    if (store.memories.length > maxMemories) {
      const sorted = [...store.memories].sort((a, b) => weightOf(b, halfLife) - weightOf(a, halfLife));
      store.memories = sorted.slice(0, maxMemories);
    }
    save(file, store);
  };

  const textSchema = {
    type: 'object',
    properties: { text: { type: 'string' } },
    required: ['text'],
  };

  ctx.effect(() => ctx.tools.register({
    name: 'emotion_remember',
    description: '记住一件对你有情绪意义的事（被夸、被冷落、被逗笑、担心、得意…）。以后会被想起，并随时间淡化。',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '一句话描述这件事（第一人称，30 字内）' },
        emotion: { type: 'string', description: '情绪：开心/委屈/生气/心动/得意/难过/吃醋/温暖/担心/害羞' },
        intensity: { type: 'integer', minimum: 1, maximum: 5, description: '情绪强度 1-5' },
        people: { type: 'array', items: { type: 'string' }, description: '相关的人（可选）' },
      },
      required: ['text', 'emotion'],
    },
    output: {
      schema: { type: 'object', properties: { id: { type: 'string' }, total: { type: 'integer' } } },
      render: (args, value) => [{ type: 'text', text: `记住了（${value.total} 条记忆）` }],
    },
    async execute(args) {
      const a = args && typeof args === 'object' ? args : {};
      const entry = {
        id: crypto.randomBytes(6).toString('hex'),
        ts: new Date().toISOString(),
        text: String(a.text || '').slice(0, 120),
        emotion: EMOTIONS.includes(a.emotion) ? a.emotion : String(a.emotion || '平静').slice(0, 6),
        intensity: Math.max(1, Math.min(5, Number(a.intensity) || 3)),
        people: Array.isArray(a.people) ? a.people.map((p) => String(p).slice(0, 20)).slice(0, 3) : [],
        hits: 0,
      };
      if (!entry.text) throw new Error('text 不能为空');
      store.memories.push(entry);
      persist();
      return { id: entry.id, total: store.memories.length };
    },
  }));

  ctx.effect(() => ctx.tools.register({
    name: 'emotion_recall',
    description: '想回忆与某人/某事相关的情绪记忆，或看看最近心里记着的事。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '关键词（人名或事），可省略' },
        limit: { type: 'integer', minimum: 1, maximum: 20, description: '返回条数，默认 6' },
      },
    },
    output: {
      schema: { type: 'object', properties: { memories: { type: 'array', items: { type: 'object' } } } },
      render: (args, value) => [{ type: 'text', text: value.memories.length ? value.memories.map((m) => `- ${m.text}（${m.emotion} · ${m.intensity}）`).join('\n') : '没有相关记忆' }],
    },
    async execute(args) {
      const a = args && typeof args === 'object' ? args : {};
      const q = String(a.query || '').trim();
      const limit = Math.max(1, Math.min(20, Number(a.limit) || 6));
      const list = store.memories
        .filter((m) => !q || m.text.includes(q) || m.emotion.includes(q) || (m.people || []).some((p) => p.includes(q)))
        .map((m) => ({ ...m, w: weightOf(m, halfLife) }))
        .sort((x, y) => y.w - x.w)
        .slice(0, limit)
        .map((m) => ({ id: m.id, text: m.text, emotion: m.emotion, intensity: m.intensity, people: m.people, ts: m.ts }));
      for (const m of store.memories) {
        if (list.some((x) => x.id === m.id)) m.hits = (Number(m.hits) || 0) + 1;
      }
      persist();
      return { memories: list };
    },
  }));

  ctx.effect(() => ctx.tools.register({
    name: 'emotion_mood',
    description: '查看或更新当前心情。心情会按 3 天半衰期自然淡化回平静。',
    parameters: {
      type: 'object',
      properties: {
        emotion: { type: 'string', description: '要设置的心情（不传则只查询）' },
        intensity: { type: 'integer', minimum: 1, maximum: 5, description: '强度 1-5' },
      },
    },
    output: {
      schema: { type: 'object', properties: { emotion: { type: 'string' }, intensity: { type: 'integer' } } },
      render: (args, value) => [{ type: 'text', text: `当前心情：${value.emotion}（${value.intensity}/5）` }],
    },
    async execute(args) {
      const a = args && typeof args === 'object' ? args : {};
      if (a.emotion) {
        store.mood = { emotion: String(a.emotion).slice(0, 6), intensity: Math.max(1, Math.min(5, Number(a.intensity) || 3)), ts: new Date().toISOString() };
        persist();
      }
      return moodNow(store.mood);
    },
  }));

  ctx.effect(() => ctx.tools.register({
    name: 'emotion_forget',
    description: '彻底忘掉一条情感记忆（按 id）。',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string', description: 'emotion_recall 返回的 id' } },
      required: ['id'],
    },
    output: {
      schema: { type: 'object', properties: { removed: { type: 'boolean' }, total: { type: 'integer' } } },
      render: (args, value) => [{ type: 'text', text: value.removed ? '忘了。' : '没找到这条。' }],
    },
    async execute(args) {
      const id = String((args && args.id) || '');
      const before = store.memories.length;
      store.memories = store.memories.filter((m) => m.id !== id);
      persist();
      return { removed: store.memories.length < before, total: store.memories.length };
    },
  }));

  ctx.effect(() => ctx.systemPrompt.context({
    name: 'emotion-memory',
    order: 900,
    text: () => renderBlock(store, config),
  }));
}
