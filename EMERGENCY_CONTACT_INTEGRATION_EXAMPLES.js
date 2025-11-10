// Integration Code Examples
// Add these snippets to integrate emergency contact system with emotion detection

// ============================================================
// 1. BACKEND INTEGRATION - In Chat Message Handler
// ============================================================
// File: backend/src/routes/chatRoutes.js or emotion detection handler
// Add this code to trigger alerts when high-risk emotions detected

import { triggerEmergencyAlert } from '../utils/emergencyAlertTrigger.js';

async function handleChatMessage(userId, userMessage, req, res) {
  try {
    // ... existing emotion detection logic ...
    
    // Example emotion detection result
    const emotionResult = {
      emotion: 'sad',          // detected emotion
      confidence: 0.85,         // confidence score (0-1)
      sentiment: 'negative'
    };
    
    // Check if this emotion warrants an alert
    const alertResult = await triggerEmergencyAlert(
      userId,
      emotionResult.emotion,
      emotionResult.confidence,
      userMessage  // message content as context
    );
    
    if (alertResult.success) {
      console.log('✅ Emergency alert sent:', {
        contactName: alertResult.contact_name,
        email: alertResult.contact_email
      });
    }
    
    // Send normal response to user
    res.json({
      success: true,
      message: aiResponse,
      emotion: emotionResult.emotion,
      alertSent: alertResult.success
    });
    
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
}

// ============================================================
// 2. FRONTEND INTEGRATION - Chat Page Emergency Modal
// ============================================================
// File: frontend/app/chat/page.tsx
// Add this code to show emergency contact modal on first visit

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useEmergencyContact } from '@/hooks/useEmergencyContact';
import { EmergencyContactModal } from '@/components/EmergencyContactModal';

export default function ChatPage() {
  const { user } = useAuth();
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const { contact, fetchContact, loading: contactLoading } = useEmergencyContact();

  // Check for emergency contact on component mount
  useEffect(() => {
    if (user?.id && !contact && !contactLoading) {
      fetchContact().then((existingContact) => {
        if (!existingContact) {
          // No emergency contact found - show modal after 2 seconds
          setTimeout(() => setShowEmergencyModal(true), 2000);
        }
      });
    }
  }, [user?.id, contact, contactLoading, fetchContact]);

  return (
    <>
      {/* ... existing chat UI ... */}
      
      {/* Emergency Contact Modal */}
      <EmergencyContactModal
        isOpen={showEmergencyModal}
        onClose={() => setShowEmergencyModal(false)}
        onSuccess={() => {
          setShowEmergencyModal(false);
          fetchContact();
        }}
        mode="create"
      />
    </>
  );
}

// ============================================================
// 3. FRONTEND INTEGRATION - Profile Page
// ============================================================
// File: frontend/app/profile/page.tsx
// Add the EmergencyContactSection component

import { EmergencyContactSection } from '@/components/EmergencyContactSection';

export default function ProfilePage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* ... existing profile sections ... */}
      
      {/* Emergency Contact Section */}
      <EmergencyContactSection />
    </div>
  );
}

// ============================================================
// 4. HIGH-RISK EMOTION CONFIGURATION
// ============================================================
// File: backend/src/utils/emotionThresholds.js
// Configure which emotions trigger alerts and their thresholds

export const EMOTION_ALERT_CONFIG = {
  // High-risk emotions that always trigger alerts above threshold
  highRisk: {
    sad: { threshold: 0.70, level: 'high' },
    angry: { threshold: 0.75, level: 'high' },
    fear: { threshold: 0.70, level: 'high' },
    distressed: { threshold: 0.65, level: 'critical' },
    depressed: { threshold: 0.75, level: 'high' },
    anxious: { threshold: 0.70, level: 'high' },
  },

  // Medium-risk emotions (optional alerts based on context)
  mediumRisk: {
    frustrated: { threshold: 0.80, level: 'medium' },
    guilty: { threshold: 0.75, level: 'medium' },
    ashamed: { threshold: 0.75, level: 'medium' },
  }
};

/**
 * Check if emotion should trigger alert
 * @param {string} emotion - Detected emotion
 * @param {number} confidence - Confidence score
 * @returns {Object} - { shouldAlert: boolean, level: string }
 */
export function evaluateEmotionRisk(emotion, confidence) {
  const normalized = emotion.toLowerCase().trim();
  
  const config = EMOTION_ALERT_CONFIG.highRisk[normalized] || 
                 EMOTION_ALERT_CONFIG.mediumRisk[normalized];
  
  if (!config) {
    return { shouldAlert: false, level: null };
  }
  
  return {
    shouldAlert: confidence >= config.threshold,
    level: config.level,
    threshold: config.threshold
  };
}

