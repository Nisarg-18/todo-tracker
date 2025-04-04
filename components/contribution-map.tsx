"use client";

import { useState, useEffect, useMemo } from "react";
import {
  format,
  parseISO,
  subDays,
  eachDayOfInterval,
  addDays,
  isSameDay,
  startOfDay,
} from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DailyStats {
  date: string;
  completed: number;
  total: number;
  percentage: number;
}

interface ContributionMapProps {
  stats: DailyStats[];
}

export function ContributionMap({ stats }: ContributionMapProps) {
  const [hoveredDay, setHoveredDay] = useState<DailyStats | null>(null);

  // Log when stats are received
  useEffect(() => {
    console.log("ContributionMap received stats:", stats);
  }, [stats]);

  // Use useMemo for all date calculations to ensure they're stable
  const { statsMap, endDate, startDate, weeks, months, allDates } =
    useMemo(() => {
      // Create a lookup map for quick access to stats by date
      const statsMap = new Map<string, DailyStats>();
      stats.forEach((day) => {
        statsMap.set(day.date, day);
      });

      // Calculate the date range for the contribution map (1 year)
      const now = new Date();
      const endDate = startOfDay(now); // Normalize to start of day to avoid time-related issues
      const startDate = subDays(endDate, 364); // 365 days total

      // Generate all dates in the range
      const allDates = eachDayOfInterval({ start: startDate, end: endDate });

      // Generate weeks (for the grid layout)
      const weeks: Date[][] = [];
      let currentWeek: Date[] = [];

      allDates.forEach((date) => {
        const dayOfWeek = date.getDay();

        // Start a new week if it's Sunday (0) or the first day
        if (dayOfWeek === 0 && currentWeek.length > 0) {
          weeks.push(currentWeek);
          currentWeek = [];
        }

        currentWeek.push(date);

        // Push the last week if we've reached the end
        if (isSameDay(date, endDate)) {
          // Fill the remaining days of the week with future dates
          const daysToAdd = 7 - currentWeek.length;
          if (daysToAdd > 0) {
            for (let i = 1; i <= daysToAdd; i++) {
              currentWeek.push(addDays(date, i));
            }
          }
          weeks.push(currentWeek);
        }
      });

      // Get months for labels (show first day of each month)
      const months: { label: string; index: number }[] = [];
      let currentMonth = -1;

      allDates.forEach((date, index) => {
        const month = date.getMonth();
        if (month !== currentMonth) {
          months.push({
            label: format(date, "MMM"),
            index: Math.floor(index / 7), // Convert to week index
          });
          currentMonth = month;
        }
      });

      return { statsMap, endDate, startDate, weeks, months, allDates };
    }, [stats]);

  // Function to get color based on number of completed todos
  const getColorClass = (day: DailyStats | undefined) => {
    if (!day || day.completed === 0) {
      return "bg-[#ebedf0] dark:bg-[#161b22]";
    }

    const completed = day.completed;

    if (completed >= 10) return "bg-[#39d353] dark:bg-[#39d353]";
    if (completed >= 7) return "bg-[#26a641] dark:bg-[#26a641]";
    if (completed >= 4) return "bg-[#006d32] dark:bg-[#006d32]";
    if (completed >= 1) return "bg-[#0e4429] dark:bg-[#0e4429]";

    return "bg-[#ebedf0] dark:bg-[#161b22]";
  };

  // Function to format the tooltip content
  const formatTooltip = (day: DailyStats | undefined, date: Date) => {
    const formattedDate = format(date, "MMMM d, yyyy");

    if (!day || day.completed === 0) {
      return `${formattedDate}: No contributions`;
    }

    return `${formattedDate}: ${day.completed} contribution${
      day.completed === 1 ? "" : "s"
    }`;
  };

  // Days of the week for labels
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="flex">
          {/* Days of week labels */}
          <div className="flex flex-col text-xs text-muted-foreground mt-6 mr-1">
            {daysOfWeek.map((day, i) => (
              <div key={day} className="h-[14px] py-[2px]">
                {i % 2 === 0 ? day : ""}
              </div>
            ))}
          </div>

          <div className="w-full">
            {/* Month labels */}
            <div className="flex text-xs text-muted-foreground mb-1 relative h-5">
              {months.map((month, i) => (
                <div
                  key={`${month.label}-${i}`}
                  className="absolute"
                  style={{ left: `${month.index * 14}px` }}
                >
                  {month.label}
                </div>
              ))}
            </div>

            {/* Contribution grid */}
            <div className="flex gap-[2px]">
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-[2px]">
                  {week.map((date) => {
                    const dateStr = format(date, "yyyy-MM-dd");
                    const dayStats = statsMap.get(dateStr);
                    const isFutureDate = date > endDate;

                    return (
                      <TooltipProvider key={dateStr}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={`w-[12px] h-[12px] rounded-sm ${
                                isFutureDate
                                  ? "bg-transparent"
                                  : getColorClass(dayStats)
                              }`}
                              onMouseEnter={() =>
                                setHoveredDay(dayStats || null)
                              }
                              onMouseLeave={() => setHoveredDay(null)}
                              aria-label={formatTooltip(dayStats, date)}
                            />
                          </TooltipTrigger>
                          {!isFutureDate && (
                            <TooltipContent side="top">
                              {formatTooltip(dayStats, date)}
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span>Less</span>
        <div className="flex">
          <div
            className="w-3 h-3 bg-[#ebedf0] dark:bg-[#161b22]"
            title="No contributions"
          ></div>
          <div className="w-3 h-3 bg-[#0e4429]" title="1-3 contributions"></div>
          <div className="w-3 h-3 bg-[#006d32]" title="4-6 contributions"></div>
          <div className="w-3 h-3 bg-[#26a641]" title="7-9 contributions"></div>
          <div className="w-3 h-3 bg-[#39d353]" title="10+ contributions"></div>
        </div>
        <span>More</span>
      </div>

      {/* Current selection info */}
      <div className="text-sm">
        {hoveredDay ? (
          <div className="text-center">
            <span className="font-medium">
              {format(parseISO(hoveredDay.date), "MMMM d, yyyy")}:
            </span>{" "}
            {hoveredDay.completed > 0 ? (
              <span>
                {hoveredDay.completed} contribution
                {hoveredDay.completed === 1 ? "" : "s"}
              </span>
            ) : (
              <span className="text-muted-foreground">No contributions</span>
            )}
          </div>
        ) : (
          <div className="text-center text-xs text-muted-foreground">
            Hover over cells to see details
          </div>
        )}
      </div>

      {/* Add a debug display during development */}
      <div className="hidden">
        <pre>
          {JSON.stringify(
            stats.filter((s) => s.total > 0),
            null,
            2
          )}
        </pre>
      </div>
    </div>
  );
}
