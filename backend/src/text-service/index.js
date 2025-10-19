/**
 * Text Service Module
 * Handles text preprocessing and emotion detection with caching
 * 
 * This module:
 * 1. Preprocesses text (cleaning, tokenization)
 * 2. Detects emotions using BiLSTM ONNX model (custom) and HuggingFace API
 * 3. Combines results from both models
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

/**
 * Cache utility functions
 */
const getCacheKey = (text) => {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
};

const getCachedResult = (key) => {
  const cached = emotionCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
};

const setCachedResult = (key, data) => {
  emotionCache.set(key, {
    data,
    timestamp: Date.now()
  });
  
  // Clean up old cache entries
  if (emotionCache.size > 1000) {
    const entries = Array.from(emotionCache.entries());
    const cutoff = Date.now() - CACHE_DURATION;
    for (const [key, value] of entries) {
      if (value.timestamp < cutoff) {
        emotionCache.delete(key);
      }
    }
  }
};

/**
 * Preprocess text input
 * Cleans and normalizes text before emotion analysis
 */
export const preprocessText = (text) => {
  // Remove extra whitespace
  let cleaned = text.trim().replace(/\s+/g, ' ');
  
  // Remove special characters (optional - keep for now as they may carry emotion)
  // cleaned = cleaned.replace(/[^\w\s.,!?]/g, '');
  
  // Truncate if too long (model limits)
  const maxLength = 512;
  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength);
  }
  
  return cleaned;
};

/**
 * Tokenize text (basic word tokenization)
 * More sophisticated tokenization is handled by the ML model
 */
export const tokenizeText = (text) => {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(token => token.length > 0);
};

/**
 * Detect emotion from text using HuggingFace API with caching
 * Uses BERT/RoBERTa model for emotion classification
 */
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

    // Call HuggingFace Inference API
    const response = await axios.post(
      apiUrl,
      { inputs: text },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000 // Reduced timeout for better UX
      }
    );

    // Parse response
    // Response format: [[{ label: "joy", score: 0.95 }, { label: "sadness", score: 0.03 }, ...]]
    const predictions = response.data[0];
    
    // Sort by score descending
    predictions.sort((a, b) => b.score - a.score);
    
    // Get dominant emotion
    const dominantEmotion = predictions[0];
    
    // Convert to standardized format
    const scores = {};
    predictions.forEach(pred => {
      scores[pred.label] = pred.score;
    });

    const result = {
      emotion: dominantEmotion.label,
      confidence: dominantEmotion.score,
      scores: scores
    };

    // Cache the result
    setCachedResult(cacheKey, result);

    return result;
  } catch (error) {
    console.error('❌ Error calling HuggingFace API:', error.message);
    
    // Fallback: Return neutral emotion if API fails
    return {
      emotion: 'neutral',
      confidence: 0.5,
      scores: { neutral: 0.5 },
      error: 'API call failed, using fallback'
    };
  }
};

/**
 * Alternative: Detect emotion using local Python microservice
 * Uncomment and implement if you want to use a local model instead of HuggingFace API
 */
export const detectEmotionLocal = async (text) => {
  // TODO: Implement local model inference
  // This would call a local Python Flask/FastAPI service running BERT/RoBERTa
  
  try {
    const response = await axios.post(
      'http://localhost:5000/api/text-emotion',
      { text },
      { timeout: 10000 }
    );
    
    return response.data;
  } catch (error) {
    console.error('❌ Error calling local emotion service:', error.message);
    throw error;
  }
};

/**
 * Detect emotion using BiLSTM ONNX model
 * Uses custom trained BiLSTM model for text emotion detection
 */
