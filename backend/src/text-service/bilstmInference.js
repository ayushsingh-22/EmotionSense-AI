
import path from 'path';
import { fileURLToPath } from 'url';
import onnx from 'onnxruntime-node';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Model configuration
const MODEL_PATH = path.resolve(__dirname, '../models/emotion_bilstm_final.onnx');
const MAX_LENGTH = 80;
const EMOTION_LABELS = ['angry', 'disgust', 'fear', 'happy', 'neutral', 'sad'];

// Vocabulary from Python script
const COMMON_WORDS = [
    // Padding and unknown
    '<PAD>', '<UNK>',
    // Common words
    'i', 'you', 'he', 'she', 'it', 'we', 'they',
    'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'must',
    'can', 'cannot', 'cant',
    'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then',
    'not', 'no', 'yes',
    // Emotion-related words
    'happy', 'sad', 'angry', 'fear', 'scared', 'afraid',
    'joy', 'joyful', 'excited', 'excited', // Duplicated in original script
    'upset', 'frustrated', 'annoyed', 'mad',
    'love', 'hate', 'like', 'dislike',
    'good', 'bad', 'great', 'terrible', 'awful',
    'feel', 'feeling', 'felt',
    'very', 'really', 'so', 'too', 'much',
    'sorry', 'please', 'thank', 'thanks',
    'help', 'need', 'want', 'wish',
    'think', 'thought', 'know', 'believe',
    'see', 'look', 'hear', 'listen',
    'go', 'come', 'get', 'make', 'take',
    'day', 'time', 'way', 'people', 'thing',
    'work', 'life', 'world', 'home', 'friend',
    'tell', 'say', 'said', 'ask', 'asked',
    'just', 'now', 'today', 'never', 'always',
    'about', 'after', 'before', 'because', 'when', 'where',
    'what', 'why', 'how', 'who', 'which'
];

// Build vocabulary map
const buildVocab = () => {
    const wordIndex = {};
    COMMON_WORDS.forEach((word, idx) => {
        // Python uses 1-based indexing for words in the list
        // And later overwrites if duplicates exist
        wordIndex[word] = idx + 1;
    });
    
    // Explicitly set special tokens as per Python script
    wordIndex['<PAD>'] = 0;
    wordIndex['<UNK>'] = 1;
    
    return wordIndex;
};

const wordIndex = buildVocab();

// Preprocessing
const preprocessText = (text) => {
    // Convert to lowercase
    let cleaned = text.toLowerCase();
    // Remove special characters and numbers (keep a-z and whitespace)
    cleaned = cleaned.replace(/[^a-z\s]/g, '');
    // Remove extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
};

// Tokenization
const tokenize = (text) => {
    const cleaned = preprocessText(text);
    const words = cleaned.split(' ');
    const sequence = [];
    
    for (let i = 0; i < Math.min(words.length, MAX_LENGTH); i++) {
        const word = words[i];
        const idx = wordIndex[word] !== undefined ? wordIndex[word] : wordIndex['<UNK>'];
        sequence.push(idx);
    }
    
    // Pad sequence
    while (sequence.length < MAX_LENGTH) {
        sequence.push(0); // <PAD>
    }
    
    // Return Int32Array for ONNX
    return new Int32Array(sequence);
};

// Global session variable
let session = null;

const loadModel = async () => {
    if (!session) {
        try {
            session = await onnx.InferenceSession.create(MODEL_PATH);
            console.log('✅ BiLSTM ONNX model loaded successfully');
        } catch (error) {
            console.error('❌ Failed to load BiLSTM ONNX model:', error);
            throw error;
        }
    }
    return session;
};

export const runBiLSTMInference = async (text) => {
    try {
        if (!text || !text.trim()) {
            throw new Error('Empty text provided');
        }

        const sess = await loadModel();
        
        // Tokenize
        const inputSequence = tokenize(text);

        
        // Create tensor
        // Shape: [1, MAX_LENGTH]
        const tensor = new onnx.Tensor('int32', inputSequence, [1, MAX_LENGTH]);
        
        // Get input name
        const inputName = sess.inputNames[0];
        
        // Run inference
        const feeds = {};
        feeds[inputName] = tensor;
        
        const results = await sess.run(feeds);
        
        // Get output
        const outputName = sess.outputNames[0];
        const outputTensor = results[outputName];
        const predictions = outputTensor.data; // Float32Array
        
        // Validate output size
        if (predictions.length !== EMOTION_LABELS.length) {
            throw new Error(`Model output size (${predictions.length}) doesn't match emotion labels count (${EMOTION_LABELS.length})`);
        }
        
        // Find max
        let maxIdx = 0;
        let maxScore = predictions[0];
        const scores = {};
        
        for (let i = 0; i < predictions.length; i++) {
            const score = predictions[i];
            scores[EMOTION_LABELS[i]] = score;
            if (score > maxScore) {
                maxScore = score;
                maxIdx = i;
            }
        }
        
        return {
            emotion: EMOTION_LABELS[maxIdx],
            confidence: maxScore,
            scores: scores,
            model: 'bilstm_onnx',
            text_length: text.length,
            tokens_used: inputSequence.filter(x => x !== 0).length
        };
        
    } catch (error) {
        console.error('❌ BiLSTM Inference Error:', error);
        return {
            emotion: 'neutral',
            confidence: 0.5,
            scores: { neutral: 0.5 },
            useFallback: true,
            error: error.message,
            model: 'bilstm_onnx'
        };
    }
};
