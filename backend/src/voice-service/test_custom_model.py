"""
Test script for custom BiLSTM emotion model
This helps diagnose issues with the model loading and prediction
"""

import sys
import os
import numpy as np

# Disable TensorFlow warnings
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

def test_model():
    try:
        print("🔧 Testing Custom BiLSTM Model")
        print("=" * 50)
        
        # Check TensorFlow
        print("\n1. Checking TensorFlow installation...")
        import tensorflow as tf
        print(f"✅ TensorFlow version: {tf.__version__}")
        
        # Check model file
        print("\n2. Checking model file...")
        model_path = "./src/models/emotion_bilstm_final.h5"
        if os.path.exists(model_path):
            print(f"✅ Model file found: {model_path}")
            file_size = os.path.getsize(model_path) / (1024 * 1024)
            print(f"   File size: {file_size:.2f} MB")
        else:
            print(f"❌ Model file not found: {model_path}")
            return
        
        # Try loading model
        print("\n3. Attempting to load model...")
        from tensorflow import keras
        from tensorflow.keras.layers import Layer
        
        class CompatibleAttention(Layer):
            """
            Custom self-attention layer that's compatible with the saved model
            This layer has only 1 weight to match the saved model
            """
            def __init__(self, use_scale=False, score_mode='dot', **kwargs):
                super(CompatibleAttention, self).__init__(**kwargs)
                self.use_scale = use_scale
                self.score_mode = score_mode
                self.supports_masking = True
            
            def build(self, input_shape):
                # Match Keras Attention layer - it only has scale weight
                if self.use_scale:
                    self.scale = self.add_weight(
                        name='scale',
                        shape=(),
                        initializer='ones',
                        trainable=True
                    )
                super(CompatibleAttention, self).build(input_shape)
            
            def call(self, inputs, mask=None):
                # Handle both single input and list of inputs
                # If single input, use self-attention (query = value = inputs)
                if isinstance(inputs, list):
                    query, value = inputs[0], inputs[1]
                else:
                    # Self-attention: use same input for query and value
                    query = value = inputs
                
                # Compute attention scores
                # query/value shape: (batch, timesteps, features)
                # We want output shape to match input: (batch, timesteps, features)
                
                # Calculate attention weights for each timestep
                # scores shape: (batch, timesteps, timesteps)
                scores = tf.matmul(query, value, transpose_b=True)
                
                # Normalize by feature dimension
                d_k = tf.cast(tf.shape(query)[-1], tf.float32)
                scores = scores / tf.sqrt(d_k)
                
                if self.use_scale:
                    scores = scores * self.scale
                
                # Apply softmax to get attention weights
                attention_weights = tf.nn.softmax(scores, axis=-1)
                
                # Apply attention weights to value
                # output shape: (batch, timesteps, features) - same as input
                output = tf.matmul(attention_weights, value)
                
                return output
            
            def compute_mask(self, inputs, mask=None):
                return None
            
            def get_config(self):
                config = super().get_config()
                config.update({
                    'use_scale': self.use_scale,
                    'score_mode': self.score_mode
                })
                return config
        
        try:
            model = keras.models.load_model(
                model_path, 
                custom_objects={'Attention': CompatibleAttention},
                compile=False
            )
            print("✅ Model loaded successfully with CompatibleAttention wrapper")
        except Exception as e:
            print(f"⚠️  Loading with custom objects failed: {e}")
            print("   Trying standard loading...")
            try:
                model = keras.models.load_model(model_path, compile=False)
                print("✅ Model loaded with standard loading")
            except Exception as e2:
                print(f"❌ Standard loading also failed: {e2}")
                return
        
        # Print model summary
        print("\n4. Model architecture:")
        model.summary()
        
        # Test with dummy data
        print("\n5. Testing with dummy data...")
        # Try both input shapes
        test_shapes = [
            (1, 40, 174),  # (batch, mfcc, time)
            (1, 174, 40),  # (batch, time, mfcc)
        ]
        
        for i, shape in enumerate(test_shapes):
            print(f"\n   Testing shape {shape}...")
            try:
                dummy_input = np.random.randn(*shape).astype(np.float32)
                
                # Try with model() call first
                try:
                    predictions = model(dummy_input, training=False).numpy()
                    print(f"   ✅ model() call succeeded with shape {shape}")
                    print(f"      Output shape: {predictions.shape}")
                    print(f"      Output sample: {predictions[0][:5]}")
                    break
                except Exception as e1:
                    print(f"   ⚠️  model() call failed: {e1}")
                    
                # Try with predict() method
                try:
                    predictions = model.predict(dummy_input, verbose=0)
                    print(f"   ✅ predict() method succeeded with shape {shape}")
                    print(f"      Output shape: {predictions.shape}")
                    print(f"      Output sample: {predictions[0][:5]}")
                    break
                except Exception as e2:
                    print(f"   ⚠️  predict() method failed: {e2}")
                    
            except Exception as e:
                print(f"   ❌ Testing failed: {e}")
        
        print("\n" + "=" * 50)
        print("✅ Model test completed")
        
    except Exception as e:
        print(f"\n❌ Test failed: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_model()
