/**
 * Chat Routes
 * Handles chat-specific requests combining emotion analysis and response generation
 * Supports user-specific sessions and contextual conversations
 */

import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { analyzeTextEmotion } from '../text-service/index.js';
import { generateResponse } from '../llm-service/index.js';
import { generateSpeech } from '../tts-service/index.js';
import { 
  saveAnalysisResult, 
  createChatSession, 
  saveChatMessage, 
  getUserChatSessions, 
  getChatMessages, 
  getRecentChatMessages, 
  updateChatSessionTitle, 
  deleteChatSession 
} from '../storage-service/index.js';
import config from '../config/index.js';

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
    // Step 1: Get or create session
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      console.log(`🆕 Creating new chat session...`);
      const newSession = await createChatSession(userId, message.length > 50 ? message.substring(0, 50) + '...' : message);
      currentSessionId = newSession.id;
    }

    // Step 2: Get recent messages for context
    const memoryLength = parseInt(process.env.CHAT_MEMORY_LENGTH || 10);
    console.log(`🧠 Fetching last ${memoryLength} messages for context...`);
    const conversationHistory = await getRecentChatMessages(userId, currentSessionId, memoryLength);

    // Step 3: Analyze emotion from the message
    console.log(`🔤 Analyzing emotion...`);
    const emotionResult = await analyzeTextEmotion(message);
    
    console.log(`✅ Emotion detected: ${emotionResult.emotion} (confidence: ${emotionResult.confidence})`);

    // Step 4: Save user message to database
    console.log(`💾 Saving user message...`);
    const userMessage = await saveChatMessage(
      userId, 
      currentSessionId, 
      'user', 
      message, 
      {
        emotion: emotionResult.emotion,
        confidence: emotionResult.confidence
      }
    );

    // Step 5: Generate empathetic AI response based on emotion and context
    console.log(`🤖 Generating AI response with conversation context...`);
    const llmResponse = await generateResponse({
      emotion: emotionResult.emotion,
      confidence: emotionResult.confidence,
      context: {
        userMessage: message,
        processedText: emotionResult.processedText
      },
      transcript: message,
      conversationHistory: conversationHistory
    });

    console.log(`✅ AI response generated: "${llmResponse.text ? llmResponse.text.substring(0, 100) : 'No response'}..."`);

    // Step 6: Save AI response to database
    console.log(`💾 Saving AI response...`);
    const assistantMessage = await saveChatMessage(
      userId, 
      currentSessionId, 
      'assistant', 
      llmResponse.text
    );

    // Step 7: Generate audio response if requested
    let audioResponse = null;
    if (includeAudio && llmResponse.text) {
      console.log(`🔊 Generating audio response...`);
      try {
        audioResponse = await generateSpeech(llmResponse.text);
        console.log(`✅ Audio response generated`);
      } catch (audioError) {
        console.warn(`⚠️ Audio generation failed:`, audioError.message);
        // Continue without audio - don't fail the entire request
      }
    }

    // Step 8: Return comprehensive response
    const response = {
      success: true,
      data: {
        sessionId: currentSessionId,
        userMessage: {
          id: userMessage.id,
          message: message,
          emotion: emotionResult.emotion,
          confidence: emotionResult.confidence,
          timestamp: userMessage.created_at
        },
        aiResponse: {
          id: assistantMessage.id,
          message: llmResponse.text,
          model: llmResponse.model,
          timestamp: assistantMessage.created_at
        },
        emotion: {
          detected: emotionResult.emotion,
          confidence: emotionResult.confidence,
          scores: emotionResult.scores
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
 * GET /api/chat/sessions
 * Get all chat sessions for a user
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
    const sessions = await getUserChatSessions(userId);
    
    res.json({
      success: true,
      data: {
        sessions: sessions,
        count: sessions.length
      }
    });

  } catch (error) {
    console.error('❌ Error fetching chat sessions:', error);
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
    const messages = await getChatMessages(userId, sessionId);
    
    res.json({
      success: true,
      data: {
        sessionId: sessionId,
        messages: messages,
        count: messages.length
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

export default router;