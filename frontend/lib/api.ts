import axios from 'axios';
import { withCache, PerformanceMonitor } from './performance';
import type {
  TextAnalysisResult,
  VoiceAnalysisResult,
  MultiModalResult,
  ChatMessageResult,
  VoiceMessageResult,
} from '@/types';

// Create axios instance with optimized config
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
  headers: {
    'Content-Type': 'application/json',
  },
  // The backend can fall through several Gemini models in sequence when one
  // is rate-limited/overloaded (observed a real ~45s round trip during
  // testing) before finally succeeding — 30s was cutting that off client-side
  // even though the backend would have responded successfully.
  timeout: 60000,
});

// ---- Backend authentication -------------------------------------------------
// The Express API (Render) trusts only a short-lived bearer token minted by this
// app's /api/backend-token route from the NextAuth session. The user id is
// derived from that token server-side; any userId we still send is ignored
// (and rejected if it differs).
let cachedToken: { token: string; expiresAt: number } | null = null;
let inflight: Promise<string> | null = null;

export const clearBackendToken = () => {
  cachedToken = null;
};

export const getBackendAuthToken = async (forceRefresh = false): Promise<string> => {
  if (!forceRefresh && cachedToken && cachedToken.expiresAt - Date.now() > 30_000) {
    return cachedToken.token;
  }
  if (!inflight) {
    inflight = fetch('/api/backend-token', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Not authenticated (${res.status})`);
        const data = (await res.json()) as { token: string; expiresAt: number };
        cachedToken = { token: data.token, expiresAt: data.expiresAt };
        return data.token;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
};

/** Authorization header for raw fetch() calls to the backend. */
export const authHeaders = async (): Promise<Record<string, string>> => {
  try {
    return { Authorization: `Bearer ${await getBackendAuthToken()}` };
  } catch (error) {
    // Send the request unauthenticated: an authenticated backend answers 401
    // (clear failure) and a not-yet-upgraded backend keeps working. Never block
    // the whole UI on a token hiccup.
    console.warn('[API] Could not obtain backend token:', error instanceof Error ? error.message : error);
    return {};
  }
};

api.interceptors.request.use(async (config) => {
  const headers = await authHeaders();
  if (headers.Authorization) config.headers.set('Authorization', headers.Authorization);
  return config;
});

// Request interceptor for performance monitoring
api.interceptors.request.use(
  (config) => {
    const requestId = `${config.method?.toUpperCase()}-${config.url}`;
    PerformanceMonitor.start(requestId);
    console.log(`[API Request] ${requestId}`);
    return config;
  },
  (error) => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
  }
);

// Response interceptor with performance logging
api.interceptors.response.use(
  (response) => {
    const requestId = `${response.config.method?.toUpperCase()}-${response.config.url}`;
    PerformanceMonitor.end(requestId);
    return response;
  },
  async (error) => {
    const original = error.config as (typeof error.config & { _retried?: boolean }) | undefined;
    if (error.response?.status === 401 && original && !original._retried) {
      original._retried = true;
      clearBackendToken();
      try {
        original.headers.set('Authorization', `Bearer ${await getBackendAuthToken(true)}`);
        return api.request(original);
      } catch {
        /* fall through to the original error */
      }
    }
    const requestId = `${error.config?.method?.toUpperCase()}-${error.config?.url}`;
    PerformanceMonitor.end(requestId);
    console.error('[API Response Error]', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// API Functions

/**
 * Analyze text for emotions with caching
 */
export const analyzeText = async (text: string): Promise<TextAnalysisResult> => {
  const cacheKey = `text-analysis-${text.slice(0, 50)}`;
  
  return withCache(cacheKey, async () => {
    const response = await api.post<{ 
      success: boolean; 
      data: { 
        emotion: string; 
        confidence: number; 
        scores: Record<string, number>; 
        recordId?: string;
      } 
    }>('/api/analyze/text', { text });
    
    // Backend returns { success: true, data: { emotion, confidence, scores, recordId } }
    // But we expect the full analysis result structure
    const backendData = response.data.data;
    
    // Transform the simplified backend response to match our expected structure
    return {
      originalText: text,
      processedText: text.toLowerCase().trim(),
      emotion: backendData.emotion,
      confidence: backendData.confidence,
      scores: backendData.scores,
      models_used: ['BiLSTM', 'HuggingFace'],
      combination_strategy: 'Weighted Average',
      individual_results: undefined // Not provided by current backend
    };
  });
};

/**
 * Analyze voice/audio file for emotions
 */
export const analyzeVoice = async (audioFile: File): Promise<VoiceAnalysisResult> => {
  const formData = new FormData();
  formData.append('audio', audioFile);

  const response = await api.post<VoiceAnalysisResult>('/api/analyze/voice', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

/**
 * Analyze both text and voice for multi-modal emotion detection
 */
export const analyzeMultiModal = async (
  text: string,
  audioFile: File
): Promise<MultiModalResult> => {
  const formData = new FormData();
  formData.append('text', text);
  formData.append('audio', audioFile);

  const response = await api.post<MultiModalResult>('/api/analyze/multimodal', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

/**
 * Regenerate AI response for a given emotion
 */
export const regenerateResponse = async (
  emotion: string,
  context?: string
): Promise<{ response: string }> => {
  const response = await api.post<{ response: string }>('/api/response/regenerate', {
    emotion,
    context,
  });
  return response.data;
};

/**
 * Convert text to speech
 */
export const textToSpeech = async (text: string): Promise<Blob> => {
  const response = await api.post(
    '/api/tts',
    { text },
    {
      responseType: 'blob',
    }
  );
  return response.data;
};

/**
 * Send chat message with emotion analysis and AI response
 */
export const sendChatMessage = async (
  message: string,
  userId?: string,
  sessionId?: string,
  includeAudio = false
): Promise<ChatMessageResult> => {
  const response = await api.post<{ 
    success: boolean; 
    data?: ChatMessageResult;
    error?: string;
  }>('/api/chat/message', { 
    message, 
    userId,
    sessionId,
    includeAudio,
    memoryLength: 10
  });
  
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to send chat message');
  }
  
  return response.data.data;
};

/**
 * Send chat message and consume the streamed SSE response token-by-token.
 *
 * Uses `fetch` + `response.body.getReader()` (not `EventSource`, which can't
 * send POST bodies/custom headers) against POST /api/chat/message/stream.
 * Frame format sent by the backend:
 *   event: token   data: {"text": "..."}
 *   event: done    data: <same shape as sendChatMessage's return value>
 *   event: error   data: {"error": "...", "details": "..."}
 *
 * Callbacks:
 *   onToken(text)       - called for each incremental chunk of AI reply text
 *   onDone(result)       - called once with the final ChatMessageResult payload
 *   onError(message)     - called if the stream reports/ends in an error
 */
export const sendChatMessageStream = async (
  message: string,
  userId: string,
  sessionId: string | undefined,
  includeAudio: boolean,
  callbacks: {
    onToken: (text: string) => void;
    onDone: (result: ChatMessageResult) => void;
    onError: (message: string) => void;
  }
): Promise<void> => {
  const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  const response = await fetch(`${baseURL}/api/chat/message/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ message, userId, sessionId, includeAudio, memoryLength: 10 }),
  });

  if (!response.ok || !response.body) {
    callbacks.onError(`Request failed with status ${response.status}`);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const handleFrame = (rawFrame: string) => {
    // A frame looks like:
    //   event: token
    //   data: {"text":"..."}
    let eventName = 'message';
    const dataLines: string[] = [];

    for (const line of rawFrame.split('\n')) {
      if (line.startsWith('event:')) {
        eventName = line.slice('event:'.length).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice('data:'.length).trim());
      }
    }

    if (dataLines.length === 0) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(dataLines.join('\n'));
    } catch {
      return;
    }

    if (eventName === 'token') {
      const text = (parsed as { text?: string })?.text;
      if (typeof text === 'string') callbacks.onToken(text);
    } else if (eventName === 'done') {
      callbacks.onDone(parsed as ChatMessageResult);
    } else if (eventName === 'error') {
      const err = parsed as { error?: string; details?: string };
      callbacks.onError(err.details || err.error || 'Unknown streaming error');
    }
  };

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line ("\n\n")
    let separatorIndex: number;
    while ((separatorIndex = buffer.indexOf('\n\n')) !== -1) {
      const rawFrame = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);
      if (rawFrame.trim().length > 0) {
        handleFrame(rawFrame);
      }
    }
  }
};

