/**
 * Text Service Module
 * Handles text preprocessing and emotion detection with caching
 * 
 * This module:
 * 1. Preprocesses text (cleaning, tokenization)
 * 2. Detects emotions using BiLSTM ONNX model (custom) and HuggingFace API
 * 3. Combines results from both models (HuggingFace-dominant weighted fusion)
 * 4. Returns emotion labels with confidence scores
 * 5. Implements caching for improved performance
 */

import axios from 'axios';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple cache implementation
const emotionCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Cache utilities
const getCacheKey = (text) => text.toLowerCase().trim().replace(/\s+/g, ' ');
const getCachedResult = (key) => {
  const cached = emotionCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
};
const setCachedResult = (key, data) => {
  emotionCache.set(key, { data, timestamp: Date.now() });
  if (emotionCache.size > 1000) {
    const entries = Array.from(emotionCache.entries());
    const cutoff = Date.now() - CACHE_DURATION;
    for (const [key, value] of entries) {
      if (value.timestamp < cutoff) emotionCache.delete(key);
    }
  }
};

// Text preprocessing
export const preprocessText = (text) => {
  let cleaned = text.trim().replace(/\s+/g, ' ');
  const maxLength = 512;
  if (cleaned.length > maxLength) cleaned = cleaned.substring(0, maxLength);
  return cleaned;
};

// Tokenization (basic)
export const tokenizeText = (text) => {
  return text.toLowerCase().split(/\s+/).filter(token => token.length > 0);
};

// HuggingFace emotion detection
export const detectEmotionFromText = async (text) => {
  try {
    const cacheKey = getCacheKey(text);
    const cached = getCachedResult(cacheKey);
    if (cached) {
      console.log(`💾 Using cached HuggingFace result for text emotion detection`);
      return cached;
    }

    const apiKey = config.huggingface.apiKey;
    const model = config.huggingface.textEmotionModel;
    const apiUrl = `${config.huggingface.apiUrl}/${model}`;

    console.log(`🧠 Calling HuggingFace API for text emotion detection...`);
    const response = await axios.post(
      apiUrl,
      { inputs: text },
      {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 15000
      }
    );

    const predictions = response.data[0];
    predictions.sort((a, b) => b.score - a.score);
    const dominantEmotion = predictions[0];
    const scores = {};
    predictions.forEach(pred => (scores[pred.label] = pred.score));

    const result = {
      emotion: dominantEmotion.label,
      confidence: dominantEmotion.score,
      scores: scores
    };
    setCachedResult(cacheKey, result);
    return result;

  } catch (error) {
    console.error('❌ Error calling HuggingFace API:', error.message);
    return {
      emotion: 'neutral',
      confidence: 0.5,
      scores: { neutral: 0.5 },
      useFallback: true,
      error: 'API call failed, using fallback'
    };
  }
};

// BiLSTM ONNX model inference
export const detectEmotionBiLSTM = async (text) => {
  return new Promise((resolve) => {
    try {
      const modelPath = path.resolve('./src/models/emotion_bilstm_final.onnx');
      const scriptPath = path.resolve('./src/text-service/bilstm_onnx_inference.py');
      const emotionLabels = 'angry,disgust,fear,happy,neutral,sad';
      console.log(`🧠 Running BiLSTM ONNX model for text emotion...`);

      const python = spawn('python', [scriptPath, modelPath, text, emotionLabels]);
      let output = '';
      let errorOutput = '';

      python.stdout.on('data', (data) => (output += data.toString()));
      python.stderr.on('data', (data) => (errorOutput += data.toString()));

      python.on('close', (code) => {
        try {
          if (code === 0 && output) {
            const result = JSON.parse(output.trim());
            if (result.success) {
              console.log(`✅ BiLSTM detected: ${result.emotion} (${(result.confidence * 100).toFixed(1)}%)`);
              resolve({
                emotion: result.emotion,
                confidence: result.confidence,
                scores: result.scores,
                model: 'bilstm_onnx'
              });
              return;
            }
          }
          console.warn(`⚠️ BiLSTM model failed or parsing error.`);
          if (errorOutput) console.warn(`   Python stderr: ${errorOutput.substring(0, 300)}`);
          resolve({
            emotion: 'neutral',
            confidence: 0.5,
            scores: { neutral: 0.5 },
            useFallback: true,
            model: 'bilstm_onnx'
          });
        } catch (e) {
          console.warn(`⚠️ BiLSTM parsing error: ${e.message}`);
          resolve({
            emotion: 'neutral',
            confidence: 0.5,
            scores: { neutral: 0.5 },
            useFallback: true,
            model: 'bilstm_onnx'
          });
        }
      });
    } catch (error) {
      console.error('❌ BiLSTM Error:', error.message);
      resolve({
        emotion: 'neutral',
        confidence: 0.5,
        scores: { neutral: 0.5 },
        useFallback: true,
        model: 'bilstm_onnx'
      });
    }
  });
};

