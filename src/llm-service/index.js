/**
 * LLM Service Module
 * Generates empathetic responses using LLM (Gemini primary, LLaMA fallback)
 * 
 * This module:
 * 1. Receives emotion and context
 * 2. Creates appropriate prompts for empathetic responses
 * 3. Calls Gemini API (primary)
 * 4. Falls back to LLaMA if Gemini fails
 * 5. Returns generated response text
 */

import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../config/index.js';

/**
 * Create empathetic prompt based on emotion and context
 */
export const createEmpatheticPrompt = (emotion, context, transcript) => {
  const emotionPrompts = {
    happy: "The user is expressing happiness and joy. Respond with warmth and encouragement. Celebrate their positive moment.",
    sad: "The user is feeling sad or down. Respond with empathy, understanding, and gentle support. Validate their feelings.",
    angry: "The user is expressing anger or frustration. Respond with calm understanding and help them process their feelings.",
    fear: "The user is experiencing fear or anxiety. Respond with reassurance, comfort, and practical support.",
    surprise: "The user is surprised. Respond with curiosity and help them process this unexpected situation.",
    disgust: "The user is expressing disgust or discomfort. Respond with understanding and validation.",
    neutral: "The user is in a neutral emotional state. Respond conversationally and be helpful."
  };

  const emotionGuidance = emotionPrompts[emotion] || emotionPrompts.neutral;

  let prompt = `You are an empathetic AI assistant designed to provide emotional support and understanding.

CONTEXT:
- Detected Emotion: ${emotion}
- Confidence: ${context?.confidence || 'N/A'}
${transcript ? `- User said: "${transcript}"` : ''}
${context?.context ? `- Additional context: ${context.context}` : ''}

GUIDELINES:
${emotionGuidance}

RESPONSE REQUIREMENTS:
- Be warm, genuine, and human-like
- Keep response concise (2-3 sentences)
- Use simple, natural language
- Show understanding of their emotional state
- Offer support or encouragement as appropriate
- Do NOT mention that you're an AI unless relevant
- Do NOT explain emotion detection or confidence scores

Please provide an empathetic response:`;

  return prompt;
};

/**
 * Call Gemini API to generate response
 * Primary LLM service with model fallback
 */
export const generateWithGemini = async (prompt) => {
  const apiKey = config.gemini.apiKey;
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  // Initialize Gemini AI
  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Generation config
  const generationConfig = {
    temperature: config.gemini.temperature,
    topK: config.gemini.topK,
    topP: config.gemini.topP,
    maxOutputTokens: config.gemini.maxTokens
  };

  // Try each model in the fallback array
  const models = config.gemini.models;
  let lastError = null;

  for (const [index, modelName] of models.entries()) {
    try {
      console.log(`🤖 Attempting Gemini API with model: ${modelName} (${index + 1}/${models.length})`);

      // Get the generative model
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig
      });

      // Generate content
      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = response.text().trim();

      console.log(`✅ Gemini response generated successfully with ${modelName}`);

      return {
        text,
        model: `gemini-${modelName}`,
        success: true
      };

    } catch (error) {
      lastError = error;
      console.warn(`⚠️  Model ${modelName} failed: ${error.message}`);
      
      // If not the last model, try the next one
      if (index < models.length - 1) {
        console.log(`🔄 Trying next model...`);
        continue;
      }
    }
  }

  // All models failed
  console.error('❌ All Gemini models failed');
  throw new Error(`Gemini API call failed after trying ${models.length} models: ${lastError?.message || 'Unknown error'}`);
};

/**
 * Call LLaMA API to generate response via Groq
 * Fallback LLM service
 */