/**
 * Send a recorded voice message and consume the streamed SSE response.
 *
 * Same fetch + reader approach as sendChatMessageStream, against POST
 * /api/chat/voice/stream. Frame format sent by the backend:
 *   event: transcript   data: {"text": "...", "whisperLanguage": "..."}
 *   event: token        data: {"text": "..."}
 *   event: audio_chunk  data: {"index": 0, "text": "...", "url": "...", "duration": 1.2}
 *   event: done         data: <same shape as /api/chat/voice's response.data>
 *   event: error        data: {"error": "...", "details": "..."}
 *
 * Callbacks:
 *   onTranscript(text)   - called once the user's speech has been transcribed
 *   onToken(text)        - called for each incremental chunk of AI reply text
 *   onAudioChunk(chunk)  - called for each sentence's TTS audio as soon as it's ready,
 *                          in order, well before the full response/'done' event
 *   onDone(result)       - called once with the final VoiceMessageResult payload
 *   onError(message)     - called if the stream reports/ends in an error
 */
export interface VoiceAudioChunk {
  index: number;
  text: string;
  url: string;
  duration?: number;
}

export const sendVoiceMessageStream = async (
  audioBlob: Blob,
  userId: string,
  sessionId: string | undefined,
  callbacks: {
    onTranscript: (text: string, whisperLanguage?: string) => void;
    onToken: (text: string) => void;
    onAudioChunk?: (chunk: VoiceAudioChunk) => void;
    onDone: (result: VoiceMessageResult) => void;
    onError: (message: string) => void;
  }
): Promise<void> => {
  const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  const formData = new FormData();
  formData.append('userId', userId);
  if (sessionId) formData.append('sessionId', sessionId);
  formData.append('audio', audioBlob, 'voice-message.webm');
  formData.append('type', 'voice');

  const response = await fetch(`${baseURL}/api/chat/voice/stream`, {
    method: 'POST',
    headers: await authHeaders(),
    body: formData,
  });

  if (!response.ok || !response.body) {
    callbacks.onError(`Request failed with status ${response.status}`);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const handleFrame = (rawFrame: string) => {
    let eventName = 'message';
    const dataLines: string[] = [];

    for (const line of rawFrame.split('\n')) {
      if (line.startsWith('event:')) {
        eventName = line.slice('event:'.length).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice('data:'.length).trim());
      }
    }

    if (dataLines.length === 0) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(dataLines.join('\n'));
    } catch {
      return;
    }

    if (eventName === 'transcript') {
      const data = parsed as { text?: string; whisperLanguage?: string };
      if (typeof data.text === 'string') callbacks.onTranscript(data.text, data.whisperLanguage);
    } else if (eventName === 'token') {
      const text = (parsed as { text?: string })?.text;
      if (typeof text === 'string') callbacks.onToken(text);
    } else if (eventName === 'audio_chunk') {
      const chunk = parsed as VoiceAudioChunk;
      if (typeof chunk.url === 'string') callbacks.onAudioChunk?.(chunk);
    } else if (eventName === 'done') {
      callbacks.onDone(parsed as VoiceMessageResult);
    } else if (eventName === 'error') {
      const err = parsed as { error?: string; details?: string };
      callbacks.onError(err.details || err.error || 'Unknown streaming error');
    }
  };

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let separatorIndex: number;
    while ((separatorIndex = buffer.indexOf('\n\n')) !== -1) {
      const rawFrame = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);
      if (rawFrame.trim().length > 0) {
        handleFrame(rawFrame);
      }
    }
  }
};

