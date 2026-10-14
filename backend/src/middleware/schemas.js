/**
 * Request schemas for the legacy /api routes (zod). All objects use
 * .passthrough() so existing clients that send extra fields keep working;
 * what is enforced is type and size of the fields the handlers actually use.
 * `userId` is intentionally NOT validated here: it is bound from the token.
 */
import { z } from 'zod';

const id = z.string().min(1).max(64);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const boolish = z.union([z.boolean(), z.enum(['true', 'false'])]);
const intQuery = (max) => z.coerce.number().int().min(1).max(max);

const MAX_TEXT = 5000;

export const chatMessageBody = z.object({
  message: z.string().trim().min(1).max(MAX_TEXT),
  sessionId: id.nullish(),
  includeAudio: boolish.optional(),
  memoryLength: z.coerce.number().int().min(0).max(30).optional()
}).passthrough();

export const sessionCreateBody = z.object({
  sessionTitle: z.string().trim().max(200).nullish()
}).passthrough();

export const sessionTitleBody = z.object({
  title: z.string().trim().min(1).max(200)
}).passthrough();

export const sessionIdParams = z.object({ sessionId: id }).passthrough();

/** Multipart voice fields arrive as strings. */
export const voiceFormBody = z.object({
  sessionId: id.optional().or(z.literal('')),
  language: z.string().max(20).optional(),
  transcript: z.string().max(MAX_TEXT).optional()
}).passthrough();

export const textBody = z.object({
  text: z.string().trim().min(1).max(MAX_TEXT)
}).passthrough();

export const ttsBody = z.object({
  text: z.string().trim().min(1).max(MAX_TEXT),
  language: z.string().max(20).optional(),
  language_code: z.string().max(20).optional(),
  voice: z.string().max(64).optional()
}).passthrough();

export const responseGenerateBody = z.object({
  emotion: z.string().max(40).optional(),
  confidence: z.coerce.number().min(0).max(1).optional(),
  context: z.string().max(MAX_TEXT).optional(),
  transcript: z.string().max(MAX_TEXT).optional(),
  includeAudio: boolish.optional()
}).passthrough();

export const responseChatBody = z.object({
  message: z.string().trim().min(1).max(MAX_TEXT),
  emotion: z.string().max(40).optional(),
  conversationHistory: z.array(z.unknown()).max(50).optional()
}).passthrough();

export const emergencyContactBody = z.object({
  contactName: z.string().trim().min(1).max(100),
  contactEmail: z.string().trim().email().max(254),
  contactPhone: z.string().trim().max(32).nullish()
}).passthrough();

export const journalGenerateBody = z.object({
  date: isoDate.optional(),
  force: boolish.optional()
}).passthrough();

export const dateParams = z.object({ date: isoDate }).passthrough();

export const limitQuery = z.object({
  limit: intQuery(200).optional()
}).passthrough();

export const activityIdParams = z.object({ activityId: id }).passthrough();

export const activityCreateBody = z.object({
  activity_type: z.string().min(1).max(64),
  content: z.string().max(20000).nullish(),
  session_id: id.nullish()
}).passthrough();
