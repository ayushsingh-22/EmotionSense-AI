/**
 * Model Catalog
 *
 * Groq and Gemini both retire/rename models frequently, which used to mean
 * hardcoded model ids in this codebase silently started failing whenever a
 * provider deprecated one. This module instead asks each provider for its
 * live model list, picks the model(s) best suited to this project's use case
 * (empathetic chat text generation, or speech-to-text), and caches the
 * result for 24 hours (both in memory and on disk, so a dev-server restart
 * doesn't force a re-fetch mid-day).
 *
 * If a live fetch fails, we fall back to the last known-good cached choice,
 * and only fall back to a hardcoded default if we've never successfully
 * fetched anything at all — the app should never hard-fail just because a
 * models-list endpoint hiccupped.
 *
 * An explicit env var override (GEMINI_MODEL / LLAMA_MODEL / GROQ_MODEL)
 * always wins over auto-discovery, but is layered ahead of the discovered
 * list rather than replacing it — so a stale manual pin still has a working
 * fallback instead of breaking the app outright.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import config from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_PATH = path.join(__dirname, '..', '..', 'data', 'model-catalog-cache.json');
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // once a day

let cache = loadCacheFromDisk();

function loadCacheFromDisk() {
  try {
    const raw = fs.readFileSync(CACHE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveCacheToDisk() {
  try {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  } catch (error) {
    console.warn('⚠️ Could not persist model catalog cache:', error.message);
  }
}

function isFresh(entry) {
  return Boolean(entry) && Date.now() - entry.fetchedAt < REFRESH_INTERVAL_MS;
}

async function withDailyCache(key, fetcher, fallback) {
  const cached = cache[key];
  if (isFresh(cached)) {
    return cached.value;
  }

  try {
    const value = await fetcher();
    if (value && (!Array.isArray(value) || value.length > 0)) {
      cache[key] = { value, fetchedAt: Date.now() };
      saveCacheToDisk();
      return value;
    }
    throw new Error('Fetcher returned an empty result');
  } catch (error) {
    console.warn(`⚠️ Model catalog refresh failed for "${key}": ${error.message}`);
    if (cached?.value) {
      console.warn(`   Using last known-good cached value for "${key}" instead.`);
      return cached.value;
    }
    console.warn(`   No cache available for "${key}" — using hardcoded fallback.`);
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

const GEMINI_EXCLUDE_PATTERNS = [
  'embedding', 'aqa', 'tts', 'image', 'vision', 'learnlm',
  'transcribe', 'robotics', 'computer-use', 'customtools'
];

function parseGeminiVersion(id) {
  const match = id.match(/gemini-(\d+)\.(\d+)/);
  if (!match) return [0, 0];
  return [parseInt(match[1], 10), parseInt(match[2], 10)];
}

function rankGeminiModel(id) {
  const [major, minor] = parseGeminiVersion(id);
  const isFlash = id.includes('flash');
  const isPro = id.includes('pro');
  const isPreviewOrExp = id.includes('exp') || id.includes('preview');
  // Prefer: newest version > flash over pro (faster, cheaper — right fit for
  // a real-time empathetic chat reply) > stable over preview/experimental.
  return major * 1000 + minor * 100 + (isFlash ? 20 : isPro ? 10 : 0) + (isPreviewOrExp ? 0 : 5);
}

async function fetchGeminiModelList(apiKey) {
  const response = await axios.get(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
    { timeout: 10000 }
  );
  const models = response.data?.models || [];

  return models
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    .filter((id) => id.startsWith('gemini-'))
    .filter((id) => !GEMINI_EXCLUDE_PATTERNS.some((pattern) => id.includes(pattern)))
    .sort((a, b) => rankGeminiModel(b) - rankGeminiModel(a));
}

/**
 * Ordered list of Gemini model ids to try (best first), refreshed daily.
 * Requires at least one configured API key to fetch live; without one it
 * just returns the hardcoded fallback list.
 */