/**
 * Get chat sessions for a user
 */
export const getChatSessions = async (userId: string) => {
  const response = await api.get(`/api/chat/sessions`, {
    params: { userId }
  });
  return response.data.data;
};

/**
 * Get messages for a specific chat session
 */
export const getChatMessages = async (sessionId: string, userId: string) => {
  const response = await api.get(`/api/chat/sessions/${sessionId}/messages`, {
    params: { userId }
  });
  return response.data.data;
};

/**
 * Create a new chat session
 */
export const createChatSession = async (userId: string, sessionTitle?: string) => {
  const response = await api.post('/api/chat/sessions', {
    userId,
    sessionTitle
  });
  return response.data.data;
};

/**
 * Update session title
 */
export const updateChatSessionTitle = async (sessionId: string, userId: string, title: string) => {
  const response = await api.put(`/api/chat/sessions/${sessionId}/title`, {
    userId,
    title
  });
  return response.data.data;
};

/**
 * Delete a chat session
 */
export const deleteChatSession = async (sessionId: string, userId: string) => {
  const response = await api.delete(`/api/chat/sessions/${sessionId}`, {
    params: { userId }
  });
  return response.data;
};

/**
 * Health check
 */
export const healthCheck = async (): Promise<{ status: string; timestamp: string }> => {
  const response = await api.get<{ status: string; timestamp: string }>('/api/health');
  return response.data;
};

