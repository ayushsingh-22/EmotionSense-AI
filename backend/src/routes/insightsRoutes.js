/**
 * Insights Routes
 * Handles all API endpoints for emotion insights, daily journals, and weekly summaries
 * UPDATED: Now uses master_user_activity as single source of truth
 */

import express from "express";
import prisma from "../lib/prisma.js";
import masterActivityService from "../storage-service/masterActivityService.js";
import * as insightsStorage from "../storage-service/insights.js";
import * as unifiedEmotion from "../storage-service/unifiedEmotionService.js";
import * as llmService from "../llm-service/index.js";
import logger from "../utils/logger.js";
import { DateTime } from "luxon";

const router = express.Router();

// SCHEMA NOTE: `journal_entries` doesn't exist in the Neon/Prisma schema -
// journal data is stored in DailyEmotionSummary (see storage-service/insights.js
// and journal-service/journalGenerator.js). We read it here directly via
// Prisma since we only need `date` + a synthesized `emotion_summary` shape.
const fetchJournalEntriesForRange = async (userId, start, end) => {
  const rows = await prisma.dailyEmotionSummary.findMany({
    where: { userId, date: { gte: start, lte: end } },
    select: {
      date: true,
      dominantEmotion: true,
      moodScore: true,
      emotionDistribution: true,
      timeSegments: true
    }
  });

  return rows.map((row) => ({
    date: row.date,
    emotion: row.dominantEmotion,
    emotion_summary: {
      dominant_emotion: row.dominantEmotion,
      mood_score: row.moodScore,
      emotion_counts: row.emotionDistribution ?? {},
      time_segments: row.timeSegments ?? []
    }
  }));
};

// Helper function to get emotion emoji (STRICT 7 EMOTIONS)
function getEmotionEmoji(emotion) {
  const emojiMap = {
    anger: "🤬",
    disgust: "🤢",
    fear: "😨",
    joy: "😀",
    neutral: "😐",
    sadness: "😭",
    surprise: "😲",
  };
  return emojiMap[emotion?.toLowerCase()] || "😐";
}

// Helper function to calculate mood variance (stability metric)
function calculateMoodVariance(dailyArc) {
  if (!dailyArc || dailyArc.length === 0) return 0;

  // Only calculate variance for days with actual data
  const validScores = dailyArc
    .filter((day) => day.has_data && day.mood_score !== null)
    .map((day) => day.mood_score);

  if (validScores.length === 0) return 0; // No data available
  if (validScores.length === 1) return 0; // Only one data point, no variance

  const mean =
    validScores.reduce((sum, score) => sum + score, 0) / validScores.length;
  const variance =
    validScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) /
    validScores.length;

  return Math.round(Math.sqrt(variance)); // Return standard deviation
}

// Helper function to generate journal text from insights
function generateJournalText(insights, date) {
  const { dominantEmotion, emotionDistribution, activityCount } = insights;
  const emotions = Object.keys(emotionDistribution || {});

  if (!dominantEmotion || activityCount === 0) {
    return `No significant emotional activity recorded for ${date}.`;
  }

  const mainEmotion = dominantEmotion;
  const emotionEmoji = getEmotionEmoji(mainEmotion);
  const emotionCount = emotionDistribution[mainEmotion] || 0;

  const templates = {
    joy: [
      `Today was filled with joy! ${emotionEmoji} You experienced ${emotionCount} moments of happiness.`,
      `A wonderful day! ${emotionEmoji} Joy was your dominant emotion with ${emotionCount} positive moments.`,
    ],
    sadness: [
      `Today brought some sadness. ${emotionEmoji} You processed ${emotionCount} moments of melancholy.`,
      `A reflective day. ${emotionEmoji} Sadness emerged ${emotionCount} times as you navigated your emotions.`,
    ],
    anger: [
      `Today had some challenging moments. ${emotionEmoji} Anger surfaced ${emotionCount} times.`,
      `An intense day. ${emotionEmoji} You felt angry in ${emotionCount} instances.`,
    ],
    neutral: [
      `A balanced day. ${emotionEmoji} You maintained emotional equilibrium with ${emotionCount} neutral moments.`,
      `A steady day. ${emotionEmoji} Your emotions stayed relatively neutral throughout.`,
    ],
    fear: [
      `Today brought some anxiety. ${emotionEmoji} Fear or worry appeared ${emotionCount} times.`,
      `A cautious day. ${emotionEmoji} You felt apprehensive or fearful in ${emotionCount} moments.`,
    ],
    disgust: [
      `Today had some challenging moments. ${emotionEmoji} Disgust appeared ${emotionCount} times.`,
      `A difficult day. ${emotionEmoji} You experienced disgust in ${emotionCount} instances.`,
    ],
    surprise: [
      `Today brought unexpected moments! ${emotionEmoji} Surprise emerged ${emotionCount} times.`,
      `An eventful day! ${emotionEmoji} You felt surprised in ${emotionCount} instances.`,
    ],
  };

  const template = templates[mainEmotion] || templates["neutral"];
  const selectedTemplate =
    template[Math.floor(Math.random() * template.length)];

  // Add context about other emotions if present
  const otherEmotions = emotions.filter(
    (e) => e !== mainEmotion && emotionDistribution[e] > 0
  );
  if (otherEmotions.length > 0) {
    const otherEmotionsText = otherEmotions
      .map((e) => `${e} (${emotionDistribution[e]})`)
      .join(", ");
    return `${selectedTemplate} You also experienced: ${otherEmotionsText}.`;
  }

  return selectedTemplate;
}

