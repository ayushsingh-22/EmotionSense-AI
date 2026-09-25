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
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import config from '../config/index.js';
import { indianContextConfig } from '../config/indianContext.js';
import { getGeminiModelList, getGroqChatModel } from '../utils/modelCatalog.js';

/**
 * Build Indian context guidance based on detected topic
 */
const buildIndianContextGuidance = (topic) => {
  const guidance = {
    finance: `
• Acknowledge the financial pressure - many Indian families face these challenges
• Suggest government schemes like PM Kisan, Mudra loans, RBI savings schemes
• Recommend community solutions: chit funds, family lending circles
• Discuss realistic budgeting for festivals/celebrations
• Involve family members in financial decisions
• Explore employer benefits and health insurance options
• Suggest free/subsidized government resources`,
    
    marriage: `
• Understand family expectations and cultural norms around marriage
• Acknowledge the importance of parental approval and family consent
• Discuss respectful ways to involve family in decision-making
• Be aware of dowry concerns and societal pressures
• Respect caste, religion, and community considerations mentioned
• Help navigate arranged vs. love marriage acceptance
• Suggest community elders or counselors for guidance`,
    
    education: `
• Acknowledge India's exam-focused education culture and high competition
• Recognize pressure from JEE, NEET, board exams, competitive exams
• Understand role of coaching classes and academic stress
• Provide perspective on multiple career paths beyond "standard" routes
• Discuss government job aspirations (IAS, IPS, SSC)
• Help manage parental expectations about education
• Suggest stress-management and work-life balance`,
    
    career: `
• Acknowledge competitive Indian job market with quota system
• Discuss government job aspirations realistically (IAS, IPS, SSC, PSU)
• Understand family expectations around "secure" employment
• Help navigate location changes and migration concerns
• Discuss skill development and continuous learning
• Acknowledge role of networks and connections in Indian workplace
• Suggest government resources for job training and placement`,
    
    family: `
• Respect joint family system and multi-generational living
• Acknowledge elder care responsibilities and filial duties
• Understand decision-making is often collective, not individual
• Help navigate conflicts while respecting hierarchy
• Discuss cultural values of respect, sacrifice, and duty
• Suggest involving trusted family members in problem-solving
• Acknowledge financial interdependence in joint families`,
    
    emergency: `
• IMMEDIATELY: This is serious. Encourage reaching out to: 
  - Family members immediately
  - AASRA (9820466726), iCall (9152987821), Vandrevala Foundation (9999 666 555)
  - Local hospitals or emergency services
• Emphasize that family support and professional help are crucial
• Religious/spiritual resources may provide comfort
• Do NOT dismiss or minimize their feelings
• Help them see reasons to live and connect with support systems`
  };
  
  return guidance[topic] || "Consider the user's Indian context: family values, economic constraints, social norms, and cultural expectations.";
};

/**
 * Detect non-emotional intents that should bypass LLM generation
 */
const EMOTIONAL_KEYWORDS = [
  'feel',
  'feeling',
  'emotion',
  'stress',
  'stressed',
  'anxious',
  'anxiety',
  'sad',
  'depressed',
  'depression',
  'lonely',
  'alone',
  'angry',
  'upset',
  'hurt',
  'scared',
  'worried',
  'guilty',
  'overwhelmed',
  'cope',
  'coping',
  'grief'
];

const NON_EMOTIONAL_PATTERNS = [
  {
    category: 'technical or account support',
    keywords: [
      'password',
      'reset my password',
      'forgot password',
      'login issue',
      'sign in problem',
      'verification code',
      'otp',
      'account locked',
      'bug report',
      'error code',
      'app not working',
      'software update',
      'install the app',
      'device issue',
      'internet not working'
    ]
  },
  {
    category: 'orders, billing, or subscription requests',
    keywords: [
      'order status',
      'shipping',
      'delivery',
      'refund',
      'return my order',
      'exchange',
      'cancel my order',
      'tracking number',
      'invoice',
      'payment failed',
      'subscription',
      'billing support'
    ]
  },
  {
    category: 'general knowledge or factual questions',
    keywords: [
      'capital of',
      'who is',
      'what is',
      'definition of',
      'history of',
      'recipe',
      'weather forecast',
      'latest news',
      'sports score',
      'stock price'
    ]
  },
  {
    category: 'coding or math help',
    keywords: [
      'write code',
      'fix this code',
      'compile error',
      'algorithm',
      'python',
      'java',
      'javascript',
      'sql query',
      'solve this equation',
      'math problem',
      'derivative'
    ]
  },
  {
    category: 'legal, medical, or financial services',
    keywords: [
      'legal advice',
      'sue someone',
      'attorney',
      'court case',
      'medical diagnosis',
      'prescription',
      'treatment plan',
      'side effects',
      'investment tips',
      'open a bank account',
      'loan eligibility'
    ]
  }
];

