/**
 * Chat Routes
 * Handles chat-specific requests combining emotion analysis and response generation
 * Supports user-specific sessions and contextual conversations with multi-language support
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { asyncHandler } from '../middleware/errorHandler.js';
import { analyzeTextEmotion } from '../text-service/index.js';
import { generateResponse, generateResponseStream } from '../llm-service/index.js';
import { generateSpeech } from '../tts-service/index.js';
import { 
  saveAnalysisResult, 
  createChatSession, 
  saveChatMessage, 
  getRecentChatMessages, 
  updateChatSessionTitle, 
  deleteChatSession,
  getEmergencyContact,
  logSafetyAlert,
  getUserProfile
} from '../storage-service/index.js';
import { 
  getUserChatSessionsUnified, 
  getChatMessagesUnified 
} from '../storage-service/unifiedChatService.js';
import { 
  translateToEnglishIfNeeded, 
  translateBackToUserLanguage,
  getLanguageName,
  isLanguageSupported
} from '../utils/translationHelper.js';
import { textToSpeech } from '../utils/voiceHelper.js';
import { sendEmergencyAlert } from '../utils/nodemailerHelper.js';
import { detectRiskLevel, shouldTriggerEmergencyAlert } from '../utils/safetyHelper.js';
import config from '../config/index.js';
import { 
  isIndianLanguageSupported, 
  getIndianLanguageName,
  normalizeIndianLanguageCode,
  getIndianLanguageTTSCode
} from '../config/indianLanguages.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for audio file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Allow audio files
    const allowedMimes = ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/webm'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid audio format: ${file.mimetype}`));
    }
  }
});

const router = express.Router();

/**
 * POST /api/chat/message
 * Process chat message: analyze emotion + generate AI response with context
 * 
 * Request body:
 * {
 *   "message": "Today I feel sad 😔",
 *   "userId": "user123" (required),
 *   "sessionId": "session-uuid" (optional - creates new if not provided),
 *   "includeAudio": true (optional, default: false)
 * }
 */
