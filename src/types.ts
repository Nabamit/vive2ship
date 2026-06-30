export interface SubTask {
  id: string;
  title: string;
  estimatedMinutes: number;
  starterContent: string;
  completed: boolean;
  completedAt?: string;
}

export interface ScheduledBlock {
  subtaskId: string;
  title: string;
  start: string; // ISO String
  end: string; // ISO String
  reason: string;
  syncedToGoogleCalendar?: boolean;
  googleEventId?: string;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  dueDate: string; // YYYY-MM-DD
  priority: "High" | "Medium" | "Low";
  urgencyScore: number;
  effort: "low" | "medium" | "high";
  importance: number;
  description: string;
  originalInput: string;
  status: "pending" | "completed";
  createdAt: string;
  subtasks: SubTask[];
  scheduledBlocks?: ScheduledBlock[];
}

export interface Habit {
  id: string;
  userId: string;
  title: string;
  streak: number;
  lastCompletedDate?: string; // YYYY-MM-DD
  createdAt: string;
}

export interface Nudge {
  id: string;
  message: string;
  actionStep: string;
  urgency: "low" | "medium" | "high";
  timestamp: string;
}
