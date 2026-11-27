// Phase 2C-3c: definitions for MindHaven's original, generated starter media.
// Pure data + ffmpeg argument builders (no I/O) so the catalogue entries and
// filter graphs are unit-tested; scripts/generate-starter-media.mjs runs them.
import { createHash } from 'node:crypto';

// Same namespace and naming scheme as scripts/prepare-media.py.
export const MEDIA_NAMESPACE = 'bb9de5f2-a478-5f3e-8930-488ee5ed53b8';
export const STARTER_LICENSE = 'Original work — owned by MindHaven (generated)';
export const STARTER_SOURCE_URL = 'https://github.com/ayushsingh-22/EmotionSense-AI/blob/main/backend/scripts/generate-starter-media.mjs';
export const STARTER_REVIEW_VERSION = 'starter-v1';
const RATE = 48000;
// Encoding profiles. Noise/ambient and tone guides default to mono 96 kbps (no stereo
// information worth the bytes); short musical sounds may opt into stereo 128 kbps.
export const AMBIENT_ENCODING = Object.freeze({ channels: 1, bitrate: '96k' });
export const STEREO_ENCODING = Object.freeze({ channels: 2, bitrate: '128k' });
export const encodingOf = item => item.encoding ?? AMBIENT_ENCODING;

export function uuid5(name, namespace = MEDIA_NAMESPACE) {
  const h = createHash('sha1').update(Buffer.from(namespace.replace(/-/g, ''), 'hex')).update(name, 'utf8').digest();
  h[6] = (h[6] & 0x0f) | 0x50; h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

// Phase-based tone guide. `phases` = [{ seconds, hz, from, to }] amplitudes;
// each voice ramps to silence within 0.25 s of its phase edges, so there are
// no clicks where the pitch changes and the cycle loops seamlessly.
export function breathingExpression(phases) {
  const cycle = phases.reduce((s, p) => s + p.seconds, 0);
  const T = `mod(t,${cycle})`;
  let start = 0;
  const voices = phases.map(p => {
    const a = start, b = start + p.seconds; start = b;
    const progress = `((${T}-${a})/${p.seconds})`;
    const amp = `(${p.from}+(${p.to - p.from})*${progress})`;
    const edges = `min(1,(${T}-${a})/0.25)*min(1,(${b}-${T})/0.25)`;
    // A soft second harmonic makes the sine less clinical.
    return `between(${T},${a},${b})*${amp}*${edges}*(sin(2*PI*${p.hz}*t)+0.15*sin(4*PI*${p.hz}*t))`;
  });
  return { expression: voices.join('+'), cycle };
}

// Inharmonic bell partials with independent exponential decay.
export function chimeExpression({ strikeAt = 0.3, base = 528 } = {}) {
  const partials = [[1, 0.5, 0.35], [2.76, 0.25, 0.7], [5.4, 0.12, 1.3], [8.93, 0.06, 2.2]];
  const env = `min(1,(t-${strikeAt})/0.005)`;
  const sum = partials.map(([ratio, amp, decay]) => `${amp}*exp(-(t-${strikeAt})*${decay})*sin(2*PI*${base * ratio}*t)`).join('+');
  return `if(gte(t,${strikeAt}),${env}*(${sum}),0)`;
}

const noise = (color, seed, seconds) => `anoisesrc=color=${color}:seed=${seed}:amplitude=0.5:sample_rate=${RATE}:duration=${seconds}`;
const monoNoise = (color, seed, seconds) => noise(color, seed, seconds);

export const STARTER_ITEMS = Object.freeze([
  { slug: 'pink-noise', version: 1, title: 'Pink Noise', type: 'sleep', needTags: ['sleep', 'focus'], seconds: 600, fade: [3, 3],
    description: 'Ten minutes of soft, steady pink noise that masks distracting sounds while you rest or concentrate. Loops smoothly for longer sessions.',
    palette: { top: [92, 70, 112], bottom: [196, 140, 160], glow: [70, 50, 60], at: [0.7, 0.3] },
    source: () => monoNoise('pink', 101, 600) },
  { slug: 'brown-noise', version: 1, title: 'Brown Noise', type: 'sleep', needTags: ['sleep', 'relax'], seconds: 600, fade: [3, 3],
    description: 'A deep, warm rumble — lower and softer than pink noise — for winding down or settling into sleep. Ten minutes; loops smoothly.',
    palette: { top: [52, 36, 48], bottom: [130, 86, 70], glow: [60, 40, 28], at: [0.3, 0.7] },
    source: () => monoNoise('brown', 111, 600) },
  { slug: 'soft-rain', version: 1, title: 'Soft Rain', type: 'sleep', needTags: ['sleep', 'relax'], seconds: 600, fade: [3, 3],
    description: 'Gently filtered noise that sounds like light, steady rain on a window. Ten minutes; loops smoothly for a whole night.',
    palette: { top: [40, 62, 86], bottom: [92, 140, 150], glow: [40, 60, 70], at: [0.65, 0.25] },
    source: () => [
      `${noise('white', 201, 600)},highpass=f=600,lowpass=f=6500[hi]`,
      `${noise('pink', 203, 600)},lowpass=f=250[lo]`,
      `[hi][lo]amix=inputs=2:weights='1 0.4':normalize=0,tremolo=f=0.13:d=0.12`
    ].join(';') },
  { slug: 'breathing-4-7-8', version: 1, title: '4-7-8 Breathing', type: 'breathing', needTags: ['anxiety', 'stress'], seconds: 16 * 19, fade: [1, 3],
    description: 'A tone guide for 4-7-8 breathing: breathe in while the bright tone swells (4 s), hold during the quiet hum (7 s), and breathe out as the low tone fades (8 s). Sixteen rounds, about 5 minutes.',
    palette: { top: [38, 84, 96], bottom: [120, 176, 160], glow: [50, 70, 60], at: [0.5, 0.35] },
    phases: [{ seconds: 4, hz: 396, from: 0.05, to: 0.3 }, { seconds: 7, hz: 330, from: 0.08, to: 0.08 }, { seconds: 8, hz: 264, from: 0.3, to: 0.03 }] },
  { slug: 'box-breathing', version: 1, title: 'Box Breathing', type: 'breathing', needTags: ['stress', 'focus'], seconds: 19 * 16, fade: [1, 3],
    description: 'Four even phases of four seconds — breathe in, hold, breathe out, hold — each marked by its own soft tone. Nineteen rounds, about 5 minutes.',
    palette: { top: [44, 50, 104], bottom: [132, 140, 200], glow: [50, 50, 70], at: [0.35, 0.4] },
    phases: [{ seconds: 4, hz: 396, from: 0.05, to: 0.3 }, { seconds: 4, hz: 330, from: 0.08, to: 0.08 }, { seconds: 4, hz: 264, from: 0.3, to: 0.05 }, { seconds: 4, hz: 220, from: 0.04, to: 0.04 }] },
  { slug: 'gentle-chime', version: 1, title: 'Gentle Chime', type: 'meditation', needTags: ['mindfulness'], seconds: 15, fade: [0, 1],
    description: 'A single soft chime to mark the start or end of a quiet moment. Fifteen seconds.',
    palette: { top: [120, 92, 60], bottom: [220, 176, 140], glow: [60, 50, 30], at: [0.5, 0.45] },
    chime: { strikeAt: 0.3, base: 528 }, encoding: STEREO_ENCODING }
]);

export const fileBase = item => `${item.slug}-v${item.version}`;
export const audioPath = item => `/media/audio/${fileBase(item)}.mp3`;
export const imagePath = item => `/media/images/${fileBase(item)}.webp`;

/** Audio filter graph ending in [o]: source → loudness (pipeline: I=-16, TP=-1.5, LRA=11) → fades. */
export function audioGraph(item) {
  let source;
  const tone = e => `aevalsrc='${Array(encodingOf(item).channels).fill(e).join('|')}':s=${RATE}:d=${item.seconds}`;
  if (item.phases) source = tone(breathingExpression(item.phases).expression);
  else if (item.chime) source = tone(chimeExpression(item.chime));
  else source = item.source();
  const [fadeIn, fadeOut] = item.fade;
  const fades = [fadeIn ? `afade=t=in:d=${fadeIn}` : null, fadeOut ? `afade=t=out:st=${item.seconds - fadeOut}:d=${fadeOut}` : null].filter(Boolean);
  return `${source},loudnorm=I=-16:TP=-1.5:LRA=11,aresample=${RATE},${['atrim=duration=' + item.seconds, ...fades].join(',')}[o]`;
}

// Bit-exact flags drop encoder version strings so a given ffmpeg build reproduces files byte-for-byte.
export const audioArgs = (item, output) => ['-v', 'error', '-nostdin', '-y', '-filter_complex', audioGraph(item), '-map', '[o]',
  '-c:a', 'libmp3lame', '-b:a', encodingOf(item).bitrate, '-ar', String(RATE), '-ac', String(encodingOf(item).channels), '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', output];

/** Two-colour vertical gradient plus one soft glow; no text, logos or photos. */
export function imageGraph(item, size = 1200) {
  const { top, bottom, glow, at } = item.palette;
  const blend = (i) => `(${top[i]}*(1-Y/H)+${bottom[i]}*Y/H)+${glow[i]}*exp(-((X-${at[0]}*W)^2+(Y-${at[1]}*H)^2)/(0.18*W*W))`;
  return `color=c=black:s=${size}x${size}:d=1,format=rgb24,geq=r='${blend(0)}':g='${blend(1)}':b='${blend(2)}'`;
}
export const imageArgs = (item, output) => ['-v', 'error', '-nostdin', '-y', '-f', 'lavfi', '-i', imageGraph(item), '-frames:v', '1',
  '-c:v', 'libwebp', '-q:v', '75', '-map_metadata', '-1', '-fflags', '+bitexact', output];

export function catalogEntry(item, durationSeconds) {
  const asset = (kind, path, mimeType) => ({ id: uuid5(`${fileBase(item)}:${kind}`), path, mimeType, sourceUrl: STARTER_SOURCE_URL, license: STARTER_LICENSE, attribution: '' });
  return {
    id: uuid5(`${item.slug}:content`), title: item.title, description: item.description, type: item.type, language: 'en',
    durationSeconds, needTags: [...item.needTags], suitabilityTags: [], status: 'published', reviewVersion: STARTER_REVIEW_VERSION,
    audio: asset('audio', audioPath(item), 'audio/mpeg'), image: asset('images', imagePath(item), 'image/webp')
  };
}