// Helper function to generate fallback reflection when AI generation fails
function generateFallbackReflection(weekData) {
  const {
    dominant_emotion,
    active_days,
    avg_mood_score,
    emotion_summary,
    total_activities,
  } = weekData;

  if (!total_activities || total_activities === 0) {
    return "This was a quiet week with minimal emotional activity recorded.";
  }

  const emotionEmoji = getEmotionEmoji(dominant_emotion);
  const moodLevel =
    avg_mood_score >= 70
      ? "positive"
      : avg_mood_score >= 40
      ? "balanced"
      : "challenging";

  const templates = {
    joy: [
      `${emotionEmoji} This was a joyful week! You experienced happiness across ${active_days} days.`,
      `${emotionEmoji} A wonderful week filled with positive moments over ${active_days} active days.`,
    ],
    sadness: [
      `${emotionEmoji} This week brought some reflective moments across ${active_days} days.`,
      `${emotionEmoji} A thoughtful week with emotional depth over ${active_days} days.`,
    ],
    anger: [
      `${emotionEmoji} This week had some intense moments spread across ${active_days} days.`,
      `${emotionEmoji} A challenging week with strong emotions over ${active_days} active days.`,
    ],
    neutral: [
      `${emotionEmoji} A balanced week with steady emotions across ${active_days} days.`,
      `${emotionEmoji} This week maintained emotional equilibrium over ${active_days} days.`,
    ],
    fear: [
      `${emotionEmoji} This week brought some anxious moments across ${active_days} days.`,
      `${emotionEmoji} A cautious week with thoughtful reflection over ${active_days} days.`,
    ],
    disgust: [
      `${emotionEmoji} This week had some challenging experiences across ${active_days} days.`,
      `${emotionEmoji} A difficult week that you navigated over ${active_days} active days.`,
    ],
    surprise: [
      `${emotionEmoji} This week brought unexpected moments across ${active_days} days!`,
      `${emotionEmoji} An eventful week with surprises over ${active_days} active days!`,
    ],
  };

  const emotionTemplates = templates[dominant_emotion] || templates["neutral"];
  const baseReflection =
    emotionTemplates[Math.floor(Math.random() * emotionTemplates.length)];

  // Add mood context
  let moodContext = "";
  if (moodLevel === "positive") {
    moodContext = " Overall, it was a positive and uplifting week.";
  } else if (moodLevel === "challenging") {
    moodContext =
      " Take time to care for yourself and celebrate small victories.";
  } else {
    moodContext = " You maintained good emotional balance throughout.";
  }

  return baseReflection + moodContext;
}

// Helper function to generate fallback journal text
function generateFallbackJournalText(emotions, dominantEmotion, activityCount) {
  const emotionEmoji = getEmotionEmoji(dominantEmotion);

  if (activityCount === 0) {
    return "A quiet day with no recorded emotional activity.";
  }

  return `Today you experienced ${activityCount} emotional moments. ${emotionEmoji} ${dominantEmotion} was most prominent.`;
}

// Helper function to generate time segments from activities
function generateTimeSegments(activities) {
  const segments = {
    morning: { period: "morning", emotions: {}, count: 0 },
    afternoon: { period: "afternoon", emotions: {}, count: 0 },
    evening: { period: "evening", emotions: {}, count: 0 },
  };

  activities.forEach((activity) => {
    if (!activity.created_at || !activity.emotion_data?.emotion) return;

    const hour = new Date(activity.created_at).getHours();
    let period;

    if (hour >= 5 && hour < 12) period = "morning";
    else if (hour >= 12 && hour < 17) period = "afternoon";
    else period = "evening";

    const emotion = unifiedEmotion.normalizeEmotion(
      activity.emotion_data.emotion
    );
    segments[period].count++;
    segments[period].emotions[emotion] =
      (segments[period].emotions[emotion] || 0) + 1;
  });

  // Calculate dominant emotion per period - ONLY return segments with actual data
  return Object.keys(segments)
    .map((periodKey) => {
      const segment = segments[periodKey];

      // Skip periods with no emotion data
      if (Object.keys(segment.emotions).length === 0) {
        return null;
      }

      // Get emotion with highest count
      const dominantEmotion = Object.entries(segment.emotions).sort(
        ([, a], [, b]) => b - a
      )[0][0];

      return {
        period: periodKey,
        emotion: dominantEmotion,
        count: segment.count,
      };
    })
    .filter((segment) => segment !== null); // Remove null entries
}

