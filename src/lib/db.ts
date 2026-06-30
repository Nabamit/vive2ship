import { db, auth } from "./firebase";
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  deleteDoc, 
  orderBy,
  updateDoc
} from "firebase/firestore";
import { Task, Habit, Nudge } from "../types";

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const isPermissionError = (err: any) => {
  if (!err) return false;
  return err.code === 'permission-denied' || 
         (err.message && err.message.toLowerCase().includes('permission')) ||
         String(err).toLowerCase().includes('permission');
};

// FALLBACK LOCALSTORAGE KEYS
const LOCAL_TASKS_KEY = "deadlinemate_tasks";
const LOCAL_HABITS_KEY = "deadlinemate_habits";
const LOCAL_NUDGES_KEY = "deadlinemate_nudges";

// HELPER FOR TASKS
export const saveTaskToStore = async (task: Task, userId: string | null): Promise<void> => {
  if (userId) {
    try {
      const taskRef = doc(db, "tasks", task.id);
      await setDoc(taskRef, { ...task, userId });
    } catch (err: any) {
      if (isPermissionError(err)) {
        handleFirestoreError(err, OperationType.WRITE, `tasks/${task.id}`);
      }
      console.error("Firestore error saving task:", err);
      saveTaskLocally(task);
    }
  } else {
    saveTaskLocally(task);
  }
};

const saveTaskLocally = (task: Task) => {
  const localTasks = getTasksLocally();
  const index = localTasks.findIndex(t => t.id === task.id);
  if (index >= 0) {
    localTasks[index] = task;
  } else {
    localTasks.push(task);
  }
  localStorage.setItem(LOCAL_TASKS_KEY, JSON.stringify(localTasks));
};