export const detectEmotionBiLSTM = async (text) => {
  return new Promise((resolve) => {
    try {
      const modelPath = path.resolve('./src/models/emotion_bilstm_final.onnx');
      const scriptPath = path.resolve('./src/text-service/bilstm_onnx_inference.py');
      // Model outputs 6 emotions (no 'surprise')
      const emotionLabels = 'angry,disgust,fear,happy,neutral,sad';

      console.log(`🧠 Running BiLSTM ONNX model for text emotion...`);

      const python = spawn('python', [scriptPath, modelPath, text, emotionLabels]);
      
      let output = '';
      let errorOutput = '';

      python.stdout.on('data', (data) => {
        output += data.toString();
      });

      python.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

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
            } else {
              console.warn(`⚠️  BiLSTM model error: ${result.error}`);
            }
          }
          
          // Failed - return fallback marker
          console.warn(`⚠️  BiLSTM model failed, will use fallback`);
          if (errorOutput) {
            console.warn(`   Python stderr: ${errorOutput.substring(0, 300)}`);
          }
          resolve({ 
            emotion: 'neutral', 
            confidence: 0.5, 
            scores: { neutral: 0.5 }, 
            useFallback: true,
            model: 'bilstm_onnx'
          });
        } catch (e) {
          console.warn(`⚠️  BiLSTM parsing error: ${e.message}`);
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
        error: error.message,
        model: 'bilstm_onnx'
      });
    }
  });
};

/**
 * Combine results from BiLSTM and HuggingFace models
 * Uses weighted average based on confidence scores
 */
export const combineTextEmotionResults = (bilstmResult, hfResult) => {
  console.log(`🔀 Combining BiLSTM and HuggingFace results...`);
  
  // If one model failed, use the other
  if (bilstmResult.useFallback && !hfResult.useFallback) {
    console.log(`   Using HuggingFace only (BiLSTM failed)`);
    return {
      ...hfResult,
      models_used: ['huggingface'],
      combination_strategy: 'single_model'
    };
  }
  
  if (!bilstmResult.useFallback && hfResult.useFallback) {
    console.log(`   Using BiLSTM only (HuggingFace failed)`);
    return {
      ...bilstmResult,
      models_used: ['bilstm_onnx'],
      combination_strategy: 'single_model'
    };
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
  
  // Both models succeeded - combine using weighted average
  const bilstmWeight = 0.5; // Equal weight for both models
  const hfWeight = 0.5;
  
  // Normalize emotion labels
  const emotionMap = {
    'joy': 'happy',
    'sadness': 'sad',
    'anger': 'angry',
  };
  
  const normalizeLabelBiLSTM = (label) => emotionMap[label] || label;
  const normalizeLabelHF = (label) => emotionMap[label] || label;
  
  // Get all unique emotions
  const allEmotions = new Set([
    ...Object.keys(bilstmResult.scores || {}),
    ...Object.keys(hfResult.scores || {})
  ]);
  
  // Calculate combined scores
  const combinedScores = {};
  allEmotions.forEach(emotion => {
    const bilstmScore = bilstmResult.scores[emotion] || 0;
    const hfScore = hfResult.scores[emotion] || 0;
    combinedScores[emotion] = (bilstmScore * bilstmWeight) + (hfScore * hfWeight);
  });
  
  // Find dominant emotion
  let dominantEmotion = 'neutral';
  let maxScore = 0;
  
  Object.entries(combinedScores).forEach(([emotion, score]) => {
    if (score > maxScore) {
      maxScore = score;
      dominantEmotion = emotion;
    }
  });
  
  console.log(`✅ Combined emotion: ${dominantEmotion} (${(maxScore * 100).toFixed(1)}%)`);
  console.log(`   BiLSTM: ${bilstmResult.emotion} (${(bilstmResult.confidence * 100).toFixed(1)}%)`);
  console.log(`   HuggingFace: ${hfResult.emotion} (${(hfResult.confidence * 100).toFixed(1)}%)`);
  
  return {
    emotion: dominantEmotion,
    confidence: maxScore,
    scores: combinedScores,
    models_used: ['bilstm_onnx', 'huggingface'],
    combination_strategy: 'weighted_average',
    individual_results: {
      bilstm: {
        emotion: bilstmResult.emotion,
        confidence: bilstmResult.confidence
      },
      huggingface: {
        emotion: hfResult.emotion,
        confidence: hfResult.confidence
      }
    }
  };
};

/**
 * Main function: Analyze text emotion using both BiLSTM and HuggingFace
 * This is the primary export used by routes
 */
export const analyzeTextEmotion = async (text) => {
  console.log(`📝 Analyzing text emotion with dual models...`);
  
  // Preprocess text
  const cleanedText = preprocessText(text);
  console.log(`✅ Text preprocessed: "${cleanedText}"`);
  
  // Run both models in parallel
  const [bilstmResult, hfResult] = await Promise.all([
    detectEmotionBiLSTM(cleanedText),
    detectEmotionFromText(cleanedText)
  ]);
  
  // Combine results
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