router.post('/message', asyncHandler(async (req, res) => {
  const { message, userId, sessionId, includeAudio = false } = req.body;

  // Validate input
  if (!message || typeof message !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Message is required and must be a string'
    });
  }

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'User ID is required'
    });
  }

  if (message.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Message cannot be empty'
    });
  }

  console.log(`💬 Processing chat message for user: ${userId}`);
  console.log(`📝 Message: "${message}"`);

  try {
    // Step 1: Language Detection & Translation to English
    console.log(`🌐 Detecting language and translating if needed...`);
    const translationResult = await translateToEnglishIfNeeded(message);
    
    const {
      translatedText: englishText,
      sourceLang: detectedLanguageRaw,
      needsTranslation,
      usedFallback: usedTranslationFallback,
      translationFailed
    } = translationResult;
    
    // Normalize to Indian language
    const detectedLanguage = normalizeIndianLanguageCode(detectedLanguageRaw);
    const isIndianLang = isIndianLanguageSupported(detectedLanguage);

    console.log(`✅ Language detection: ${detectedLanguageRaw} → ${detectedLanguage}`);
    console.log(`🇮🇳 Indian Language: ${getIndianLanguageName(detectedLanguage)} ${isIndianLang ? '✓' : '(defaulted to English)'}`);
    
    if (needsTranslation) {
      console.log(`🔄 Text translated for processing: "${englishText}"`);
    }

    if (usedTranslationFallback) {
      console.log(`⚠️ Used Gemini fallback for translation`);
    }

    if (translationFailed) {
      console.log(`⚠️ Translation failed, proceeding with original text`);
    }

    // Step 2: Get or create session ONLY when user sends actual message
    let currentSessionId = sessionId;
    let isNewSession = false;
    
    if (!currentSessionId) {
      console.log(`🆕 Creating new chat session with user message...`);
      
      // Create meaningful title from the original user message (not translated)
      // Use first 40 characters for better readability in different languages
      const sessionTitle = message.length > 40 
        ? message.substring(0, 40).trim() + '...' 
        : message.trim();
      
      const newSession = await createChatSession(userId, sessionTitle);
      currentSessionId = newSession.id;
      isNewSession = true;
      
      console.log(`✅ Created new session "${sessionTitle}" for first user message`);
    }

    // Step 3: Get recent messages for context (empty for new sessions)
    const memoryLength = parseInt(process.env.CHAT_MEMORY_LENGTH || 10);
    console.log(`🧠 Fetching last ${memoryLength} messages for context...`);
    const conversationHistory = await getRecentChatMessages(userId, currentSessionId, memoryLength);

    // Step 4: Analyze emotion from the English text
    console.log(`🔤 Analyzing emotion from processed text...`);
    const emotionResult = await analyzeTextEmotion(englishText);
    
    console.log(`✅ Emotion detected: ${emotionResult.emotion} (confidence: ${emotionResult.confidence})`);

    // Step 4.5: Check for high-risk messages and trigger emergency alert if needed
    console.log(`🚨 Checking for high-risk indicators...`);
    const riskAnalysis = detectRiskLevel(englishText);
    console.log(`Risk level: ${riskAnalysis.riskLevel || 'none'}`);
    
    if (riskAnalysis.matchedKeywords.length > 0) {
      console.log(`⚠️ Detected keywords: ${riskAnalysis.matchedKeywords.join(', ')}`);
    }

    // Log safety alert if high or medium risk detected
    if (riskAnalysis.riskLevel) {
      try {
        const emergencyContact = await getEmergencyContact(userId);
        let alertSent = false;
        
        if (emergencyContact && emergencyContact.notify_enabled) {
          console.log(`🚨 Emergency contact found for user, checking if alert should be sent...`);
          
          if (shouldTriggerEmergencyAlert(emotionResult.emotion, riskAnalysis.riskLevel)) {
            console.log(`📧 Attempting to send emergency alert via email...`);
            
            // Fetch user profile from Supabase to get accurate user information
            const userProfile = await getUserProfile(userId);
            
            // Prepare user data for emergency alert
            let userData = {
              id: userId,
              full_name: userProfile?.full_name || userProfile?.name || req.user?.full_name || 'User',
              email: userProfile?.email || userProfile?.user_email || userProfile?.auth_email || req.user?.email || 'Not available'
            };
            
            console.log(`👤 User data for alert: ${userData.full_name} (${userData.email})`);
            console.log(`🔍 User profile debug:`, { 
              profile_exists: !!userProfile,
              available_fields: userProfile ? Object.keys(userProfile) : 'none',
              email_field: userProfile?.email,
              user_email_field: userProfile?.user_email,
              auth_email_field: userProfile?.auth_email
            });
            console.log(`📮 Sending alert to emergency contact: ${emergencyContact.contact_email}`);
            
            // Send email alert via Nodemailer to the emergency contact's email
            alertSent = await sendEmergencyAlert(
              userData,
              emergencyContact,
              emotionResult.emotion,
              englishText,
              riskAnalysis.riskLevel
            );
            
            if (alertSent) {
              console.log(`✅ Emergency alert email sent successfully to ${emergencyContact.contact_email}`);
            } else {
              console.warn(`⚠️ Failed to send emergency alert email to ${emergencyContact.contact_email}`);
            }
          }
        }
        
        // Log the safety alert event
        await logSafetyAlert(
          userId,
          emotionResult.emotion,
          englishText,
          emergencyContact?.id || null,
          alertSent
        );
        
      } catch (alertError) {
        console.error(`⚠️ Error handling emergency alert:`, alertError.message);
        // Don't fail the chat request if alert handling fails
      }
    }

    // Step 5: Save user message to database (save original message, not translated)
    console.log(`💾 Saving user message...`);
    const userMessage = await saveChatMessage(
      userId, 
      currentSessionId, 
      'user', 
      message, // Save original message
      {
        emotion: emotionResult.emotion,
        confidence: emotionResult.confidence,
        detectedLanguage: detectedLanguage,
        languageName: getLanguageName(detectedLanguage),
        wasTranslated: needsTranslation,
        translatedText: needsTranslation ? englishText : null
      }
    );

    // Step 6: Generate empathetic AI response based on emotion and context (using English text)
    console.log(`🤖 Generating AI response with conversation context...`);
    const llmResponse = await generateResponse({
      emotion: emotionResult.emotion,
      confidence: emotionResult.confidence,
      context: {
        userMessage: englishText, // Use translated English text for LLM
        processedText: emotionResult.processedText,
        originalMessage: message, // Keep original for context
        userLanguage: detectedLanguage
      },
      transcript: englishText, // Use English for processing
      conversationHistory: conversationHistory
    });

    console.log(`✅ AI response generated: "${llmResponse.text ? llmResponse.text.substring(0, 100) : 'No response'}..."`);

    // Validate that we have a response
    if (!llmResponse.text || llmResponse.text.trim().length === 0) {
      throw new Error('AI response is empty. This may be due to safety filters or API issues.');
    }

    // Step 7: Translate AI response back to user's language
    let finalResponse = llmResponse.text;
    let responseTranslated = false;
    let responseTranslationFailed = false;

    if (needsTranslation && detectedLanguage !== 'en' && detectedLanguage !== 'unknown') {
      console.log(`🔄 Translating AI response back to ${getLanguageName(detectedLanguage)}...`);
      
      try {
        finalResponse = await translateBackToUserLanguage(llmResponse.text, detectedLanguage);
        responseTranslated = true;
        console.log(`✅ Response translated back to user's language`);
      } catch (error) {
        console.error(`❌ Failed to translate response back to user language:`, error.message);
        finalResponse = llmResponse.text; // Keep English response
        responseTranslationFailed = true;
      }
    }

    // Step 8: Save AI response to database (save in user's language)
    console.log(`💾 Saving AI response...`);
    const assistantMessage = await saveChatMessage(
      userId, 
      currentSessionId, 
      'assistant', 
      finalResponse, // Save in user's language
      {
        originalEnglishText: responseTranslated ? llmResponse.text : null,
        targetLanguage: detectedLanguage,
        wasTranslated: responseTranslated,
        translationFailed: responseTranslationFailed
      }
    );

    // Step 8.5: Update session title with better title for new sessions
    if (isNewSession) {
      try {
        console.log(`🏷️ Generating better session title for new session...`);
        
        // Create a more meaningful title based on the conversation context
        const titleText = message.length > 60 ? message.substring(0, 60).trim() + '...' : message.trim();
        
        // If it's a non-English conversation, keep the original language title
        let betterTitle = titleText;
        
        // For very short messages, try to create a more descriptive title
        if (message.trim().length <= 10) {
          const emotionContext = emotionResult.emotion === 'neutral' ? 'Chat' : `${emotionResult.emotion} conversation`;
          const languageContext = detectedLanguage !== 'en' ? ` (${getLanguageName(detectedLanguage)})` : '';
          betterTitle = `${emotionContext}${languageContext}`;
        }
        
        await updateChatSessionTitle(userId, currentSessionId, betterTitle);
        console.log(`✅ Updated session title to: "${betterTitle}"`);
        
      } catch (error) {
        console.warn(`⚠️ Failed to update session title:`, error.message);
        // Don't fail the request if title update fails
      }
    }

    // Step 9: Generate audio response if requested (using translated text in user's language)
    let audioResponse = null;
    if (includeAudio && finalResponse) {
      console.log(`🔊 Generating audio response...`);
      try {
        audioResponse = await generateSpeech(finalResponse);
        console.log(`✅ Audio response generated`);
      } catch (audioError) {
        console.warn(`⚠️ Audio generation failed:`, audioError.message);
        // Continue without audio - don't fail the entire request
      }
    }

    // Step 10: Return comprehensive response with translation info
    const response = {
      success: true,
      data: {
        sessionId: currentSessionId,
        userMessage: {
          id: userMessage.id,
          content: userMessage.content || message,
          message: message,
          emotion: userMessage.emotion || emotionResult.emotion,
          emotionConfidence: userMessage.emotion_confidence ?? emotionResult.confidence,
          confidence: userMessage.emotion_confidence ?? emotionResult.confidence,
          metadata: userMessage.metadata,
          audioUrl: userMessage.audio_url,
          timestamp: userMessage.created_at,
          // Language detection info
          detectedLanguage: detectedLanguage,
          languageName: getLanguageName(detectedLanguage),
          wasTranslated: needsTranslation,
          translatedText: needsTranslation ? englishText : null,
          translationMethod: usedTranslationFallback ? 'gemini_fallback' : 'google_translate'
        },
        aiResponse: {
          id: assistantMessage.id,
          content: assistantMessage.content || finalResponse,
          message: finalResponse, // Response in user's language
          model: llmResponse.model,
          metadata: assistantMessage.metadata,
          audioUrl: assistantMessage.audio_url,
          timestamp: assistantMessage.created_at,
          // Translation info for response
          originalEnglishText: responseTranslated ? llmResponse.text : null,
          wasTranslated: responseTranslated,
          translationFailed: responseTranslationFailed,
          targetLanguage: detectedLanguage
        },
        emotion: {
          detected: emotionResult.emotion,
          confidence: emotionResult.confidence,
          scores: emotionResult.scores
        },
        language: {
          detected: detectedLanguage,
          name: getLanguageName(detectedLanguage),
          supported: isLanguageSupported(detectedLanguage),
          inputTranslated: needsTranslation,
          outputTranslated: responseTranslated,
          translationFailed: translationFailed || responseTranslationFailed
        },
        hasContext: conversationHistory.length > 0,
        contextLength: conversationHistory.length
      }
    };

    // Add audio if generated
    if (audioResponse) {
      response.data.audio = {
        url: audioResponse.url,
        duration: audioResponse.duration
      };
    }

    console.log(`🎉 Chat processing completed successfully`);
    res.json(response);

  } catch (error) {
    console.error('❌ Error processing chat message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process chat message',
      details: error.message
    });
  }
}));

