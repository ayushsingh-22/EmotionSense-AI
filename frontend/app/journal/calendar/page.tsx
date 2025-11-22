"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getJournalList, JournalEntry } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JournalCalendar } from "@/components/journal/JournalCalendar";

const emotionEmojiMap: Record<string, string> = {
  anger: "🤬",
  disgust: "🤢",
  fear: "😨",
  joy: "😀",
  neutral: "😐",
  sadness: "😭",
  surprise: "😲",
};

export default function JournalCalendarPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const fetchJournals = async () => {
      try {
        setLoading(true);
        const data = await getJournalList(user.id, 120);
        if (!cancelled) {
          setEntries(data);
        }
      } catch (error) {
        console.error("Error loading journal calendar data:", error);
        toast({
          title: "Error",
          description: "Unable to load journals for the calendar view.",
          variant: "destructive",
        });
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchJournals();

    return () => {
      cancelled = true;
    };
  }, [user, toast]);

  const calendarEntries = useMemo(
    () =>
      entries.map((entry) => {
        const emotionKey = entry.emotion?.toLowerCase() ?? "";
        return {
          date: entry.date,
          emotion: entry.emotion,
          emotionEmoji:
            entry.emotion_emoji || emotionEmojiMap[emotionKey] || "•",
          moodScore: entry.emotion_summary?.mood_score || null,
        };
      }),
    [entries]
  );

  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    router.push(`/journal?date=${date}`);
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <Card className="p-8 text-center">
          <CalendarDays className="mx-auto mb-4 h-14 w-14 text-muted-foreground" />
          <h2 className="text-2xl font-semibold mb-2">Sign in required</h2>
          <p className="text-muted-foreground">
            Please sign in to view your journal calendar.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Card className="p-6">
        {loading ? (
          <div className="space-y-4" role="status" aria-label="Loading calendar">
            <div className="h-8 w-48 rounded bg-muted/40" />
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 42 }).map((_, index) => (
                <div key={index} className="h-20 rounded-lg bg-muted/40" />
              ))}
            </div>
            <div className="h-4 w-64 rounded bg-muted/40" />
          </div>
        ) : (
          <JournalCalendar
            entries={calendarEntries}
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
          />
        )}
      </Card>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-xl text-sm text-muted-foreground">
          Journal entries are mapped to the days they were created. Use the
          navigation controls to review past months and tap a highlighted day to
          jump into the detailed reflection for that date.
        </div>
        <Button variant="outline" onClick={() => router.push('/journal')}>
          Go to journal list
        </Button>
      </div>
    </div>
  );
}
