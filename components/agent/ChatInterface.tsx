// components/agent/ChatInterface.tsx

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, ChatState } from '../../types/chat';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { v4 as uuidv4 } from 'uuid';

export function ChatInterface() {
  const [chatState, setChatState] = useState<ChatState>({
    messages: [],
    isLoading: false,
    currentInput: ''
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [chatState.messages]);

  // Initialize with welcome message
  useEffect(() => {
    const welcomeMessage: ChatMessage = {
      id: uuidv4(),
      type: 'agent',
      content: `👋 Hi! I'm your AI configuration assistant. I can help you manage your digest system through natural language.

Try saying things like:
• "Add @elonmusk to Twitter sources"
• "Switch to Gemini model to save costs"  
• "Show me current sources"
• "Generate a digest about AI news"

What would you like to do?`,
      timestamp: new Date(),
      status: 'completed',
      suggestedActions: [
        {
          label: "Add Twitter Source",
          description: "Add a Twitter account to monitor",
          command: "Add @username to Twitter sources",
          category: 'common'
        },
        {
          label: "Switch AI Model",
          description: "Change AI provider for cost or quality",
          command: "Switch to Gemini model",
          category: 'common'
        },
        {
          label: "View System Status",
          description: "Check current configuration and status",
          command: "What's the current system status?",
          category: 'common'
        }
      ]
    };

    setChatState(prev => ({
      ...prev,
      messages: [welcomeMessage]
    }));
  }, []);

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || chatState.isLoading) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: uuidv4(),
      type: 'user',
      content: message.trim(),
      timestamp: new Date(),
      status: 'sent'
    };

    setChatState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      currentInput: '',
      isLoading: true
    }));

    try {
      // Send to agent API
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() })
      });

      const result = await response.json();

      // Create agent response message
      const agentMessage: ChatMessage = {
        id: uuidv4(),
        type: 'agent',
        content: result.result ? '' : (result.message || 'I received your message.'),
        timestamp: new Date(),
        status: 'completed',
        intent: result.intent,
        previewData: result.preview,
        executionResult: result.result,
        suggestedActions: result.suggestedActions
      };

      setChatState(prev => ({
        ...prev,
        messages: [...prev.messages, agentMessage],
        isLoading: false,
        pendingAction: result.preview ? {
          messageId: agentMessage.id,
          preview: result.preview
        } : undefined
      }));

    } catch (error: any) {
      // Add error message
      const errorMessage: ChatMessage = {
        id: uuidv4(),
        type: 'system',
        content: `❌ Sorry, I encountered an error: ${error.message}. Please try again.`,
        timestamp: new Date(),
        status: 'error'
      };

      setChatState(prev => ({
        ...prev,
        messages: [...prev.messages, errorMessage],
        isLoading: false
      }));
    }
  };

  const handleConfirmAction = async (messageId: string, confirmed: boolean) => {
    if (!chatState.pendingAction || chatState.pendingAction.messageId !== messageId) {
      return;
    }

    setChatState(prev => ({ ...prev, isLoading: true }));

    try {
      if (confirmed) {
        // Execute the pending action
        const actionId = chatState.pendingAction.preview.actionId;
        if (!actionId) {
          throw new Error('Action ID not found. Please try again.');
        }

        const response = await fetch('/api/agent/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageId,
            action: 'confirm',
            actionId
          })
        });

        const result = await response.json();

        // Add execution result message
        const resultMessage: ChatMessage = {
          id: uuidv4(),
          type: 'agent',
          content: result.success ? '' : (result.message || 'Action failed.'),
          timestamp: new Date(),
          status: result.success ? 'completed' : 'error',
          executionResult: result
        };

        setChatState(prev => ({
          ...prev,
          messages: [...prev.messages, resultMessage],
          isLoading: false,
          pendingAction: undefined
        }));

      } else {
        // User cancelled the action
        const cancelMessage: ChatMessage = {
          id: uuidv4(),
          type: 'agent',
          content: '👍 No problem! The action was cancelled. What else can I help you with?',
          timestamp: new Date(),
          status: 'completed'
        };

        setChatState(prev => ({
          ...prev,
          messages: [...prev.messages, cancelMessage],
          isLoading: false,
          pendingAction: undefined
        }));
      }

    } catch (error: any) {
      const errorMessage: ChatMessage = {
        id: uuidv4(),
        type: 'system',
        content: `❌ Failed to execute action: ${error.message}`,
        timestamp: new Date(),
        status: 'error'
      };

      setChatState(prev => ({
        ...prev,
        messages: [...prev.messages, errorMessage],
        isLoading: false,
        pendingAction: undefined
      }));
    }
  };

  const handleSuggestedAction = (command: string) => {
    setChatState(prev => ({ ...prev, currentInput: command }));
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto bg-white rounded-lg shadow-lg">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center">
            <span className="text-white text-lg">🤖</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Digest Bot Assistant
            </h2>
            <p className="text-sm text-gray-600">
              Configure your system with natural language
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <div className="w-2 h-2 rounded-full bg-green-400"></div>
          <span>Online</span>
        </div>
      </div>

      {/* Messages Container */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50"
        style={{ maxHeight: 'calc(100vh - 200px)' }}
      >
        {chatState.messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onConfirmAction={handleConfirmAction}
            onSuggestedAction={handleSuggestedAction}
            isPending={chatState.pendingAction?.messageId === message.id && chatState.isLoading}
          />
        ))}
        
        {chatState.isLoading && (
          <div className="flex justify-start">
            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 text-black">
              Loading...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <div className="border-t border-gray-200 bg-white">
        <ChatInput
          value={chatState.currentInput}
          onChange={(value: string) => setChatState(prev => ({ ...prev, currentInput: value }))}
          onSend={handleSendMessage}
          disabled={chatState.isLoading}
          placeholder={
            chatState.isLoading 
              ? "Processing your request..." 
              : "Type your message... (e.g., 'Add @username to Twitter sources')"
          }
        />
      </div>
    </div>
  );
}
