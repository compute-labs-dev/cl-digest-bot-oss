// components/agent/MessageBubble.tsx

import React from 'react';
import { ChatMessage } from '../../types/chat';
import { ActionPreviewCard } from './ActionPreviewCard';
import { SuggestedActions } from './SuggestedActions';

interface MessageBubbleProps {
  message: ChatMessage;
  onConfirmAction: (messageId: string, confirmed: boolean) => void;
  onSuggestedAction: (command: string) => void;
  isPending?: boolean;
}

export function MessageBubble({ 
  message, 
  onConfirmAction, 
  onSuggestedAction, 
  isPending 
}: MessageBubbleProps) {
  const isUser = message.type === 'user';
  const isSystem = message.type === 'system';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] ${isUser ? 'order-2' : 'order-1'}`}>
        
        {/* Message Bubble - only render if there's content */}
        {message.content && (
          <div
            className={`
              rounded-lg p-4 shadow-sm border
              ${isUser 
                ? 'bg-blue-600 text-white border-blue-600' 
                : isSystem
                  ? 'bg-red-50 text-red-800 border-red-200'
                  : 'bg-white text-black border-gray-200'
              }
            `}
          >
            {/* Message Content */}
            <div className="whitespace-pre-wrap break-words">
              {message.content}
            </div>

            {/* Message Status */}
            {message.status && (
              <div className={`
                flex items-center justify-end mt-2 text-xs
                ${isUser ? 'text-blue-100' : 'text-black'}
              `}>
                {message.status === 'sending' && (
                  <>
                    <div className="animate-spin w-3 h-3 border border-current border-t-transparent rounded-full mr-1" />
                    Sending...
                  </>
                )}
                {message.status === 'processing' && (
                  <>
                    <div className="animate-pulse w-3 h-3 bg-current rounded-full mr-1" />
                    Processing...
                  </>
                )}
                {message.status === 'completed' && '✓'}
                {message.status === 'error' && '⚠️'}
              </div>
            )}
          </div>
        )}

        {/* Action Preview (if present) */}
        {message.previewData && !isUser && (
          <div className="mt-3">
            <ActionPreviewCard
              preview={message.previewData}
              onConfirm={() => onConfirmAction(message.id, true)}
              onCancel={() => onConfirmAction(message.id, false)}
              isPending={isPending}
            />
          </div>
        )}

        {/* Execution Result (if present) */}
        {message.executionResult && !isUser && (
          <div className={message.content ? "mt-3" : ""}>
            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 text-black text-pretty whitespace-pre-wrap break-words">
              {message.executionResult.message}
            </div>
          </div>
        )}

        {/* Suggested Actions (if present) */}
        {message.suggestedActions && message.suggestedActions.length > 0 && !isUser && (
          <div className={message.content || message.executionResult ? "mt-3" : ""}>
            <SuggestedActions
              actions={message.suggestedActions}
              onActionClick={onSuggestedAction}
            />
          </div>
        )}

        {/* Timestamp */}
        <div className={`
          text-xs mt-2 
          ${isUser ? 'text-right text-black' : 'text-left text-black'}
        `}>
          {message.timestamp.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </div>
      </div>

      {/* Avatar */}
      <div className={`
        flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm
        ${isUser 
          ? 'bg-blue-600 text-white ml-3 order-1' 
          : 'bg-gray-200 text-black mr-3 order-2'
        }
      `}>
        {isUser ? '👤' : isSystem ? '⚠️' : '🤖'}
      </div>
    </div>
  );
}