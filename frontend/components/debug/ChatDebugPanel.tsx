// Debug Chat Component - Add this to your chat page temporarily for debugging
// This will help track the exact state transitions and identify any remaining issues

import { useChat } from '@/contexts/ChatContext';

export function ChatDebugPanel() {
  const { messages, isLoading, isTyping, currentSessionId } = useChat();

  return (
    <div className="fixed bottom-4 right-4 max-w-sm bg-black/80 text-white text-xs p-4 rounded-lg z-50">
      <h4 className="font-bold mb-2">🔧 Chat Debug Panel</h4>
      <div className="space-y-1">
        <div>Session ID: {currentSessionId || 'None'}</div>
        <div>Messages: {messages.length}</div>
        <div>Is Loading: {isLoading ? '✅' : '❌'}</div>
        <div>Is Typing: {isTyping ? '✅' : '❌'}</div>
        <div className="mt-2">
          <div>Last 3 messages:</div>
          {messages.slice(-3).map((msg, i) => (
            <div key={i} className="text-xs opacity-70">
              {msg.role}: {msg.message.slice(0, 30)}...
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}