export const getTasksFromStore = async (userId: string | null): Promise<Task[]> => {
  if (userId) {
    try {
      const q = query(collection(db, "tasks"), where("userId", "==", userId), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const tasks: Task[] = [];
      snapshot.forEach(docSnap => {
        tasks.push(docSnap.data() as Task);
      });
      return tasks;
    } catch (err: any) {
      if (isPermissionError(err)) {
        handleFirestoreError(err, OperationType.LIST, "tasks");
      }
      console.error("Firestore error getting tasks:", err);
      return getTasksLocally();
    }
  } else {
    return getTasksLocally();
  }
};

const getTasksLocally = (): Task[] => {
  const data = localStorage.getItem(LOCAL_TASKS_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const deleteTaskFromStore = async (taskId: string, userId: string | null): Promise<void> => {
  if (userId) {
    try {
      await deleteDoc(doc(db, "tasks", taskId));
    } catch (err: any) {
      if (isPermissionError(err)) {
        handleFirestoreError(err, OperationType.DELETE, `tasks/${taskId}`);
      }
      console.error("Firestore error deleting task:", err);
      deleteTaskLocally(taskId);
    }
  } else {
    deleteTaskLocally(taskId);
  }
};

const deleteTaskLocally = (taskId: string) => {
  const localTasks = getTasksLocally();
  const filtered = localTasks.filter(t => t.id !== taskId);
  localStorage.setItem(LOCAL_TASKS_KEY, JSON.stringify(filtered));
};

// HELPER FOR HABITS
export const saveHabitToStore = async (habit: Habit, userId: string | null): Promise<void> => {
  if (userId) {
    try {
      const habitRef = doc(db, "habits", habit.id);
      await setDoc(habitRef, { ...habit, userId });
    } catch (err: any) {
      if (isPermissionError(err)) {
        handleFirestoreError(err, OperationType.WRITE, `habits/${habit.id}`);
      }
      console.error("Firestore error saving habit:", err);
      saveHabitLocally(habit);
    }
  } else {
    saveHabitLocally(habit);
  }
};

const saveHabitLocally = (habit: Habit) => {
  const habits = getHabitsLocally();
  const index = habits.findIndex(h => h.id === habit.id);
  if (index >= 0) {
    habits[index] = habit;
  } else {
    habits.push(habit);
  }
  localStorage.setItem(LOCAL_HABITS_KEY, JSON.stringify(habits));
};

export const getHabitsFromStore = async (userId: string | null): Promise<Habit[]> => {
  if (userId) {
    try {
      const q = query(collection(db, "habits"), where("userId", "==", userId));
      const snapshot = await getDocs(q);
      const habits: Habit[] = [];
      snapshot.forEach(docSnap => {
        habits.push(docSnap.data() as Habit);
      });
      return habits;
    } catch (err: any) {
      if (isPermissionError(err)) {
        handleFirestoreError(err, OperationType.LIST, "habits");
      }
      console.error("Firestore error getting habits:", err);
      return getHabitsLocally();
    }
  } else {
    return getHabitsLocally();
  }
};

const getHabitsLocally = (): Habit[] => {
  const data = localStorage.getItem(LOCAL_HABITS_KEY);
  if (!data) {
    const initialHabits: Habit[] = [
      { id: "h1", userId: "", title: "Check Calendar mornings", streak: 3, lastCompletedDate: "", createdAt: new Date().toISOString() },
      { id: "h2", userId: "", title: "Complete at least 1 subtask before noon", streak: 5, lastCompletedDate: "", createdAt: new Date().toISOString() }
    ];
    localStorage.setItem(LOCAL_HABITS_KEY, JSON.stringify(initialHabits));
    return initialHabits;
  }
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const deleteHabitFromStore = async (habitId: string, userId: string | null): Promise<void> => {
  if (userId) {
    try {
      await deleteDoc(doc(db, "habits", habitId));
    } catch (err: any) {
      if (isPermissionError(err)) {
        handleFirestoreError(err, OperationType.DELETE, `habits/${habitId}`);
      }
      console.error("Firestore error deleting habit:", err);
      deleteHabitLocally(habitId);
    }
  } else {
    deleteHabitLocally(habitId);
  }
};

const deleteHabitLocally = (habitId: string) => {
  const habits = getHabitsLocally();
  const filtered = habits.filter(h => h.id !== habitId);
  localStorage.setItem(LOCAL_HABITS_KEY, JSON.stringify(filtered));
};

// HELPER FOR NUDGES
export const saveNudgeToStore = async (nudge: Nudge, userId: string | null): Promise<void> => {
  if (userId) {
    try {
      const nudgeRef = doc(db, "nudges", nudge.id);
      await setDoc(nudgeRef, { ...nudge, userId });
    } catch (err: any) {
      if (isPermissionError(err)) {
        handleFirestoreError(err, OperationType.WRITE, `nudges/${nudge.id}`);
      }
      console.error("Firestore error saving nudge:", err);
      saveNudgeLocally(nudge);
    }
  } else {
    saveNudgeLocally(nudge);
  }
};

const saveNudgeLocally = (nudge: Nudge) => {
  const nudges = getNudgesLocally();
  nudges.unshift(nudge);
  localStorage.setItem(LOCAL_NUDGES_KEY, JSON.stringify(nudges.slice(0, 20)));
};

export const getNudgesFromStore = async (userId: string | null): Promise<Nudge[]> => {
  if (userId) {
    try {
      const q = query(collection(db, "nudges"), where("userId", "==", userId), orderBy("timestamp", "desc"));
      const snapshot = await getDocs(q);
      const nudges: Nudge[] = [];
      snapshot.forEach(docSnap => {
        nudges.push(docSnap.data() as Nudge);
      });
      return nudges;
    } catch (err: any) {
      if (isPermissionError(err)) {
        handleFirestoreError(err, OperationType.LIST, "nudges");
      }
      console.error("Firestore error getting nudges:", err);
      return getNudgesLocally();
    }
  } else {
    return getNudgesLocally();
  }
};

export const getNudgesLocally = (): Nudge[] => {
  const data = localStorage.getItem(LOCAL_NUDGES_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
};
