/**
 * Journal Generator - Generates Daily Emotion Journal entries
 * Uses Gemini (primary) and Groq LLaMA (fallback) with strict formatting
 * Outputs EXACTLY the required format specified in copilot instructions
 */

import masterActivityService from '../storage-service/masterActivityService.js';
import { createClient } from '@supabase/supabase-js';
import config from '../config/index.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import logger from '../utils/logger.js';
import * as unifiedEmotion from '../storage-service/unifiedEmotionService.js';

class JournalGenerator {
  constructor() {
    // Initialize Supabase client
    this.supabase = createClient(
      config.database.supabase.url,
      config.database.supabase.serviceRoleKey || config.database.supabase.anonKey
    );

    // Initialize Gemini
    const geminiApiKey = config.gemini?.apiKey1 || config.gemini?.apiKey;
    if (geminiApiKey) {
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      this.geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    }

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
      const { data: messages, error: msgError } = await this.supabase
        .from('messages')
        .select('id, role, content, emotion, emotion_confidence, metadata, created_at')
        .eq('user_id', userId)
        .gte('created_at', startTime)
        .lte('created_at', endTime)
        .eq('role', 'user') // Only user messages for journal source
        .order('created_at', { ascending: true });
      
      if (msgError) {
        logger.error(`❌ Error fetching messages: ${msgError.message}`);
        throw msgError;
      }
      
      // Step 3: Check if we have enough data
      if (!messages || messages.length === 0) {
        logger.info(`⏭️ No messages for ${date}, skipping journal`);
        return { success: true, skipped: true, reason: 'no_messages', messageCount: 0 };
      }
      
      // Step 4: Check if journal already exists
      const { data: existingJournal } = await this.supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', userId)
        .eq('date', date)
        .maybeSingle();
      
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
      
      // Step 8: Save to database
      const journalData = {
        user_id: userId,
        date: date,
        content: journalContent,
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
        // Emotion summary
        emotion_summary: {
          primaryEmotion: emotionSummary.primaryEmotion,
          primaryEmoji: emotionSummary.primaryEmoji,
          mood_score: emotionSummary.moodScore,
          dominant_emotion: emotionSummary.primaryEmotion,
          emotion_counts: emotionSummary.emotionCounts,
          total_messages: emotionSummary.totalMessages
        },
        source: manual ? 'manual' : 'auto',
        generated_at: new Date().toISOString()
      };
      
      let savedJournal;
      
      // Handle force regenerate (used by refresh endpoint)
      const shouldForce = force || forceRegenerate;
      
      if (existingJournal && !shouldForce) {
        // Update existing journal
        logger.info(`📝 Updating existing journal for ${date}`);
        const { data, error } = await this.supabase
          .from('journal_entries')
          .update({
            ...journalData,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingJournal.id)
          .select()
          .single();
        
        if (error) {
          logger.error(`❌ Error updating journal: ${error.message}`);
          throw error;
        }
        
        savedJournal = data;
      } else {
        // Insert new journal or force regenerate
        if (existingJournal && shouldForce) {
          logger.info(`🔄 Force regenerating journal for ${date}`);
          // Delete existing and insert new
          await this.supabase
            .from('journal_entries')
            .delete()
            .eq('id', existingJournal.id);
        }
        
        logger.info(`✨ Creating new journal entry for ${date}`);
        const { data, error } = await this.supabase
          .from('journal_entries')
          .insert(journalData)
          .select()
          .single();
        
        if (error) {
          logger.error(`❌ Error inserting journal: ${error.message}`);
          throw error;
        }
        
        savedJournal = data;
      }
      
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
        const emotion = msg.emotion.toLowerCase();
        emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
        
        emotionList.push({
          emotion: emotion,
          confidence: msg.emotion_confidence || 0.5
        });
      }
    });
    
    // Find primary emotion
    const primaryEmotion = Object.entries(emotionCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'neutral';
    
    const primaryEmoji = this.emotionEmojis[primaryEmotion] || '😐';
    
    // Calculate mood score using unified service (consistent with insights)
    // This uses valence (happy=high, sad=low) instead of just confidence
    const moodScore = unifiedEmotion.calculateAverageMoodScore(emotionList);
    
    return {
      primaryEmotion,
      primaryEmoji,
      moodScore,
      emotionCounts,
      totalMessages: messages.length
    };
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
Mood score: ${emotionSummary.moodScore}/10
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
Mood Score: ${emotionSummary.moodScore}/10
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
        logger.info('🤖 Calling Gemini for journal generation...');
        const result = await this.geminiModel.generateContent(prompt);
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
          return text;
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
          model: 'llama-3.3-70b-versatile',
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
        return text;
        
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