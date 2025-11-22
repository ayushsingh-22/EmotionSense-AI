/**
 * Journal Generator
 * Generates formatted daily journal entries with strict format enforcement
 */

import { generateDailyJournal } from '../llm-service/index.js';
import logger from '../utils/logger.js';

/**
 * Generate a formatted journal entry with strict format validation
 * @param {Object} journalData - Structured journal data
 * @returns {Promise<string>} Formatted journal entry
 */
export async function generateFormattedJournal(journalData) {
  try {
    logger.info('📔 Generating formatted journal entry...');

    // Generate journal using LLM
    let journalText = await generateDailyJournal(journalData);

    // Validate and enforce format
    journalText = enforceJournalFormat(journalText, journalData.date);

    logger.info('✅ Journal formatting validated');
    return journalText;

  } catch (error) {
    logger.error('❌ Error generating formatted journal:', error);
    throw error;
  }
}

/**
 * Enforce strict journal format compliance
 * STRICT FORMAT ENFORCEMENT - DO NOT MODIFY
 * Format must match EXACTLY:
 * 🌙 Daily Reflection — Nov 15, 2025
 * 
 * [2 paragraphs describing mood flow]
 * 
 * ✨ What helped today:
 * • [3 bullet points]
 * 
 * 💡 Gentle reminder:
 * [1-2 sentences]
 * 
 * Try this tomorrow:
 * [one simple action]
 * 
 * @param {string} text - Raw journal text from LLM
 * @param {string} date - Journal date
 * @returns {string} Format-compliant journal text
 */
