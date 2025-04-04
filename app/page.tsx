"use client";

import { useEffect, useState } from "react";
import { format, parseISO, subDays, startOfDay } from "date-fns";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContributionMap } from "@/components/contribution-map";

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  date: string;
}

interface DailyStats {
  date: string;
  completed: number;
  total: number;
  percentage: number;
}

export default function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState("");
  const [stats, setStats] = useState<DailyStats[]>([]);
  const today = format(startOfDay(new Date()), "yyyy-MM-dd"); // Normalize today to start of day

  // Load todos and stats from localStorage on initial render
  useEffect(() => {
    const savedTodos = localStorage.getItem("todos");
    const savedStats = localStorage.getItem("stats");

    if (savedTodos) {
      setTodos(JSON.parse(savedTodos));
    }

    if (savedStats) {
      setStats(JSON.parse(savedStats));
    } else {
      // Initialize stats with empty data for the last 365 days
      const now = new Date();
      const initialStats = Array.from({ length: 365 }, (_, i) => {
        // Changed to count backwards from today to ensure today is included
        const date = format(subDays(now, i), "yyyy-MM-dd");
        return {
          date,
          completed: 0,
          total: 0,
          percentage: 0,
        };
      });
      setStats(initialStats);
    }
  }, []);

  // Save todos and stats to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("todos", JSON.stringify(todos));
  }, [todos]);

  useEffect(() => {
    localStorage.setItem("stats", JSON.stringify(stats));
  }, [stats]);

  // Update stats whenever todos change
  useEffect(() => {
    const now = new Date();
    const todayString = format(now, "yyyy-MM-dd");
    let newStats = [...stats];

    if (!newStats.some((stat) => stat.date === todayString)) {
      newStats = [
        {
          date: todayString,
          completed: 0,
          total: 0,
          percentage: 0,
        },
        ...newStats.slice(0, -1),
      ];
    }

    // Reset all counts
    newStats = newStats.map((stat) => ({
      ...stat,
      completed: 0,
      total: 0,
      percentage: 0, // We'll use this to store the contribution level (0-4)
    }));

    const statsMap = new Map<string, number>();
    newStats.forEach((stat, index) => {
      statsMap.set(stat.date, index);
    });

    // Count completed todos for each day
    todos.forEach((todo) => {
      if (todo.completed) {
        // Only count completed todos
        const statIndex = statsMap.get(todo.date);
        if (statIndex !== undefined) {
          const stat = newStats[statIndex];
          stat.completed += 1;

          // Set contribution levels based on number of completed todos
          // 0: no contributions (0)
          // 1: light (1)
          // 2: medium-light (2-3)
          // 3: medium (4-5)
          // 4: dark (6+)
          if (stat.completed === 0) stat.percentage = 0;
          else if (stat.completed === 1) stat.percentage = 25;
          else if (stat.completed <= 3) stat.percentage = 50;
          else if (stat.completed <= 5) stat.percentage = 75;
          else stat.percentage = 100;
        }
      }
    });

    setStats(newStats);
  }, [todos]);

  const addTodo = () => {
    if (newTodo.trim() === "") return;

    const newTodoItem: Todo = {
      id: crypto.randomUUID(),
      text: newTodo,
      completed: false,
      date: today,
    };

    console.log("Adding new todo:", newTodoItem);
    setTodos([...todos, newTodoItem]);
    setNewTodo("");

    // No manual stats update needed - the useEffect will handle it
  };

  const toggleTodo = (id: string) => {
    const updatedTodos = todos.map((todo) =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    );
    console.log("Todo toggled:", id);
    setTodos(updatedTodos);

    // No manual stats update needed - the useEffect will handle it
  };

  const deleteTodo = (id: string) => {
    const todoToDelete = todos.find((todo) => todo.id === id);
    console.log("Deleting todo:", todoToDelete?.text);

    const updatedTodos = todos.filter((todo) => todo.id !== id);
    setTodos(updatedTodos);

    // No manual stats update needed - the useEffect will handle it
  };

  const todaysTodos = todos.filter((todo) => todo.date === today);
  const completedToday = todaysTodos.filter((todo) => todo.completed).length;
  const totalToday = todaysTodos.length;
  const percentageToday =
    totalToday > 0 ? (completedToday / totalToday) * 100 : 0;

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8 text-center">Todo Tracker</h1>

      <div className="flex flex-col gap-8">
        {/* Contribution Map - Now full width */}
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Map</CardTitle>
            <CardDescription>Completion History</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto pb-4">
            <ContributionMap stats={stats} />
          </CardContent>
        </Card>

        <div className="grid gap-8 md:grid-cols-[1fr_300px]">
          <div className="space-y-8">
            {/* Today's Todos - Now below contribution map */}
            <Card>
              <CardHeader>
                <CardTitle>Today&apos;s Todos</CardTitle>
                <CardDescription>
                  {totalToday > 0
                    ? `${completedToday} of ${totalToday} completed (${Math.round(
                        percentageToday
                      )}%)`
                    : "No todos for today yet"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex space-x-2 mb-6">
                  <Input
                    placeholder="Add a new todo..."
                    value={newTodo}
                    onChange={(e) => setNewTodo(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addTodo();
                    }}
                  />
                  <Button onClick={addTodo}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>

                {todaysTodos.length > 0 ? (
                  <ul className="space-y-3">
                    {todaysTodos.map((todo) => (
                      <li
                        key={todo.id}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            id={todo.id}
                            checked={todo.completed}
                            onCheckedChange={() => toggleTodo(todo.id)}
                          />
                          <label
                            htmlFor={todo.id}
                            className={`text-sm ${
                              todo.completed
                                ? "line-through text-muted-foreground"
                                : ""
                            }`}
                          >
                            {todo.text}
                          </label>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteTodo(todo.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-center text-muted-foreground py-4">
                    No todos for today. Add some tasks to get started!
                  </p>
                )}
              </CardContent>
            </Card>

            <Tabs defaultValue="all">
              <TabsList className="mb-4">
                <TabsTrigger value="all">All Todos</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
              </TabsList>

              <TabsContent value="all">
                <TodoList
                  todos={todos}
                  toggleTodo={toggleTodo}
                  deleteTodo={deleteTodo}
                  emptyMessage="No todos found"
                />
              </TabsContent>

              <TabsContent value="completed">
                <TodoList
                  todos={todos.filter((todo) => todo.completed)}
                  toggleTodo={toggleTodo}
                  deleteTodo={deleteTodo}
                  emptyMessage="No completed todos"
                />
              </TabsContent>

              <TabsContent value="pending">
                <TodoList
                  todos={todos.filter((todo) => !todo.completed)}
                  toggleTodo={toggleTodo}
                  deleteTodo={deleteTodo}
                  emptyMessage="No pending todos"
                />
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Today</p>
                  <p className="text-2xl font-bold">
                    {totalToday > 0 ? `${Math.round(percentageToday)}%` : "0%"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {completedToday} of {totalToday} completed
                  </p>
                </div>

                <Separator />

                <div>
                  <p className="text-sm text-muted-foreground">All time</p>
                  <p className="text-2xl font-bold">
                    {todos.length > 0
                      ? `${Math.round(
                          (todos.filter((t) => t.completed).length /
                            todos.length) *
                            100
                        )}%`
                      : "0%"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {todos.filter((t) => t.completed).length} of {todos.length}{" "}
                    completed
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TodoListProps {
  todos: Todo[];
  toggleTodo: (id: string) => void;
  deleteTodo: (id: string) => void;
  emptyMessage: string;
}

function TodoList({
  todos,
  toggleTodo,
  deleteTodo,
  emptyMessage,
}: TodoListProps) {
  // Group todos by date
  const todosByDate = todos.reduce((groups, todo) => {
    const date = todo.date;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(todo);
    return groups;
  }, {} as Record<string, Todo[]>);

  // Sort dates in descending order
  const sortedDates = Object.keys(todosByDate).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  if (todos.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-4">{emptyMessage}</p>
    );
  }

  return (
    <div className="space-y-6">
      {sortedDates.map((date) => (
        <div key={date}>
          <h3 className="text-sm font-medium mb-2">
            {date === format(new Date(), "yyyy-MM-dd")
              ? "Today"
              : format(parseISO(date), "MMMM d, yyyy")}
          </h3>
          <ul className="space-y-2">
            {todosByDate[date].map((todo) => (
              <li
                key={todo.id}
                className="flex items-center justify-between p-2 rounded hover:bg-muted/50"
              >
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id={`list-${todo.id}`}
                    checked={todo.completed}
                    onCheckedChange={() => toggleTodo(todo.id)}
                  />
                  <label
                    htmlFor={`list-${todo.id}`}
                    className={`text-sm ${
                      todo.completed ? "line-through text-muted-foreground" : ""
                    }`}
                  >
                    {todo.text}
                  </label>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteTodo(todo.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