/**
 * Generate AI-powered weekly reflection text
 * @param {Object} weekData - Week summary data
 * @returns {Promise<string>} Reflection text
 */
async function generateWeeklyReflection(weekData) {
  try {
    const {
      dominant_emotion,
      avg_mood_score,
      emotion_summary,
      active_days,
      total_activities,
    } = weekData;

    if (total_activities === 0 || active_days === 0) {
      return "This was a quiet week with minimal emotional activity recorded.";
    }

    // Generate fallback reflection immediately (template-based)
    const fallbackReflection = generateFallbackReflection(weekData);

    // Try LLM generation with timeout protection
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => resolve(fallbackReflection), 3000); // 3 second timeout
    });

    // Build context for LLM
    const emotionList = Object.entries(emotion_summary)
      .sort(([, a], [, b]) => b - a)
      .map(([emotion, count]) => `${emotion} (${count} times)`)
      .slice(0, 3)
      .join(", ");

    const moodLevel =
      avg_mood_score >= 70
        ? "positive"
        : avg_mood_score >= 40
        ? "balanced"
        : "challenging";

    const prompt = `You are an empathetic emotion insights assistant. Generate a brief, supportive weekly reflection (2-3 sentences) based on this emotional data:

- Dominant emotion: ${dominant_emotion}
- Mood level: ${moodLevel} (score: ${avg_mood_score}/100)
- Top emotions experienced: ${emotionList}
- Active days: ${active_days}/7 days
- Total emotional moments: ${total_activities}

Write a concise, warm reflection that:
1. Acknowledges the emotional journey
2. Highlights positive patterns or growth
3. Offers gentle encouragement if needed

Keep it under 200 characters. Be specific to the emotions mentioned. Sound natural and supportive.`;

    const llmPromise = llmService
      .generateResponse(prompt, "neutral", [])
      .then((response) => {
        // Handle different response formats
        if (typeof response === "string") return response;
        if (response?.text) return response.text;
        return fallbackReflection;
      })
      .catch(() => fallbackReflection);

    // Race between LLM and timeout
    const response = await Promise.race([llmPromise, timeoutPromise]);

    // Ensure we have a valid string response
    const reflectionText =
      typeof response === "string" ? response : fallbackReflection;

    // Fallback to simple template if LLM fails
    if (!reflectionText || reflectionText.length === 0) {
      return generateFallbackReflection(weekData);
    }

    // Trim to reasonable length
    return reflectionText.substring(0, 500);
  } catch (error) {
    logger.warn("Failed to generate weekly reflection:", error.message);
    // Return simple fallback
    const { dominant_emotion, active_days, avg_mood_score } = weekData;
    return `This week showed ${dominant_emotion} as your primary emotion across ${active_days} active days. ${
      avg_mood_score >= 60
        ? "Overall, it was a positive week."
        : "Take time to care for yourself."
    }`;
  }
}

/**
 * GET /api/insights/daily
 * Fetch daily insights for a user
 * Query params: startDate, endDate
 */