function enforceJournalFormat(text, date) {
  // Remove any extra whitespace
  text = text.trim();

  // Convert escaped newlines to actual newlines (in case LLM returns \n as string)
  text = text.replace(/\\n/g, '\n');

  // Remove markdown code blocks if present
  text = text.replace(/```[a-z]*\n?/g, '');

  // Remove conversational framing that LLM might add
  const conversationalPhrases = [
    /^Okay,?\s+(here\s+we\s+go|let's\s+unpack\s+today)[^\n]*\n*/gi,
    /^Alright,?\s+[^\n]*\n*/gi,
    /^Let\s+me\s+create[^\n]*\n*/gi,
    /^Here's\s+[^\n]*\n*/gi,
    /^I'll\s+[^\n]*\n*/gi,
    /^Sure,?\s+[^\n]*\n*/gi,
    /^Here\s+is\s+[^\n]*\n*/gi
  ];

  conversationalPhrases.forEach(phrase => {
    text = text.replace(phrase, '');
  });

  // Extract only the journal content if it starts with the moon emoji
  const moonEmojiIndex = text.indexOf('🌙');
  if (moonEmojiIndex > 0) {
    // LLM added text before the emoji, remove it
    text = text.substring(moonEmojiIndex);
  }

  // Format date properly (e.g., "Nov 15, 2025")
  const formattedDate = formatJournalDate(date);

  // Ensure it starts with the EXACT moon emoji header
  if (!text.startsWith('🌙 Daily Reflection —')) {
    text = `🌙 Daily Reflection — ${formattedDate}\n\n` + text.replace(/^🌙\s*Daily\s*Reflection[^\n]*\n*/i, '');
  } else {
    // Replace existing header with correctly formatted one
    text = text.replace(/^🌙\s*Daily\s*Reflection\s*[—–-]\s*[^\n]*/i, `🌙 Daily Reflection — ${formattedDate}`);
  }

  // STRICT emoji enforcement - replace ANY variants with exact emojis
  text = text.replace(/[✨⭐🌟💫]\s*What helped/gi, '✨ What helped');
  text = text.replace(/[💡🔆💭]\s*Gentle reminder/gi, '💡 Gentle reminder');

  // STRICT bullet point enforcement - ONLY use •
  text = text.replace(/[•●∙⦿⦾⦁◦▪▫]/g, '•');
  text = text.replace(/^[\s]*[-*+]\s+/gm, '• '); // Replace -, *, + bullets with •

  // Ensure consistent spacing around sections (exactly 2 newlines between sections)
  text = text.replace(/\n{3,}/g, '\n\n'); // Max 2 newlines
  
  // Ensure "Try this tomorrow:" is formatted correctly
  text = text.replace(/Try this tomorrow:\s*/gi, 'Try this tomorrow:\n');

  // Validate required sections are present IN ORDER
  const requiredSections = [
    { marker: '🌙 Daily Reflection', name: 'Header' },
    { marker: '✨ What helped today:', name: 'What helped' },
    { marker: '💡 Gentle reminder:', name: 'Gentle reminder' },
    { marker: 'Try this tomorrow:', name: 'Tomorrow suggestion' }
  ];

  const missingSections = requiredSections.filter(section => !text.includes(section.marker));
  
  if (missingSections.length > 0) {
    logger.warn(`⚠️ Journal missing sections: ${missingSections.map(s => s.name).join(', ')}`);
    // Add fallback sections if missing
    if (!text.includes('✨ What helped today:')) {
      text += '\n\n✨ What helped today:\n• Taking time for self-reflection\n• Acknowledging your feelings\n• Moving through the day\n';
    }
    if (!text.includes('💡 Gentle reminder:')) {
      text += '\n💡 Gentle reminder:\nYou showed up today, and that matters.\n';
    }
    if (!text.includes('Try this tomorrow:')) {
      text += '\nTry this tomorrow:\nStart your day with three deep breaths.';
    }
  }

  // Final cleanup: ensure exactly 3 bullet points in "What helped today" section
  text = enforceThreeBulletPoints(text);

  return text;
}

/**
 * Format date for journal header (e.g., "Nov 15, 2025")
 * @param {string} date - Date string (YYYY-MM-DD)
 * @returns {string} Formatted date
 */
function formatJournalDate(date) {
  try {
    const dateObj = new Date(date);
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return dateObj.toLocaleDateString('en-US', options);
  } catch (error) {
    logger.warn(`⚠️ Could not format date: ${date}, using as-is`);
    return date;
  }
}

/**
 * Ensure exactly 3 bullet points in "What helped today" section
 * @param {string} text - Journal text
 * @returns {string} Text with exactly 3 bullets
 */
function enforceThreeBulletPoints(text) {
  const helpedSectionRegex = /(✨ What helped today:)([\s\S]*?)(💡 Gentle reminder:|$)/;
  const match = text.match(helpedSectionRegex);
  
  if (!match) return text;

  const beforeSection = text.substring(0, match.index);
  const afterSection = text.substring(match.index + match[0].length);
  const bulletContent = match[2];

  // Extract all bullet points
  const bullets = bulletContent.match(/^[\s]*•[\s]*(.+)$/gm) || [];

  let finalBullets = [];
  if (bullets.length === 0) {
    // No bullets found, add defaults
    finalBullets = [
      '• Taking time for self-reflection',
      '• Acknowledging your feelings',
      '• Moving through the day'
    ];
  } else if (bullets.length < 3) {
    // Less than 3 bullets, add defaults
    finalBullets = [...bullets];
    const defaults = [
      '• Being present with yourself',
      '• Taking time to pause',
      '• Showing up for the day'
    ];
    while (finalBullets.length < 3) {
      finalBullets.push(defaults[finalBullets.length - bullets.length]);
    }
  } else if (bullets.length > 3) {
    // More than 3 bullets, keep only first 3
    finalBullets = bullets.slice(0, 3);
  } else {
    // Exactly 3 bullets, perfect
    finalBullets = bullets;
  }

  // Reconstruct with exactly 3 bullets
  const rebuiltSection = `✨ What helped today:\n${finalBullets.join('\n')}\n\n`;
  
  return beforeSection + rebuiltSection + (match[3] === '💡 Gentle reminder:' ? '💡 Gentle reminder:' : '') + afterSection;
}

/**
 * Extract helpful factors from emotional data
 * @param {Array} emotions - Emotion events
 * @param {Array} messages - Chat messages
 * @param {Object} trends - Emotion trends
 * @returns {Array<string>} Helpful factors
 */
export function extractHelpfulFactors(emotions, messages, trends) {
  const helpfulFactors = [];

  // Check for social connection mentions
  const socialKeywords = ['friend', 'talk', 'chat', 'connect', 'family', 'call', 'meet'];
  const hasSocialConnection = messages.some(m => 
    socialKeywords.some(keyword => (m.content || m.message || '').toLowerCase().includes(keyword))
  );
  if (hasSocialConnection) {
    helpfulFactors.push('Social connection and meaningful conversation');
  }

  // Check for rest/relaxation mentions
  const restKeywords = ['rest', 'relax', 'break', 'sleep', 'nap', 'pause', 'breathe'];
  const hadRest = messages.some(m => 
    restKeywords.some(keyword => (m.content || m.message || '').toLowerCase().includes(keyword))
  );
  if (hadRest) {
    helpfulFactors.push('Taking time to rest and recharge');
  }

  // Check for positive trend
  if (trends.morningToEvening === 'improved') {
    helpfulFactors.push('Your resilience through the day\'s challenges');
  }

  // Check for achievement mentions
  const achievementKeywords = ['done', 'finished', 'completed', 'achieved', 'accomplished', 'solved'];
  const hadAchievement = messages.some(m => 
    achievementKeywords.some(keyword => (m.content || m.message || '').toLowerCase().includes(keyword))
  );
  if (hadAchievement) {
    helpfulFactors.push('Completing tasks and making progress');
  }

  // Check for self-care mentions
  const selfCareKeywords = ['exercise', 'walk', 'meditate', 'journal', 'music', 'hobby'];
  const hadSelfCare = messages.some(m => 
    selfCareKeywords.some(keyword => (m.content || m.message || '').toLowerCase().includes(keyword))
  );
  if (hadSelfCare) {
    helpfulFactors.push('Engaging in self-care activities');
  }

  // Fallback factors if nothing specific detected
  if (helpfulFactors.length === 0) {
    helpfulFactors.push(
      'Taking time to acknowledge your feelings',
      'Moving through the day step by step',
      'Being present with yourself'
    );
  }

  // Return top 3
  return helpfulFactors.slice(0, 3);
}

/**
 * Generate tomorrow's suggestion based on today's patterns
 * @param {Object} emotionSummary - Emotion summary
 * @param {Object} trends - Emotion trends
 * @returns {string} Tomorrow's suggestion
 */
export function generateTomorrowSuggestion(emotionSummary, trends) {
  const moodScore = emotionSummary.moodScore || 50;
  const dominant = emotionSummary.dominant || 'neutral';

  // Suggestions based on mood patterns
  if (moodScore < 40) {
    return 'Set aside 5 minutes in the morning for deep breathing or gentle stretching.';
  }

  if (dominant === 'anxious' || dominant === 'fear') {
    return 'Write down one thing you\'re grateful for before bed tonight.';
  }

  if (dominant === 'angry' || dominant === 'frustrated') {
    return 'Take a short walk outside when you feel tension building.';
  }

  if (trends.morningToEvening === 'improved') {
    return 'Notice what helped today and try to recreate those conditions tomorrow.';
  }

  // Default suggestions
  const suggestions = [
    'Start your day with three deep breaths and a positive intention.',
    'Schedule a 10-minute break mid-afternoon to reset.',
    'Connect with someone who makes you feel heard and valued.',
    'Write down three things that went well today before sleep.',
    'Take a brief walk outside to shift your energy.'
  ];

  return suggestions[Math.floor(Math.random() * suggestions.length)];
}
