import React, { useState } from 'react';
import type { CharterData, CharterItem } from '../../agent/types';

interface CharterPanelProps {
  charter: CharterData | null | undefined;
}

export function CharterPanel({ charter }: CharterPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['goal', 'dod']));

  if (!charter) {
    return null;
  }

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const renderItems = (items: CharterItem[] | undefined) => {
    if (!items || items.length === 0) return <span className="text-gray-400 italic">None</span>;
    return (
      <ul className="list-disc list-inside space-y-1">
        {items.map(item => (
          <li key={item.id} className="text-sm text-gray-700 dark:text-gray-300">
            {item.content}
          </li>
        ))}
      </ul>
    );
  };

  const SectionHeader = ({ id, title, count }: { id: string; title: string; count?: number }) => (
    <button
      onClick={() => toggleSection(id)}
      className="w-full flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
    >
      <span className="font-medium text-sm text-gray-700 dark:text-gray-200">
        {title} {count !== undefined && <span className="text-gray-400">({count})</span>}
      </span>
      <span className="text-gray-400">{expandedSections.has(id) ? '▼' : '▶'}</span>
    </button>
  );

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-4">
      <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-100 flex items-center gap-2">
        📋 Charter
      </h3>

      <div className="space-y-2">
        {/* Goal */}
        <div>
          <SectionHeader id="goal" title="Goal" />
          {expandedSections.has('goal') && (
            <div className="mt-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {charter.goal?.content || <span className="italic text-gray-400">No goal defined</span>}
              </p>
            </div>
          )}
        </div>

        {/* Non-Goals */}
        {charter.nonGoals && charter.nonGoals.length > 0 && (
          <div>
            <SectionHeader id="nonGoals" title="Non-Goals" count={charter.nonGoals.length} />
            {expandedSections.has('nonGoals') && (
              <div className="mt-2 px-3 py-2">
                {renderItems(charter.nonGoals)}
              </div>
            )}
          </div>
        )}

        {/* Definition of Done */}
        <div>
          <SectionHeader id="dod" title="Definition of Done" count={charter.definitionOfDone?.length || 0} />
          {expandedSections.has('dod') && (
            <div className="mt-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded">
              {renderItems(charter.definitionOfDone)}
            </div>
          )}
        </div>

        {/* Constraints */}
        {charter.constraints && charter.constraints.length > 0 && (
          <div>
            <SectionHeader id="constraints" title="Constraints" count={charter.constraints.length} />
            {expandedSections.has('constraints') && (
              <div className="mt-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                {renderItems(charter.constraints)}
              </div>
            )}
          </div>
        )}

        {/* Invariants */}
        {charter.invariants && charter.invariants.length > 0 && (
          <div>
            <SectionHeader id="invariants" title="Invariants" count={charter.invariants.length} />
            {expandedSections.has('invariants') && (
              <div className="mt-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded">
                {renderItems(charter.invariants)}
              </div>
            )}
          </div>
        )}

        {/* Glossary */}
        {charter.glossary && Object.keys(charter.glossary).length > 0 && (
          <div>
            <SectionHeader id="glossary" title="Glossary" count={Object.keys(charter.glossary).length} />
            {expandedSections.has('glossary') && (
              <div className="mt-2 px-3 py-2">
                <dl className="space-y-1">
                  {Object.entries(charter.glossary).map(([term, definition]) => (
                    <div key={term} className="text-sm">
                      <dt className="font-medium text-gray-700 dark:text-gray-200 inline">{term}: </dt>
                      <dd className="text-gray-600 dark:text-gray-400 inline">{definition}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