export const generateWithLLaMA = async (prompt) => {
  // Check if LLaMA is enabled before attempting
  if (!config.llama.enabled) {
    console.log(`⚠️  LLaMA is disabled in configuration, skipping...`);
    throw new Error('LLaMA is not enabled in configuration');
  }

  if (!config.llama.apiKey) {
    throw new Error('Groq API key not configured for LLaMA');
  }

  try {
    console.log(`🤖 Calling LLaMA via Groq (${config.llama.model})...`);

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: config.llama.model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: config.llama.temperature,
        max_tokens: config.llama.maxTokens,
        top_p: 0.9
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.llama.apiKey}`
        },
        timeout: 30000 // 30 second timeout
      }
    );

    // Extract text from Groq response
    const generatedText = response.data.choices?.[0]?.message?.content;
    
    if (!generatedText) {
      throw new Error('No response text from Groq LLaMA API');
    }
    
    console.log(`✅ LLaMA (Groq) response generated successfully`);

    return {
      text: generatedText.trim(),
      model: `llama-groq-${config.llama.model}`,
      success: true
    };
  } catch (error) {
    console.error('❌ Error calling LLaMA API:', error.response?.data?.error?.message || error.message);
    throw new Error('LLaMA API call failed: ' + (error.response?.data?.error?.message || error.message));
  }
};

/**
 * Generate fallback response when all LLMs fail
 */
export const generateFallbackResponse = (emotion) => {
  const fallbackResponses = {
    happy: "That's wonderful to hear! I'm glad you're feeling good. Keep embracing those positive moments!",
    sad: "I hear you, and I want you to know that it's okay to feel this way. I'm here for you, and things will get better.",
    angry: "I understand you're feeling frustrated right now. Take a deep breath - your feelings are valid. Let's work through this together.",
    fear: "It's completely normal to feel anxious sometimes. Remember that you're stronger than you think, and I'm here to support you.",
    surprise: "That sounds unexpected! Life can throw curveballs sometimes. How are you feeling about it?",
    disgust: "I can sense your discomfort. Your reaction is valid, and it's important to trust your feelings.",
    neutral: "I'm here and listening. Feel free to share what's on your mind whenever you're ready."
  };

  return {
    text: fallbackResponses[emotion] || fallbackResponses.neutral,
    model: 'fallback',
    success: true,
    isFallback: true
  };
};

/**
 * Main function: Generate empathetic response
 * This is the primary export used by routes
 * Implements auto-switch logic: Gemini -> LLaMA -> Fallback
 */
export const generateResponse = async ({ emotion, confidence, context, transcript, conversationHistory = [] }) => {
  console.log(`💬 Generating empathetic response for emotion: ${emotion}`);

  // Create prompt
  const prompt = createEmpatheticPrompt(emotion, { confidence, context }, transcript);

  // Try Gemini first
  try {
    const geminiResponse = await generateWithGemini(prompt);
    return geminiResponse;
  } catch (geminiError) {
    console.warn(`⚠️  Gemini failed: ${geminiError.message}`);

    // Try LLaMA as fallback only if enabled
    if (config.llama.enabled) {
      console.log('🔄 Attempting LLaMA fallback...');
      try {
        const llamaResponse = await generateWithLLaMA(prompt);
        return llamaResponse;
      } catch (llamaError) {
        console.warn(`⚠️  LLaMA fallback failed: ${llamaError.message}`);
      }
    } else {
      console.log('⚠️  LLaMA is disabled, skipping fallback...');
    }

    // Use static fallback if LLaMA is disabled or failed
    console.log('📝 Using static fallback response...');
    const fallbackResponse = generateFallbackResponse(emotion);
    return fallbackResponse;
  }
};

/**
 * Generate conversational response (for chat continuation)
 */
export const generateConversationalResponse = async ({ message, emotion = 'neutral', conversationHistory = [] }) => {
  console.log(`💬 Generating conversational response...`);

  // Build conversation context
  let conversationContext = '';
  if (conversationHistory.length > 0) {
    conversationContext = '\n\nPREVIOUS CONVERSATION:\n';
    conversationHistory.forEach((msg, idx) => {
      conversationContext += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
    });
  }

  const prompt = `You are an empathetic AI assistant. The user is in a ${emotion} emotional state.

${conversationContext}

User: ${message}

Provide a helpful, empathetic response (2-3 sentences):`;

  // Try Gemini -> LLaMA -> Fallback
  try {
    return await generateWithGemini(prompt);
  } catch (error) {
    try {
      return await generateWithLLaMA(prompt);
    } catch (error) {
      return generateFallbackResponse(emotion);
    }
  }
};