router.get("/daily", async (req, res) => {
  try {
    const { userId } = req.query;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "userId is required",
      });
    }

    // If no date range provided, get last 30 days
    const end =
      endDate || DateTime.now().setZone("Asia/Kolkata").toFormat("yyyy-MM-dd");
    const start =
      startDate ||
      DateTime.now()
        .setZone("Asia/Kolkata")
        .minus({ days: 30 })
        .toFormat("yyyy-MM-dd");

    // Get activities for date range
    const activitiesResult = await masterActivityService.getActivities({
      user_id: userId,
      startDate: start,
      endDate: end,
      limit: 1000,
    });
    const activities = activitiesResult.data || [];

    // Get journal entries for the same date range to ensure consistent mood scores
    const journalEntries = await fetchJournalEntriesForRange(userId, start, end);

    // Group by date and create daily summaries
    const dailyMap = {};
    activities.forEach((activity) => {
      const date = activity.local_date;
      if (!dailyMap[date]) {
        dailyMap[date] = [];
      }
      dailyMap[date].push(activity);
    });

    // Build daily insights
    const dailyInsights = await Promise.all(
      Object.keys(dailyMap).map(async (date) => {
        try {
          // PRIORITY 1: Check if journal entry exists for this date
          const journalEntry = journalEntries?.find((j) => j.date === date);

          let dominantEmotion, moodScore, emotionCounts, timeSegments;

          if (journalEntry?.emotion_summary) {
            // USE JOURNAL DATA - This is the ABSOLUTE source of truth
            const journalSummary = journalEntry.emotion_summary;
            dominantEmotion = unifiedEmotion.normalizeEmotion(
              journalSummary.dominant_emotion ||
                journalSummary.primaryEmotion ||
                "neutral"
            );
            moodScore =
              journalSummary.mood_score || journalSummary.moodScore || 50;
            emotionCounts = journalSummary.emotion_counts || {};
            
            // CRITICAL: Use journal time_segments if available, otherwise generate from activities
            // But NEVER mix journal emotion data with generated segments
            if (journalSummary.time_segments && journalSummary.time_segments.length > 0) {
              timeSegments = journalSummary.time_segments;
              logger.info(`✅ Using journal time_segments for ${date}`);
            } else {
              timeSegments = generateTimeSegments(dailyMap[date] || []);
              logger.info(`⚠️ Journal missing time_segments for ${date}, generating from activities`);
            }

            logger.info(
              `✅ Using journal data for ${date}: ${dominantEmotion}, mood: ${moodScore}`
            );
          } else {
            // FALLBACK: no journal exists yet for this date (e.g. today,
            // before the nightly cron or a manual generate has run) — use
            // the SAME canonical computation Journal generation itself uses
            // (unifiedEmotionService, over user messages only), instead of a
            // separate master_user_activity-based calculation. That older
            // fallback counted raw (unweighted, unnormalized) emotion_data
            // frequency across ALL activities including assistant replies
            // (which default to "neutral" when untagged) — diluting the
            // result toward "neutral" and picking a different dominant
            // emotion than Journal would for the identical day.
            logger.info(
              `⚠️ No journal for ${date}, calculating from messages (unified)`
            );

            const summary = await unifiedEmotion.getDailyEmotionSummary(userId, date);
            dominantEmotion = summary.dominantEmotion;
            emotionCounts = summary.emotionCounts || {};
            moodScore = summary.moodScore;
            timeSegments = summary.timeSegments?.length
              ? summary.timeSegments
              : generateTimeSegments(dailyMap[date] || []);
          }

          // Generate journal text
          const journalText = generateJournalText(
            {
              dominantEmotion,
              emotionDistribution: emotionCounts,
              activityCount: dailyMap[date]?.length || 0,
            },
            date
          );

          return {
            id: `daily-${userId}-${date}`,
            user_id: userId,
            date,
            content: journalText,
            emotion: dominantEmotion,
            emotion_emoji: getEmotionEmoji(dominantEmotion),
            emotion_summary: {
              dominant_emotion: dominantEmotion,
              mood_score: moodScore,
              emotion_counts: emotionCounts,
              time_segments: timeSegments,
              context_summary: `Analyzed ${
                dailyMap[date]?.length || 0
              } activities`,
              message_count: dailyMap[date]?.length || 0,
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        } catch (error) {
          logger.warn(`Failed to get insights for ${date}:`, error.message);

          // FALLBACK: Manual calculation from activities
          const dayActivities = dailyMap[date] || [];
          const emotions = {};
          dayActivities.forEach((activity) => {
            if (activity.emotion_data?.emotion) {
              const normalizedEmotion = unifiedEmotion.normalizeEmotion(
                activity.emotion_data.emotion
              );
              emotions[normalizedEmotion] =
                (emotions[normalizedEmotion] || 0) + 1;
            }
          });

          // Check journal entry first (PRIORITY)
          const journalEntry = journalEntries?.find((j) => j.date === date);
          let dominantEmotion, moodScore;

          if (journalEntry?.emotion_summary) {
            dominantEmotion = unifiedEmotion.normalizeEmotion(
              journalEntry.emotion_summary.dominant_emotion ||
                journalEntry.emotion_summary.primaryEmotion ||
                "neutral"
            );
            moodScore =
              journalEntry.emotion_summary.mood_score ||
              journalEntry.emotion_summary.moodScore ||
              50;
            logger.info(
              `✅ Fallback using journal data for ${date}: ${dominantEmotion}`
            );
          } else {
            // Same canonical computation as the primary path above and as
            // Journal generation — see comment there for why this replaces
            // the old master_user_activity-based calculation.
            const summary = await unifiedEmotion.getDailyEmotionSummary(userId, date);
            dominantEmotion = summary.dominantEmotion;
            moodScore = summary.moodScore;
            logger.info(
              `⚠️ Fallback (unified) calculating from messages for ${date}: ${dominantEmotion}`
            );
          }

          const journalText = generateFallbackJournalText(
            emotions,
            dominantEmotion,
            dayActivities.length
          );
          const timeSegments = generateTimeSegments(dayActivities);

          return {
            id: `daily-${userId}-${date}`,
            user_id: userId,
            date,
            content: journalText,
            emotion: dominantEmotion,
            emotion_emoji: getEmotionEmoji(dominantEmotion),
            emotion_summary: {
              dominant_emotion: dominantEmotion,
              mood_score: moodScore,
              emotion_counts: emotions,
              time_segments: timeSegments,
              context_summary: `Processed ${dayActivities.length} activities`,
              message_count: dayActivities.length,
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        }
      })
    );

    // Sort by date descending
    dailyInsights.sort((a, b) => b.date.localeCompare(a.date));

    res.json({
      success: true,
      data: {
        insights: dailyInsights,
        count: dailyInsights.length,
      },
    });
  } catch (error) {
    logger.error("Error in GET /insights/daily:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch daily insights",
      message: error.message,
    });
  }
});

