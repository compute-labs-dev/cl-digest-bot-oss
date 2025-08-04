// components/agent/SuggestedActions.tsx

import React from 'react';
import { SuggestedAction } from '../../types/chat';

interface SuggestedActionsProps {
  actions: SuggestedAction[];
  onActionClick: (command: string) => void;
}

export function SuggestedActions({ actions, onActionClick }: SuggestedActionsProps) {
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'common': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'advanced': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'help': return 'bg-green-50 text-green-700 border-green-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h4 className="text-sm font-medium text-gray-900 mb-3">💡 Suggested Actions:</h4>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {actions.map((action, index) => (
          <button
            key={index}
            onClick={() => onActionClick(action.command)}
            className={`
              text-left p-3 rounded-lg border transition-colors hover:shadow-sm
              ${getCategoryColor(action.category)}
            `}
          >
            <div className="font-medium text-sm">{action.label}</div>
            <div className="text-xs opacity-75 mt-1">{action.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}