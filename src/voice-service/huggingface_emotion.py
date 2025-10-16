"""
HuggingFace Speech Emotion Classification
Uses prithivMLmods/Speech-Emotion-Classification model
"""

import sys
import json
import warnings
warnings.filterwarnings('ignore')

# Disable TensorFlow warnings
import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

from transformers import Wav2Vec2ForSequenceClassification, Wav2Vec2FeatureExtractor
import torch
import librosa

# Label mapping
id2label = {
    "0": "angry",
    "1": "calm",
    "2": "disgust",
    "3": "fear",
    "4": "happy",
    "5": "neutral",
    "6": "sad",
    "7": "surprise"
}

def classify_audio(model_name, audio_path):
    """
    Classify emotion from audio file using HuggingFace transformers
    """
    try:
        # Load model and processor
        print(f"Loading model: {model_name}...", file=sys.stderr)
        model = Wav2Vec2ForSequenceClassification.from_pretrained(model_name)
        processor = Wav2Vec2FeatureExtractor.from_pretrained(model_name)
        
        # Load and resample audio to 16kHz
        speech, sample_rate = librosa.load(audio_path, sr=16000)
        
        # Process audio
        inputs = processor(
            speech,
            sampling_rate=sample_rate,
            return_tensors="pt",
            padding=True
        )
        
        # Get predictions
        with torch.no_grad():
            outputs = model(**inputs)
            logits = outputs.logits
            probs = torch.nn.functional.softmax(logits, dim=1).squeeze().tolist()
        
        # Build scores dictionary
        scores = {}
        for i in range(len(probs)):
            emotion = id2label[str(i)]
            scores[emotion] = float(probs[i])
        
        # Get dominant emotion
        dominant_idx = probs.index(max(probs))
        dominant_emotion = id2label[str(dominant_idx)]
        confidence = max(probs)
        
        return {
            "success": True,
            "emotion": dominant_emotion,
            "confidence": float(confidence),
            "scores": scores,
            "model": "huggingface-prithiv"
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    try:
        # Get arguments: model_name, audio_path
        model_name = sys.argv[1]
        audio_path = sys.argv[2]
        
        # Run classification
        result = classify_audio(model_name, audio_path)
        
        # Output JSON result
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            "success": False,
            "error": str(e)
        }
        print(json.dumps(error_result))