/**
 * GET /api/insights/weekly
 * Fetch weekly insights for a user
 * Query params: limit (default: 4)
 */
router.get("/weekly", async (req, res) => {
  try {
    const { userId, limit } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "userId is required",
      });
    }

    const weeksToFetch = limit ? parseInt(limit) : 4;
    const weeklyInsights = [];

    // Calculate last N weeks
    const today = DateTime.now().setZone("Asia/Kolkata");

    for (let i = 0; i < weeksToFetch; i++) {
      const weekStart = today.minus({ weeks: i }).startOf("week");
      const weekEnd = today.minus({ weeks: i }).endOf("week");

      try {
        // Get activities for the week
        const activitiesResult = await masterActivityService.getActivities({
          user_id: userId,
          startDate: weekStart.toFormat("yyyy-MM-dd"),
          endDate: weekEnd.toFormat("yyyy-MM-dd"),
          limit: 1000,
        });

        const weekActivities = activitiesResult.data || [];

        // Get journal entries for this week to ensure consistent mood scores
        const journalEntries = await fetchJournalEntriesForRange(
          userId,
          weekStart.toFormat("yyyy-MM-dd"),
          weekEnd.toFormat("yyyy-MM-dd")
        );

        // Calculate weekly summary and daily arc
        const emotions = {};

        // Group ALL activities by day for the daily arc — previously this
        // grouping only included activities with emotion_data.emotion set,
        // while total_activities below counts every activity unconditionally.
        // Any activity missing emotion_data (partial/legacy rows, or any
        // write path that doesn't tag emotion) made active_days silently
        // collapse to 0 while total_activities stayed real — exactly the
        // "21 activities, 0 active days, quiet week" contradiction reported.
        // "Is this day active" and "what's the day's mood" are now tracked
        // separately: every activity counts toward activity_count/active_days;
        // only user-authored, emotion-tagged ones feed the mood computation
        // (assistant replies default to "neutral" when untagged and would
        // otherwise dilute the real, user-felt mood toward neutral).
        const dailyActivities = {};

        weekActivities.forEach((activity) => {
          const activityDate = DateTime.fromISO(activity.created_at).toFormat(
            "yyyy-MM-dd"
          );
          if (!dailyActivities[activityDate]) {
            dailyActivities[activityDate] = [];
          }
          dailyActivities[activityDate].push(activity);

          if (
            activity.activity_type === "chat_message" &&
            activity.emotion_data?.emotion
          ) {
            const emotion = unifiedEmotion.normalizeEmotion(
              activity.emotion_data.emotion
            );
            emotions[emotion] = (emotions[emotion] || 0) + 1;
          }
        });

        // Calculate daily arc (mood score for each day)
        const dailyArc = [];
        for (let day = 0; day < 7; day++) {
          const currentDay = weekStart.plus({ days: day });
          const dateKey = currentDay.toFormat("yyyy-MM-dd");
          const dayActivities = dailyActivities[dateKey] || [];

          // "Has activity" (any type) vs "has mood data" (user-authored,
          // emotion-tagged) are different questions — a day with only
          // assistant replies is active but has no user mood to report.
          const journalEntry = journalEntries?.find((j) => j.date === dateKey);
          let avgDayMoodScore = null;
          let dominantDayEmotion = "neutral";
          let hasMoodData = false;

          if (journalEntry?.emotion_summary?.mood_score) {
            avgDayMoodScore = journalEntry.emotion_summary.mood_score;
            dominantDayEmotion =
              journalEntry.emotion ||
              journalEntry.emotion_summary?.dominant_emotion ||
              "neutral";
            hasMoodData = true;
          } else {
            // Same canonical computation as Insights-daily and Journal
            // generation (unifiedEmotionService, user messages only) —
            // guarantees this matches what Journal would show for this date.
            const summary = await unifiedEmotion.getDailyEmotionSummary(userId, dateKey);
            if (summary.messageCount > 0) {
              avgDayMoodScore = summary.moodScore;
              dominantDayEmotion = summary.dominantEmotion;
              hasMoodData = true;
            }
          }

          dailyArc.push({
            date: dateKey,
            emotion: dominantDayEmotion,
            mood_score: avgDayMoodScore,
            activity_count: dayActivities.length,
            has_data: hasMoodData,
          });
        }

        // Calculate weekly dominant emotion and mood score
        let dominantEmotion = 'neutral';
        let avgMoodScore = 50;

        if (journalEntries && journalEntries.length > 0) {
          // PRIORITY: Use journal entries for weekly summary
          const journalEmotions = {};
          let totalJournalMood = 0;
          let journalCount = 0;

          journalEntries.forEach(j => {
            if (j.emotion_summary) {
              const emotion = unifiedEmotion.normalizeEmotion(
                j.emotion_summary.dominant_emotion || j.emotion_summary.primaryEmotion || 'neutral'
              );
              journalEmotions[emotion] = (journalEmotions[emotion] || 0) + 1;
              
              const score = j.emotion_summary.mood_score || j.emotion_summary.moodScore;
              if (score !== undefined) {
                totalJournalMood += score;
                journalCount++;
              }
            }
          });

          // Find dominant emotion from journals
          dominantEmotion = Object.entries(journalEmotions)
            .sort(([, a], [, b]) => b - a)[0]?.[0] || 'neutral';
            
          // Calculate average mood from journals
          if (journalCount > 0) {
            avgMoodScore = Math.round(totalJournalMood / journalCount);
          }
        } else {
          // FALLBACK: use activities if no journals — user-authored only
          // (assistant replies default to "neutral" when untagged and would
          // dilute this toward neutral), confidence-weighted the same way
          // getDominantEmotion computes it everywhere else (previously this
          // picked the raw most-frequent label, unweighted).
          const weeklyEmotionList = weekActivities
            .filter((a) => a.activity_type === "chat_message")
            .map((a) => ({
              emotion: a.emotion_data?.emotion,
              confidence:
                a.emotion_data?.confidence || a.emotion_data?.emotion_confidence,
            }))
            .filter((e) => e.emotion);

          dominantEmotion = unifiedEmotion.getDominantEmotion(weeklyEmotionList);

          avgMoodScore = unifiedEmotion.calculateAverageMoodScore(weeklyEmotionList);
        }

        const weekSummary = {
          week_start: weekStart.toFormat("yyyy-MM-dd"),
          week_end: weekEnd.toFormat("yyyy-MM-dd"),
          dominant_emotion: dominantEmotion,
          emotion_emoji: getEmotionEmoji(dominantEmotion),
          avg_mood_score: avgMoodScore,
          emotion_summary: emotions,
          daily_arc: dailyArc,
          total_messages: weekActivities.filter(
            (a) => a.activity_type === "chat_message"
          ).length,
          total_activities: weekActivities.length,
          // Additional insights
          peak_mood_day: dailyArc
            .filter((day) => day.has_data && day.mood_score !== null)
            .reduce(
              (max, day) =>
                day.mood_score > (max.mood_score || 0) ? day : max,
              {
                mood_score: null,
                emotion: "neutral",
                date: "",
                has_data: false,
              }
            ),
          low_mood_day: dailyArc
            .filter((day) => day.has_data && day.mood_score !== null)
            .reduce(
              (min, day) =>
                day.mood_score < (min.mood_score || 100) ? day : min,
              {
                mood_score: null,
                emotion: "neutral",
                date: "",
                has_data: false,
              }
            ),
          mood_variance: calculateMoodVariance(dailyArc),
          active_days: dailyArc.filter((day) => day.activity_count > 0).length,
        };

        // Generate AI-powered reflection text (with timeout protection)
        try {
          const reflectionText = await generateWeeklyReflection(weekSummary);
          weekSummary.reflection_text = reflectionText;
        } catch (reflectionError) {
          logger.warn(
            `Failed to generate reflection for week ${i}:`,
            reflectionError.message
          );
          weekSummary.reflection_text = generateFallbackReflection(weekSummary);
        }

        weeklyInsights.push(weekSummary);
      } catch (error) {
        logger.warn(
          `Failed to get weekly summary for week ${i}:`,
          error.message
        );
        // Add empty week data
        const emptyDailyArc = [];
        const weekStart = today.minus({ weeks: i }).startOf("week");

        for (let day = 0; day < 7; day++) {
          const currentDay = weekStart.plus({ days: day });
          emptyDailyArc.push({
            date: currentDay.toFormat("yyyy-MM-dd"),
            emotion: "neutral",
            mood_score: null,
            activity_count: 0,
            has_data: false,
          });
        }

        weeklyInsights.push({
          week_start: weekStart.toFormat("yyyy-MM-dd"),
          week_end: weekStart.endOf("week").toFormat("yyyy-MM-dd"),
          dominant_emotion: "neutral",
          emotion_emoji: "😐",
          avg_mood_score: 50,
          reflection_text:
            "This was a quiet week with minimal emotional activity recorded.",
          emotion_summary: {},
          daily_arc: emptyDailyArc,
          total_messages: 0,
          total_activities: 0,
          peak_mood_day: {
            date: "",
            mood_score: null,
            emotion: "neutral",
            has_data: false,
          },
          low_mood_day: {
            date: "",
            mood_score: null,
            emotion: "neutral",
            has_data: false,
          },
          mood_variance: 0,
          active_days: 0,
        });
      }
    }

    res.json({
      success: true,
      data: {
        insights: weeklyInsights,
        count: weeklyInsights.length,
      },
    });
  } catch (error) {
    logger.error("Error in GET /insights/weekly:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch weekly insights",
      message: error.message,
    });
  }
});

