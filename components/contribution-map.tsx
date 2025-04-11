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

// Constants for local storage
const LOCAL_STORAGE_KEY = "contribution-tracker-stats";
const TODO_COMPLETION_EVENT = "todo-completion-update";

export function ContributionMap({ stats: initialStats }: ContributionMapProps) {
  const [hoveredDay, setHoveredDay] = useState<DailyStats | null>(null);
  // Initialize with initialStats, then load from localStorage in useEffect
  const [stats, setStats] = useState<DailyStats[]>(initialStats);
  // Track if component is mounted (client-side)
  const [isMounted, setIsMounted] = useState(false);

  // Mark component as mounted (client-side only)
  useEffect(() => {
    setIsMounted(true);

    // Load stats from localStorage on client-side only
    const savedStats = localStorage.getItem(LOCAL_STORAGE_KEY);
    // Also check for stats in the main app's localStorage key
    const appStats = localStorage.getItem("stats");

    if (savedStats) {
      try {
        setStats(JSON.parse(savedStats));
      } catch (e) {
        console.error("Failed to parse stored stats:", e);
      }
    } else if (appStats) {
      // If no contribution-specific stats but app stats exist, use those
      try {
        setStats(JSON.parse(appStats));
      } catch (e) {
        console.error("Failed to parse app stats:", e);
      }
    }
  }, []);

  // Add a listener for todo completion events
  useEffect(() => {
    if (!isMounted) return;

    // Function to handle todo completion events
    const handleTodoCompletion = () => {
      const savedStats = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedStats) {
        try {
          const updatedStats = JSON.parse(savedStats);
          setStats(updatedStats);
          console.log(
            "Updated contribution map from storage event:",
            updatedStats
          );
        } catch (e) {
          console.error("Failed to parse stored stats:", e);
        }
      }
    };

    // Add event listener for storage events
    window.addEventListener("storage", (event) => {
      if (event.key === TODO_COMPLETION_EVENT) {
        handleTodoCompletion();
      }
    });

    // Custom event for same-window updates
    window.addEventListener(TODO_COMPLETION_EVENT, handleTodoCompletion);

    return () => {
      window.removeEventListener("storage", handleTodoCompletion);
      window.removeEventListener(TODO_COMPLETION_EVENT, handleTodoCompletion);
    };
  }, [isMounted]);

  // Save stats to localStorage whenever they change, but only after mounting
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stats));
    }
  }, [stats, isMounted]);

  // Log when stats are received
  useEffect(() => {
    if (isMounted) {
      console.log("ContributionMap using stats:", stats);
    }
  }, [stats, isMounted]);

  // Add a public method to update stats for today
  useEffect(() => {
    if (!isMounted) return;

    // Add a method to the window object that other components can call
    window.updateContributionMap = (increment = true) => {
      const today = format(new Date(), "yyyy-MM-dd");
      console.log(
        `Updating contribution map for ${today}, increment: ${increment}`
      );

      setStats((prevStats) => {
        const existingIndex = prevStats.findIndex((s) => s.date === today);
        const newStats = [...prevStats];

        if (existingIndex >= 0) {
          // Update existing date
          const currentCompleted = prevStats[existingIndex].completed;
          newStats[existingIndex] = {
            ...newStats[existingIndex],
            completed: increment
              ? currentCompleted + 1
              : Math.max(currentCompleted - 1, 0),
            percentage:
              ((increment
                ? currentCompleted + 1
                : Math.max(currentCompleted - 1, 0)) /
                Math.max(newStats[existingIndex].total, 1)) *
              100,
          };
        } else if (increment) {
          // Add new date (only for increments)
          newStats.push({
            date: today,
            completed: 1,
            total: 1,
            percentage: 100,
          });
        }

        // Save to localStorage and trigger the event
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newStats));
        // Also update the main app's stats in localStorage
        localStorage.setItem("stats", JSON.stringify(newStats));
        // Trigger event for other instances of the component
        localStorage.setItem(TODO_COMPLETION_EVENT, Date.now().toString());
        // Dispatch custom event for same-window updates
        window.dispatchEvent(new Event(TODO_COMPLETION_EVENT));

        console.log("Updated stats:", newStats);
        return newStats;
      });
    };

    return () => {
      // Clean up
      delete window.updateContributionMap;
    };
  }, [isMounted]);

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

    // Add console log during testing to see completion count
    console.log(`Date: ${day.date}, Completed: ${completed}`);

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

                    // For debugging - log found dayStats for each date
                    if (dayStats && dayStats.completed > 0) {
                      console.log(`Found stats for ${dateStr}:`, dayStats);
                    }

                    return (
                      <TooltipProvider key={dateStr}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={`w-[12px] h-[12px] rounded-sm ${
                                isFutureDate
                                  ? "bg-transparent"
                                  : getColorClass(dayStats)
                              } hover:ring-2 hover:ring-offset-1 hover:ring-gray-400`}
                              onMouseEnter={() => {
                                console.log(
                                  `Hovering over ${dateStr}`,
                                  dayStats
                                );
                                setHoveredDay(dayStats || null);
                              }}
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

      {/* Current selection info - Make more visible */}
      <div className="text-sm p-2 border rounded-md text-center min-h-[40px]">
        {hoveredDay ? (
          <div>
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
          <div className="text-muted-foreground">
            Hover over cells to see details
          </div>
        )}
      </div>

      {/* Re-enable the test panel for debugging */}
      {/* {isMounted && (
        <div className="border rounded-md p-4 mt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium">Contribution Map Test Panel</h3>
            <button
              className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
              onClick={() => {
                // Create a copy to avoid mutating props directly
                const testStats = [...stats];

                // Add 10 random contributions in the past year
                for (let i = 0; i < 10; i++) {
                  const randomDayOffset = Math.floor(Math.random() * 364);
                  const randomDate = format(
                    subDays(endDate, randomDayOffset),
                    "yyyy-MM-dd"
                  );
                  const randomCompletions = Math.floor(Math.random() * 12) + 1;

                  // Check if date already exists
                  const existingIndex = testStats.findIndex(
                    (s) => s.date === randomDate
                  );

                  if (existingIndex >= 0) {
                    // Update existing date
                    testStats[existingIndex] = {
                      ...testStats[existingIndex],
                      completed: randomCompletions,
                      percentage:
                        (randomCompletions / testStats[existingIndex].total) *
                        100,
                    };
                  } else {
                    // Add new date
                    testStats.push({
                      date: randomDate,
                      completed: randomCompletions,
                      total: randomCompletions,
                      percentage: 100,
                    });
                  }
                }

                // Update the internal state to reflect the test data
                setStats(testStats);
                console.log("Generated test data:", testStats);

                // Show confirmation message
                alert(
                  `Added test data for 10 random dates. The contribution map has been updated.`
                );
              }}
            >
              Generate Random Test Data
            </button>
          </div>
          <div className="text-xs text-muted-foreground">
            <p>
              This panel is for testing only. Click the button to generate
              random contribution data and see it reflected in the contribution
              map above.
            </p>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              className="text-xs px-2 py-1 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              onClick={() => {
                // Reset to original data
                setStats(initialStats);
                localStorage.removeItem(LOCAL_STORAGE_KEY);
                alert("Test data has been reset");
              }}
            >
              Reset Test Data
            </button>
            <button
              className="text-xs px-2 py-1 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              onClick={() => {
                // Add a single contribution to today
                const today = format(new Date(), "yyyy-MM-dd");
                const existingIndex = stats.findIndex((s) => s.date === today);

                const newStats = [...stats];

                if (existingIndex >= 0) {
                  // Increment existing date
                  newStats[existingIndex] = {
                    ...newStats[existingIndex],
                    completed: newStats[existingIndex].completed + 1,
                    total: newStats[existingIndex].total + 1,
                  };
                } else {
                  // Add new date
                  newStats.push({
                    date: today,
                    completed: 1,
                    total: 1,
                    percentage: 100,
                  });
                }

                setStats(newStats);
              }}
            >
              Add Today's Contribution
            </button>
          </div>
        </div>
      )} */}
    </div>
  );
}

// Add this to make TypeScript happy with our window property
declare global {
  interface Window {
    updateContributionMap?: (increment?: boolean) => void;
  }
}
