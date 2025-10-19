# 🧠 Conversation Context & Memory Feature

## Overview

Your MantrAI chatbot now has **full conversation memory and context awareness**. When you chat with MantrAI, it remembers previous messages in the conversation and uses them to provide more coherent, personalized, and contextually relevant responses.

## How It Works

### 1. **Backend Context Processing** (Updated in `backend/src/llm-service/index.js`)

When you send a message, the system:
- Retrieves the **last 10 messages** from your conversation history (configurable via `CHAT_MEMORY_LENGTH`)
- Passes this history to the LLM with explicit instructions to:
  - ✅ Acknowledge topics from previous messages
  - ✅ Build on the conversation thread
  - ✅ Reference previous context when relevant
  - ✅ Maintain emotional support continuity
  - ✅ Answer questions about what was discussed before

### 2. **Enhanced Prompt Structure**

The LLM receives context with clear formatting:

```
CURRENT MESSAGE CONTEXT:
- Detected Emotion: [emotion]
- User's current message: "[message]"

════════════════════════════════════════════════════════════════
CONVERSATION HISTORY (X previous messages):
════════════════════════════════════════════════════════════════

[1] 👤 User [SADNESS]: "I'm feeling really sad today..."
[2] 🤖 Assistant: "I hear you, and I want you to know that..."
[3] 👤 User [NEUTRAL]: "One of my friends broke my heart..."
[4] 🤖 Assistant: "Oh no, that sounds incredibly painful..."

════════════════════════════════════════════════════════════════
CRITICAL INSTRUCTIONS FOR RESPONDING:
✓ Acknowledge topics/themes from previous messages when relevant
✓ Build on the conversation thread - don't treat this as the first message
✓ Reference previous context to show you're listening and remembering
✓ If the user is asking "how to forget", specifically reference their earlier messages
✓ Maintain continuity of emotional support throughout the conversation
✓ If they ask about previous conversations, give specific examples from the history above
```

### 3. **Frontend Display Enhancement**

Each AI response now shows:

- **Emotion Badge**: The detected emotion and confidence score
- **Context Badge** (🧠 Context: X): Indicates how many previous messages influenced the response
- **Toast Notification**: Alerts you when the AI is using conversation context

### 4. **Session Management**

- **New conversations** start fresh when you create a new session
- **Existing sessions** automatically load all previous messages
- **Chat history** is preserved in your Supabase database

## Example Conversation Flow

### ❌ Before (Without Context)

```
User: "Hey, I feel sad"
AI: "I'm sorry to hear you're feeling sad. Would you like to talk about it?"

User: "One of my friend broke my heart and betray me 🥲"
AI: "Oh no, that sounds incredibly painful. 
     To have a friend break your heart and betray you like that must be so hurtful."

User: "how i forget this"
AI: "I see you're trying to remember something. 
     Is there anything I can do to help you recall it?"
     
// ^ Notice: AI doesn't remember the friend betrayal context!
```

### ✅ After (With Context)

```
User: "Hey, I feel sad"
AI: "I'm sorry to hear you're feeling sad. I'm here to listen if you want to talk about it 
     or if you just need a distraction."

User: "One of my friend broke my heart and betray me 🥲"
AI: "Oh no, that sounds incredibly painful. To have a friend break your heart and betray you 
     like that must be so hurtful. I'm here for you if you need to vent or just want a 
     distraction from it all."

User: "how i forget this"
AI: "It's understandable that you want to move past this painful experience with your friend. 
     Dealing with betrayal takes time. Here are some things that might help:
     - Give yourself time and space to process these feelings
     - Focus on your other positive relationships
     - Engage in activities that bring you joy..."
     
// ^ AI now remembers the friend betrayal and gives relevant advice!
```

## Technical Details

### Configuration

**Memory Length** (Backend - `.env`):
```
CHAT_MEMORY_LENGTH=10    # Number of previous messages to include (default: 10)
```

### Database Structure

The context is retrieved from `chat_messages` table:
```sql
SELECT * FROM chat_messages 
WHERE session_id = '...' 
  AND user_id = '...' 
ORDER BY created_at DESC 
LIMIT 10
```

### API Response

Each message response includes:
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid...",
    "userMessage": {
      "id": "...",
      "message": "...",
      "emotion": "sadness",
      "confidence": 0.87
    },
    "aiResponse": {
      "id": "...",
      "message": "..."
    },
    "hasContext": true,
    "contextLength": 5  // ← Number of previous messages used
  }
}
```

## Features Enabled by Context

### 1. **Conversation Continuity**
- Follow-up questions are understood in context
- Multiple related topics flow naturally

### 2. **Emotional Journey Tracking**
- AI understands how your emotions are evolving
- Responses adapt to your emotional trajectory

### 3. **Memory References**
When you ask:
- "What did I tell you earlier?" → AI recalls specific details
- "How do I forget this?" → AI references the betrayal you mentioned
- "Is this normal?" → AI relates to your earlier shared context

### 4. **Persistent Sessions**
- Close and reopen a conversation → Previous context is still there
- Multiple conversation threads stay separate
- Your chat history is secure and private

## Troubleshooting

### Issue: "AI still doesn't remember"

**Possible causes:**
1. **New Session**: Each new chat session starts fresh
   - Solution: Continue in the same session for memory to work

2. **Too Many Messages**: Memory is limited to last 10 messages
   - Solution: Recent context takes priority; older messages fade

3. **Different Topics**: AI focuses on related topics in context
   - Solution: Mention the connection to previous topics

### Issue: Memory seems to reset

**Check:**
- ✅ Are you using the same session? (Check Session ID in chat)
- ✅ Is your internet connected? (Messages must save to database)
- ✅ Check browser console for any errors

## Future Enhancements

Potential improvements to the context system:
- 🚀 **Longer Memory**: Extend to 20-50 messages
- 🚀 **Semantic Search**: Find relevant past conversations
- 🚀 **Cross-Session Memory**: Remember across different chats
- 🚀 **Context Summarization**: Automatically summarize long conversations
- 🚀 **Memory Management**: Manual control over what to remember

## Summary

Your MantrAI is now truly conversational! It remembers your story, understands your emotions over time, and provides responses that feel genuinely connected to your journey. The more you chat, the better it understands you. 🎉

**Try it now:**
1. Start a new chat
2. Share something personal
3. Continue the conversation
4. Notice how MantrAI builds on previous messages
5. Look for the 🧠 Context badge to see memory in action

---

**Last Updated**: October 20, 2025