/**
 * POST /api/chat/message/stream
 * Same pipeline as POST /message, but streams the AI reply token-by-token
 * over Server-Sent Events (SSE) so the user sees text appear incrementally
 * instead of waiting for the entire ~10-40s LLM round trip.
 *
 * Steps 1-6 (language detection/translation, session, history, emotion,
 * risk/safety-alert, save user message) run exactly as in /message BEFORE
 * we start streaming. Then the LLM call streams `event: token` frames as
 * text arrives. Once the stream ends, translation-back, DB save, session
 * title update, and optional TTS all run, and the full final payload
 * (matching the shape of POST /message's response.data) is sent as a single
 * `event: done` frame so the frontend has one code path for final state.
 *
 * SSE frame format:
 *   event: token
 *   data: {"text": "..."}
 *
 *   event: done
 *   data: { ...same shape as POST /message's `data` field... }
 *
 *   event: error
 *   data: {"error": "..."}
 *
 * Request body: identical to POST /message.
 */
router.post('/message/stream', asyncHandler(async (req, res) => {
  const { message, userId, sessionId, includeAudio = false } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ success: false, error: 'Message is required and must be a string' });
  }
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }
  if (message.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Message cannot be empty' });
  }

  console.log(`💬 [stream] Processing chat message for user: ${userId}`);
  console.log(`📝 [stream] Message: "${message}"`);

  // Set up SSE headers up front so we can stream errors too, not just success.
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no' // disable proxy buffering (nginx etc.)
  });
  // Disable Nagle's algorithm — without this, small SSE frames written in
  // quick succession can sit in the TCP send buffer instead of going out
  // immediately, defeating the point of token-by-token streaming.
  req.socket?.setNoDelay?.(true);
  res.flushHeaders?.();

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // IMPORTANT: listen on the *response*'s close event, not the request's.
  // req.on('close') fires as soon as the request body has been fully read
  // (i.e. almost immediately for a small POST body) — NOT when the client
  // actually disconnects. Using it here was making clientClosed flip true
  // right at the start of the handler, silently no-op'ing every sendEvent()
  // call for the rest of the request. res.on('close') only fires when the
  // underlying connection is actually torn down (client navigated away,
  // aborted, etc.), which is what we actually want to guard against.
  let clientClosed = false;
  res.on('close', () => { clientClosed = true; });

  try {
    // Step 1: Language Detection & Translation to English
    console.log(`🌐 [stream] Detecting language and translating if needed...`);
    const translationResult = await translateToEnglishIfNeeded(message);

    const {
      translatedText: englishText,
      sourceLang: detectedLanguageRaw,
      needsTranslation,
      usedFallback: usedTranslationFallback,
      translationFailed
    } = translationResult;

    const detectedLanguage = normalizeIndianLanguageCode(detectedLanguageRaw);
    const isIndianLang = isIndianLanguageSupported(detectedLanguage);

    console.log(`✅ [stream] Language detection: ${detectedLanguageRaw} → ${detectedLanguage}`);
    console.log(`🇮🇳 [stream] Indian Language: ${getIndianLanguageName(detectedLanguage)} ${isIndianLang ? '✓' : '(defaulted to English)'}`);

    // Step 2: Get or create session
    let currentSessionId = sessionId;
    let isNewSession = false;

    if (!currentSessionId) {
      console.log(`🆕 [stream] Creating new chat session with user message...`);
      const sessionTitle = message.length > 40 ? message.substring(0, 40).trim() + '...' : message.trim();
      const newSession = await createChatSession(userId, sessionTitle);
      currentSessionId = newSession.id;
      isNewSession = true;
      console.log(`✅ [stream] Created new session "${sessionTitle}" for first user message`);
    }

    // Step 3: Get recent messages for context
    const memoryLength = parseInt(process.env.CHAT_MEMORY_LENGTH || 10);
    console.log(`🧠 [stream] Fetching last ${memoryLength} messages for context...`);
    const conversationHistory = await getRecentChatMessages(userId, currentSessionId, memoryLength);

    // Step 4: Analyze emotion from the English text
    console.log(`🔤 [stream] Analyzing emotion from processed text...`);
    const emotionResult = await analyzeTextEmotion(englishText);
    console.log(`✅ [stream] Emotion detected: ${emotionResult.emotion} (confidence: ${emotionResult.confidence})`);

    // Step 4.5: Check for high-risk messages and trigger emergency alert if needed
    console.log(`🚨 [stream] Checking for high-risk indicators...`);
    const riskAnalysis = detectRiskLevel(englishText);
    console.log(`Risk level: ${riskAnalysis.riskLevel || 'none'}`);

    if (riskAnalysis.riskLevel) {
      try {
        const emergencyContact = await getEmergencyContact(userId);
        let alertSent = false;

        if (emergencyContact && emergencyContact.notify_enabled) {
          if (shouldTriggerEmergencyAlert(emotionResult.emotion, riskAnalysis.riskLevel)) {
            const userProfile = await getUserProfile(userId);
            let userData = {
              id: userId,
              full_name: userProfile?.full_name || userProfile?.name || req.user?.full_name || 'User',
              email: userProfile?.email || userProfile?.user_email || userProfile?.auth_email || req.user?.email || 'Not available'
            };

            alertSent = await sendEmergencyAlert(
              userData,
              emergencyContact,
              emotionResult.emotion,
              englishText,
              riskAnalysis.riskLevel
            );

            if (alertSent) {
              console.log(`✅ [stream] Emergency alert email sent successfully to ${emergencyContact.contact_email}`);
            } else {
              console.warn(`⚠️ [stream] Failed to send emergency alert email to ${emergencyContact.contact_email}`);
            }
          }
        }

        await logSafetyAlert(
          userId,
          emotionResult.emotion,
          englishText,
          emergencyContact?.id || null,
          alertSent
        );
      } catch (alertError) {
        console.error(`⚠️ [stream] Error handling emergency alert:`, alertError.message);
      }
    }

    // Step 5: Save user message to database
    console.log(`💾 [stream] Saving user message...`);
    const userMessage = await saveChatMessage(
      userId,
      currentSessionId,
      'user',
      message,
      {
        emotion: emotionResult.emotion,
        confidence: emotionResult.confidence,
        detectedLanguage: detectedLanguage,
        languageName: getLanguageName(detectedLanguage),
        wasTranslated: needsTranslation,
        translatedText: needsTranslation ? englishText : null
      }
    );

    // Step 6: Stream the AI response token-by-token
    console.log(`🤖 [stream] Generating AI response with conversation context...`);
    const llmResponse = await generateResponseStream({
      emotion: emotionResult.emotion,
      confidence: emotionResult.confidence,
      context: {
        userMessage: englishText,
        processedText: emotionResult.processedText,
        originalMessage: message,
        userLanguage: detectedLanguage
      },
      transcript: englishText,
      conversationHistory: conversationHistory
    }, (tokenText) => {
      if (!clientClosed) {
        sendEvent('token', { text: tokenText });
      }
    });

    console.log(`✅ [stream] AI response generated: "${llmResponse.text ? llmResponse.text.substring(0, 100) : 'No response'}..."`);

    if (!llmResponse.text || llmResponse.text.trim().length === 0) {
      throw new Error('AI response is empty. This may be due to safety filters or API issues.');
    }

    // Step 7: Translate AI response back to user's language
    let finalResponse = llmResponse.text;
    let responseTranslated = false;
    let responseTranslationFailed = false;

    if (needsTranslation && detectedLanguage !== 'en' && detectedLanguage !== 'unknown') {
      console.log(`🔄 [stream] Translating AI response back to ${getLanguageName(detectedLanguage)}...`);
      try {
        finalResponse = await translateBackToUserLanguage(llmResponse.text, detectedLanguage);
        responseTranslated = true;
      } catch (error) {
        console.error(`❌ [stream] Failed to translate response back to user language:`, error.message);
        finalResponse = llmResponse.text;
        responseTranslationFailed = true;
      }
    }

    // Step 8: Save AI response to database
    console.log(`💾 [stream] Saving AI response...`);
    const assistantMessage = await saveChatMessage(
      userId,
      currentSessionId,
      'assistant',
      finalResponse,
      {
        originalEnglishText: responseTranslated ? llmResponse.text : null,
        targetLanguage: detectedLanguage,
        wasTranslated: responseTranslated,
        translationFailed: responseTranslationFailed
      }
    );

    // Step 8.5: Update session title for new sessions
    if (isNewSession) {
      try {
        const titleText = message.length > 60 ? message.substring(0, 60).trim() + '...' : message.trim();
        let betterTitle = titleText;

        if (message.trim().length <= 10) {
          const emotionContext = emotionResult.emotion === 'neutral' ? 'Chat' : `${emotionResult.emotion} conversation`;
          const languageContext = detectedLanguage !== 'en' ? ` (${getLanguageName(detectedLanguage)})` : '';
          betterTitle = `${emotionContext}${languageContext}`;
        }

        await updateChatSessionTitle(userId, currentSessionId, betterTitle);
        console.log(`✅ [stream] Updated session title to: "${betterTitle}"`);
      } catch (error) {
        console.warn(`⚠️ [stream] Failed to update session title:`, error.message);
      }
    }

    // Step 9: Generate audio response if requested
    let audioResponse = null;
    if (includeAudio && finalResponse) {
      console.log(`🔊 [stream] Generating audio response...`);
      try {
        audioResponse = await generateSpeech(finalResponse);
        console.log(`✅ [stream] Audio response generated`);
      } catch (audioError) {
        console.warn(`⚠️ [stream] Audio generation failed:`, audioError.message);
      }
    }

    // Step 10: Build the same shaped payload as POST /message's `data` field
    const donePayload = {
      sessionId: currentSessionId,
      userMessage: {
        id: userMessage.id,
        content: userMessage.content || message,
        message: message,
        emotion: userMessage.emotion || emotionResult.emotion,
        emotionConfidence: userMessage.emotion_confidence ?? emotionResult.confidence,
        confidence: userMessage.emotion_confidence ?? emotionResult.confidence,
        metadata: userMessage.metadata,
        audioUrl: userMessage.audio_url,
        timestamp: userMessage.created_at,
        detectedLanguage: detectedLanguage,
        languageName: getLanguageName(detectedLanguage),
        wasTranslated: needsTranslation,
        translatedText: needsTranslation ? englishText : null,
        translationMethod: usedTranslationFallback ? 'gemini_fallback' : 'google_translate'
      },
      aiResponse: {
        id: assistantMessage.id,
        content: assistantMessage.content || finalResponse,
        message: finalResponse,
        model: llmResponse.model,
        metadata: assistantMessage.metadata,
        audioUrl: assistantMessage.audio_url,
        timestamp: assistantMessage.created_at,
        originalEnglishText: responseTranslated ? llmResponse.text : null,
        wasTranslated: responseTranslated,
        translationFailed: responseTranslationFailed,
        targetLanguage: detectedLanguage
      },
      emotion: {
        detected: emotionResult.emotion,
        confidence: emotionResult.confidence,
        scores: emotionResult.scores
      },
      language: {
        detected: detectedLanguage,
        name: getLanguageName(detectedLanguage),
        supported: isLanguageSupported(detectedLanguage),
        inputTranslated: needsTranslation,
        outputTranslated: responseTranslated,
        translationFailed: translationFailed || responseTranslationFailed
      },
      hasContext: conversationHistory.length > 0,
      contextLength: conversationHistory.length
    };

    if (audioResponse) {
      donePayload.audio = {
        url: audioResponse.url,
        duration: audioResponse.duration
      };
    }

    console.log(`🎉 [stream] Chat processing completed successfully`);
    if (!clientClosed) {
      sendEvent('done', donePayload);
    }
    res.end();

  } catch (error) {
    console.error('❌ [stream] Error processing chat message:', error);
    if (!clientClosed) {
      sendEvent('error', {
        error: 'Failed to process chat message',
        details: error.message
      });
    }
    res.end();
  }
}));

