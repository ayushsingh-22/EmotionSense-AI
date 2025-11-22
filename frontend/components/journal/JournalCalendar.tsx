"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MoodScoreBadge } from "@/components/ui/MoodScoreBadge";
import { cn } from "@/lib/utils";
import { format, isSameMonth, isToday } from "date-fns";

type CalendarEntry = {
	date: string;
	emotion?: string | null;
	emotionEmoji?: string | null;
	moodScore?: number | null;
};

interface JournalCalendarProps {
	entries: CalendarEntry[];
	selectedDate?: string | null;
	onSelectDate: (date: string) => void;
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const EMOTION_COLORS: Record<string, string> = {
	anger: "bg-red-500/80 text-red-50 border-red-500/60",
	disgust: "bg-lime-500/70 text-lime-950 border-lime-500/60",
	fear: "bg-indigo-500/75 text-indigo-50 border-indigo-500/60",
	joy: "bg-amber-400/80 text-amber-950 border-amber-400/60",
	neutral: "bg-gray-400/70 text-gray-50 border-gray-400/60",
	sadness: "bg-blue-500/75 text-blue-50 border-blue-500/60",
	surprise: "bg-fuchsia-500/75 text-fuchsia-50 border-fuchsia-500/60",
};

const emotionOrder = [
	"joy",
	"surprise",
	"neutral",
	"sadness",
	"fear",
	"anger",
	"disgust",
];

const parseISODate = (value: string): Date => {
	const [year, month, day] = value.split("-").map(Number);
	return new Date(Date.UTC(year, month - 1, day));
};

const toISODate = (date: Date): string => {
	return date.toISOString().slice(0, 10);
};

const normalizeMonth = (date: Date): Date => {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
};

const getMonthLabel = (date: Date): string => {
	return new Intl.DateTimeFormat("en-IN", {
		month: "long",
		year: "numeric",
		timeZone: "UTC",
	}).format(date);
};

const shiftMonth = (date: Date, offset: number): Date => {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));
};

const buildGrid = (month: Date) => {
	const startOfMonth = normalizeMonth(month);
	const endOfMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0));

	const startOffset = (startOfMonth.getUTCDay() + 6) % 7; // Monday as first day
	const gridStart = new Date(startOfMonth);
	gridStart.setUTCDate(startOfMonth.getUTCDate() - startOffset);

	const endOffset = (6 - ((endOfMonth.getUTCDay() + 6) % 7));
	const gridEnd = new Date(endOfMonth);
	gridEnd.setUTCDate(endOfMonth.getUTCDate() + endOffset);

	const cursor = new Date(gridStart);
	const days: Date[] = [];

	while (cursor <= gridEnd) {
		days.push(new Date(cursor));
		cursor.setUTCDate(cursor.getUTCDate() + 1);
	}

	return days;
};

export function JournalCalendar({ entries, selectedDate, onSelectDate }: JournalCalendarProps) {
	const entryMap = useMemo(() => {
		const map = new Map<string, CalendarEntry>();
		entries.forEach((entry) => {
			map.set(entry.date, entry);
		});
		return map;
	}, [entries]);

	const initialMonth = useMemo(() => {
		if (selectedDate) {
			return normalizeMonth(parseISODate(selectedDate));
		}
		if (entries.length > 0) {
			const latest = entries.reduce((acc, current) => (current.date > acc.date ? current : acc));
			return normalizeMonth(parseISODate(latest.date));
		}
		return normalizeMonth(new Date());
	}, [entries, selectedDate]);

	const [currentMonth, setCurrentMonth] = useState<Date>(initialMonth);

	useEffect(() => {
		setCurrentMonth(initialMonth);
	}, [initialMonth]);

	const todayISO = toISODate(new Date());

	const gridDays = useMemo(() => buildGrid(currentMonth), [currentMonth]);

	const emotionLegend = useMemo(() => {
		const seen = new Set<string>();
		entries.forEach((entry) => {
			if (entry.emotion) {
				seen.add(entry.emotion.toLowerCase());
			}
		});
		return emotionOrder.filter((emotion) => seen.has(emotion));
	}, [entries]);

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex items-center gap-3">
					<div className="rounded-full bg-primary/10 p-3 text-primary">
						<CalendarDays className="h-6 w-6" aria-hidden="true" />
					</div>
					<div>
						<h1 className="text-2xl font-semibold">Journal Calendar</h1>
						<p className="text-sm text-muted-foreground">
							Tap highlighted dates to open detailed reflections
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="icon"
						onClick={() => setCurrentMonth((prev) => shiftMonth(prev, -1))}
						aria-label="Previous month"
					>
						<ChevronLeft className="h-4 w-4" />
					</Button>
					<div className="min-w-[160px] text-center text-sm font-medium">
						{getMonthLabel(currentMonth)}
					</div>
					<Button
						variant="outline"
						size="icon"
						onClick={() => setCurrentMonth((prev) => shiftMonth(prev, 1))}
						aria-label="Next month"
					>
						<ChevronRight className="h-4 w-4" />
					</Button>
				</div>
			</div>

			<div className="grid grid-cols-7 gap-2 text-center text-xs font-medium uppercase text-muted-foreground">
				{WEEKDAY_LABELS.map((label) => (
					<div key={label}>{label}</div>
				))}
			</div>

			<div className="grid grid-cols-7 gap-2" role="grid" aria-label="Journal calendar">
				{gridDays.map((day) => {
					const iso = toISODate(day);
					const entry = entryMap.get(iso);
					const isCurrentMonth = day.getUTCMonth() === currentMonth.getUTCMonth();
					const isTodayDay = iso === todayISO;
					const isSelected = selectedDate ? iso === selectedDate : false;
					const emotionKey = entry?.emotion ? entry.emotion.toLowerCase() : null;

					return (
						<div
							key={iso}
							className={cn(
								"group relative flex h-20 w-full flex-col items-center justify-center rounded-xl border transition-all cursor-pointer",
								isCurrentMonth
									? "border-border bg-background"
									: "border-dashed border-border/40 bg-muted/40 text-muted-foreground/70",
								entry && emotionKey && EMOTION_COLORS[emotionKey]
									? `border ${EMOTION_COLORS[emotionKey]}`
									: "",
								entry
									? "hover:-translate-y-0.5 hover:shadow-md"
									: "opacity-70",
								isSelected && "ring-2 ring-primary ring-offset-2",
								isTodayDay && !isSelected && "border-primary/60"
							)}
							onClick={() => onSelectDate(iso)}
						>
							<span className="text-sm font-semibold">
								{day.getUTCDate()}
							</span>
							{entry ? (
								<>
									<span className="mt-1 text-2xl" aria-hidden="true" title={entry.emotion || 'No emotion'}>
										{entry.emotionEmoji || "😐"}
									</span>
								</>
							) : (
								<span className="mt-1 text-xs text-muted-foreground/50">—</span>
							)}
						</div>
					);
				})}
			</div>

			{emotionLegend.length > 0 ? (
				<div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
					<span className="font-medium">Emotion legend:</span>
					{emotionLegend.map((emotion) => (
						<div key={emotion} className="flex items-center gap-2">
							<span
								className={cn(
									"h-3 w-3 rounded-full",
									EMOTION_COLORS[emotion]?.split(' ')[0] ?? "bg-gray-400"
								)}
								aria-hidden="true"
							/>
							<span className="capitalize">{emotion}</span>
						</div>
					))}
				</div>
			) : null}
		</div>
	);
}

export type { CalendarEntry, JournalCalendarProps };
