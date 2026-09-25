
export const EMOTION_SCORES: Record<string, number> = {
  anger: 20,
  disgust: 18,
  fear: 25,
  sadness: 30,
  neutral: 50,
  surprise: 70,
  joy: 85,
};

export const EMOTION_EMOJI: Record<string, string> = {
  anger: '🤬',
  disgust: '🤢',
  fear: '😨',
  joy: '😀',
  neutral: '😐',
  sadness: '😭',
  surprise: '😲',
};

export const STANDARD_EMOTIONS = ['anger', 'disgust', 'fear', 'joy', 'neutral', 'sadness', 'surprise'];

const LEGACY_EMOTION_MAP: Record<string, string> = {
  happy: 'joy',
  happiness: 'joy',
  excited: 'joy',
  joyful: 'joy',
  sad: 'sadness',
  depressed: 'sadness',
  melancholy: 'sadness',
  angry: 'anger',
  frustrated: 'anger',
  mad: 'anger',
  anxious: 'fear',
  worried: 'fear',
  fearful: 'fear',
  scared: 'fear',
  surprised: 'surprise',
  shocked: 'surprise',
  disgusted: 'disgust',
  calm: 'neutral',
  relaxed: 'neutral',
  peaceful: 'neutral',
};

/** Maps raw/variant model output labels to the 7 canonical emotions. */
export function normalizeEmotion(emotion: string | null | undefined): string {
  if (!emotion) return 'neutral';
  const normalized = emotion.toLowerCase().trim();
  if (STANDARD_EMOTIONS.includes(normalized)) return normalized;
  return LEGACY_EMOTION_MAP[normalized] || 'neutral';
}

interface EmotionConfidencePair {
  emotion?: string | null;
  confidence?: number | null;
}

/** Confidence-weighted dominant emotion — same algorithm as the backend. */
export function getDominantEmotion(emotions: EmotionConfidencePair[]): string {
  const valid = (emotions || []).filter((e) => e && e.emotion);
  if (valid.length === 0) return 'neutral';

  const weights: Record<string, number> = {};
  valid.forEach((e) => {
    const normalized = normalizeEmotion(e.emotion);
    const confidence = Math.max(0, Math.min(1, e.confidence ?? 0.5));
    weights[normalized] = (weights[normalized] || 0) + confidence;
  });

  const entries = Object.entries(weights);
  if (entries.length === 0) return 'neutral';
  return entries.reduce((a, b) => (weights[a[0]] > weights[b[0]] ? a : b))[0];
}

/** Confidence-weighted average mood score (0-100) — same algorithm as the backend. */
export function calculateAverageMoodScore(emotions: EmotionConfidencePair[]): number {
  const valid = (emotions || []).filter((e) => e && e.emotion);
  if (valid.length === 0) return 50;

  let totalWeightedScore = 0;
  let totalWeight = 0;
  valid.forEach((e) => {
    const normalized = normalizeEmotion(e.emotion);
    const score = EMOTION_SCORES[normalized] ?? 50;
    const weight = Math.max(0, Math.min(1, e.confidence ?? 0.5));
    totalWeightedScore += score * weight;
    totalWeight += weight;
  });

  if (totalWeight === 0) return 50;
  return Math.max(0, Math.min(100, Math.round(totalWeightedScore / totalWeight)));
}

export function getEmotionEmoji(emotion: string): string {
  return EMOTION_EMOJI[normalizeEmotion(emotion)] || '😐';
}