export async function getGeminiModelList() {
  const apiKey = config.gemini.apiKeys[0];
  const discovered = apiKey
    ? await withDailyCache('gemini_models', () => fetchGeminiModelList(apiKey), config.gemini.fallbackModels)
    : config.gemini.fallbackModels;

  if (config.gemini.modelOverride) {
    // Pin goes first; discovered/fallback list stays as the safety net.
    return [config.gemini.modelOverride, ...discovered.filter((m) => m !== config.gemini.modelOverride)];
  }
  return discovered;
}

// ---------------------------------------------------------------------------
// Groq (shared models list between chat and speech-to-text)
// ---------------------------------------------------------------------------

async function fetchGroqModelList() {
  const response = await axios.get('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${config.llama.apiKey}` },
    timeout: 10000
  });
  const models = response.data?.data || [];
  return models
    .filter((m) => m.active !== false)
    .map((m) => m.id);
}

const CHAT_EXCLUDE_PATTERNS = ['whisper', 'tts', 'guard', 'distil-whisper', 'playai'];
// Highest-priority family first — matches this project's prior manual choice
// (llama-3.3 70b "versatile") while tolerating Groq renaming/retiring models.
const CHAT_FAMILY_PRIORITY = [
  'llama-3.3', 'llama-4', 'llama-3.1', 'llama3', 'llama-3',
  'mixtral', 'qwen', 'gemma2', 'gemma', 'deepseek'
];

function rankGroqChatModel(id) {
  const familyRank = CHAT_FAMILY_PRIORITY.findIndex((family) => id.includes(family));
  const sizeMatch = id.match(/(\d+)b/);
  const size = sizeMatch ? parseInt(sizeMatch[1], 10) : 0;
  const isVersatile = id.includes('versatile');
  // Lower familyRank index = higher priority family; invert so higher score wins.
  const familyScore = familyRank === -1 ? -1 : (CHAT_FAMILY_PRIORITY.length - familyRank) * 1000;
  return familyScore + size + (isVersatile ? 10 : 0);
}

async function fetchGroqChatModel() {
  const all = await fetchGroqModelList();
  const candidates = all.filter((id) => !CHAT_EXCLUDE_PATTERNS.some((p) => id.includes(p)));
  if (candidates.length === 0) {
    throw new Error('No non-whisper/non-tts chat models returned by Groq');
  }
  return candidates.sort((a, b) => rankGroqChatModel(b) - rankGroqChatModel(a))[0];
}

/** Best currently-available Groq chat/completions model, refreshed daily. */
export async function getGroqChatModel() {
  if (config.llama.modelOverride) {
    return config.llama.modelOverride;
  }
  if (!config.llama.apiKey) {
    return config.llama.fallbackModel;
  }
  return withDailyCache('groq_chat_model', fetchGroqChatModel, config.llama.fallbackModel);
}

function rankGroqSttModel(id) {
  if (id.includes('turbo')) return 3;
  if (id.includes('large-v3')) return 2;
  if (id.includes('whisper')) return 1;
  return 0;
}

async function fetchGroqSttModel() {
  const all = await fetchGroqModelList();
  const candidates = all.filter((id) => id.includes('whisper'));
  if (candidates.length === 0) {
    throw new Error('No whisper models returned by Groq');
  }
  return candidates.sort((a, b) => rankGroqSttModel(b) - rankGroqSttModel(a))[0];
}

/** Best currently-available Groq Whisper (speech-to-text) model, refreshed daily. */
export async function getGroqSttModel() {
  if (config.stt.groq.modelOverride) {
    return config.stt.groq.modelOverride;
  }
  if (!config.stt.groq.apiKey) {
    return config.stt.groq.fallbackModel;
  }
  return withDailyCache('groq_stt_model', fetchGroqSttModel, config.stt.groq.fallbackModel);
}