/**
 * GET /api/chat/sessions
 * Get all chat sessions for a user from master_user_activity (UNIFIED)
 */
router.get('/sessions', asyncHandler(async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'User ID is required'
    });
  }

  try {
    const sessionData = await getUserChatSessionsUnified(userId);
    
    res.json({
      success: true,
      data: {
        sessions: sessionData.sessions,
        count: sessionData.total
      }
    });

  } catch (error) {
    console.error('❌ Error fetching unified chat sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch chat sessions',
      details: error.message
    });
  }
}));

/**
 * GET /api/chat/sessions/:sessionId/messages
 * Get all messages for a specific chat session
 */
router.get('/sessions/:sessionId/messages', asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'User ID is required'
    });
  }

  try {
    const messageData = await getChatMessagesUnified(sessionId, userId);
    
    res.json({
      success: true,
      data: {
        sessionId: sessionId,
        messages: messageData.messages,
        count: messageData.total,
        metadata: messageData.sessionMetadata
      }
    });

  } catch (error) {
    console.error('❌ Error fetching chat messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch chat messages',
      details: error.message
    });
  }
}));

/**
 * POST /api/chat/sessions
 * Create a new chat session
 */
router.post('/sessions', asyncHandler(async (req, res) => {
  const { userId, sessionTitle } = req.body;

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'User ID is required'
    });
  }

  try {
    const session = await createChatSession(userId, sessionTitle);
    
    res.json({
      success: true,
      data: session
    });

  } catch (error) {
    console.error('❌ Error creating chat session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create chat session',
      details: error.message
    });
  }
}));