/**
 * GET /api/insights/timeline/:date
 * Get emotion timeline for a specific date
 * Params: date (YYYY-MM-DD)
 */
router.get("/timeline/:date", async (req, res) => {
  try {
    const { date } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "userId is required",
      });
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        error: "Valid date (YYYY-MM-DD) is required",
      });
    }

    // Get activities for the specific date
    const activitiesResult = await masterActivityService.getActivities({
      user_id: userId,
      startDate: date,
      endDate: date,
      limit: 1000,
    });

    const dayActivities = activitiesResult.data || [];

    // Build timeline from activities
    const timeline = dayActivities
      .filter((activity) => activity.emotion_data?.emotion)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map((activity) => ({
        timestamp: activity.created_at,
        emotion: activity.emotion_data.emotion,
        confidence: activity.emotion_data.confidence,
        activity_type: activity.activity_type,
        content_preview:
          activity.activity_type === "chat_message"
            ? activity.raw_content?.substring(0, 100) + "..."
            : activity.content?.substring(0, 100) + "...",
      }));

    res.json({
      success: true,
      data: timeline,
    });
  } catch (error) {
    logger.error("Error in GET /insights/timeline/:date:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch emotion timeline",
      message: error.message,
    });
  }
});

/**
 * GET /api/insights/monthly
 * Get monthly emotion summary for a user
 * Query params: year, month (e.g., 2025, 11)
 */
