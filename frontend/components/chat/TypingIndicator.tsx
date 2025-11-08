'use client';

import { memo } from 'react';
import { Bot } from 'lucide-react';

export const TypingIndicator = memo(function TypingIndicator() {
  return (
    <div className="group relative flex gap-4 px-4 py-6 animate-fade-in">
      {/* Avatar */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden">
        <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
          <Bot className="h-5 w-5 text-white" />
        </div>
      </div>

      {/* Typing Content */}
      <div className="flex-1 min-w-0">
        {/* Role Label */}
        <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-2">
          MantrAI
        </div>

        {/* Typing Animation */}
        <div className="flex items-center space-x-1 py-2">
          <div className="flex space-x-1">
            <div 
              className="w-2 h-2 bg-gray-600 dark:bg-gray-400 rounded-full animate-bounce" 
              style={{ animationDelay: '0ms', animationDuration: '1.4s' }}
            />
            <div 
              className="w-2 h-2 bg-gray-600 dark:bg-gray-400 rounded-full animate-bounce" 
              style={{ animationDelay: '200ms', animationDuration: '1.4s' }}
            />
            <div 
              className="w-2 h-2 bg-gray-600 dark:bg-gray-400 rounded-full animate-bounce" 
              style={{ animationDelay: '400ms', animationDuration: '1.4s' }}
            />
          </div>
          <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">
            Thinking...
          </span>
        </div>
      </div>
    </div>
  );
});

TypingIndicator.displayName = 'TypingIndicator';