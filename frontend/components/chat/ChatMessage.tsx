'use client';

import { useState, useCallback, memo } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bot, User, Copy, Edit3, Check, X, Volume2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ChatMessageProps {
  id: string;
  message: string;
  role: 'user' | 'assistant';
  timestamp?: string;
  emotion?: string;
  confidence?: number;
  isLoading?: boolean;
  hasContext?: boolean;
  contextLength?: number;
  detectedLanguage?: string;
  languageName?: string;
  wasTranslated?: boolean;
  translationMethod?: string;
  transcript?: string; // Voice message transcript (internal use only)
  voiceMetadata?: {
    transcript: string;
    confidence: number;
    language: string;
    languageName: string;
    provider?: string;
  };
  onEdit?: (id: string, newMessage: string) => void;
  editable?: boolean;
}

export const ChatMessage = memo(function ChatMessage({ 
  id,
  message, 
  role, 
  timestamp, 
  emotion, 
  confidence,
  isLoading = false,
  hasContext = false,
  contextLength = 0,
  languageName,
  wasTranslated = false,
  onEdit,
  editable = false
}: ChatMessageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(message);
  const isUser = role === 'user';

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast({
        title: "Copied to clipboard",
        description: "Message copied successfully",
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Could not copy message",
        variant: "destructive",
      });
    }
  }, [message]);

  const handleSpeak = useCallback(() => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.rate = 0.8;
      utterance.pitch = 1;
      speechSynthesis.speak(utterance);
    }
  }, [message]);

  const handleEdit = useCallback(() => {
    setIsEditing(true);
    setEditValue(message);
  }, [message]);

  const handleSaveEdit = useCallback(() => {
    if (editValue.trim() !== message && onEdit) {
      onEdit(id, editValue.trim());
    }
    setIsEditing(false);
  }, [editValue, message, onEdit, id]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditValue(message);
  }, [message]);

  // Loading dots animation component
  const LoadingDots = () => (
    <div className="flex items-center space-x-1 py-2">
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
      <span className="text-sm ml-2 animate-pulse">Thinking...</span>
    </div>
  );

  return (
    <div className={cn(
      "group relative flex gap-4 px-4 py-6 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors duration-200",
      "max-w-none w-full"
    )}>
      {/* Avatar */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden">
        {isUser ? (
          <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <User className="h-5 w-5 text-white" />
          </div>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <Bot className="h-5 w-5 text-white" />
          </div>
        )}
      </div>

      {/* Message Content */}
      <div className="flex-1 min-w-0">
        {/* Role Label */}
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">
            {isUser ? 'You' : 'MantrAI'}
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {!isUser && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="h-8 w-8 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                  title="Copy message"
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSpeak}
                  className="h-8 w-8 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                  title="Read aloud"
                >
                  <Volume2 className="h-3 w-3" />
                </Button>
              </>
            )}
            
            {isUser && editable && onEdit && (
              <>
                {isEditing ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSaveEdit}
                      className="h-8 w-8 p-0 hover:bg-green-100 dark:hover:bg-green-900"
                      title="Save edit"
                    >
                      <Check className="h-3 w-3 text-green-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelEdit}
                      className="h-8 w-8 p-0 hover:bg-red-100 dark:hover:bg-red-900"
                      title="Cancel edit"
                    >
                      <X className="h-3 w-3 text-red-600" />
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleEdit}
                    className="h-8 w-8 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                    title="Edit message"
                  >
                    <Edit3 className="h-3 w-3" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Message Text */}
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {isLoading ? (
            <LoadingDots />
          ) : isEditing ? (
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full min-h-[80px] p-3 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.metaKey) {
                  handleSaveEdit();
                } else if (e.key === 'Escape') {
                  handleCancelEdit();
                }
              }}
            />
          ) : (
            <div className="text-gray-900 dark:text-gray-100 leading-relaxed whitespace-pre-wrap break-words">
              {message}
            </div>
          )}
        </div>

        {/* Metadata */}
        {(emotion || hasContext || wasTranslated) && !isLoading && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {emotion && confidence && (
              <Badge variant="secondary" className="text-xs">
                {emotion} ({Math.round(confidence * 100)}%)
              </Badge>
            )}
            
            {hasContext && contextLength > 0 && (
              <Badge variant="outline" className="text-xs">
                Context: {contextLength} message{contextLength > 1 ? 's' : ''}
              </Badge>
            )}
            
            {wasTranslated && languageName && (
              <Badge variant="outline" className="text-xs">
                Translated from {languageName}
              </Badge>
            )}
          </div>
        )}

        {/* Timestamp */}
        {timestamp && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {new Date(timestamp).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </div>
        )}
      </div>
    </div>
  );
});

ChatMessage.displayName = 'ChatMessage';