/**
 * PUT /api/chat/sessions/:sessionId/title
 * Update session title
 */
router.put('/sessions/:sessionId/title', asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { userId, title } = req.body;

  if (!userId || !title) {
    return res.status(400).json({
      success: false,
      error: 'User ID and title are required'
    });
  }

  try {
    const session = await updateChatSessionTitle(userId, sessionId, title);
    
    res.json({
      success: true,
      data: session
    });

  } catch (error) {
    console.error('❌ Error updating session title:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update session title',
      details: error.message
    });
  }
}));

/**
 * DELETE /api/chat/sessions/:sessionId
 * Delete a chat session and all its messages
 */
router.delete('/sessions/:sessionId', asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'User ID is required'
    });
  }

  try {
    await deleteChatSession(userId, sessionId);
    
    res.json({
      success: true,
      message: 'Session deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting chat session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete chat session',
      details: error.message
    });
  }
}));

/**
 * POST /api/chat/voice
 * Process voice message: STT -> Emotion -> LLM -> TTS with context
 * 
 * Request:
 * - multipart/form-data
 * - audio: Audio file (WAV, MP3, OGG, WEBM)
 * - userId: User ID (required)
 * - sessionId: Session ID (optional - creates new if not provided)
 * - language: User language code (optional, default: en-US)
 */