/**
 * Send voice chat message with audio
 */
export const sendVoiceMessage = async (
  audioFile: File,
  transcript: string,
  userId: string,
  sessionId?: string,
  language: string = 'en-US'
): Promise<ChatMessageResult> => {
  const formData = new FormData();
  formData.append('audio', audioFile);
  formData.append('transcript', transcript);
  formData.append('userId', userId);
  formData.append('language', language);
  
  if (sessionId) {
    formData.append('sessionId', sessionId);
  }

  const response = await api.post<{ success: boolean; data: ChatMessageResult }>(
    '/api/chat/voice',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );

  return response.data.data;
};

/**
 * Request microphone permission
 */
export const requestMicrophonePermission = async (): Promise<boolean> => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Close the stream immediately after getting permission
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch {
    return false;
  }
};

/**
 * Emergency Contact API Functions
 */

export interface EmergencyContact {
  id: string;
  user_id: string;
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  notify_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export const setEmergencyContactNotifications = async (notifyEnabled: boolean): Promise<EmergencyContact> => {
  const response = await api.put<{ success: boolean; data: EmergencyContact }>('/api/emergency/notifications', { notifyEnabled });
  return response.data.data;
};

/**
 * Check if user has an emergency contact
 */
export const hasEmergencyContact = async (userId: string): Promise<boolean> => {
  try {
    const response = await api.get<{ success: boolean; hasEmergencyContact: boolean }>(
      `/api/emergency/check/${userId}`
    );
    return response.data.hasEmergencyContact;
  } catch (error) {
    console.error('Error checking emergency contact:', error);
    return false;
  }
};

/**
 * Get emergency contact for a user
 */
export const getEmergencyContact = async (userId: string): Promise<EmergencyContact | null> => {
  try {
    const response = await api.get<{ success: boolean; data: EmergencyContact }>(
      `/api/emergency/${userId}`
    );
    return response.data.data;
  } catch (error) {
    console.error('Error fetching emergency contact:', error);
    return null;
  }
};

/**
 * Save emergency contact
 */
export const saveEmergencyContact = async (
  userId: string,
  contactName: string,
  contactEmail: string,
  contactPhone?: string
): Promise<EmergencyContact | null> => {
  try {
    const response = await api.post<{ success: boolean; data: EmergencyContact }>(
      '/api/emergency/save',
      {
        userId,
        contactName,
        contactEmail,
        contactPhone
      }
    );
    return response.data.data;
  } catch (error) {
    console.error('Error saving emergency contact:', error);
    throw error;
  }
};

/**
 * Update emergency contact
 */
export const updateEmergencyContact = async (
  userId: string,
  contactName: string,
  contactEmail: string,
  contactPhone?: string
): Promise<EmergencyContact | null> => {
  try {
    const response = await api.put<{ success: boolean; data: EmergencyContact }>(
      '/api/emergency/update',
      {
        userId,
        contactName,
        contactEmail,
        contactPhone
      }
    );
    return response.data.data;
  } catch (error) {
    console.error('Error updating emergency contact:', error);
    throw error;
  }
};

/**
 * Delete emergency contact
 */
export const deleteEmergencyContact = async (userId: string): Promise<boolean> => {
  try {
    const response = await api.delete<{ success: boolean }>(
      `/api/emergency/${userId}`
    );
    return response.data.success;
  } catch (error) {
    console.error('Error deleting emergency contact:', error);
    throw error;
  }
};

// ============================================================================
// JOURNAL API FUNCTIONS
// ============================================================================

export interface TimeSegment {
  period: string;
  emotion: string;
  count: number;
}

export interface JournalEntry {
  id?: string;
  user_id?: string;
  date: string;
  content: string; // Main formatted journal text (full Daily Emotion Journal)
  overview?: string; // Section 1
  key_moments?: string[]; // Section 2 bullets
  analysis?: string; // Section 3
  closing?: string; // Section 4
  emotion?: string; // Primary emotion for the day
  emotion_emoji?: string; // Emoji representation
  emotion_summary?: {
    dominant_emotion: string;
    mood_score: number; // 0-100 scale
    emotion_counts: Record<string, number>;
    time_segments?: TimeSegment[];
    context_summary?: string;
    message_count?: number;
  };
  source?: 'auto' | 'manual';
  created_at: string;
  updated_at: string;
}

/**
 * Get today's journal entry
 */
export const getJournalToday = async (userId: string): Promise<JournalEntry | null> => {
  try {
    const response = await api.get<{ success: boolean; data: JournalEntry | null }>(
      '/api/journal/today',
      { params: { userId } }
    );
    return response.data.data;
  } catch (error) {
    console.error('Error fetching today\'s journal:', error);
    throw error;
  }
};

/**
 * Get list of journal entries
 */
export const getJournalList = async (
  userId: string,
  limit: number = 30
): Promise<JournalEntry[]> => {
  try {
    const response = await api.get<{ success: boolean; data: { journals: JournalEntry[] } }>(
      '/api/journal/list',
      { params: { userId, limit } }
    );
    return response.data.data.journals;
  } catch (error) {
    console.error('Error fetching journal list:', error);
    throw error;
  }
};

/**
 * Get journal entry for a specific date
 */
export const getJournalByDate = async (
  userId: string,
  date: string
): Promise<JournalEntry | null> => {
  try {
    const response = await api.get<{ success: boolean; data: JournalEntry | null }>(
      `/api/journal/${date}`,
      { params: { userId } }
    );
    return response.data.data;
  } catch (error) {
    console.error('Error fetching journal by date:', error);
    throw error;
  }
};

/**
 * Generate journal entry (manual trigger)
 */
export const generateJournal = async (
  userId: string,
  date?: string,
  force?: boolean
): Promise<JournalEntry | null> => {
  try {
    const response = await api.post<{ 
      success: boolean; 
      data?: JournalEntry;
      skipped?: boolean;
      reason?: string;
      message?: string;
    }>(
      '/api/journal/generate',
      { userId, date, force }
    );
    
    if (response.data.skipped) {
      console.log(`Journal generation skipped: ${response.data.reason}`);
      return null;
    }
    
    return response.data.data || null;
  } catch (error) {
    console.error('Error generating journal:', error);
    throw error;
  }
};

/**
 * Refresh today's journal by recalculating from today's chat messages
 */
export const refreshTodayJournal = async (userId: string): Promise<JournalEntry> => {
  try {
    const response = await api.post<{ success: boolean; data?: JournalEntry; error?: string; messageCount?: number }>(
      '/api/journal/refresh',
      { userId }
    );
    
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to refresh journal');
    }
    
    return response.data.data;
  } catch (error) {
    console.error('Error refreshing journal:', error);
    throw error;
  }
};
