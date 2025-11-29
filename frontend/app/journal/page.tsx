'use client';

/**
 * Journal Page
 * Displays daily journal entries with list and detail views
 */

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getJournalList, getJournalToday, generateJournal, getJournalByDate, refreshTodayJournal, JournalEntry } from '@/lib/api';
import { JournalList } from '@/components/journal/JournalList';
import { JournalDetail } from '@/components/journal/JournalDetail';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BookOpen, Plus, RefreshCw, Sparkles, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function JournalPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [selectedJournal, setSelectedJournal] = useState<JournalEntry | null>(null);
  const [todayJournal, setTodayJournal] = useState<JournalEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [resolvingDate, setResolvingDate] = useState(false);

  const loadJournals = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const data = await getJournalList(user.id, 30);
      setJournals(data);
    } catch (error) {
      console.error('Error loading journals:', error);
      toast({
        title: 'Error',
        description: 'Failed to load journals',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTodayJournal = async () => {
    if (!user) return;

    try {
      const data = await getJournalToday(user.id);
      setTodayJournal(data);
    } catch (error) {
      console.error('Error loading today\'s journal:', error);
    }
  };

  useEffect(() => {
    if (user) {
      loadJournals();
      loadTodayJournal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const targetDate = searchParams?.get('date');

    if (!targetDate) {
      if (selectedJournal) {
        setSelectedJournal(null);
      }
      return;
    }

    const existing = journals.find((entry) => entry.date === targetDate);
    if (existing) {
      if (!selectedJournal || selectedJournal.id !== existing.id) {
        setSelectedJournal(existing);
      }
      return;
    }

    if (resolvingDate) {
      return;
    }

    setResolvingDate(true);
    getJournalByDate(user.id, targetDate)
      .then((entry) => {
        if (entry) {
          setSelectedJournal(entry);
        } else {
          // Journal doesn't exist for this date
          // Don't redirect, we'll show the "Create Journal" view
          setSelectedJournal(null);
        }
      })
      .catch((error) => {
        console.error('Error resolving journal by date:', error);
        toast({
          title: 'Error',
          description: 'Could not load the selected journal entry.',
          variant: 'destructive',
        });
        // Only redirect on actual error
        router.replace('/journal');
      })
      .finally(() => setResolvingDate(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, journals, user]);

  const handleSelectFromList = (journal: JournalEntry) => {
    setSelectedJournal(journal);
    router.push(`/journal?date=${journal.date}`);
  };

  const handleBack = () => {
    setSelectedJournal(null);
    router.replace('/journal');
  };

  const handleGenerateJournal = async (force: boolean = false) => {
    if (!user) return;

    try {
      setGenerating(true);
      
      if (force) {
        // Use refresh endpoint for force regeneration
        toast({
          title: 'Refreshing Journal',
          description: 'Recalculating from today\'s chat messages...',
        });

        const journal = await refreshTodayJournal(user.id);
        
        if (journal) {
          setTodayJournal(journal);
          // Update journals list: remove old entry for today if exists, add new one
          setJournals(prev => [journal, ...prev.filter(j => j.date !== journal.date)]);
          setSelectedJournal(journal);
          router.replace(`/journal?date=${journal.date}`);
          
          toast({
            title: 'Success',
            description: 'Journal refreshed successfully with latest chat data!',
          });
        }
      } else {
        // Normal generation
        toast({
          title: 'Generating Journal',
          description: 'Creating your daily journal entry...',
        });

        const journal = await generateJournal(user.id);
        
        if (journal) {
          setTodayJournal(journal);
          // Update journals list: remove old entry for today if exists, add new one
          setJournals(prev => [journal, ...prev.filter(j => j.date !== journal.date)]);
          setSelectedJournal(journal);
          router.replace(`/journal?date=${journal.date}`);
          
          toast({
            title: 'Success',
            description: 'Journal generated successfully!',
          });
        } else {
          toast({
            title: 'No Data',
            description: 'Not enough emotional data to generate a journal for today.',
            variant: 'default',
          });
        }
      }
    } catch (error: unknown) {
      console.error('Error generating journal:', error);
      
      // Check if it's a "no data" error vs actual error
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isNoDataError = (error as any)?.response?.data?.error?.includes('No chat messages');
      
      toast({
        title: isNoDataError && force ? 'No Messages Yet' : 'Error',
        description: isNoDataError 
          ? 'No chat messages found for today. Start chatting to generate your journal!' 
          : (force ? 'Failed to refresh journal' : 'Failed to generate journal'),
        variant: isNoDataError ? 'default' : 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-8 text-center">
          <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Sign In Required</h2>
          <p className="text-muted-foreground">
            Please sign in to view your journals
          </p>
        </Card>
      </div>
    );
  }

  const handleGenerateForDate = async (date: string) => {
    if (!user) return;

    try {
      setGenerating(true);
      toast({
        title: 'Generating Journal',
        description: `Creating journal entry for ${date}...`,
      });

      const journal = await generateJournal(user.id, date);
      
      if (journal) {
        setJournals(prev => [journal, ...prev.filter(j => j.date !== journal.date)]);
        setSelectedJournal(journal);
        
        toast({
          title: 'Success',
          description: 'Journal generated successfully!',
        });
      } else {
        toast({
          title: 'No Data',
          description: 'Not enough emotional data to generate a journal for this date.',
          variant: 'default',
        });
      }
    } catch (error: unknown) {
      console.error('Error generating journal:', error);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isNoDataError = (error as any)?.response?.data?.error?.includes('No chat messages');
      
      toast({
        title: isNoDataError ? 'No Messages' : 'Error',
        description: isNoDataError 
          ? 'No chat messages found for this date.' 
          : 'Failed to generate journal.',
        variant: isNoDataError ? 'default' : 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  if (selectedJournal) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <JournalDetail
          journal={selectedJournal}
          onBack={handleBack}
        />
      </div>
    );
  }

  const targetDate = searchParams?.get('date');
  if (targetDate && !resolvingDate && !loading) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-2xl text-center">
        <Card className="p-12">
          <div className="p-4 rounded-full bg-muted inline-flex mb-6">
            <Calendar className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold mb-2">No Journal for {new Date(targetDate).toLocaleDateString()}</h2>
          <p className="text-muted-foreground mb-8">
            You haven&apos;t created a journal entry for this date yet.
            Would you like to generate one from your chat history?
          </p>
          
          <div className="flex gap-4 justify-center">
            <Button variant="outline" onClick={handleBack}>
              Go Back
            </Button>
            <Button 
              onClick={() => handleGenerateForDate(targetDate)}
              disabled={generating}
              className="bg-gradient-to-r from-purple-500 to-pink-500"
            >
              {generating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Journal
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500">
              <BookOpen className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">My Journal</h1>
              <p className="text-muted-foreground">
                Reflections on your emotional journey
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleGenerateJournal(true)}
              disabled={generating}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
              Refresh Today
            </Button>
          </div>
        </div>
      </div>

      {/* Today's Journal Card */}
      <Card className="p-6 mb-8 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-white dark:bg-gray-800 shadow-md">
              <Sparkles className="h-6 w-6 text-purple-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Today&apos;s Journal</h3>
              <p className="text-sm text-muted-foreground">
                {todayJournal
                  ? 'Your journal for today is ready'
                  : 'Generate your daily reflection'}
              </p>
            </div>
          </div>

          {todayJournal ? (
            <Button onClick={() => setSelectedJournal(todayJournal)}>
              View Today&apos;s Entry
            </Button>
          ) : (
            <Button
              onClick={() => handleGenerateJournal(false)}
              disabled={generating}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            >
              {generating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Generate Journal
                </>
              )}
            </Button>
          )}
        </div>
      </Card>

      {/* Journal List */}
      <div className="mb-4">
        <h2 className="text-2xl font-semibold mb-4">Past Journals</h2>
      </div>

      <JournalList
        journals={journals}
        onSelectJournal={handleSelectFromList}
        loading={loading}
      />
    </div>
  );
}