router.post('/voice', upload.single('audio'), asyncHandler(async (req, res) => {
  const { userId, sessionId } = req.body;

  // Validate input
  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'User ID is required'
    });
  }

  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'Audio file is required'
    });
  }

  console.log(`🎙️ Processing multilingual voice message for user: ${userId}`);
  console.log(`📁 Audio file: ${req.file.originalname} (${req.file.mimetype}, ${req.file.size} bytes)`);

  try {
    // Step 1: Transcribe audio using Groq Whisper with automatic language detection
    console.log(`� Transcribing audio with Groq Whisper (auto-detect language)...`);
    
    // Import voice service for transcription
    const { speechToTextGroq } = await import('../voice-service/index.js');
    
    // Save audio buffer to temporary file for transcription
    const fs = await import('fs');
    const tempDir = path.join(__dirname, '../../temp/audio');
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const fileExt = path.extname(req.file.originalname) || '.webm';
    const tempFilePath = path.join(tempDir, `voice-${Date.now()}${fileExt}`);
    
    console.log(`📁 Received audio file: ${req.file.originalname} (${req.file.size} bytes)`);
    
    // Write buffer to file for Groq Whisper
    fs.writeFileSync(tempFilePath, req.file.buffer);
    
    const tempFileStats = fs.statSync(tempFilePath);
    console.log(`✅ Temp file written: ${tempFilePath} (${tempFileStats.size} bytes)`);
    
    // Transcribe with Groq Whisper (detects language automatically)
    const transcriptionResult = await speechToTextGroq(tempFilePath);
    
    // Clean up temp file and any converted WAV files
    try {
      fs.unlinkSync(tempFilePath);
      console.log(`🧹 Cleaned up temp file: ${tempFilePath}`);
    } catch (cleanupError) {
      console.warn('⚠️ Failed to cleanup temp file:', cleanupError.message);
    }
    
    const transcript = transcriptionResult.transcript;
    const whisperLanguage = transcriptionResult.language || 'en'; // Whisper returns language code
    
    // If transcription error occurred
    if (transcriptionResult.error) {
      console.error(`❌ Transcription error: ${transcriptionResult.error}`);
      return res.status(400).json({
        success: false,
        error: 'Speech transcription failed',
        details: {
          groqError: transcriptionResult.error,
          receivedFile: req.file.originalname,
          fileSize: req.file.size,
          message: 'The audio file could not be transcribed. Please try again with clearer audio.'
        }
      });
    }
    
    if (!transcript || transcript.trim().length === 0) {
      console.warn(`⚠️ Empty transcript received from Groq`);
      console.warn(`   Confidence: ${transcriptionResult.confidence}`);
      console.warn(`   File size: ${req.file.size} bytes`);
      
      return res.status(400).json({
        success: false,
        error: 'Speech transcription failed or no speech detected',
        details: {
          reason: 'Empty transcript - possibly no clear speech in audio',
          receivedFile: req.file.originalname,
          fileSize: req.file.size,
          confidence: transcriptionResult.confidence,
          suggestion: 'Please speak clearly and try again'
        }
      });
    }

    console.log(`✅ Whisper transcription: "${transcript}"`);
    console.log(`🌐 Detected language from Whisper: ${whisperLanguage}`);
    
    // Step 1.5: Validate if detected language is an Indian language
    const normalizedLanguage = normalizeIndianLanguageCode(whisperLanguage);
    const isIndianLang = isIndianLanguageSupported(normalizedLanguage);
    
    if (!isIndianLang) {
      console.warn(`⚠️  Non-Indian language detected: ${whisperLanguage}. Defaulting to Indian English.`);
    }
    
    console.log(`🇮🇳 Indian Language: ${getIndianLanguageName(normalizedLanguage)}`);

    // Step 2: Translate to English if needed (for internal chat reasoning)
    console.log(`🔄 Translating to English if needed...`);
    const translationResult = await translateToEnglishIfNeeded(transcript);
    
    const {
      translatedText: englishText,
      sourceLang: translationLanguage,
      needsTranslation,
      usedFallback: usedTranslationFallback,
      translationFailed
    } = translationResult;
    
    // Use normalized Indian language code
    const detectedLanguage = normalizedLanguage;

    console.log(`✅ Final Indian language: ${detectedLanguage} (${getIndianLanguageName(detectedLanguage)})`);
    
    if (needsTranslation) {
      console.log(`📝 English translation for processing: "${englishText}"`);
    }

    // Step 3: Get or create session
    let currentSessionId = sessionId;
    let isNewSession = false;
    
    if (!currentSessionId) {
      console.log(`🆕 Creating new voice chat session...`);
      
      const sessionTitle = transcript.length > 40 
        ? transcript.substring(0, 40).trim() + '...' 
        : transcript.trim();
      
      const newSession = await createChatSession(userId, sessionTitle);
      currentSessionId = newSession.id;
      isNewSession = true;
      
      console.log(`✅ Created new session for voice message`);
    }

    // Step 4: Get recent messages for context
    const memoryLength = parseInt(process.env.CHAT_MEMORY_LENGTH || 10);
    console.log(`🧠 Fetching last ${memoryLength} messages for context...`);
    const conversationHistory = await getRecentChatMessages(userId, currentSessionId, memoryLength);

    // Step 5: Analyze emotion from the English text
    console.log(`🔤 Analyzing emotion from transcript...`);
    const emotionResult = await analyzeTextEmotion(englishText);
    
    console.log(`✅ Emotion detected: ${emotionResult.emotion} (confidence: ${emotionResult.confidence})`);

    // Step 6: Save user message (voice transcript)
    console.log(`💾 Saving voice message...`);
    const userMessage = await saveChatMessage(
      userId, 
      currentSessionId, 
      'user', 
      transcript,
      {
        emotion: emotionResult.emotion,
        confidence: emotionResult.confidence,
        detectedLanguage: detectedLanguage,
        languageName: getLanguageName(detectedLanguage),
        wasTranslated: needsTranslation,
        translatedText: needsTranslation ? englishText : null,
        messageType: 'voice',
        audioFileName: req.file.originalname
      }
    );

    // Step 7: Generate empathetic AI response based on emotion and context
    console.log(`🤖 Generating AI response with conversation context...`);
    const llmResponse = await generateResponse({
      emotion: emotionResult.emotion,
      confidence: emotionResult.confidence,
      context: {
        userMessage: englishText,
        processedText: emotionResult.processedText,
        originalMessage: transcript,
        userLanguage: detectedLanguage
      },
      transcript: englishText,
      conversationHistory: conversationHistory
    });

    console.log(`✅ AI response generated`);

    // Step 8: Translate AI response back to user's language
    let finalResponse = llmResponse.text;
    let responseTranslated = false;
    let responseTranslationFailed = false;

    console.log(`📊 Translation Check:`);
    console.log(`   - Detected Language: ${detectedLanguage}`);
    console.log(`   - Needs Translation: ${needsTranslation}`);
    console.log(`   - LLM Response (English): "${llmResponse.text.substring(0, 100)}..."`);

    if (needsTranslation && detectedLanguage !== 'en' && detectedLanguage !== 'unknown') {
      console.log(`🔄 Translating AI response back to ${getLanguageName(detectedLanguage)}...`);
      
      try {
        finalResponse = await translateBackToUserLanguage(llmResponse.text, detectedLanguage);
        responseTranslated = true;
        console.log(`✅ Response translated back to user's language`);
        console.log(`   - Translated Response: "${finalResponse.substring(0, 100)}..."`);
      } catch (error) {
        console.error(`❌ Failed to translate response:`, error.message);
        finalResponse = llmResponse.text;
        responseTranslationFailed = true;
      }
    } else {
      console.log(`ℹ️  No translation needed - using English response`);
    }

    // Step 9: Save AI response to database
    console.log(`💾 Saving AI response...`);
    const assistantMessage = await saveChatMessage(
      userId, 
      currentSessionId, 
      'assistant', 
      finalResponse,
      {
        originalEnglishText: responseTranslated ? llmResponse.text : null,
        targetLanguage: detectedLanguage,
        wasTranslated: responseTranslated,
        translationFailed: responseTranslationFailed,
        messageType: 'voice_response'
      }
    );

    // Step 10: Update session title for new sessions
    if (isNewSession) {
      try {
        const titleText = transcript.length > 60 ? transcript.substring(0, 60).trim() + '...' : transcript.trim();
        let betterTitle = titleText;
        
        if (transcript.trim().length <= 10) {
          const emotionContext = emotionResult.emotion === 'neutral' ? 'Voice chat' : `${emotionResult.emotion} voice chat`;
          const languageContext = detectedLanguage !== 'en' ? ` (${getLanguageName(detectedLanguage)})` : '';
          betterTitle = `${emotionContext}${languageContext}`;
        }
        
        await updateChatSessionTitle(userId, currentSessionId, betterTitle);
        console.log(`✅ Updated session title to: "${betterTitle}"`);
      } catch (error) {
        console.warn(`⚠️ Failed to update session title:`, error.message);
      }
    }

    // Step 11: Generate audio response using TTS (Indian language voices)
    let audioResponse = null;
    if (finalResponse) {
      console.log(`🔊 Generating audio response with Indian TTS...`);
      try {
        // Use the Indian language TTS code
        const ttsLanguage = getIndianLanguageTTSCode(detectedLanguage);
        console.log(`🇮🇳 Using Indian TTS voice: ${ttsLanguage} for ${getIndianLanguageName(detectedLanguage)}`);
        audioResponse = await textToSpeech(finalResponse, ttsLanguage);
        console.log(`✅ Audio response generated in ${getIndianLanguageName(detectedLanguage)}`);
      } catch (audioError) {
        console.warn(`⚠️ Audio generation failed:`, audioError.message);
        // Continue without audio - don't fail the entire request
      }
    }

    // Step 12: Return comprehensive multilingual response
    console.log(`📤 Preparing multilingual response to frontend:`);
    console.log(`   📝 User Transcript (${detectedLanguage}): "${transcript.substring(0, 80)}"`);
    if (needsTranslation) {
      console.log(`   📝 English Translation: "${englishText.substring(0, 80)}"`);
    }
    console.log(`   🤖 AI Response English: "${llmResponse.text.substring(0, 80)}"`);
    if (responseTranslated) {
      console.log(`   🤖 AI Response (${detectedLanguage}): "${finalResponse.substring(0, 80)}"`);
    }
    
    const response = {
      success: true,
      data: {
        sessionId: currentSessionId,
        userMessage: {
          id: userMessage.id,
          content: userMessage.content || transcript,
          message: transcript,
          // Original user text in their language
          text: transcript,
          // English translation for internal processing
          englishText: needsTranslation ? englishText : null,
          transcript: transcript, // Keep for backward compatibility
          emotion: userMessage.emotion || emotionResult.emotion,
          emotionConfidence: userMessage.emotion_confidence ?? emotionResult.confidence,
          confidence: userMessage.emotion_confidence ?? emotionResult.confidence,
          metadata: userMessage.metadata,
          audioUrl: userMessage.audio_url,
          timestamp: userMessage.created_at,
          // Indian Language information
          detectedLanguage: detectedLanguage,
          languageName: getIndianLanguageName(detectedLanguage),
          isIndianLanguage: isIndianLanguageSupported(detectedLanguage),
          whisperLanguage: whisperLanguage,
          translationLanguage: translationLanguage,
          wasTranslated: needsTranslation,
          translationMethod: usedTranslationFallback ? 'gemini_fallback' : 'google_translate',
          translationFailed: translationFailed
        },
        aiResponse: {
          id: assistantMessage.id,
          content: assistantMessage.content || finalResponse,
          // Response in user's language
          message: finalResponse,
          text: finalResponse, // Add for consistency
          // Original English response
          englishText: llmResponse.text,
          originalEnglishText: llmResponse.text, // Keep for backward compatibility
          model: llmResponse.model,
          metadata: assistantMessage.metadata,
          audioUrl: assistantMessage.audio_url,
          timestamp: assistantMessage.created_at,
          // Translation info
          wasTranslated: responseTranslated,
          translationFailed: responseTranslationFailed,
          targetLanguage: detectedLanguage
        },
        emotion: {
          detected: emotionResult.emotion,
          confidence: emotionResult.confidence,
          scores: emotionResult.scores
        },
        language: {
          detected: detectedLanguage,
          name: getIndianLanguageName(detectedLanguage),
          isIndianLanguage: isIndianLanguageSupported(detectedLanguage),
          whisperDetected: whisperLanguage,
          translationDetected: translationLanguage,
          supported: isIndianLanguageSupported(detectedLanguage),
          inputTranslated: needsTranslation,
          outputTranslated: responseTranslated,
          ttsCode: getIndianLanguageTTSCode(detectedLanguage)
        },
        audio: audioResponse ? {
          url: audioResponse.audioUrl,
          duration: audioResponse.duration,
          provider: audioResponse.provider,
          language: detectedLanguage
        } : null,
        contextLength: conversationHistory.length,
        // Add transcript info for debugging
        transcription: {
          provider: 'groq_whisper',
          confidence: transcriptionResult.confidence,
          duration: transcriptionResult.duration,
          whisperLanguage: whisperLanguage
        }
      }
    };

    console.log(`🎉 Voice message processing completed successfully`);
    res.json(response);

  } catch (error) {
    console.error('❌ Error processing voice message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process voice message',
      details: error.message
    });
  }
}));