const detectNonEmotionalIntent = (message = '', conversationHistory = []) => {
  const haystacks = [];

  if (typeof message === 'string' && message.trim().length > 0) {
    haystacks.push(message.toLowerCase());
  }

  if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
    conversationHistory
      .filter((item) => item && item.role === 'user' && typeof item.message === 'string')
      .slice(-4)
      .forEach((item) => haystacks.push(item.message.toLowerCase()));
  }

  if (haystacks.length === 0) {
    return { blocked: false };
  }

  const primaryText = haystacks[0];
  const primaryHasEmotion = EMOTIONAL_KEYWORDS.some((word) => primaryText.includes(word));

  for (const pattern of NON_EMOTIONAL_PATTERNS) {
    for (const keyword of pattern.keywords) {
      if (!primaryHasEmotion && primaryText.includes(keyword)) {
        return {
          blocked: true,
          category: pattern.category,
          keyword
        };
      }
    }
  }

  // Fallback: if the most recent message is emotional, still check older ones
  for (const pattern of NON_EMOTIONAL_PATTERNS) {
    for (const keyword of pattern.keywords) {
      const match = haystacks.slice(1).find((text) => {
        if (!text.includes(keyword)) {
          return false;
        }
        const hasEmotion = EMOTIONAL_KEYWORDS.some((word) => text.includes(word));
        return !hasEmotion;
      });

      if (match) {
        return {
          blocked: true,
          category: pattern.category,
          keyword
        };
      }
    }
  }

  return { blocked: false };
};

const buildScopeBoundaryMessage = (category) => {
  const focusLine = 'I am here to support emotional wellbeing, feelings, and coping strategies.';
  const categoryLine = category ? `It sounds like your question is about ${category}, which I am not able to help with directly.` : 'Your question seems outside that focus.';
  const redirectLine = 'If something about this is causing stress or difficult feelings, let me know so I can support you emotionally.';
  return `${focusLine} ${categoryLine} ${redirectLine}`;
};

/**
 * Create empathetic prompt based on emotion, context, and chat history
 * Enhanced to provide better continuity and context awareness
 * IMPORTANT: Uses conversation history to understand the actual topic, not just emotion
 * NOW WITH INDIAN CONTEXT: Considers Indian cultural, economic, and social aspects
 */
