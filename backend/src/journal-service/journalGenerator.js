/**
 * Journal Generator - Generates Daily Emotion Journal entries
 * Uses Gemini (primary) and Groq LLaMA (fallback) with strict formatting
 * Outputs EXACTLY the required format specified in copilot instructions
 */

import masterActivityService from '../storage-service/masterActivityService.js';
import prisma from '../lib/prisma.js';
import * as storageService from '../storage-service/index.js';
import config from '../config/index.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import logger from '../utils/logger.js';
import * as unifiedEmotion from '../storage-service/unifiedEmotionService.js';
import { getGeminiModelList, getGroqChatModel } from '../utils/modelCatalog.js';

// NOTE ON SCHEMA GAP: the original Supabase schema had a dedicated
// `journal_entries` table. The finalized Neon/Prisma schema
// (prisma/schema.prisma) does not include that table - it was
// consolidated into `DailyEmotionSummary` (see storage-service/index.js's
// getDailyEmotionSummary/upsertDailyEmotionSummary). This class now stores
// journal content in DailyEmotionSummary, bagging the journal-specific
// sections (overview/analysis/closing/title/etc.) inside its JSON
// `segmentSummary` column, and reshapes reads back into a
// journal-entry-shaped object so callers (journalRoutes.js etc.) don't
// need to change. Flag this mapping for review by whoever owns the schema.

class JournalGenerator {
  constructor() {
    // Gemini: store the key and construct the model lazily (see getGeminiModel())
    // since the best available model id is resolved daily and async.
    this.geminiApiKey = config.gemini?.apiKeys?.[0] || config.gemini?.apiKey;

    // Initialize Groq (for LLaMA fallback)
    const groqApiKey = process.env.GROQ_API_KEY || config.llama?.apiKey;
    if (groqApiKey) {
      this.groq = new Groq({ apiKey: groqApiKey });
    }

    // Standardized emotion emojis
    this.emotionEmojis = {
      joy: '😊',
      sadness: '😢',
      anger: '😠',
      fear: '😨',
      surprise: '😲',
      disgust: '🤢',
      neutral: '😐'
    };
  }

  /**
   * Resolve the best currently-available Gemini model (daily-refreshed) and
   * build a fresh generative model instance for it.
   */
  async getGeminiModel() {
    if (!this.geminiApiKey) {
      return null;
    }
    const [modelName] = await getGeminiModelList();
    const genAI = new GoogleGenerativeAI(this.geminiApiKey);
    return genAI.getGenerativeModel({ model: modelName });
  }

