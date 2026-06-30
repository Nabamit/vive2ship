import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Sparkles, 
  Plus, 
  Check, 
  Trash2, 
  AlertTriangle, 
  CheckSquare, 
  Mic, 
  MicOff, 
  LogOut, 
  LogIn, 
  CalendarDays, 
  TrendingUp, 
  User, 
  RefreshCw, 
  Zap, 
  ChevronDown, 
  ChevronUp, 
  Bell, 
  FileText, 
  Info,
  Award
} from "lucide-react";
import Markdown from "react-markdown";

import { 
  initAuth, 
  googleSignIn, 
  logout, 
  getAccessToken 
} from "./lib/firebase";
import { 
  saveTaskToStore, 
  getTasksFromStore, 
  deleteTaskFromStore,
  saveHabitToStore,
  getHabitsFromStore,
  deleteHabitFromStore,
  saveNudgeToStore,
  getNudgesFromStore
} from "./lib/db";
import { 
  fetchUpcomingEvents, 
  createCalendarEvent, 
  CalendarEvent 
} from "./lib/calendar";
import { Task, Habit, Nudge, SubTask, ScheduledBlock } from "./types";

export default function App() {
  // USER / AUTH STATE
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // CORE DATA STATE
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

  // UI / INPUT STATE
  const [activeTab, setActiveTab] = useState<"dashboard" | "calendar" | "nudges">("dashboard");
  const [taskInput, setTaskInput] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [expandedStarterId, setExpandedStarterId] = useState<string | null>(null);
  const [schedulingTaskId, setSchedulingTaskId] = useState<string | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);
  const [syncingTaskId, setSyncingTaskId] = useState<string | null>(null);
  
  // SCHEDULING PREFERENCES
  const [workingHours, setWorkingHours] = useState({ start: "09:00", end: "17:00" });
  const [energyPattern, setEnergyPattern] = useState("morning focus");

  // INSIGHT STATE
  const [productivityInsight, setProductivityInsight] = useState("You finish most tasks during morning hours. I will prioritize planning your heavy lifting early in the day!");
  const [insightLoading, setInsightLoading] = useState(false);

  // NOTIFICATION TOAST
  const [toast, setToast] = useState<{ message: string; actionStep: string; urgency: string } | null>(null);

  // VOICE RECOGNITION REF
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // INITIALIZE AUTH & LOAD DATA
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        setAuthLoading(false);
        loadUserDependentData(currentUser.uid, accessToken);
      },
      () => {
        setUser(null);
        setToken(null);
        setAuthLoading(false);
        loadUserDependentData(null, null);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // LOAD RELEVANT DATA FROM FIRESTORE OR LOCALSTORAGE
  const loadUserDependentData = async (uid: string | null, accessToken: string | null) => {
    try {
      const fetchedTasks = await getTasksFromStore(uid);
      setTasks(fetchedTasks);
      
      const fetchedHabits = await getHabitsFromStore(uid);
      setHabits(fetchedHabits);
      
      const fetchedNudges = await getNudgesFromStore(uid);
      setNudges(fetchedNudges);

      if (accessToken) {
        setCalendarLoading(true);
        try {
          const events = await fetchUpcomingEvents(accessToken);
          setCalendarEvents(events);
        } catch (calErr) {
          console.error("Failed to load Calendar events", calErr);
        } finally {
          setCalendarLoading(false);
        }
      } else {
        // Fallback mock events for non-logged-in users
        setCalendarEvents([
          { 
            id: "mock1", 
            summary: "Team Daily Alignment", 
            start: { dateTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() }, 
            end: { dateTime: new Date(Date.now() + 2.5 * 60 * 60 * 1000).toISOString() } 
          },
          { 
            id: "mock2", 
            summary: "Weekly Sync & Review", 
            start: { dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }, 
            end: { dateTime: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString() } 
          }
        ]);
      }
    } catch (err) {
      console.error("Error loading application data:", err);
    }
  };

  // WEB SPEECH RECOGNITION SETUP
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListening(true);
      };

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setTaskInput(prev => prev ? prev + ' ' + transcript : transcript);
      };

      rec.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Voice speech recognition is not supported in this iframe/browser. Try typing in your deadline!");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  // HANDLE GOOGLE AUTH
  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setToken(result.accessToken);
        setUser(result.user);
        await loadUserDependentData(result.user.uid, result.accessToken);
      }
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        console.warn("Google sign-in was cancelled or the popup was closed.");
      } else {
        console.error("Google sign in failed:", err);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setToken(null);
      setCalendarEvents([]);
      await loadUserDependentData(null, null);
    } catch (err) {
      console.error("Sign out failed:", err);
    }
  };

  // INTELLIGENT TASK PRIORITIZATION & DECOMPOSITION
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskInput.trim()) return;

    setIsParsing(true);
    try {
      const currentDate = new Date().toISOString().split('T')[0];
      const response = await fetch("/api/parse-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originalInput: taskInput, currentDate })
      });

      if (!response.ok) {
        throw new Error("Gemini AI failed to parse task. Please try again.");
      }

      const aiParsedTask = await response.json();
      
      // Inject standard client fields
      const newTask: Task = {
        id: `task_${Date.now()}`,
        userId: user ? user.uid : "",
        title: aiParsedTask.title || "Untitled Goal",
        dueDate: aiParsedTask.dueDate || currentDate,
        priority: aiParsedTask.priority || "Medium",
        urgencyScore: aiParsedTask.urgencyScore || 50,
        effort: aiParsedTask.effort || "medium",
        importance: aiParsedTask.importance || 50,
        description: aiParsedTask.description || "",
        originalInput: taskInput,
        status: "pending",
        createdAt: new Date().toISOString(),
        subtasks: (aiParsedTask.subtasks || []).map((st: any) => ({
          ...st,
          completed: false
        })),
        scheduledBlocks: []
      };

      await saveTaskToStore(newTask, user ? user.uid : null);
      
      setTasks(prev => [newTask, ...prev]);
      setTaskInput("");
      setExpandedTaskId(newTask.id); // auto-expand to show nice subtasks
    } catch (error: any) {
      console.error("Task creation error:", error);
      alert(error.message || "An error occurred during AI parsing.");
    } finally {
      setIsParsing(false);
    }
  };

  // TOGGLE SUBTASK COMPLETION State
  const handleToggleSubtask = async (taskId: string, subtaskId: string) => {
    const updatedTasks = tasks.map(t => {
      if (t.id === taskId) {
        const updatedSubtasks = t.subtasks.map(st => {
          if (st.id === subtaskId) {
            return { 
              ...st, 
              completed: !st.completed,
              completedAt: !st.completed ? new Date().toISOString() : undefined
            };
          }
          return st;
        });
        
        // If all subtasks are completed, mark the task as completed
        const allDone = updatedSubtasks.every(st => st.completed);
        const taskStatus = allDone ? "completed" as const : "pending" as const;

        const updatedTask = {
          ...t,
          subtasks: updatedSubtasks,
          status: taskStatus
        };

        saveTaskToStore(updatedTask, user ? user.uid : null);
        return updatedTask;
      }
      return t;
    });

    setTasks(updatedTasks);
  };

  // AI-POWERED SCHEDULING SYSTEM
  const handlePlanSchedule = async (task: Task) => {
    setSchedulingTaskId(task.id);
    setIsScheduling(true);

    try {
      // Gather calendar busy times
      const busySlots = calendarEvents.map(e => ({
        start: e.start.dateTime || e.start.date,
        end: e.end.dateTime || e.end.date
      })).filter(slot => slot.start && slot.end);

      const response = await fetch("/api/propose-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskTitle: task.title,
          subtasks: task.subtasks.filter(st => !st.completed),
          calendarBusySlots: busySlots,
          workingHours,
          userEnergyPattern: energyPattern,
          currentDate: new Date().toISOString().split('T')[0]
        })
      });

      if (!response.ok) {
        throw new Error("Scheduling system failed to compile slots.");
      }

      const { proposedBlocks } = await response.json();

      const updatedTasks = tasks.map(t => {
        if (t.id === task.id) {
          const updatedTask = {
            ...t,
            scheduledBlocks: proposedBlocks.map((block: any) => ({
              ...block,
              syncedToGoogleCalendar: false
            }))
          };
          saveTaskToStore(updatedTask, user ? user.uid : null);
          return updatedTask;
        }
        return t;
      });

      setTasks(updatedTasks);
    } catch (err: any) {
      console.error("Scheduling error:", err);
      alert(err.message || "Could not generate an optimized schedule.");
    } finally {
      setIsScheduling(false);
      setSchedulingTaskId(null);
    }
  };

  // WRITE CONFIRMED TIME BLOCKS TO GOOGLE CALENDAR
  const handleSyncToGoogleCalendar = async (task: Task) => {
    if (!token) {
      alert("Please Sign in with Google to allow actual Google Calendar writing!");
      return;
    }

    if (!task.scheduledBlocks || task.scheduledBlocks.length === 0) {
      alert("No time blocks proposed yet. Click 'Plan Schedule with AI' first.");
      return;
    }

    setSyncingTaskId(task.id);
    try {
      const updatedBlocks = [...task.scheduledBlocks];
      
      for (let i = 0; i < updatedBlocks.length; i++) {
        const block = updatedBlocks[i];
        if (block.syncedToGoogleCalendar) continue; // skip already synced ones

        try {
          const eventId = await createCalendarEvent(token, {
            title: `[DeadlineMate] ${block.title}`,
            description: `Planned focus slot generated by DeadlineMate AI.\nRationale: ${block.reason}`,
            start: block.start,
            end: block.end
          });

          updatedBlocks[i] = {
            ...block,
            syncedToGoogleCalendar: true,
            googleEventId: eventId
          };
        } catch (calErr) {
          console.error(`Failed to sync block ${block.title}:`, calErr);
        }
      }

      const updatedTask = {
        ...task,
        scheduledBlocks: updatedBlocks
      };

      await saveTaskToStore(updatedTask, user ? user.uid : null);
      
      setTasks(prev => prev.map(t => t.id === task.id ? updatedTask : t));
      
      // Reload calendar to show the newly added events!
      const freshEvents = await fetchUpcomingEvents(token);
      setCalendarEvents(freshEvents);

      alert("🎉 Time blocks written to your Google Calendar successfully!");
    } catch (err) {
      console.error("Overall syncing failed:", err);
      alert("An error occurred writing blocks to Google Calendar.");
    } finally {
      setSyncingTaskId(null);
    }
  };

  // DELETE TASK
  const handleDeleteTask = async (taskId: string) => {
    await deleteTaskFromStore(taskId, user ? user.uid : null);
    setTasks(prev => prev.filter(t => t.id !== taskId));
    if (expandedTaskId === taskId) {
      setExpandedTaskId(null);
    }
  };

  // HABITS STREAKS TRACKER
  const handleToggleHabit = async (habitId: string) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const updatedHabits = habits.map(h => {
      if (h.id === habitId) {
        let newStreak = h.streak;
        if (h.lastCompletedDate === todayStr) {
          // already checked in today, undo
          newStreak = Math.max(0, h.streak - 1);
          const updated = {
            ...h,
            streak: newStreak,
            lastCompletedDate: ""
          };
          saveHabitToStore(updated, user ? user.uid : null);
          return updated;
        } else {
          // check in today
          newStreak = h.streak + 1;
          const updated = {
            ...h,
            streak: newStreak,
            lastCompletedDate: todayStr
          };
          saveHabitToStore(updated, user ? user.uid : null);
          return updated;
        }
      }
      return h;
    });

    setHabits(updatedHabits);
  };

  const handleAddHabit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const title = data.get("habitTitle") as string;
    if (!title?.trim()) return;

    const newHabit: Habit = {
      id: `habit_${Date.now()}`,
      userId: user ? user.uid : "",
      title: title.trim(),
      streak: 0,
      createdAt: new Date().toISOString()
    };

    await saveHabitToStore(newHabit, user ? user.uid : null);
    setHabits(prev => [...prev, newHabit]);
    e.currentTarget.reset();
  };

  const handleDeleteHabit = async (id: string) => {
    await deleteHabitFromStore(id, user ? user.uid : null);
    setHabits(prev => prev.filter(h => h.id !== id));
  };

  // AGENTIC PUB/SUB EVENT TRIGGER SIMULATION
  const triggerPubSubEvent = async (eventType: string) => {
    // We pick the highest priority active task to generate context
    const activeTasks = tasks.filter(t => t.status === "pending");
    if (activeTasks.length === 0) {
      alert("Please parse/add at least one active task first to simulate a situation-aware nudge!");
      return;
    }

    const prioritySorted = [...activeTasks].sort((a, b) => b.urgencyScore - a.urgencyScore);
    const targetTask = prioritySorted[0];

    try {
      const response = await fetch("/api/generate-nudge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: targetTask, eventType })
      });

      if (!response.ok) {
        throw new Error("Failed to compile contextual nudge.");
      }

      const nudgeData = await response.json();
      
      // Save nudge to history
      const newNudge: Nudge = {
        id: `nudge_${Date.now()}`,
        message: nudgeData.message,
        actionStep: nudgeData.actionStep || targetTask.subtasks[0]?.title || "First Step",
        urgency: nudgeData.urgency || "medium",
        timestamp: new Date().toISOString()
      };

      await saveNudgeToStore(newNudge, user ? user.uid : null);
      setNudges(prev => [newNudge, ...prev]);

      // Pop client toast
      setToast({
        message: nudgeData.message,
        actionStep: nudgeData.actionStep,
        urgency: nudgeData.urgency || "medium"
      });

      // Clear toast automatically in 10s
      setTimeout(() => {
        setToast(null);
      }, 10000);

    } catch (err) {
      console.error("Nudge generation failed:", err);
    }
  };

  // NIGHTLY PERSONALIZED PRODUCTIVITY INSIGHT ENGINE
  const handleRefreshInsights = async () => {
    setInsightLoading(true);
    try {
      const completedCount = tasks.filter(t => t.status === "completed").length;
      
      // construct simple summary of history
      const completedSubtasks = tasks.flatMap(t => t.subtasks.filter(st => st.completed));
      const patterns = completedSubtasks.length > 0 
        ? `Completed ${completedSubtasks.length} specific steps. Most steps marked done during active hours.`
        : "No steps completed yet. User added multiple goals but is looking for a structured startup.";

      const response = await fetch("/api/generate-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completedCount, patternsStr: patterns })
      });

      if (response.ok) {
        const data = await response.json();
        setProductivityInsight(data.insight);
      }
    } catch (err) {
      console.error("Failed to fetch custom insights:", err);
    } finally {
      setInsightLoading(false);
    }
  };

  // Sort tasks: Active first, ordered by Urgency Score descending
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === "pending" ? -1 : 1;
    }
    return b.urgencyScore - a.urgencyScore;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 pb-16">
      
      {/* FLOATING ACTION-AWARE EVENT TOAST */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4"
          >
            <div className={`p-5 rounded-2xl shadow-xl border border-slate-200 border-l-4 bg-white flex flex-col gap-3 ${
              toast.urgency === "high" ? "border-l-red-500 shadow-red-100" : "border-l-indigo-600 shadow-indigo-100"
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex gap-3 items-center">
                  <span className={`p-2 rounded-xl ${
                    toast.urgency === "high" ? "bg-red-50 text-red-500" : "bg-indigo-50 text-indigo-600"
                  }`}>
                    <Bell className="w-5 h-5 animate-bounce" />
                  </span>
                  <div>
                    <h4 className="text-sm font-display font-bold text-slate-900">
                      Proactive Agent Nudge
                    </h4>
                    <p className="text-xs text-slate-400 font-mono">
                      Event triggered successfully
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setToast(null)} 
                  className="text-slate-400 hover:text-slate-600 transition-colors text-xs font-semibold px-2 py-1 hover:bg-slate-50 rounded"
                >
                  Dismiss
                </button>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">
                {toast.message}
              </p>
              {toast.actionStep && (
                <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between border border-slate-100">
                  <div className="flex gap-2 items-center">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-xs text-slate-500 font-medium">Recommended Step:</span>
                    <span className="text-xs text-slate-900 font-semibold">{toast.actionStep}</span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER BAR */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-200">
              DM
            </div>
            <div>
              <h1 className="text-xl font-display font-bold text-slate-950 tracking-tight">
                DeadlineMate
              </h1>
              <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider font-semibold">
                The Last-Minute Life Saver
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {authLoading ? (
              <span className="text-xs text-slate-400 font-mono">Verifying authorization...</span>
            ) : user ? (
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 py-1.5 px-3 rounded-xl">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-semibold text-slate-900 line-clamp-1">{user.displayName || user.email}</span>
                    <span className="text-[10px] text-slate-400 font-mono">Calendar Connected</span>
                  </div>
                </div>
                <button 
                  onClick={handleLogout} 
                  title="Disconnect Google Account"
                  className="p-1.5 hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="gsi-material-button scale-95 origin-right hover:shadow-md transition-shadow"
              >
                <div className="gsi-material-button-state"></div>
                <div className="gsi-material-button-content-wrapper">
                  <div className="gsi-material-button-icon">
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: "block" }}>
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                      <path fill="none" d="M0 0h48v48H0z"></path>
                    </svg>
                  </div>
                  <span className="gsi-material-button-contents font-sans">Sync Google Calendar</span>
                </div>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* SYSTEM AUTH INCENTIVE BANNER */}
      {!user && !authLoading && (
        <div className="bg-indigo-50 border-b border-indigo-100 py-2.5 px-6">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex gap-2.5 items-center">
              <Info className="w-4 h-4 text-indigo-600 shrink-0" />
              <p className="text-xs text-indigo-950 font-medium leading-relaxed text-center sm:text-left">
                <strong>Running in Sandbox Preview Mode:</strong> Sign in with Google above to sync real-time free slots on your <strong>Google Calendar</strong> and lock down <strong>durable Firestore backup</strong>!
              </p>
            </div>
            <button 
              onClick={handleLogin}
              className="text-xs text-indigo-700 font-semibold hover:text-indigo-900 hover:underline transition-all"
            >
              Connect Account →
            </button>
          </div>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <main className="max-w-7xl mx-auto px-6 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* SIDEBAR NAVIGATION COLUMN (3 Cols on Desktop) */}
        <aside className="lg:col-span-3 flex flex-col gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col gap-1.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-2 px-3">
              Workspace Nav
            </p>
            
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all text-xs font-semibold border ${
                activeTab === "dashboard"
                  ? "bg-indigo-50 text-indigo-700 border-indigo-100"
                  : "text-slate-600 hover:bg-slate-50 border-transparent hover:text-slate-900"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Sparkles className={`w-4 h-4 ${activeTab === "dashboard" ? "text-indigo-600" : "text-slate-400"}`} />
                <span>Commitments</span>
              </div>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                activeTab === "dashboard" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"
              }`}>
                {tasks.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("calendar")}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all text-xs font-semibold border ${
                activeTab === "calendar"
                  ? "bg-indigo-50 text-indigo-700 border-indigo-100"
                  : "text-slate-600 hover:bg-slate-50 border-transparent hover:text-slate-900"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <CalendarDays className={`w-4 h-4 ${activeTab === "calendar" ? "text-indigo-600" : "text-slate-400"}`} />
                <span>Time & Habits</span>
              </div>
              {habits.length > 0 && (
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                  activeTab === "calendar" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"
                }`}>
                  {habits.filter(h => h.lastCompletedDate === new Date().toISOString().split("T")[0]).length}/{habits.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("nudges")}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all text-xs font-semibold border ${
                activeTab === "nudges"
                  ? "bg-indigo-50 text-indigo-700 border-indigo-100"
                  : "text-slate-600 hover:bg-slate-50 border-transparent hover:text-slate-900"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Zap className={`w-4 h-4 ${activeTab === "nudges" ? "text-indigo-600" : "text-slate-400"}`} />
                <span>AI Proactive Agent</span>
              </div>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                activeTab === "nudges" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"
              }`}>
                {nudges.length}
              </span>
            </button>
          </div>

          {/* USER SYNC STATUS MINI WIDGET */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs text-slate-500 flex flex-col gap-2.5">
            <div className="flex items-center justify-between border-b border-slate-200/50 pb-2">
              <span className="font-bold text-slate-700">Sync Status</span>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <span className="font-medium">Cloud Backup:</span>
                <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${user ? "text-emerald-700 bg-emerald-50 border border-emerald-200" : "text-amber-700 bg-amber-50 border border-amber-200"}`}>{user ? "ACTIVE" : "LOCAL ONLY"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Google Calendar:</span>
                <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${user ? "text-emerald-700 bg-emerald-50 border border-emerald-200" : "text-slate-600 bg-slate-100 border border-slate-200"}`}>{user ? "CONNECTED" : "OFFLINE"}</span>
              </div>
            </div>
          </div>
        </aside>

        {/* CONTENT ZONE (9 Cols on Desktop) */}
        <section className="lg:col-span-9 flex flex-col gap-6">

          {/* TAB 1: COMMITMENT WORKSPACE */}
          {activeTab === "dashboard" && (
            <div className="flex flex-col gap-6">
          
          {/* TASK GENERATOR/PARSER CARD */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:border-slate-300 transition-colors">
            <h2 className="text-lg font-display font-bold text-slate-900 mb-2 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              Capture Goal & Commitments
            </h2>
            <p className="text-sm text-slate-500 mb-4 leading-relaxed">
              State what needs to be done, when it is due, or standard parameters. Let Gemini prioritize, break it down, and draft resources.
            </p>

            <form onSubmit={handleCreateTask} className="flex flex-col gap-4">
              <div className="relative">
                <textarea
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  placeholder='e.g., "I have a detailed client presentation due this Friday afternoon that requires outline drafting, slide creation, and dry run review."'
                  className="w-full min-h-[90px] p-4 pr-12 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50 resize-y"
                  disabled={isParsing}
                />
                
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`absolute right-4 bottom-4 p-2 rounded-xl transition-all ${
                    isListening 
                      ? "bg-red-500 text-white animate-pulse" 
                      : "bg-slate-100 hover:bg-slate-200 text-slate-500"
                  }`}
                  title={isListening ? "Stop listening" : "Dictate via voice input"}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              </div>

              {isListening && (
                <div className="flex items-center gap-2 px-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                  <span className="text-xs text-red-600 font-semibold font-mono animate-pulse">
                    Voice activation active... Dictate commitment details
                  </span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTaskInput("Prepare outline and schedule a sync with legal by next Monday.")}
                    className="text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 hover:border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg transition-all font-semibold shadow-xs"
                  >
                    💡 Sync with Legal
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskInput("Need to review the draft proposal before Thursday 3 PM.")}
                    className="text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 hover:border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg transition-all font-semibold shadow-xs"
                  >
                    💡 Review Proposal
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isParsing || !taskInput.trim()}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white text-sm font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  {isParsing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Gemini Decomposing Goal...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Parse & Prioritize with AI
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* ACTIVE TASKS CONTAINER */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                AI-Prioritized Commitment Queue ({tasks.length})
              </h3>
              <p className="text-xs text-slate-400 font-mono font-medium">
                Ranked by Urgency Score
              </p>
            </div>

            {sortedTasks.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-10 text-center flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">No Commitments Active</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    Enter some goal text above or click a quick suggestion to let DeadlineMate generate a step-by-step custom execution timeline.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {sortedTasks.map((task) => {
                  const isExpanded = expandedTaskId === task.id;
                  const isCompleted = task.status === "completed";
                  const pendingSubtasks = task.subtasks.filter(st => !st.completed).length;

                  return (
                    <div 
                      key={task.id} 
                      className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden relative ${
                        isCompleted 
                          ? "border-emerald-100 bg-emerald-50/10 shadow-sm opacity-90" 
                          : isExpanded 
                            ? "border-indigo-500 shadow-md ring-1 ring-indigo-500/10" 
                            : "border-slate-200 hover:border-indigo-300 shadow-sm"
                      }`}
                    >
                      {/* Left Accent Bar */}
                      {!isCompleted && (
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                          task.urgencyScore >= 75 ? "bg-orange-500" : task.urgencyScore >= 45 ? "bg-amber-500" : "bg-indigo-600"
                        }`} />
                      )}

                      {/* CARD BAR */}
                      <div 
                        className="p-6 flex items-start justify-between gap-4 cursor-pointer select-none"
                        onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                      >
                        <div className="flex items-start gap-3.5 pl-2">
                          {/* CHECK BOX TO TOGGLE COMPLETE ENTIRE TASK */}
                          <div 
                            className="mt-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className={`block w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                              isCompleted 
                                ? "bg-emerald-500 border-emerald-600 text-white" 
                                : "border-slate-300 hover:border-indigo-500 bg-white text-transparent"
                            }`}>
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </span>
                          </div>

                          <div>
                            <h4 className={`text-lg font-bold text-slate-800 leading-snug ${isCompleted ? "line-through text-slate-400" : ""}`}>
                              {task.title}
                            </h4>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2">
                              <span className="text-xs font-mono font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100/60 px-2.5 py-0.5 rounded-lg">
                                Due {task.dueDate}
                              </span>
                              
                              <span className="text-slate-300 text-xs">•</span>

                              <span className="text-xs text-slate-500 font-mono">
                                {pendingSubtasks} of {task.subtasks.length} steps left
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
                          {!isCompleted && (
                            <div className="text-right shrink-0">
                              <div className={`text-2xl font-black leading-none ${
                                task.urgencyScore >= 75 
                                  ? "text-orange-600" 
                                  : task.urgencyScore >= 45 
                                    ? "text-amber-600" 
                                    : "text-slate-400"
                              }`}>
                                {(task.urgencyScore / 10).toFixed(1)}
                              </div>
                              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">Urgency</div>
                            </div>
                          )}

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              className="p-1.5 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-lg transition-colors"
                              title="Delete task"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            
                            <button
                              onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                              className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* EXPANDABLE BODY */}
                      {isExpanded && (
                        <div className="border-t border-slate-200 bg-slate-50/50 p-6 flex flex-col gap-6">
                          {/* BRIEF */}
                          {task.description && (
                            <div>
                              <h5 className="text-xs font-bold text-slate-400 font-mono uppercase tracking-widest mb-1.5">
                                AI Context Summary
                              </h5>
                              <p className="text-sm text-slate-600 leading-relaxed bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                                {task.description}
                              </p>
                            </div>
                          )}
                                            {/* SUBTASKS CHECKLIST */}
                          <div>
                            <h5 className="text-xs font-bold text-slate-400 font-mono uppercase tracking-widest mb-2.5">
                              Ordered Checklists & Starter Contents
                            </h5>
                            <div className="flex flex-col gap-3">
                              {task.subtasks.map((st) => {
                                const isStarterExpanded = expandedStarterId === `${task.id}_${st.id}`;
                                return (
                                  <div 
                                    key={st.id} 
                                    className={`bg-white border rounded-xl overflow-hidden shadow-xs transition-all ${
                                      st.completed 
                                        ? "border-emerald-100/70 bg-emerald-50/5 opacity-75" 
                                        : "border-slate-200 hover:border-indigo-100"
                                    }`}
                                  >
                                    <div className="p-3.5 flex items-start justify-between gap-3">
                                      <div className="flex gap-3 items-center">
                                        <button
                                          onClick={() => handleToggleSubtask(task.id, st.id)}
                                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                            st.completed 
                                              ? "bg-emerald-500 border-emerald-600 text-white" 
                                              : "border-slate-300 hover:border-indigo-500 bg-white text-transparent"
                                          }`}
                                        >
                                          <Check className="w-3 h-3 stroke-[3]" />
                                        </button>
                                        <div>
                                          <span className={`text-sm font-semibold ${st.completed ? "line-through text-slate-400" : "text-slate-800"}`}>
                                            {st.title}
                                          </span>
                                          <span className="ml-2 text-[10px] font-mono text-slate-400 font-bold bg-slate-50 border border-slate-200/60 px-1.5 py-0.5 rounded">
                                            {st.estimatedMinutes} mins
                                          </span>
                                        </div>
                                      </div>

                                      {st.starterContent && (
                                        <button
                                          onClick={() => setExpandedStarterId(isStarterExpanded ? null : `${task.id}_${st.id}`)}
                                          className="text-xs text-indigo-600 font-semibold hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded"
                                        >
                                          <FileText className="w-3.5 h-3.5" />
                                          {isStarterExpanded ? "Hide Draft" : "View Starter Draft"}
                                        </button>
                                      )}
                                    </div>

                                    {/* STARTER CONTENT DRAWER */}
                                    {isStarterExpanded && st.starterContent && (
                                      <div className="px-4 pb-4 pt-1 border-t border-slate-100 bg-indigo-50/10">
                                        <div className="flex items-center justify-between mb-2 pb-1 border-b border-indigo-100/30">
                                          <span className="text-[10px] font-mono font-bold text-indigo-500 uppercase tracking-wider">
                                            Starter Resource Drafted by Gemini
                                          </span>
                                          <button 
                                            onClick={() => {
                                              navigator.clipboard.writeText(st.starterContent);
                                              alert("Resource copied to clipboard!");
                                            }}
                                            className="text-[10px] text-slate-400 hover:text-indigo-600 font-bold font-mono"
                                          >
                                            [Copy Content]
                                          </button>
                                        </div>
                                        <div className="prose prose-sm max-w-none text-xs text-slate-600 leading-relaxed font-sans">
                                          <Markdown>{st.starterContent}</Markdown>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* SCHEDULER BLOCK INTEGRATION */}
                          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                              <div className="flex items-center gap-2">
                                <CalendarIcon className="w-4.5 h-4.5 text-indigo-600" />
                                <h5 className="text-xs font-bold text-slate-400 font-mono uppercase tracking-widest">
                                  Google Calendar Time Blocking
                                </h5>
                              </div>
                              <span className="text-[10px] bg-slate-50 font-mono border border-slate-200 px-2 py-0.5 rounded text-slate-500 font-semibold">
                                energy: {energyPattern}
                              </span>
                            </div>

                            {(!task.scheduledBlocks || task.scheduledBlocks.length === 0) ? (
                              <div className="text-center py-4">
                                <p className="text-xs text-slate-400 mb-3 max-w-sm mx-auto leading-relaxed">
                                  Let Gemini read your busy commitments, respect your working hours, and find perfect, dedicated focus gaps.
                                </p>
                                <button
                                  onClick={() => handlePlanSchedule(task)}
                                  disabled={isScheduling && schedulingTaskId === task.id}
                                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white text-xs font-semibold rounded-lg flex items-center gap-2 mx-auto transition-colors cursor-pointer"
                                >
                                  {isScheduling && schedulingTaskId === task.id ? (
                                    <>
                                      <RefreshCw className="w-3 h-3 animate-spin" />
                                      Synthesizing Open Gaps...
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="w-3.5 h-3.5" />
                                      Plan Focus Blocks with AI
                                    </>
                                  )}
                                </button>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-3">
                                <div className="text-xs text-indigo-950 font-semibold leading-relaxed bg-indigo-50 border border-indigo-100 p-3 rounded-lg">
                                  ⚡ Gemini scanned your calendar and identified these gap blocks for optimal flow:
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {task.scheduledBlocks.map((block, idx) => (
                                    <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col gap-2 relative shadow-xs hover:border-indigo-200 transition-colors">
                                      <div className="flex items-start justify-between gap-1">
                                        <h6 className="text-xs font-bold text-slate-800 line-clamp-1">{block.title}</h6>
                                        <span className={`shrink-0 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                                          block.syncedToGoogleCalendar 
                                            ? "text-emerald-700 bg-emerald-100 border border-emerald-200" 
                                            : "text-amber-700 bg-amber-100 border border-amber-200"
                                        }`}>
                                          {block.syncedToGoogleCalendar ? "Synced" : "Pending Sync"}
                                        </span>
                                      </div>
                                      <div className="text-[11px] font-mono text-indigo-600 font-bold flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {new Date(block.start).toLocaleDateString()} {new Date(block.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </div>
                                      <p className="text-[10px] text-slate-500 italic leading-relaxed">
                                        "{block.reason}"
                                      </p>
                                    </div>
                                  ))}
                                </div>

                                <div className="flex justify-end gap-3 pt-2">
                                  <button
                                    onClick={() => handlePlanSchedule(task)}
                                    disabled={isScheduling && schedulingTaskId === task.id}
                                    className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all cursor-pointer"
                                  >
                                    {isScheduling && schedulingTaskId === task.id ? "Synthesizing..." : "Re-Plan with AI"}
                                  </button>

                                  <button
                                    onClick={() => handleSyncToGoogleCalendar(task)}
                                    disabled={syncingTaskId === task.id}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                                  >
                                    {syncingTaskId === task.id ? (
                                      <>
                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                        Syncing Events...
                                      </>
                                    ) : (
                                      <>
                                        <Zap className="w-3.5 h-3.5" />
                                        Confirm & Write to Calendar
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          </div>
        )}

        {/* TAB 2: TIME & HABITS */}
        {activeTab === "calendar" && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* LEFT SUBCOLUMN (7 Cols): CALENDAR PREVIEW & PREFERENCES */}
            <div className="md:col-span-7 flex flex-col gap-6">
              
              {/* CALENDAR VIEW */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <CalendarDays className="w-4 h-4 text-indigo-600" />
                  Your Calendar Status
                </h3>

                {calendarLoading ? (
                  <div className="text-center py-6">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-600 mb-1.5" />
                    <span className="text-[11px] text-slate-400 font-mono">Synchronizing events...</span>
                  </div>
                ) : calendarEvents.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400">
                    No calendar events identified. Sync your account.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                    {calendarEvents.map((e) => (
                      <div key={e.id} className="p-3 border border-slate-200 hover:border-slate-300 bg-slate-50/50 rounded-xl text-xs flex justify-between items-center gap-3">
                        <span className="font-semibold text-slate-700 line-clamp-1">{e.summary}</span>
                        <span className="shrink-0 font-mono text-[9px] text-slate-400 border border-slate-200 bg-white px-2 py-0.5 rounded">
                          {e.start.dateTime ? new Date(e.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "All Day"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* PREFERENCES FORM */}
                <div className="mt-4 pt-4 border-t border-slate-200 flex flex-col gap-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Focus Engine Preferences</h4>
                  
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Focus Pattern Preference</label>
                    <select 
                      value={energyPattern} 
                      onChange={(e) => setEnergyPattern(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="morning focus">Morning Focus (09:00 - 12:00 Peaks)</option>
                      <option value="night owl">Night Owl (18:00 - 21:00 Focus)</option>
                      <option value="afternoon sprint">Afternoon Sprint (14:00 - 17:00 Flow)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Work Starts</label>
                      <input 
                        type="text" 
                        value={workingHours.start} 
                        onChange={(e) => setWorkingHours(prev => ({ ...prev, start: e.target.value }))}
                        className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-center text-slate-700 font-semibold focus:outline-none"
                        placeholder="09:00"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Work Ends</label>
                      <input 
                        type="text" 
                        value={workingHours.end} 
                        onChange={(e) => setWorkingHours(prev => ({ ...prev, end: e.target.value }))}
                        className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-center text-slate-700 font-semibold focus:outline-none"
                        placeholder="17:00"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT SUBCOLUMN (5 Cols): HABITS */}
            <div className="md:col-span-5 flex flex-col gap-6">
              
              {/* HABITS TRACKER */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <Award className="w-4 h-4 text-indigo-600" />
                  Goal & Habit Streaks
                </h3>

                <div className="flex flex-col gap-2.5">
                  {habits.map((h) => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const checkedInToday = h.lastCompletedDate === todayStr;

                    return (
                      <div key={h.id} className="flex items-center justify-between p-3 bg-slate-50/50 border border-slate-200/60 rounded-xl">
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            onClick={() => handleToggleHabit(h.id)}
                            className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                              checkedInToday 
                                ? "bg-indigo-600 border-indigo-700 text-white" 
                                : "border-slate-300 hover:border-indigo-500 bg-white text-transparent"
                            }`}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </button>
                          <span className={`text-xs font-semibold text-slate-700 line-clamp-1 ${checkedInToday ? "line-through text-slate-400" : ""}`}>
                            {h.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <span className="text-[10px] font-mono font-bold text-orange-700 bg-orange-100 border border-orange-200 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                            🔥 {h.streak}d
                          </span>
                          <button 
                            onClick={() => handleDeleteHabit(h.id)}
                            className="text-slate-300 hover:text-red-500 transition-colors p-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  <form onSubmit={handleAddHabit} className="flex gap-2 mt-2">
                    <input
                      type="text"
                      name="habitTitle"
                      placeholder="Create custom habit..."
                      className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50 hover:border-slate-300 font-semibold text-slate-700"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shrink-0 cursor-pointer transition-all shadow-xs"
                    >
                      Add
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PROACTIVE AGENT LOGS & INSIGHTS */}
        {activeTab === "nudges" && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* TRIGGER PANEL (5 Cols) */}
            <div className="md:col-span-5 flex flex-col gap-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg text-white">
                <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-1.5 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-indigo-400 animate-pulse" />
                  Proactive Agent Trigger Panel
                </h3>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                  DeadlineMate acts autonomously on real-world event streams. Trigger Pub/Sub events below to see the agent generate custom, situational nudges!
                </p>

                <div className="flex flex-col gap-2.5">
                  <button
                    onClick={() => triggerPubSubEvent("calendar_gap")}
                    className="w-full p-3 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-xl text-left transition-all text-xs flex flex-col gap-1 cursor-pointer hover:border-indigo-500/50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-indigo-300">📅 Calendar Gap Opened</span>
                      <span className="text-[8px] font-mono text-indigo-400 border border-indigo-500/30 px-1 rounded">Pub/Sub</span>
                    </div>
                    <span className="text-[10px] text-slate-400">Generates advice to utilize a newly found open time gap.</span>
                  </button>

                  <button
                    onClick={() => triggerPubSubEvent("deadline_risk")}
                    className="w-full p-3 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-xl text-left transition-all text-xs flex flex-col gap-1 cursor-pointer hover:border-indigo-500/50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-red-300">⚠️ Impending Deadline Risk</span>
                      <span className="text-[8px] font-mono text-red-400 border border-red-500/30 px-1 rounded">Pub/Sub</span>
                    </div>
                    <span className="text-[10px] text-slate-400">Fires when less than 24h are left and key steps remain undone.</span>
                  </button>

                  <button
                    onClick={() => triggerPubSubEvent("inactivity")}
                    className="w-full p-3 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-xl text-left transition-all text-xs flex flex-col gap-1 cursor-pointer hover:border-indigo-500/50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-amber-300">⏳ User Inactivity Alert</span>
                      <span className="text-[8px] font-mono text-amber-400 border border-amber-500/30 px-1 rounded">Pub/Sub</span>
                    </div>
                    <span className="text-[10px] text-slate-400">Triggers when there is no app engagement on critical items.</span>
                  </button>
                </div>
              </div>
            </div>

            {/* LOGS & INSIGHTS (7 Cols) */}
            <div className="md:col-span-7 flex flex-col gap-6">
              
              {/* NIGHTLY PERSONALIZED ADVISOR TIPS */}
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-6 shadow-xs">
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-xs font-bold text-indigo-900 font-mono uppercase tracking-widest">
                    Nightly Productivity Advisor
                  </h3>
                  <button 
                    onClick={handleRefreshInsights}
                    disabled={insightLoading}
                    className="text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                    title="Refresh Insight Engine"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${insightLoading ? "animate-spin" : ""}`} />
                  </button>
                </div>

                <div className="text-xs text-indigo-950 leading-relaxed font-semibold bg-white border border-indigo-100 p-4 rounded-xl shadow-xs">
                  {productivityInsight}
                </div>
              </div>

              {/* NUDGE TIMELINE LIST */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <Bell className="w-4 h-4 text-indigo-600" />
                  Nudge Dispatched Logs ({nudges.length})
                </h3>

                {nudges.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center">
                    No nudges captured. Use the Proactive Trigger Panel to fire event streams!
                  </p>
                ) : (
                  <div className="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                    {nudges.map((n) => (
                      <div key={n.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/30 text-xs flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                            n.urgency === "high" 
                              ? "text-red-700 bg-red-100 border border-red-200" 
                              : "text-indigo-700 bg-indigo-100 border border-indigo-200"
                          }`}>
                            {n.urgency} risk
                          </span>
                          <span className="text-[9px] font-mono text-slate-400">
                            {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-slate-700 leading-relaxed font-medium">{n.message}</p>
                        {n.actionStep && (
                          <span className="text-[10px] text-indigo-600 font-bold font-mono">
                            → Focus step: {n.actionStep}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

      </section>

    </main>

    </div>
  );
}