/**
 * Helper function to map language codes for TTS
 * @param {string} language - Language code (e.g., 'en', 'es', 'fr')
 * @returns {string} TTS-compatible language code (e.g., 'en-US', 'es-ES', 'fr-FR')
 */
function getLanguageCodeForTTS(language) {
  const languageMap = {
    'en': 'en-US',
    'es': 'es-ES',
    'fr': 'fr-FR',
    'de': 'de-DE',
    'it': 'it-IT',
    'pt': 'pt-BR',
    'ja': 'ja-JP',
    'ko': 'ko-KR',
    'zh': 'zh-CN',
    'ar': 'ar-SA',
    'hi': 'hi-IN',
    'ru': 'ru-RU'
  };

  // If exact match exists, return it
  if (languageMap[language]) {
    return languageMap[language];
  }

  // If it's a locale like 'en-US', return as is
  if (language.includes('-')) {
    return language;
  }

  // Default to English US if not found
  return 'en-US';
}

/**
 * POST /api/chat/transcribe
 * Transcribe audio using Whisper API (Groq or OpenAI)
 * Supports cross-browser audio recording with MediaRecorder
 * 
 * Request: multipart/form-data
 *   - audio: Audio file (WebM, MP3, WAV, OGG)
 *   - language?: Language code (optional, auto-detect if not provided)
 * 
 * Response: { success: true, data: { text: string, confidence: number, language: string } }
 */
