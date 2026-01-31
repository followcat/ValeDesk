/**
 * CharterPanel - Displays session charter (goal, constraints, definition of done)
 * Similar to TodoPanel but for charter data
 */

import { useState } from "react";
import type { CharterData, CharterItem } from "../types";

interface CharterPanelProps {
  charter?: CharterData;
  charterHash?: string;
  isEditable?: boolean;
  onEditCharter?: (updates: Partial<CharterData>) => void;
}

export function CharterPanel({
  charter,
  charterHash,
  isEditable = false,
  onEditCharter
}: CharterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [editingSection, setEditingSection] = useState<string | null>(null);

  if (!charter) {
    return (
      <div className="rounded-lg border border-ink-200 bg-surface-secondary p-3">
        <div className="flex items-center gap-2 text-ink-400">
          <span className="text-lg">📋</span>
          <span className="text-sm">No charter defined for this session</span>
        </div>
      </div>
    );
  }

  const renderCharterItem = (item: CharterItem, prefix: string) => (
    <div key={item.id} className="flex items-start gap-2 py-1">
      <span className="text-ink-400 text-xs font-mono">{prefix}</span>
      <span className="text-sm text-ink-700">{item.content}</span>
    </div>
  );

  const renderSection = (
    title: string,
    icon: string,
    items: CharterItem[] | undefined,
    emptyText: string
  ) => {
    if (!items || items.length === 0) {
      return null;
    }

    return (
      <div className="mt-3">
        <div className="flex items-center gap-2 mb-1">
          <span>{icon}</span>
          <span className="text-xs font-medium text-ink-600 uppercase tracking-wide">{title}</span>
        </div>
        <div className="pl-6">
          {items.map((item, idx) => renderCharterItem(item, `${idx + 1}.`))}
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-lg border border-ink-200 bg-surface-secondary">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-surface-tertiary transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">📋</span>
          <span className="text-sm font-medium text-ink-800">Session Charter</span>
          {charterHash && (
            <span className="text-xs text-ink-400 font-mono">#{charterHash.slice(0, 8)}</span>
          )}
          {charter.version && (
            <span className="text-xs bg-accent-100 text-accent-700 px-1.5 py-0.5 rounded">
              v{charter.version}
            </span>
          )}
        </div>
        <span className={`text-ink-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-3 pb-3 border-t border-ink-100">
          {/* Goal */}
          <div className="mt-3">
            <div className="flex items-center gap-2 mb-1">
              <span>🎯</span>
              <span className="text-xs font-medium text-ink-600 uppercase tracking-wide">Goal</span>
            </div>
            <div className="pl-6 text-sm text-ink-800 font-medium">
              {charter.goal.content}
            </div>
          </div>

          {/* Non-Goals */}
          {charter.nonGoals && charter.nonGoals.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center gap-2 mb-1">
                <span>🚫</span>
                <span className="text-xs font-medium text-ink-600 uppercase tracking-wide">Non-Goals</span>
              </div>
              <div className="pl-6">
                {charter.nonGoals.map((item, idx) => (
                  <div key={item.id} className="flex items-start gap-2 py-0.5">
                    <span className="text-ink-400">•</span>
                    <span className="text-sm text-ink-600">{item.content}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Definition of Done */}
          {renderSection('Definition of Done', '✅', charter.definitionOfDone, 'No criteria defined')}

          {/* Constraints (soft) */}
          {charter.constraints && charter.constraints.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center gap-2 mb-1">
                <span>⚠️</span>
                <span className="text-xs font-medium text-ink-600 uppercase tracking-wide">Constraints</span>
                <span className="text-xs text-ink-400">(can be overridden with ADR)</span>
              </div>
              <div className="pl-6">
                {charter.constraints.map((item) => (
                  <div key={item.id} className="flex items-start gap-2 py-0.5">
                    <span className="text-yellow-500">⚡</span>
                    <span className="text-sm text-ink-600">{item.content}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invariants (hard) */}
          {charter.invariants && charter.invariants.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center gap-2 mb-1">
                <span>🔒</span>
                <span className="text-xs font-medium text-ink-600 uppercase tracking-wide">Invariants</span>
                <span className="text-xs text-red-500">(NEVER violate)</span>
              </div>
              <div className="pl-6">
                {charter.invariants.map((item) => (
                  <div key={item.id} className="flex items-start gap-2 py-0.5">
                    <span className="text-red-500">🛑</span>
                    <span className="text-sm text-ink-700 font-medium">{item.content}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Glossary */}
          {charter.glossary && Object.keys(charter.glossary).length > 0 && (
            <div className="mt-3">
              <div className="flex items-center gap-2 mb-1">
                <span>📖</span>
                <span className="text-xs font-medium text-ink-600 uppercase tracking-wide">Glossary</span>
              </div>
              <div className="pl-6">
                {Object.entries(charter.glossary).map(([term, definition]) => (
                  <div key={term} className="flex items-start gap-2 py-0.5">
                    <span className="text-sm font-medium text-ink-700">{term}:</span>
                    <span className="text-sm text-ink-600">{definition}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="mt-4 pt-3 border-t border-ink-100 flex gap-4 text-xs text-ink-400">
            {charter.createdAt && (
              <span>Created: {new Date(charter.createdAt).toLocaleDateString()}</span>
            )}
            {charter.updatedAt && charter.updatedAt !== charter.createdAt && (
              <span>Updated: {new Date(charter.updatedAt).toLocaleDateString()}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
