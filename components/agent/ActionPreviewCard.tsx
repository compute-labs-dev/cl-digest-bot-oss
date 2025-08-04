// components/agent/ActionPreviewCard.tsx

import React from 'react';
import { ActionPreview } from '../../types/chat';

interface ActionPreviewCardProps {
  preview: ActionPreview;
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean;
}

export function ActionPreviewCard({ 
  preview, 
  onConfirm, 
  onCancel, 
  isPending 
}: ActionPreviewCardProps) {
  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-black bg-gray-50 border-gray-200';
    }
  };

  const getChangeIcon = (type: string) => {
    switch (type) {
      case 'add': return '➕';
      case 'remove': return '➖';
      case 'modify': return '✏️';
      default: return '🔄';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'twitter': return '🐦';
      case 'rss': return '📰';
      case 'telegram': return '💬';
      case 'ai_model': return '🧠';
      case 'settings': return '⚙️';
      default: return '📋';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-blue-600">🔍</span>
            <h3 className="font-medium text-blue-900">{preview.title}</h3>
          </div>
          
          <div className={`
            px-2 py-1 rounded-full text-xs font-medium border
            ${getImpactColor(preview.estimatedImpact)}
          `}>
            {preview.estimatedImpact.toUpperCase()} IMPACT
          </div>
        </div>
        
        {preview.description && (
          <p className="text-sm text-blue-700 mt-1">{preview.description}</p>
        )}
      </div>

      {/* Changes List */}
      <div className="px-4 py-3">
        <h4 className="text-sm font-medium text-black mb-3">
          Planned Changes ({preview.changes.length}):
        </h4>
        
        <div className="space-y-2">
          {preview.changes.map((change, index) => (
            <div 
              key={index}
              className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex-shrink-0 flex items-center space-x-1">
                <span>{getChangeIcon(change.type)}</span>
                <span>{getCategoryIcon(change.category)}</span>
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-black">
                  {change.description}
                </p>
                
                {/* Before/After Details */}
                {(change.details.before || change.details.after) && (
                  <div className="mt-1 text-xs text-black">
                    {change.details.before && (
                      <div>Before: <code className="bg-gray-200 px-1 rounded">{change.details.before}</code></div>
                    )}
                    {change.details.after && (
                      <div>After: <code className="bg-green-100 px-1 rounded">{change.details.after}</code></div>
                    )}
                    {change.details.value && (
                      <div>Value: <code className="bg-blue-100 px-1 rounded">{change.details.value}</code></div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Warnings */}
      {preview.warnings && preview.warnings.length > 0 && (
        <div className="px-4 py-3 bg-yellow-50 border-t border-yellow-100">
          <h5 className="text-sm font-medium text-yellow-800 mb-2">⚠️ Warnings:</h5>
          <ul className="text-sm text-yellow-700 space-y-1">
            {preview.warnings.map((warning, index) => (
              <li key={index} className="flex items-start space-x-2">
                <span className="text-yellow-500">•</span>
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Buttons */}
      {preview.requiresConfirmation && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium text-black bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            Cancel
          </button>
          
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 flex items-center space-x-2"
          >
            {isPending ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                <span>Applying...</span>
              </>
            ) : (
              <>
                <span>✓</span>
                <span>Apply Changes</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}