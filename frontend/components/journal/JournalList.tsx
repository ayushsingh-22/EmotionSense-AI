/**
 * Journal List Component
 * Displays a list of journal entries
 */

import React from 'react';
import { JournalEntry } from '@/lib/api';
import { JournalCard } from './JournalCard';
import { BookOpen } from 'lucide-react';

interface JournalListProps {
  journals: JournalEntry[];
  onSelectJournal?: (journal: JournalEntry) => void;
  loading?: boolean;
}

export function JournalList({ journals, onSelectJournal, loading }: JournalListProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-64 bg-muted/20 rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (journals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <BookOpen className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No journals yet</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Your daily journals will appear here once you start using the app.
          Journals are automatically generated each evening based on your emotional experiences.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {journals.map((journal) => (
        <JournalCard
          key={journal.id}
          journal={journal}
          onClick={() => onSelectJournal?.(journal)}
        />
      ))}
    </div>
  );
}
