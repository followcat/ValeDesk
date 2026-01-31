import React, { useState } from 'react';
import type { ADRItem } from '../../agent/types';

interface ADRPanelProps {
  adrs: ADRItem[] | null | undefined;
}

const statusColors: Record<string, string> = {
  proposed: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  accepted: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  deprecated: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  superseded: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

const typeIcons: Record<string, string> = {
  architectural: '🏗️',
  technical: '⚙️',
  process: '📋',
  'charter-change': '📝',
  'constraint-override': '⚠️',
  'user-override': '👤',
};

export function ADRPanel({ adrs }: ADRPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!adrs || adrs.length === 0) {
    return null;
  }

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-4">
      <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-100 flex items-center gap-2">
        📜 ADR <span className="text-sm font-normal text-gray-400">({adrs.length})</span>
      </h3>

      <div className="space-y-2">
        {adrs.map(adr => (
          <div key={adr.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            {/* Header */}
            <button
              onClick={() => toggleExpand(adr.id)}
              className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span title={adr.type}>{typeIcons[adr.type] || '📄'}</span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                  {adr.title}
                </span>
              </div>
              <div className="flex items-center gap-2 ml-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[adr.status] || statusColors.proposed}`}>
                  {adr.status}
                </span>
                <span className="text-gray-400">{expandedId === adr.id ? '▼' : '▶'}</span>
              </div>
            </button>

            {/* Expanded content */}
            {expandedId === adr.id && (
              <div className="px-3 pb-3 border-t border-gray-100 dark:border-gray-800">
                <div className="mt-2 space-y-2 text-sm">
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>ID: {adr.id}</span>
                    <span>Type: {adr.type}</span>
                    <span>Created: {formatDate(adr.createdAt)}</span>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-600 dark:text-gray-300">Context</h4>
                    <p className="text-gray-700 dark:text-gray-400 mt-1">{adr.context}</p>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-600 dark:text-gray-300">Decision</h4>
                    <p className="text-gray-700 dark:text-gray-400 mt-1">{adr.decision}</p>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-600 dark:text-gray-300">Consequences</h4>
                    <p className="text-gray-700 dark:text-gray-400 mt-1">{adr.consequences}</p>
                  </div>

                  {adr.alternatives && (
                    <div>
                      <h4 className="font-medium text-gray-600 dark:text-gray-300">Alternatives</h4>
                      <p className="text-gray-700 dark:text-gray-400 mt-1">{adr.alternatives}</p>
                    </div>
                  )}

                  {adr.charterHashBefore && (
                    <div className="text-xs text-gray-500 mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <div>Charter hash before: <code>{adr.charterHashBefore}</code></div>
                      <div>Charter hash after: <code>{adr.charterHashAfter}</code></div>
                    </div>
                  )}

                  {adr.supersedes && (
                    <div className="text-xs text-purple-600 dark:text-purple-400">
                      Supersedes: {adr.supersedes}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