router.get("/monthly", async (req, res) => {
  try {
    const { userId, year, month } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "userId is required",
      });
    }

    if (!year || !month) {
      return res.status(400).json({
        success: false,
        error: "year and month are required",
      });
    }

    // Calculate month date range
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;

    // Get daily insights for the month
    const dailyInsights = await insightsStorage.getDailyInsights(
      userId,
      startDate,
      endDate
    );

    res.json({
      success: true,
      data: {
        year: parseInt(year),
        month: parseInt(month),
        insights: dailyInsights,
        count: dailyInsights.length,
      },
    });
  } catch (error) {
    logger.error("Error in GET /insights/monthly:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch monthly insights",
      message: error.message,
    });
  }
});

/**
 * GET /api/insights/stats
 * Get user emotion statistics from master_user_activity
 * UNIFIED: Uses same data source as history section
 */
router.get("/stats", async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "userId is required",
      });
    }

    // Debug log the user ID being requested
    logger.info(`🔍 Stats requested for user: ${userId}`);

    // Get last 30 days of activity data
    const endDate = DateTime.now()
      .setZone("Asia/Kolkata")
      .toFormat("yyyy-MM-dd");
    const startDate = DateTime.now()
      .setZone("Asia/Kolkata")
      .minus({ days: 30 })
      .toFormat("yyyy-MM-dd");

    const activitiesResult = await masterActivityService.getActivities({
      user_id: userId,
      startDate: startDate,
      endDate: endDate,
      limit: 1000,
    });
    const activities = activitiesResult.data || [];

    // Debug log the activity count
    logger.info(`📊 Found ${activities.length} activities for user ${userId}`);

    if (!activities || activities.length === 0) {
      return res.json({
        success: true,
        data: {
          trackedDays: 0,
          totalEmotions: 0,
          firstChatDate: null,
          emotionDistribution: {},
          averageMoodScore: 50,
          currentStreak: 0,
          longestStreak: 0,
        },
      });
    }

    // Calculate stats from activities
    const emotionBreakdown = {};
    let totalMoodScore = 0;
    const uniqueDates = new Set();

    activities.forEach((activity) => {
      // Count emotions
      const emotion = activity.primary_emotion;
      emotionBreakdown[emotion] = (emotionBreakdown[emotion] || 0) + 1;

      // Sum mood scores
      totalMoodScore += activity.mood_score || 50;

      // Track unique dates
      uniqueDates.add(activity.local_date);
    });

    // Calculate streak (consecutive days with activities)
    const sortedDates = Array.from(uniqueDates).sort().reverse();
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    for (let i = 0; i < sortedDates.length; i++) {
      const currentDate = DateTime.fromFormat(sortedDates[i], "yyyy-MM-dd");
      const expectedDate = DateTime.now()
        .setZone("Asia/Kolkata")
        .minus({ days: i });

      if (currentDate.hasSame(expectedDate, "day")) {
        tempStreak++;
        if (i === 0) currentStreak = tempStreak;
      } else {
        if (tempStreak > longestStreak) longestStreak = tempStreak;
        tempStreak = 0;
      }
    }
    if (tempStreak > longestStreak) longestStreak = tempStreak;

    // Get first activity date for tracking since calculation
    const firstActivityResult = await masterActivityService.getActivities({
      user_id: userId,
      limit: 1,
      orderBy: "created_at",
      orderDirection: "asc",
    });

    const firstActivity = firstActivityResult.data?.[0];
    const trackingSinceDate = firstActivity?.created_at
      ? DateTime.fromISO(firstActivity.created_at).toFormat("yyyy-MM-dd")
      : null;

    const stats = {
      trackedDays: uniqueDates.size, // Frontend expects trackedDays
      totalEmotions: activities.length, // Frontend expects totalEmotions
      firstChatDate: trackingSinceDate, // When tracking started
      emotionDistribution: emotionBreakdown, // Emotion breakdown for charts
      // Additional stats for internal use
      averageMoodScore: Math.round(totalMoodScore / activities.length),
      currentStreak: currentStreak,
      longestStreak: longestStreak,
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error("Error in GET /insights/stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch user statistics",
      message: error.message,
    });
  }
});