// ============================================================
// 5. BACKEND INTEGRATION - AUTO-ALERT IN EMOTION ENDPOINT
// ============================================================
// File: backend/src/routes/textRoutes.js or emotion detection route

import { triggerEmergencyAlert } from '../utils/emergencyAlertTrigger.js';
import { evaluateEmotionRisk } from '../utils/emotionThresholds.js';

router.post('/analyze-emotion', async (req, res) => {
  try {
    const { userId, text } = req.body;

    // ... existing emotion detection logic ...
    const emotionResult = await detectEmotion(text);
    
    // Extract top emotion and confidence
    const topEmotion = Object.entries(emotionResult.scores)
      .sort(([, a], [, b]) => b - a)[0];
    
    const [emotion, confidence] = topEmotion;

    // Evaluate if alert should be sent
    const riskAssessment = evaluateEmotionRisk(emotion, confidence);
    
    if (riskAssessment.shouldAlert) {
      // Trigger emergency alert
      const alertResult = await triggerEmergencyAlert(
        userId,
        emotion,
        confidence,
        text.substring(0, 300)  // Message context
      );
      
      if (alertResult.success) {
        console.log(`⚠️ Alert sent for ${riskAssessment.level} emotion: ${emotion}`);
      }
    }

    res.json({
      success: true,
      emotion,
      confidence,
      allScores: emotionResult.scores,
      riskLevel: riskAssessment.level,
      alertTriggered: riskAssessment.shouldAlert
    });

  } catch (error) {
    console.error('Error analyzing emotion:', error);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

// ============================================================
// 6. FRONTEND INTEGRATION - POST-RESPONSE ALERT INDICATOR
// ============================================================
// File: frontend/components/chat/ChatMessage.tsx or response component
// Show indicator when alert was sent

import { AlertTriangle } from 'lucide-react';

interface ChatMessageProps {
  message: {
    emotion?: string;
    alertSent?: boolean;
    riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  }
}

export function ChatMessage({ message }: ChatMessageProps) {
  return (
    <div className="chat-message">
      {/* ... existing message content ... */}
      
      {/* Show alert indicator if emergency alert was sent */}
      {message.alertSent && (
        <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <span className="text-xs text-red-700 dark:text-red-300">
            🚨 Emergency contact has been notified
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 7. ERROR HANDLING & LOGGING
// ============================================================

// Add detailed logging to track alerts
function logEmergencyAlert(userId, contactId, emotion, success) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    userId,
    contactId,
    emotion,
    status: success ? 'sent' : 'failed',
    details: {
      // Add any relevant details
    }
  };
  
  // Log to file or external service
  console.log('📊 Emergency Alert Log:', logEntry);
}

// ============================================================
// 8. TESTING UTILITY
// ============================================================
// File: backend/test-emergency-alert.js
// Test the emergency alert system

import { triggerEmergencyAlert } from './src/utils/emergencyAlertTrigger.js';

async function testEmergencyAlert() {
  const testUserId = 'your_test_user_id';
  const testEmotion = 'sad';
  const testConfidence = 0.85;
  
  console.log('🧪 Testing Emergency Alert System...');
  
  const result = await triggerEmergencyAlert(
    testUserId,
    testEmotion,
    testConfidence,
    'This is a test message to trigger emergency alert'
  );
  
  if (result.success) {
    console.log('✅ Test passed! Alert was sent to:', result.contact_email);
  } else {
    console.log('❌ Test failed:', result.error || result.reason);
  }
}

// Run test
testEmergencyAlert().catch(console.error);

// ============================================================
// 9. MONITORING & ANALYTICS
// ============================================================
// Track alert patterns and statistics

export async function getAlertStatistics(userId, days = 30) {
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - days);

  const { data: alerts, error } = await supabase
    .from('emergency_alerts_log')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', dateFrom.toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching alert stats:', error);
    return null;
  }

  // Calculate statistics
  const stats = {
    total_alerts: alerts.length,
    alerts_per_day: (alerts.length / days).toFixed(2),
    common_emotion: getMostCommon(alerts, 'emotion_detected'),
    avg_confidence: (
      alerts.reduce((sum, a) => sum + (a.confidence || 1.0), 0) / alerts.length
    ).toFixed(2),
    alert_timeline: alerts.map(a => ({
      date: new Date(a.sent_at).toLocaleDateString(),
      emotion: a.emotion_detected,
      confidence: a.confidence
    }))
  };

  return stats;
}

function getMostCommon(array, key) {
  const counts = {};
  array.forEach(item => {
    counts[item[key]] = (counts[item[key]] || 0) + 1;
  });
  return Object.keys(counts).reduce((a, b) => 
    counts[a] > counts[b] ? a : b
  );
}