router.post('/transcribe', upload.single('audio'), asyncHandler(async (req, res) => {
  console.log('🎙️ Transcribe endpoint called');

  // Validate audio file
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'Audio file is required'
    });
  }

  console.log(`📁 Audio file received: ${req.file.originalname} (${req.file.mimetype}, ${req.file.size} bytes)`);

  try {
    // Import voice service for Groq Whisper
    const { speechToTextGroq } = await import('../voice-service/index.js');
    
    // Save audio buffer to temporary file
    const fs = await import('fs');
    const tempDir = path.join(__dirname, '../../temp/audio');
    
    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Create temporary file with original extension
    const fileExt = path.extname(req.file.originalname) || '.webm';
    const tempFilePath = path.join(tempDir, `transcribe-${Date.now()}${fileExt}`);
    
    // Write buffer to file
    fs.writeFileSync(tempFilePath, req.file.buffer);
    console.log(`💾 Saved to temp file: ${tempFilePath}`);

    // Transcribe using Groq Whisper
    const transcriptionResult = await speechToTextGroq(tempFilePath);

    // Clean up temp file
    try {
      fs.unlinkSync(tempFilePath);
      console.log(`🗑️ Cleaned up temp file`);
    } catch (cleanupError) {
      console.warn('⚠️ Failed to cleanup temp file:', cleanupError.message);
    }

    // Return transcription result
    res.json({
      success: true,
      data: {
        text: transcriptionResult.transcript,
        confidence: transcriptionResult.confidence,
        language: transcriptionResult.language,
        provider: transcriptionResult.provider,
        duration: transcriptionResult.duration
      }
    });

    console.log(`✅ Transcription successful: "${transcriptionResult.transcript.substring(0, 50)}..."`);

  } catch (error) {
    console.error('❌ Transcription failed:', error);
    
    // Return error response
    res.status(500).json({
      success: false,
      error: 'Speech transcription failed',
      details: error.message
    });
  }
}));

export default router;