/**
 * Combine results from BiLSTM and HuggingFace models
 * HuggingFace-dominant weighted fusion with disagreement handling
 */
export const combineTextEmotionResults = (bilstmResult, hfResult) => {
  console.log(`🔀 Combining BiLSTM and HuggingFace results...`);

  // If one fails, return the other
  if (bilstmResult.useFallback && !hfResult.useFallback) {
    console.log(`   Using HuggingFace only (BiLSTM failed)`);
    return { ...hfResult, models_used: ['huggingface'], combination_strategy: 'single_model' };
  }
  if (!bilstmResult.useFallback && hfResult.useFallback) {
    console.log(`   Using BiLSTM only (HuggingFace failed)`);
    return { ...bilstmResult, models_used: ['bilstm_onnx'], combination_strategy: 'single_model' };
  }
  if (bilstmResult.useFallback && hfResult.useFallback) {
    console.log(`   Both models failed, using neutral`);
    return {
      emotion: 'neutral',
      confidence: 0.5,
      scores: { neutral: 0.5 },
      models_used: [],
      combination_strategy: 'fallback'
    };
  }

  // Base trust weights
  let w_bilstm = 0.2;
  let w_hf = 0.8;

  // Reduce BiLSTM influence if disagreement occurs
  if (bilstmResult.emotion !== hfResult.emotion) {
    console.log(`⚖️ Models disagree — reducing BiLSTM influence.`);
    w_bilstm *= 0.1;
  }

  const emotionMap = { joy: 'happy', sadness: 'sad', anger: 'angry' };
  const normalize = (label) => emotionMap[label] || label;

  const bilstmEmotion = normalize(bilstmResult.emotion);
  const hfEmotion = normalize(hfResult.emotion);

  const allEmotions = new Set([
    ...Object.keys(bilstmResult.scores || {}),
    ...Object.keys(hfResult.scores || {})
  ]);

  const combinedScores = {};
  const totalWeight = w_bilstm + w_hf;
  allEmotions.forEach((emotion) => {
    const bilstmScore = bilstmResult.scores[emotion] || 0;
    const hfScore = hfResult.scores[emotion] || 0;
    combinedScores[emotion] = (bilstmScore * w_bilstm + hfScore * w_hf) / totalWeight;
  });

  let dominantEmotion = 'neutral';
  let maxScore = 0;
  Object.entries(combinedScores).forEach(([emotion, score]) => {
    if (score > maxScore) {
      maxScore = score;
      dominantEmotion = emotion;
    }
  });

  console.log(`✅ Combined emotion: ${dominantEmotion} (${(maxScore * 100).toFixed(2)}%)`);
  console.log(`   BiLSTM: ${bilstmEmotion} (${(bilstmResult.confidence * 100).toFixed(1)}%)`);
  console.log(`   HuggingFace: ${hfEmotion} (${(hfResult.confidence * 100).toFixed(1)}%)`);

  return {
    emotion: dominantEmotion,
    confidence: maxScore,
    scores: combinedScores,
    models_used: ['bilstm_onnx', 'huggingface'],
    combination_strategy: 'weighted_hf_dominant',
    individual_results: {
      bilstm: { emotion: bilstmEmotion, confidence: bilstmResult.confidence },
      huggingface: { emotion: hfEmotion, confidence: hfResult.confidence }
    }
  };
};

// Main analysis function
export const analyzeTextEmotion = async (text) => {
  console.log(`📝 Analyzing text emotion with dual models...`);
  const cleanedText = preprocessText(text);
  console.log(`✅ Text preprocessed: "${cleanedText}"`);

  const [bilstmResult, hfResult] = await Promise.all([
    detectEmotionBiLSTM(cleanedText),
    detectEmotionFromText(cleanedText)
  ]);

  const combinedResult = combineTextEmotionResults(bilstmResult, hfResult);
  return {
    originalText: text,
    processedText: cleanedText,
    emotion: combinedResult.emotion,
    confidence: combinedResult.confidence,
    scores: combinedResult.scores,
    models_used: combinedResult.models_used,
    combination_strategy: combinedResult.combination_strategy,
    individual_results: combinedResult.individual_results
  };
};