  /**
   * Generate a daily journal entry for a specific user and date
   * @param {string} userId - The user's ID
   * @param {string} date - The date in YYYY-MM-DD format
   * @param {Object} options - Options like force regeneration
   */
  async generateDailyJournal(userId, date, options = {}) {
    const { force = false, forceRegenerate = false, manual = false } = options;
    logger.info(`📔 Generating journal for user ${userId} on ${date}`);
    
    try {
      // Step 1: Convert date to Asia/Kolkata start/end timestamps
      const { startTime, endTime } = this.getDateRangeIST(date);
      
      // Step 2: Query messages for this user on this date
      const messageRows = await prisma.message.findMany({
        where: {
          userId,
          role: 'user', // Only user messages for journal source
          createdAt: { gte: new Date(startTime), lte: new Date(endTime) }
        },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          role: true,
          content: true,
          emotion: true,
          emotionConfidence: true,
          metadata: true,
          createdAt: true
        }
      });

      const messages = messageRows.map((row) => ({
        id: row.id,
        role: row.role,
        content: row.content,
        emotion: row.emotion,
        emotion_confidence: row.emotionConfidence,
        metadata: row.metadata,
        created_at: row.createdAt
      }));

      // Step 3: Check if we have enough data
      if (!messages || messages.length === 0) {
        logger.info(`⏭️ No messages for ${date}, skipping journal`);
        return { success: true, skipped: true, reason: 'no_messages', messageCount: 0 };
      }
      
      // Step 4: Check if journal already exists (stored as a DailyEmotionSummary)
      const existingSummary = await storageService.getDailyEmotionSummary(userId, date);
      const existingJournal = existingSummary ? this._toJournalShape(userId, date, existingSummary) : null;

      // Step 5: Aggregate emotion data
      const emotionSummary = this.aggregateEmotions(messages);
      
      // Step 6: Generate journal content using LLM
      logger.info(`🤖 Generating journal content with LLM...`);
      const journalContent = await this.generateJournalContent(messages, emotionSummary, date);
      
      if (!journalContent) {
        logger.warn(`⚠️ Insufficient data to generate journal for ${date}`);
        return { success: true, skipped: true, reason: 'insufficient_data', messageCount: messages.length };
      }
      
      // Step 7: Parse journal sections for structured storage
      const parsedSections = this.parseJournalSections(journalContent);
      
      // Step 8: Save to database (stored as a DailyEmotionSummary - see note at top of file)
      const segmentSummaryBag = {
        overview: parsedSections.overview,
        key_moments: parsedSections.key_moments,
        analysis: parsedSections.analysis,
        closing: parsedSections.closing,
        // New 7-section format fields
        date_time: parsedSections.date_time,
        title: parsedSections.title,
        context: parsedSections.context,
        reflections: parsedSections.reflections,
        emotions_text: parsedSections.emotions_text,
        insights: parsedSections.insights,
        plans: parsedSections.plans,
        primaryEmoji: emotionSummary.primaryEmoji,
        source: manual ? 'manual' : 'auto'
      };

      // Force regenerate (used by refresh endpoint) just overwrites via upsert
      const savedSummary = await storageService.upsertDailyEmotionSummary({
        userId,
        date,
        dominantEmotion: emotionSummary.primaryEmotion,
        emotionDistribution: emotionSummary.emotionCounts,
        moodScore: emotionSummary.moodScore,
        totalEntries: emotionSummary.totalMessages,
        timeSegments: emotionSummary.timeSegments || [],
        keyMoments: parsedSections.insights || [],
        segmentSummary: segmentSummaryBag,
        summaryText: journalContent,
        eJournalEntry: journalContent
      });

      const savedJournal = this._toJournalShape(userId, date, savedSummary);

      logger.info(`✅ Journal successfully saved for ${date}`);
      
      return {
        success: true,
        skipped: false,
        journal: savedJournal,
        messageCount: messages.length,
        emotion: emotionSummary.primaryEmotion
      };
      
    } catch (error) {
      logger.error(`❌ Error generating journal for ${userId} on ${date}:`, error);
      throw error;
    }
  }

  /**
   * Reshape a DailyEmotionSummary (as returned by storageService.getDailyEmotionSummary
   * / upsertDailyEmotionSummary) back into the journal_entries-row shape that
   * journalRoutes.js / insightsRoutes.js expect, since the dedicated journal_entries
   * table doesn't exist in the Neon/Prisma schema. See note at top of file.
   */
  _toJournalShape(userId, date, summary) {
    const bag = summary.segmentSummary && typeof summary.segmentSummary === 'object'
      ? summary.segmentSummary
      : {};

    return {
      id: summary.id,
      user_id: userId,
      date: summary.date || date,
      content: summary.eJournalEntry,
      overview: bag.overview ?? null,
      key_moments: bag.key_moments ?? [],
      analysis: bag.analysis ?? null,
      closing: bag.closing ?? null,
      date_time: bag.date_time ?? null,
      title: bag.title ?? null,
      context: bag.context ?? null,
      reflections: bag.reflections ?? null,
      emotions_text: bag.emotions_text ?? null,
      insights: bag.insights ?? [],
      plans: bag.plans ?? null,
      emotion_summary: {
        primaryEmotion: summary.dominantEmotion,
        primaryEmoji: bag.primaryEmoji,
        mood_score: summary.moodScore,
        dominant_emotion: summary.dominantEmotion,
        emotion_counts: summary.emotionDistribution,
        total_messages: summary.totalEntries,
        time_segments: summary.timeSegments || []
      },
      source: bag.source || 'auto',
      generated_at: summary.createdAt,
      updated_at: summary.updatedAt
    };
  }

  /**
   * Fetch a single journal entry (journal-shaped) for a user/date, or null.
   */
  async getJournalEntry(userId, date) {
    const summary = await storageService.getDailyEmotionSummary(userId, date);
    return summary ? this._toJournalShape(userId, date, summary) : null;
  }

  /**
   * List journal entries (journal-shaped) for a user, most recent first.
   */
  async listJournalEntries(userId, limit = 30) {
    const summaries = await storageService.listDailyEmotionSummaries(userId, limit);
    return summaries.map((summary) => this._toJournalShape(userId, summary.date, summary));
  }

  getDateRangeIST(dateStr) {
    // Parse date as IST (Asia/Kolkata)
    const [year, month, day] = dateStr.split('-').map(Number);
    
    // Create Date objects for start and end of day in IST
    // IST is UTC+5:30
    const startIST = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    startIST.setMinutes(startIST.getMinutes() - 330); // Subtract 5:30 to convert IST to UTC
    
    const endIST = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    endIST.setMinutes(endIST.getMinutes() - 330);
    
    return {
      startTime: startIST.toISOString(),
      endTime: endIST.toISOString()
    };
  }

  /**
   * Aggregate emotion data from messages
   */
  aggregateEmotions(messages) {
    const emotionCounts = {};
    const emotionList = [];

    messages.forEach(msg => {
      if (msg.emotion) {
        // Normalize BEFORE counting/collecting — otherwise variant raw labels
        // (e.g. "happy" vs "joy") split votes instead of merging, and the
        // dominant-emotion pick below would disagree with any other consumer
        // (e.g. Insights) that normalizes first.
        const emotion = unifiedEmotion.normalizeEmotion(msg.emotion);
        emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;

        emotionList.push({
          emotion: emotion,
          confidence: msg.emotion_confidence || 0.5
        });
      }
    });

    // Confidence-weighted dominant emotion — same algorithm (and now the same
    // normalized input) as unifiedEmotionService.getDominantEmotion, used by
    // Insights. Previously this picked the RAW most-frequent label (unweighted,
    // normalized only after the fact), which could pick a different emotion
    // than the mood score below implies, and could disagree with Insights for
    // the same day's data.
    const primaryEmotion = unifiedEmotion.getDominantEmotion(emotionList);

    const primaryEmoji = this.emotionEmojis[primaryEmotion] || '😐';

    // Calculate mood score using unified service (consistent with insights)
    // This uses valence (happy=high, sad=low) instead of just confidence
    const moodScore = unifiedEmotion.calculateAverageMoodScore(emotionList);
    
    // Calculate time segments (morning, afternoon, evening) for consistent insights
    const timeSegments = this.calculateTimeSegments(messages);
    
    return {
      primaryEmotion,
      primaryEmoji,
      moodScore,
      emotionCounts,
      totalMessages: messages.length,
      timeSegments
    };
  }

  /**
   * Calculate time segments from messages
   * Returns array of {period, emotion, count} for morning/afternoon/evening
   */
  calculateTimeSegments(messages) {
    const segments = {
      morning: { period: 'morning', emotions: {}, count: 0 },
      afternoon: { period: 'afternoon', emotions: {}, count: 0 },
      evening: { period: 'evening', emotions: {}, count: 0 }
    };
    
    messages.forEach(msg => {
      if (!msg.created_at || !msg.emotion) return;
      
      const hour = new Date(msg.created_at).getHours();
      let period;
      
      if (hour >= 5 && hour < 12) period = 'morning';
      else if (hour >= 12 && hour < 17) period = 'afternoon';
      else period = 'evening';
      
      const emotion = unifiedEmotion.normalizeEmotion(msg.emotion);
      segments[period].count++;
      segments[period].emotions[emotion] = (segments[period].emotions[emotion] || 0) + 1;
    });
    
    // Calculate dominant emotion per period - ONLY return segments with actual data
    return Object.keys(segments)
      .map(periodKey => {
        const segment = segments[periodKey];
        
        // Skip periods with no emotion data
        if (Object.keys(segment.emotions).length === 0) {
          return null;
        }
        
        // Get emotion with highest count
        const dominantEmotion = Object.entries(segment.emotions)
          .sort(([,a], [,b]) => b - a)[0][0];
        
        return {
          period: periodKey,
          emotion: dominantEmotion,
          count: segment.count
        };
      })
      .filter(segment => segment !== null); // Remove null entries
  }

  /**
   * Generate journal content using LLM (Gemini primary, Groq fallback)
   * Uses STRICT prompt format from requirements
   */
  async generateJournalContent(messages, emotionSummary, dateStr) {
    try {
      // Format date as "DD MMM YYYY"
      const dateObj = new Date(dateStr + 'T00:00:00Z');
      const formattedDate = dateObj.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
      
      // Build messages block for prompt
      const messagesBlock = messages.slice(0, 10).map((msg, idx) => {
        const time = new Date(msg.created_at).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
        const excerpt = msg.content.substring(0, 150);
        return `[${time}] ${msg.role}: ${excerpt}${msg.content.length > 150 ? '...' : ''}`;
      }).join('\n');
      
      // Build emotion JSON
      const emotionJson = JSON.stringify(emotionSummary.emotionCounts, null, 2);
      
      // Get time component (use first message time or default to midnight)
      const timeComponent = messages.length > 0 
        ? new Date(messages[0].created_at).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          })
        : '12:00 AM';
      
      // UPGRADED PROMPT for 7-section format with bold headings
      const prompt = `You are an empathetic journal writer who creates meaningful, insightful daily reflections. Use the user's chat messages and emotion data to create a comprehensive journal entry that provides deep insights and satisfaction when read.

Date: ${formattedDate}
Time of first message: ${timeComponent}

Messages (chronological):
${messagesBlock}

Emotion summary:
Primary emotion: ${emotionSummary.primaryEmotion} (${emotionSummary.primaryEmoji})
Mood score: ${emotionSummary.moodScore}/100
Emotion histogram: ${emotionJson}

CRITICAL OUTPUT REQUIREMENTS:

Generate EXACTLY this 7-section format with bold markdown headings (**text:**):

**Date & Time:** ${formattedDate} – ${timeComponent}
**Title:** [Create a short, meaningful title that captures the essence of this day - make it evocative and personal, 3-8 words]

**Context / What Happened**
[2-3 sentences describing the key events, situations, and activities from the messages. Be specific and factual about what occurred during the day.]

**Thoughts & Reflections**
[3-4 sentences with deeper interpretation and introspection. What did they learn? What patterns emerged? What confused, excited, or challenged them? Let the reflection be honest and thoughtful, not superficial. This is the heart of the journal - make it meaningful.]

**Emotions / Mood Check**
Primary: ${emotionSummary.primaryEmoji} ${emotionSummary.primaryEmotion}
Mood Score: ${emotionSummary.moodScore}/100
Pattern: [1-2 sentences describing how emotions evolved through the day - was there a shift? What triggered different feelings?]

**Insights / Takeaways**
• [Key observation or realization from today]
• [Important lesson or pattern noticed]
• [Meaningful insight about themselves or their situation]

**Plans / Actions**
[1-2 sentences about concrete next steps or future direction based on today's experiences. Make this actionable and forward-looking.]

FORMATTING RULES:
- Section headers MUST use bold markdown: **Header:**
- Date & Time section must be exactly as shown
- Title must be compelling and capture the day's essence
- Each bullet in Insights must start with "•" followed by a space
- Total output: ~200-350 words for rich, meaningful content
- Tone: warm, reflective, insightful, honest, supportive

CONTENT QUALITY:
- Make reflections deep and meaningful, not generic
- Insights should be specific to what happened, not platitudes
- Title should make someone want to read the entry
- When they read this journal, they should feel satisfied and understood
- Ground everything in the actual messages - no invented content

If there is insufficient data (fewer than 2 messages), respond: "No substantial chat data for ${formattedDate} — journal skipped."

Now generate the meaningful, insightful journal for ${formattedDate}.`;

      // Try Gemini first
      try {
        const geminiModel = await this.getGeminiModel();
        if (!geminiModel) {
          throw new Error('Gemini API key not configured');
        }
        logger.info('🤖 Calling Gemini for journal generation...');
        const result = await geminiModel.generateContent(prompt);
        const response = await result.response;
        let text = response.text().trim();
        
        // Check for insufficient data message
        if (text.includes('journal skipped') || text.includes('No substantial chat data')) {
          logger.warn(`⚠️ LLM says insufficient data for ${dateStr}`);
          return null;
        }
        
        // Validate format
        if (this.validateJournalFormat(text)) {
          logger.info('✅ Gemini generated valid journal');
          return this.fixMoodScoreLine(text, emotionSummary.moodScore);
        } else {
          logger.warn('⚠️ Gemini output invalid format, trying Groq...');
        }
      } catch (geminiError) {
        logger.warn(`⚠️ Gemini error: ${geminiError.message}, trying Groq...`);
      }
      
      // Fallback to Groq
      try {
        logger.info('🔄 Calling Groq LLaMA for journal generation...');
        const completion = await this.groq.chat.completions.create({
          model: await getGroqChatModel(),
          messages: [
            {
              role: 'system',
              content: 'You are an empathetic journal writer. Follow instructions exactly.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 500
        });
        
        let text = completion.choices[0]?.message?.content?.trim();
        
        if (!text) {
          throw new Error('Groq returned empty response');
        }
        
        // Check for insufficient data message
        if (text.includes('journal skipped') || text.includes('No substantial chat data')) {
          logger.warn(`⚠️ Groq says insufficient data for ${dateStr}`);
          return null;
        }
        
        logger.info('✅ Groq generated journal');
        return this.fixMoodScoreLine(text, emotionSummary.moodScore);
        
      } catch (groqError) {
        logger.error(`❌ Groq error: ${groqError.message}`);
        throw new Error('Both Gemini and Groq failed to generate journal');
      }
      
    } catch (error) {
      logger.error(`❌ Error in generateJournalContent: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * The LLM is asked to copy "Mood Score: X/100" verbatim into the journal
   * body, but since it's free-form generation (not a template substitution),
   * it sometimes rewrites the denominator (e.g. "62/10" instead of "62/100").
   * We already know the true score from emotionSummary, so force-correct the
   * line after generation rather than trust the LLM to transcribe it exactly.
   */
  fixMoodScoreLine(text, moodScore) {
    return text.replace(/Mood Score:\s*[\d.]+\s*\/\s*\d+/i, `Mood Score: ${moodScore}/100`);
  }

  /**
   * Validate journal format matches requirements
   */
  validateJournalFormat(text) {
    // Must contain all required sections for new 7-section format
    const requiredSections = [
      '**Date & Time:**',
      '**Title:**',
      '**Context / What Happened**',
      '**Thoughts & Reflections**',
      '**Emotions / Mood Check**',
      '**Insights / Takeaways**',
      '**Plans / Actions**'
    ];
    
    for (const section of requiredSections) {
      if (!text.includes(section)) {
        logger.warn(`⚠️ Missing section: ${section}`);
        return false;
      }
    }
    
    // Must contain bullets in Insights section
    const insightsStart = text.indexOf('**Insights / Takeaways**');
    const plansStart = text.indexOf('**Plans / Actions**');
    if (insightsStart !== -1 && plansStart !== -1) {
      const insightsText = text.substring(insightsStart, plansStart);
      const bulletCount = (insightsText.match(/•/g) || []).length;
      if (bulletCount < 2) {
        logger.warn(`⚠️ Not enough bullets in Insights section: ${bulletCount}`);
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Parse journal sections for database storage
   */
  parseJournalSections(content) {
    const sections = {
      date_time: null,
      title: null,
      context: null,
      reflections: null,
      emotions_text: null,
      insights: [],
      plans: null,
      // Keep old fields for backward compatibility
      overview: null,
      key_moments: [],
      analysis: null,
      closing: null
    };
    
    try {
      // Extract Date & Time
      const dateTimeMatch = content.match(/\*\*Date & Time:\*\*\s*(.+?)(?=\n)/s);
      if (dateTimeMatch) {
        sections.date_time = dateTimeMatch[1].trim();
      }
      
      // Extract Title
      const titleMatch = content.match(/\*\*Title:\*\*\s*(.+?)(?=\n)/s);
      if (titleMatch) {
        sections.title = titleMatch[1].trim();
      }
      
      // Extract Context
      const contextMatch = content.match(/\*\*Context \/ What Happened\*\*\s*\n(.+?)(?=\n\*\*Thoughts)/s);
      if (contextMatch) {
        sections.context = contextMatch[1].trim();
        sections.overview = sections.context; // Backward compatibility
      }
      
      // Extract Thoughts & Reflections
      const reflectionsMatch = content.match(/\*\*Thoughts & Reflections\*\*\s*\n(.+?)(?=\n\*\*Emotions)/s);
      if (reflectionsMatch) {
        sections.reflections = reflectionsMatch[1].trim();
        sections.analysis = sections.reflections; // Backward compatibility
      }
      
      // Extract Emotions / Mood Check
      const emotionsMatch = content.match(/\*\*Emotions \/ Mood Check\*\*\s*\n(.+?)(?=\n\*\*Insights)/s);
      if (emotionsMatch) {
        sections.emotions_text = emotionsMatch[1].trim();
      }
      
      // Extract Insights / Takeaways
      const insightsMatch = content.match(/\*\*Insights \/ Takeaways\*\*\s*\n(.+?)(?=\n\*\*Plans)/s);
      if (insightsMatch) {
        const bullets = insightsMatch[1].match(/•\s*(.+?)(?=\n•|\n\*\*|$)/gs);
        if (bullets) {
          sections.insights = bullets.map(b => b.replace(/^•\s*/, '').trim());
          sections.key_moments = sections.insights; // Backward compatibility
        }
      }
      
      // Extract Plans / Actions
      const plansMatch = content.match(/\*\*Plans \/ Actions\*\*\s*\n(.+?)$/s);
      if (plansMatch) {
        sections.plans = plansMatch[1].trim();
        sections.closing = sections.plans; // Backward compatibility
      }
      
    } catch (error) {
      logger.warn(`⚠️ Error parsing sections: ${error.message}`);
    }
    
    return sections;
  }
  
  /**
   * Legacy method - kept for backward compatibility
   * Redirects to new generateDailyJournal
   */
  async generateJournal(activities, options = {}) {
    logger.warn('⚠️ generateJournal() is deprecated, use generateDailyJournal() instead');
    
    // This is a compatibility shim - won't work properly
    // Frontend/routes should call generateDailyJournal directly
    return {
      content: 'Please use the new journal API endpoints',
      emotion_summary: {},
      dominant_emotion: 'neutral',
      activity_count: 0
    };
  }
  
  /**
   * Generate journals for date range (bulk backfill)
   */
  async generateJournalsForDateRange(userId, startDate, endDate) {
    const results = [];
    const currentDate = new Date(startDate);
    const endDateObj = new Date(endDate);
    
    while (currentDate <= endDateObj) {
      const dateStr = currentDate.toISOString().split('T')[0];
      
      try {
        const result = await this.generateDailyJournal(userId, dateStr, { force: false });
        results.push({
          date: dateStr,
          success: result.success,
          skipped: result.skipped,
          reason: result.reason
        });
        
        // Small delay between dates
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        logger.error(`❌ Error generating journal for ${dateStr}: ${error.message}`);
        results.push({
          date: dateStr,
          success: false,
          error: error.message
        });
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return results;
  }
}

export default new JournalGenerator();