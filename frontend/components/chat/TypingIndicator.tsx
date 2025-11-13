'use client';

import { memo } from 'react';
import { Bot } from 'lucide-react';

export const TypingIndicator = memo(function TypingIndicator() {
  return (
    <div className="flex gap-3 px-4 py-4 animate-fade-in">
      {/* Avatar */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden flex items-center justify-center">
        <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
          <Bot className="h-4 w-4 text-white" />
        </div>
      </div>

      {/* Typing Indicator */}
      <div className="flex flex-col gap-1">
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <div 
              className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce" 
              style={{ animationDelay: '0ms', animationDuration: '1.4s' }}
            />
            <div 
              className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce" 
              style={{ animationDelay: '200ms', animationDuration: '1.4s' }}
            />
            <div 
              className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce" 
              style={{ animationDelay: '400ms', animationDuration: '1.4s' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

TypingIndicator.displayName = 'TypingIndicator';