/**
 * GET /api/insights/moments
 * Get key emotional moments from master_user_activity
 * UNIFIED: Uses same data source as history section
 * Query params: startDate, endDate
 */
router.get("/moments", async (req, res) => {
  try {
    const { userId, startDate, endDate } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "userId is required",
      });
    }

    // Default to last 7 days if not provided
    const end =
      endDate || DateTime.now().setZone("Asia/Kolkata").toFormat("yyyy-MM-dd");
    const start =
      startDate ||
      DateTime.now()
        .setZone("Asia/Kolkata")
        .minus({ days: 7 })
        .toFormat("yyyy-MM-dd");

    const activitiesResult = await masterActivityService.getActivities({
      user_id: userId,
      startDate: start,
      endDate: end,
      limit: 1000,
    });
    const activities = activitiesResult.data || [];

    if (!activities || activities.length === 0) {
      return res.json({
        success: true,
        data: {
          moments: [],
          count: 0,
          dateRange: { start, end },
        },
      });
    }

    // Identify "key moments" based on:
    // 1. Extreme emotions (very high or low mood scores)
    // 2. High confidence scores
    // 3. Longer text content (more meaningful)
    const keyMoments = activities
      .filter((activity) => {
        const emotionData = activity.emotion_data || {};
        const confidence = emotionData.confidence || 0;
        const moodScore = activity.mood_score || 50;

        // High confidence check
        if (confidence > 0.85) return true;

        // Extreme mood check (very happy or very sad)
        if (moodScore > 85 || moodScore < 25) return true;

        return false;
      })
      .map((activity) => ({
        emotion: activity.primary_emotion,
        confidence: activity.emotion_data?.confidence || 0,
        timestamp: activity.created_at,
        context:
          activity.activity_type === "chat_message"
            ? activity.raw_content
            : activity.content,
      }))
      .slice(0, 10); // Limit to top 10 moments

    res.json({
      success: true,
      data: {
        moments: keyMoments,
        count: keyMoments.length,
        dateRange: { start, end },
      },
    });
  } catch (error) {
    logger.error("Error in GET /insights/moments:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch key moments",
      message: error.message,
    });
  }
});

export default router;