export const createEmpatheticPrompt = (emotion, context, transcript, chatHistory = []) => {
  const emotionPrompts = {
    joy: "The user might be expressing some positivity, but FIRST check the conversation history to understand the actual situation. They may be asking HOW to be happy, or seeking hope despite difficulties.",
    sadness: "The user is feeling sad or down. Respond with empathy, understanding, and gentle support. Validate their feelings.",
    anger: "The user is expressing anger or frustration. Respond with calm understanding and help them process their feelings.",
    fear: "The user is experiencing fear or anxiety. Respond with reassurance, comfort, and practical support.",
    surprise: "The user is surprised. Respond with curiosity and help them process this unexpected situation.",
    disgust: "The user is expressing disgust or discomfort. Respond with understanding and validation.",
    neutral: "The user is in a neutral emotional state. Respond conversationally and be helpful."
  };

  const emotionGuidance = emotionPrompts[emotion] || emotionPrompts.neutral;
  
  // Determine the actual underlying topic from conversation history
  let underlyingTopic = "general conversation";
  let detectedContext = { isIndianRelevant: false, topic: '', keywords: [] };
  
  if (chatHistory && chatHistory.length > 0) {
    const recentUserMessages = chatHistory.filter(msg => msg.role === 'user').map(msg => msg.message.toLowerCase());
    const allText = recentUserMessages.join(' ');
    
    if (recentUserMessages.some(msg => msg.includes('money') || msg.includes('afford') || msg.includes('celebrate') || msg.includes('festival') || msg.includes('diwali') || msg.includes('holi') || msg.includes('eid') || msg.includes('loan'))) {
      underlyingTopic = "financial hardship and festival/celebration expenses (Indian context)";
      detectedContext = { isIndianRelevant: true, topic: 'finance', keywords: ['money', 'festival', 'celebrate'] };
    } else if (recentUserMessages.some(msg => msg.includes('die') || msg.includes('suicide') || msg.includes('harm'))) {
      underlyingTopic = "suicidal thoughts or severe distress";
      detectedContext = { isIndianRelevant: true, topic: 'emergency', keywords: ['suicide', 'harm'] };
    } else if (recentUserMessages.some(msg => msg.includes('marriage') || msg.includes('arrange') || msg.includes('parent') || msg.includes('approval') || msg.includes('dowry'))) {
      underlyingTopic = "marriage and family approval (Indian context)";
      detectedContext = { isIndianRelevant: true, topic: 'marriage', keywords: ['marriage', 'parent', 'approval'] };
    } else if (recentUserMessages.some(msg => msg.includes('exam') || msg.includes('jee') || msg.includes('neet') || msg.includes('board') || msg.includes('iit') || msg.includes('coaching'))) {
      underlyingTopic = "academic pressure and competitive exams (Indian context)";
      detectedContext = { isIndianRelevant: true, topic: 'education', keywords: ['exam', 'jee', 'neet', 'board'] };
    } else if (recentUserMessages.some(msg => msg.includes('job') || msg.includes('ias') || msg.includes('ips') || msg.includes('government') || msg.includes('ssc') || msg.includes('career'))) {
      underlyingTopic = "career and job prospects (Indian context)";
      detectedContext = { isIndianRelevant: true, topic: 'career', keywords: ['job', 'ias', 'career'] };
    } else if (recentUserMessages.some(msg => msg.includes('parent') || msg.includes('father') || msg.includes('mother') || msg.includes('elder') || msg.includes('grandmother') || msg.includes('family'))) {
      underlyingTopic = "family relationships and obligations (Indian context)";
      detectedContext = { isIndianRelevant: true, topic: 'family', keywords: ['parent', 'family', 'elder'] };
    } else if (recentUserMessages.some(msg => msg.includes('break') || msg.includes('betray') || msg.includes('friend') || msg.includes('hurt'))) {
      underlyingTopic = "relationship betrayal or emotional pain";
      detectedContext = { isIndianRelevant: false, topic: 'relationships', keywords: ['break', 'betray', 'friend'] };
    } else if (recentUserMessages.some(msg => msg.includes('work') || msg.includes('boss'))) {
      underlyingTopic = "work-related stress or issues";
      detectedContext = { isIndianRelevant: false, topic: 'work', keywords: ['work', 'boss'] };
    }
  }

  // Start with system context and guidelines - INCLUDE INDIAN CONTEXT
  let prompt = `${indianContextConfig.systemPrompt}

===========================================
CONVERSATION CONTEXT
===========================================

IMPORTANT: This is a CONTINUOUS conversation about: ${underlyingTopic}

You have access to previous messages in this conversation thread. Use them to provide coherent, contextual responses that reference the conversation thread when appropriate.

CRITICAL: Focus on the UNDERLYING TOPIC (${underlyingTopic}), not just the detected emotion. The emotion detection helps understand HOW the user feels, but the conversation history shows WHAT they're dealing with.

CURRENT MESSAGE CONTEXT:
- Underlying Topic: ${underlyingTopic}
- Detected Emotion: ${emotion}
- Confidence: ${context?.confidence || 'N/A'}
${transcript ? `- User's current message: "${transcript}"` : ''}
${context?.context ? `- Additional context: ${context.context}` : ''}

EMOTIONAL GUIDANCE:
${emotionGuidance}

${detectedContext.isIndianRelevant ? `
===========================================
INDIAN CONTEXT DETECTED - SPECIAL GUIDANCE
===========================================
This appears to be related to: ${detectedContext.topic}
Key aspects for Indian users in this situation:
${buildIndianContextGuidance(detectedContext.topic)}
` : ''}`;

  // Add chat history for context - make it prominent and well-formatted
  if (chatHistory && chatHistory.length > 0) {
    prompt += `\n\n${'═'.repeat(70)}
CONVERSATION HISTORY - UNDERSTANDING THE SITUATION
${'═'.repeat(70)}

Situation: The user is dealing with: ${underlyingTopic}

Previous messages in conversation:`;
    
    chatHistory.forEach((msg, index) => {
      const role = msg.role === 'user' ? '👤 User' : '🤖 Assistant';
      const emotion = msg.emotion_detected ? ` [${msg.emotion_detected.toUpperCase()}]` : '';
      const timestamp = msg.created_at ? new Date(msg.created_at).toLocaleTimeString() : '';
      prompt += `\n\n[${index + 1}] ${role}${emotion}${timestamp ? ` (${timestamp})` : ''}:\n"${msg.message}"`;
    });
    
    prompt += `\n\n${'═'.repeat(70)}
CRITICAL INSTRUCTIONS FOR RESPONDING:
${'═'.repeat(70)}

✓ UNDERSTAND THE REAL SITUATION: The user is dealing with ${underlyingTopic}
✓ RESPOND TO THE TOPIC, NOT JUST EMOTION: Focus on their actual problem/need
✓ REFERENCE THE CONVERSATION: Show you remember what they've told you
✓ BUILD ON PREVIOUS MESSAGES: Connect your response to their earlier statements
✓ MAINTAIN CONTINUITY: Keep supporting them on this specific journey
✓ BE SPECIFIC: Use examples from their story, not generic advice
✓ ACKNOWLEDGE THEIR FEELINGS: Validate their emotions in context of their situation
✓ PROVIDE PRACTICAL HELP: When they ask "how to overcome", give specific suggestions related to their situation

EXAMPLE:
- If they mention financial hardship → suggest practical solutions (saving, budgeting, community resources)
- If they mention loneliness → suggest connection strategies
- If they mention loss → offer grieving support
- NOT: Change topic or respond to a different emotion`;
  }

  prompt += `

RESPONSE REQUIREMENTS:
- Be warm, genuine, and conversational
- Keep response concise (1-2 sentences, or more if continuing an important thread)
- Use simple, natural language
- Show you understand their emotional journey AND their real-life situation
- Consider Indian values: family, duty, respect, hard work, education, community
- Offer support or encouragement as appropriate
- Reference previous messages and the underlying topic when helpful
- Suggest solutions considering Indian economic realities and social structures
- Do NOT start fresh - treat this as an ongoing conversation
- Do NOT ignore the real topic in favor of emotion detection
- Do NOT provide generic advice - be specific to THEIR situation and INDIAN context
- Do NOT ignore cultural/family aspects when relevant
- Do NOT say "I don't remember" - you have the conversation history above

Now respond to help them with: ${underlyingTopic}
Current message: "${transcript}"

RESPOND NATURALLY, CONTEXTUALLY, AND WITH INDIAN AWARENESS:`;

  return prompt;
};

/**
 * Call Gemini API to generate response
 * Primary LLM service with model fallback
 */
export const generateWithGemini = async (prompt) => {
  // Try every configured API key (new single GEMINI_API_KEY and/or the
  // legacy GEMINI_API_KEY1/2 pair — see config/index.js) in sequence.
  const apiKeys = config.gemini.apiKeys;

  if (apiKeys.length === 0) {
    throw new Error('No Gemini API keys configured');
  }

  // Generation config
  const generationConfig = {
    temperature: config.gemini.temperature,
    topK: config.gemini.topK,
    topP: config.gemini.topP,
    maxOutputTokens: config.gemini.maxTokens
  };

  // Safety settings - Allow emotional content but block harmful content
  const safetySettings = [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
  ];

  let error;

  // Best-suited models available right now (daily-refreshed; see modelCatalog.js).
  // Cap how many we try per key: the list can contain a dozen+ live Gemini
  // models, and with no cap a single rate-limited/hanging model can push the
  // whole chain past the frontend's 60s axios timeout before we ever fall
  // back to LLaMA. Top 2 (already sorted best-first) keeps worst case bounded.
  const models = (await getGeminiModelList()).slice(0, 2);

  // Per-attempt timeout so one slow/hanging model can't eat the whole budget.
  const GEMINI_ATTEMPT_TIMEOUT_MS = 12000;
  const withTimeout = (promise, ms, label) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms))
  ]);

  for (const [keyIndex, apiKey] of apiKeys.entries()) {
    for (const modelName of models) {
      try {
        console.log(`🤖 Attempting Gemini API Key ${keyIndex + 1} with model: ${modelName}`);
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig,
          safetySettings
        });
        const result = await withTimeout(
          model.generateContent(prompt),
          GEMINI_ATTEMPT_TIMEOUT_MS,
          `Gemini ${modelName}`
        );
        const response = result.response;

        // Check if response was blocked by safety filters
        if (response.promptFeedback?.blockReason) {
          console.warn(`⚠️ Response blocked by safety filter: ${response.promptFeedback.blockReason}`);
          throw new Error(`Response blocked: ${response.promptFeedback.blockReason}`);
        }

        const text = response.text()?.trim();

        // Validate that we got actual content
        if (!text || text.length === 0) {
          console.warn(`⚠️ Empty response received from Gemini model: ${modelName}`);
          throw new Error('Empty response received from Gemini');
        }

        console.log(`✅ Gemini response generated with ${modelName} (API Key ${keyIndex + 1})`);
        console.log(`📝 Response preview: "${text.substring(0, 100)}..."`);
        return {
          text,
          model: `gemini-${modelName}`,
          success: true
        };
      } catch (err) {
        console.warn(`API Key ${keyIndex + 1} with ${modelName} failed:`, err.message);
        error = err;
      }
    }
  }

  // If every key/model combination failed, throw the last error
  throw new Error(`All Gemini API keys failed. Last error: ${error?.message || 'Unknown error'}`);
};

/**
 * Call Gemini API to generate response as a token stream.
 * Mirrors generateWithGemini's key/model fallback chain, but calls
 * generateContentStream(...) and invokes onToken(chunkText) as chunks arrive.
 * Resolves with the full accumulated text + model name on success.
 * If a model/key attempt fails BEFORE emitting any tokens, it moves on to the
 * next one transparently (same as the non-streaming version). If a stream
 * fails PARTWAY THROUGH (after some tokens were already sent to the client),
 * we cannot silently retry with a different model — the caller (generateResponse)
 * is responsible for falling back to LLaMA/static and treating that as
 * continuation text, since some tokens have already been streamed out.
 */
export const generateWithGeminiStream = async (prompt, onToken) => {
  const apiKeys = config.gemini.apiKeys;

  if (apiKeys.length === 0) {
    throw new Error('No Gemini API keys configured');
  }

  const generationConfig = {
    temperature: config.gemini.temperature,
    topK: config.gemini.topK,
    topP: config.gemini.topP,
    maxOutputTokens: config.gemini.maxTokens
  };

  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  ];

  let error;
  const models = (await getGeminiModelList()).slice(0, 2);
  const GEMINI_ATTEMPT_TIMEOUT_MS = 12000;

  for (const [keyIndex, apiKey] of apiKeys.entries()) {
    for (const modelName of models) {
      let accumulated = '';
      let emittedAnyToken = false;
      try {
        console.log(`🤖 [stream] Attempting Gemini API Key ${keyIndex + 1} with model: ${modelName}`);
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig,
          safetySettings
        });

        // Start the stream, with a timeout guarding only the initial connect —
        // once chunks start flowing we let them keep flowing rather than
        // aborting a partially-streamed response.
        const streamResultPromise = model.generateContentStream(prompt);
        const streamResult = await Promise.race([
          streamResultPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error(`Gemini ${modelName} stream start timed out after ${GEMINI_ATTEMPT_TIMEOUT_MS}ms`)), GEMINI_ATTEMPT_TIMEOUT_MS))
        ]);

        for await (const chunk of streamResult.stream) {
          const chunkText = chunk.text();
          if (chunkText) {
            accumulated += chunkText;
            emittedAnyToken = true;
            onToken(chunkText);
          }
        }

        // Confirm the aggregated response wasn't blocked by safety filters
        const finalResponse = await streamResult.response;
        if (finalResponse?.promptFeedback?.blockReason && !accumulated) {
          throw new Error(`Response blocked: ${finalResponse.promptFeedback.blockReason}`);
        }

        if (!accumulated || accumulated.trim().length === 0) {
          console.warn(`⚠️ Empty streamed response received from Gemini model: ${modelName}`);
          throw new Error('Empty response received from Gemini stream');
        }

        console.log(`✅ Gemini stream completed with ${modelName} (API Key ${keyIndex + 1})`);
        return {
          text: accumulated.trim(),
          model: `gemini-${modelName}`,
          success: true
        };
      } catch (err) {
        console.warn(`[stream] API Key ${keyIndex + 1} with ${modelName} failed:`, err.message);
        error = err;

        // If we already streamed some tokens to the client before failing,
        // we can't pretend this attempt didn't happen — surface it as a
        // partial-stream error so the caller knows not to re-emit from scratch.
        if (emittedAnyToken) {
          const partialErr = new Error(`Gemini stream failed mid-response: ${err.message}`);
          partialErr.partialText = accumulated;
          partialErr.isPartialStreamFailure = true;
          throw partialErr;
        }
        // Otherwise fall through and try the next model/key.
      }
    }
  }

  throw new Error(`All Gemini API keys failed (stream). Last error: ${error?.message || 'Unknown error'}`);
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
    const modelName = await getGroqChatModel();
    console.log(`🤖 Calling LLaMA via Groq (${modelName})...`);

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: modelName,
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
      model: `llama-groq-${modelName}`,
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
    joy: "That's wonderful to hear! I'm so glad you're feeling good. Keep embracing those positive moments - your family and loved ones would be happy to see your joy!",
    sadness: "I hear you, and I want you to know that it's okay to feel this way. I'm here for you, and remember - you have your family and community around you. Things will get better with time and support.",
    anger: "I understand you're feeling frustrated right now. Take a deep breath - your feelings are valid. It might help to talk with someone you trust or take some time for yourself. Let's work through this together.",
    fear: "It's completely normal to feel anxious sometimes. Remember that you're stronger than you think, and you're not alone - your family, friends, and community are there to support you. I'm here too.",
    surprise: "That sounds unexpected! Life can throw curveballs sometimes. It might help to talk with someone you trust about what you're feeling. How can I help you process this?",
    disgust: "I can sense your discomfort. Your reaction is valid, and it's important to trust your feelings. Talk to someone you trust about this when you're ready.",
    neutral: "I'm here and listening. Feel free to share what's on your mind whenever you're ready - I understand Indian challenges and will try my best to help with solutions relevant to you."
  };

  return {
    text: fallbackResponses[emotion] || fallbackResponses.neutral,
    model: 'fallback',
    success: true,
    isFallback: true,
    indianContextAware: true
  };
};

/**
 * Main function: Generate empathetic response
 * This is the primary export used by routes
 * Implements auto-switch logic: Gemini -> LLaMA -> Fallback
 */
export const generateResponse = async ({ emotion, confidence, context, transcript, conversationHistory = [] }) => {
  console.log(`💬 Generating empathetic response for emotion: ${emotion}`);
  console.log(`🇮🇳 Indian Context Awareness: ENABLED - Responses will be tailored for Indian users`);

  // Guardrail: block non-emotional requests
  const scopeCheck = detectNonEmotionalIntent(transcript, conversationHistory);
  if (scopeCheck.blocked) {
    console.log(`🚧 Message appears outside emotional support scope (category: ${scopeCheck.category}, keyword: ${scopeCheck.keyword})`);
    return {
      text: buildScopeBoundaryMessage(scopeCheck.category),
      model: 'scope-guard',
      success: true,
      policyNotice: true,
      boundaryCategory: scopeCheck.category,
      boundaryKeyword: scopeCheck.keyword
    };
  }

  // Create prompt with conversation history
  const prompt = createEmpatheticPrompt(emotion, { confidence, context }, transcript, conversationHistory);

  // Try Gemini first
  try {
    const geminiResponse = await generateWithGemini(prompt);
    console.log(`✅ Response generated with Indian context awareness (Gemini)`);
    return geminiResponse;
  } catch (geminiError) {
    console.warn(`⚠️  Gemini failed: ${geminiError.message}`);

    // Try LLaMA as fallback only if enabled
    if (config.llama.enabled) {
      console.log('🔄 Attempting LLaMA fallback with Indian context...');
      try {
        const llamaResponse = await generateWithLLaMA(prompt);
        console.log(`✅ Response generated with Indian context awareness (LLaMA)`);
        return llamaResponse;
      } catch (llamaError) {
        console.warn(`⚠️  LLaMA fallback failed: ${llamaError.message}`);
      }
    } else {
      console.log('⚠️  LLaMA is disabled, skipping fallback...');
    }

    // Use static fallback if LLaMA is disabled or failed
    console.log('📝 Using static fallback response with Indian context awareness...');
    const fallbackResponse = generateFallbackResponse(emotion);
    return fallbackResponse;
  }
};

/**
 * Streaming counterpart to generateResponse, used by the SSE chat endpoint.
 * Same guardrail + fallback chain (scope-guard -> Gemini -> LLaMA -> static),
 * but streams Gemini tokens out via onToken(text) as they arrive instead of
 * waiting for the full response. Non-streaming fallback paths (scope-guard,
 * LLaMA, static) have no real "streaming" content, so their whole text is
 * simply passed to onToken once, as one chunk.
 *
 * Returns the same shape as generateResponse: { text, model, success, ... }
 */
export const generateResponseStream = async ({ emotion, confidence, context, transcript, conversationHistory = [] }, onToken) => {
  console.log(`💬 [stream] Generating empathetic response for emotion: ${emotion}`);

  // Guardrail: block non-emotional requests
  const scopeCheck = detectNonEmotionalIntent(transcript, conversationHistory);
  if (scopeCheck.blocked) {
    console.log(`🚧 [stream] Message appears outside emotional support scope (category: ${scopeCheck.category}, keyword: ${scopeCheck.keyword})`);
    const text = buildScopeBoundaryMessage(scopeCheck.category);
    onToken(text);
    return {
      text,
      model: 'scope-guard',
      success: true,
      policyNotice: true,
      boundaryCategory: scopeCheck.category,
      boundaryKeyword: scopeCheck.keyword
    };
  }

  const prompt = createEmpatheticPrompt(emotion, { confidence, context }, transcript, conversationHistory);

  // Try Gemini streaming first
  try {
    const geminiResponse = await generateWithGeminiStream(prompt, onToken);
    console.log(`✅ [stream] Response generated with Indian context awareness (Gemini)`);
    return geminiResponse;
  } catch (geminiError) {
    console.warn(`⚠️  [stream] Gemini failed: ${geminiError.message}`);

    // If tokens were already streamed to the client before the failure, we
    // can't cleanly retry as if nothing happened — but we can still append
    // fallback continuation text as one more token event so the user gets a
    // complete-feeling response rather than a cut-off one.
    const alreadyStreamedText = geminiError.isPartialStreamFailure ? (geminiError.partialText || '') : '';

    if (config.llama.enabled) {
      console.log('🔄 [stream] Attempting LLaMA fallback with Indian context...');
      try {
        const llamaResponse = await generateWithLLaMA(prompt);
        console.log(`✅ [stream] Response generated with Indian context awareness (LLaMA)`);
        onToken(llamaResponse.text);
        return {
          ...llamaResponse,
          text: alreadyStreamedText + llamaResponse.text
        };
      } catch (llamaError) {
        console.warn(`⚠️  [stream] LLaMA fallback failed: ${llamaError.message}`);
      }
    } else {
      console.log('⚠️  [stream] LLaMA is disabled, skipping fallback...');
    }

    console.log('📝 [stream] Using static fallback response with Indian context awareness...');
    const fallbackResponse = generateFallbackResponse(emotion);
    onToken(fallbackResponse.text);
    return {
      ...fallbackResponse,
      text: alreadyStreamedText + fallbackResponse.text
    };
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

/**
 * Generate daily journal entry based on emotional events
 * @param {Object} journalData - Structured journal data
 * @returns {Promise<string>} Generated journal entry
 */
export const generateDailyJournal = async (journalData) => {
  console.log(`📔 Generating daily journal entry...`);

  const {
    date,
    emotionSummary,
    timeProgression,
    keyMoments,
    topics,
    conversationSamples,
    messageCount
  } = journalData;

  // Build journal prompt
  let prompt = `You are an empathetic journaling assistant. Create a gentle, reflective journal entry for the user's day based on their emotional experiences.

EMOTIONAL SUMMARY:
- Dominant emotion: ${emotionSummary.dominant}
- Mood score: ${emotionSummary.moodScore}/100
- Emotions experienced: ${Object.keys(emotionSummary.counts).join(', ')}
- Total emotional moments: ${Object.values(emotionSummary.counts).reduce((a, b) => a + b, 0)}

TIME PROGRESSION:`;

  if (timeProgression && timeProgression.segments && timeProgression.segments.length > 0) {
    timeProgression.segments.forEach(seg => {
      // Safety check for undefined values
      const period = seg.period || seg.timeLabel || 'Unknown time';
      const emotion = seg.emotion || seg.primaryEmotion || 'neutral';
      const count = seg.count || seg.messageCount || 0;
      
      const periodLabel = typeof period === 'string' && period.length > 0 
        ? period.charAt(0).toUpperCase() + period.slice(1)
        : period;
      
      prompt += `\n- ${periodLabel}: ${emotion} (${count} moments)`;
    });
  }

  if (timeProgression && timeProgression.trend) {
    prompt += `\n- Overall trend: ${timeProgression.trend}`;
  }

  if (topics && topics.length > 0) {
    prompt += `\n\nKEY TOPICS DISCUSSED:`;
    topics.slice(0, 3).forEach(topic => {
      const topicName = topic.name || topic.topic || 'Unknown topic';
      const topicLabel = typeof topicName === 'string' && topicName.length > 0
        ? topicName.charAt(0).toUpperCase() + topicName.slice(1)
        : topicName;
      prompt += `\n- ${topicLabel}`;
    });
  }

  if (keyMoments.improvements && keyMoments.improvements.length > 0) {
    prompt += `\n\nPOSITIVE MOMENTS:`;
    keyMoments.improvements.forEach(improvement => {
      prompt += `\n- ${improvement}`;
    });
  }

  if (conversationSamples && conversationSamples.length > 0) {
    prompt += `\n\nSAMPLE THOUGHTS (for context):`;
    conversationSamples.slice(0, 2).forEach((sample, idx) => {
      // Support both string and object formats
      const content = typeof sample === 'string' ? sample : (sample.content || sample.message || '');
      const truncated = content && content.length > 100 ? content.substring(0, 100) + '...' : content;
      if (truncated) {
        prompt += `\n- "${truncated}"`;
      }
    });
  }

  prompt += `\n\nIMPORTANT: You MUST respond with ONLY the formatted journal entry. Do NOT include any conversational text before or after. Start directly with the 🌙 emoji.

======================== REQUIRED FORMAT (STRICT) ========================
🌙 Daily Reflection — ${date}

[First paragraph: 2-3 sentences. Start with "Today began with..." or similar. Describe morning emotions using second person "You felt...". Be specific about the dominant morning emotion.]

[Second paragraph: 2-3 sentences. Describe afternoon progression. Mention specific topics if relevant (work, relationships, etc). Describe how emotions evolved.]

[Third paragraph: 2-3 sentences. Describe evening mood. Highlight any positive shifts or relief. End on a gentle, hopeful note.]

✨ What helped today:
• [First specific helpful factor - be concrete]
• [Second helpful factor - relate to their actions or moments]
• [Third helpful factor - something they did well]

💡 Gentle reminder:
[One or two compassionate sentences acknowledging their effort. Avoid clichés. Be warm and personal.]

Try this tomorrow:
[One single, specific, actionable suggestion. Make it simple and achievable in 3-5 minutes.]
======================== END FORMAT ========================

CRITICAL RULES - FOLLOW EXACTLY:
1. START your response with "🌙 Daily Reflection" - NO OTHER TEXT BEFORE THIS
2. Use EXACTLY these emojis: 🌙 ✨ 💡 (copy them exactly)
3. Use EXACTLY this bullet symbol: • (not -, *, or any other character)
4. Write in second person ONLY ("You felt", "Your mood", not "I" or "The user")
5. Keep each paragraph 2-3 sentences
6. Include ALL sections: reflection paragraphs, What helped, Gentle reminder, Try this tomorrow
7. DO NOT add any conversational framing like "Okay, here we go..." or "Let me create..."
8. DO NOT add extra sections or headings beyond what's shown
9. Total length: 180-250 words
10. Keep tone warm, gentle, non-judgmental

CORRECT EXAMPLE:
🌙 Daily Reflection — Nov 15, 2025

Today began with a sense of heaviness. You felt lonely in the morning, and a few anxious thoughts lingered about work deadlines.

During the afternoon, talking about your project increased your stress levels. You noticed tension building as you tried to meet expectations.

By evening, you shifted into a lighter mood after connecting with a friend. Your energy improved, and your tone became more hopeful.

✨ What helped today:
• Social connection with someone who listens
• A moment of rest after completing work
• Speaking honestly about your feelings

💡 Gentle reminder:
Don't ignore yourself on days when the world feels heavy. You made progress today.

Try this tomorrow:
Take three deep breaths before starting your morning routine.

GENERATE THE JOURNAL ENTRY NOW (start with 🌙, no other text before it):`;

  // Try Gemini -> LLaMA -> Fallback
  try {
    const response = await generateWithGemini(prompt);
    // Extract text from response object
    const journalEntry = typeof response === 'object' && response.text ? response.text : response;
    console.log(`✅ Journal entry generated with Gemini`);
    console.log(`📝 Journal preview: "${journalEntry.substring(0, 100)}..."`);
    return journalEntry;
  } catch (geminiError) {
    console.warn(`⚠️ Gemini failed for journal generation: ${geminiError.message}`);
    
    if (config.llama.enabled) {
      console.log('🔄 Attempting LLaMA fallback for journal...');
      try {
        const response = await generateWithLLaMA(prompt);
        // Extract text from response object
        const journalEntry = typeof response === 'object' && response.text ? response.text : response;
        console.log(`✅ Journal entry generated with LLaMA`);
        return journalEntry;
      } catch (llamaError) {
        console.warn(`⚠️ LLaMA fallback failed: ${llamaError.message}`);
      }
    }

    // Static fallback
    console.log('📝 Using static fallback for journal entry...');
    return generateFallbackJournal(emotionSummary, timeProgression, topics, date);
  }
};

/**
 * Generate fallback journal entry when LLM fails
 * @private
 */
function generateFallbackJournal(emotionSummary, timeProgression, topics, date = null) {
  const emotion = emotionSummary.dominant || 'neutral';
  const moodScore = emotionSummary.moodScore || 50;
  const journalDate = date || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  
  let journal = `🌙 Daily Reflection — ${journalDate}\n\n`;
  
  // First paragraph - Morning
  if (moodScore < 40) {
    journal += `Today began with some emotional heaviness. You felt ${emotion} in the morning, carrying weight through your early hours. There were moments of struggle as you started your day.\n\n`;
  } else if (moodScore > 70) {
    journal += `Today started on a positive note. You felt ${emotion} in the morning, and that energy set a good foundation. Your mood was stable and hopeful.\n\n`;
  } else {
    journal += `Today was a balanced day emotionally. You felt ${emotion} at times, navigating through various feelings. The morning brought mixed emotions.\n\n`;
  }

  // Second paragraph - Afternoon
  if (topics && topics.length > 0) {
    const topTopic = topics[0].name;
    journal += `Through the afternoon, ${topTopic} was on your mind. You processed these thoughts while managing your emotional state. `;
  } else {
    journal += `During the afternoon, you moved through your tasks and responsibilities. You stayed present with your feelings. `;
  }
  
  if (timeProgression.trend === 'improved') {
    journal += `Your stress levels began to ease as the hours passed.\n\n`;
  } else {
    journal += `You maintained your pace through the day.\n\n`;
  }

  // Third paragraph - Evening
  if (timeProgression.trend === 'improved') {
    journal += `By evening, your mood improved noticeably. You found moments of relief and lighter energy. The day ended on a more hopeful note than it began.\n\n`;
  } else {
    journal += `As evening arrived, you allowed yourself to rest. You acknowledged the day's experiences with gentleness. You made it through.\n\n`;
  }

  // What helped today
  journal += `✨ What helped today:\n`;
  journal += `• Taking time to acknowledge your feelings\n`;
  journal += `• Moving through the day step by step\n`;
  journal += `• Being present with yourself\n\n`;
  
  // Gentle reminder
  journal += `💡 Gentle reminder:\n`;
  journal += `You showed up today, and that matters. Every step counts.\n\n`;
  
  // Tomorrow suggestion
  journal += `Try this tomorrow:\n`;
  journal += `Take three deep breaths before starting your morning routine.`;
  
  return journal;
}
