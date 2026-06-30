import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini client using the modern SDK
// Uses GEMINI_API_KEY from environment with correct telemetry User-Agent header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build'
    }
  }
});

// API Route 1: Parse and prioritize tasks using Gemini
app.post("/api/parse-task", async (req, res) => {
  try {
    const { originalInput, currentDate } = req.body;
    if (!originalInput) {
      return res.status(400).json({ error: "No task input provided" });
    }

    const todayStr = currentDate || new Date().toISOString().split('T')[0];

    const prompt = `Analyze this raw task input, commitment, or goal: "${originalInput}"
Today's date is: ${todayStr}.
Parse this into a structured task object. If no due date is mentioned, estimate a realistic one (usually 3 days from now).
Decompose the task into realistic, actionable subtasks/steps (maximum 6 steps). For each step, estimate the duration in minutes, and draft brief starter content (e.g., an outline, checklist of documents, email template, or first line of a draft) that can help the user get started immediately.
Also prioritize the task: estimate its urgency (1 to 100), importance (1 to 100), and effort required (low, medium, high).

Return JSON only, matching this TypeScript interface exactly without any surrounding markdown formatting or text:
{
  "title": "string",
  "dueDate": "YYYY-MM-DD",
  "priority": "High" | "Medium" | "Low",
  "urgencyScore": number, // 1 to 100
  "effort": "low" | "medium" | "high",
  "importance": number, // 1 to 100
  "description": "string",
  "subtasks": [
    {
      "id": "string", // short unique identifier, e.g. "step1", "step2"
      "title": "string",
      "estimatedMinutes": number,
      "starterContent": "string" // Markdown formatted draft / outline / email or checklist
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("Empty response from Gemini API");
    }

    const parsedData = JSON.parse(text.trim());
    res.json(parsedData);
  } catch (error: any) {
    console.error("Error in /api/parse-task:", error);
    res.status(500).json({ error: error.message || "Failed to parse task" });
  }
});

// API Route 2: Propose realistic schedule blocks using Gemini reasoning
app.post("/api/propose-schedule", async (req, res) => {
  try {
    const { taskTitle, subtasks, calendarBusySlots, workingHours, userEnergyPattern, currentDate } = req.body;
    if (!taskTitle || !subtasks || !Array.isArray(subtasks)) {
      return res.status(400).json({ error: "Task or subtasks missing" });
    }

    const todayStr = currentDate || new Date().toISOString().split('T')[0];
    const busySlotsJson = JSON.stringify(calendarBusySlots || []);
    const workingHoursStr = JSON.stringify(workingHours || { start: "09:00", end: "17:00" });

    const prompt = `You are DeadlineMate, an agentic AI schedule organizer.
Today is ${todayStr}.
You need to find free time blocks on the user's Google Calendar to schedule the following subtasks for the task: "${taskTitle}".
Subtasks to schedule:
${JSON.stringify(subtasks)}

User parameters:
- Working hours: ${workingHoursStr} (Only schedule blocks within these local hours)
- Energy focus pattern: "${userEnergyPattern || "morning focus"}" (Prioritize harder steps or initial steps during their preferred focus times)
- Busy calendar slots to avoid: ${busySlotsJson} (Do NOT overlap scheduled blocks with these times)

Plan out the blocks starting from today (${todayStr}) onwards. Try to spread them out logically so the user isn't overwhelmed but finishes before the task deadlines.
For each subtask, determine a start and end time in ISO-8601 format (e.g., '2026-06-30T10:00:00').

Return JSON only, matching this structure exactly:
{
  "proposedBlocks": [
    {
      "subtaskId": "string",
      "title": "string",
      "start": "string", // ISO 8601 DateTime
      "end": "string", // ISO 8601 DateTime
      "reason": "string" // friendly rationale explaining why this slot is perfect (e.g., "morning focus period", "open gap before your meeting", etc.)
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("Empty response from Gemini API");
    }

    const parsedData = JSON.parse(text.trim());
    res.json(parsedData);
  } catch (error: any) {
    console.error("Error in /api/propose-schedule:", error);
    res.status(500).json({ error: error.message || "Failed to propose schedule" });
  }
});

// API Route 3: Generate situational context-aware nudges
app.post("/api/generate-nudge", async (req, res) => {
  try {
    const { task, eventType } = req.body;
    if (!task) {
      return res.status(400).json({ error: "Task data is missing" });
    }

    const prompt = `You are DeadlineMate, a highly proactive, friendly, and persistent agent.
Generate an engaging, context-aware nudge (notification) for the user.
Context:
- Task: "${task.title}"
- Subtasks & status: ${JSON.stringify(task.subtasks || [])}
- Trigger event: "${eventType}" (Values can be 'calendar_gap', 'deadline_risk', 'inactivity')

Description of trigger events:
- 'calendar_gap': An unexpected free gap in their calendar has opened up. Encourage them to take advantage of it now to make progress on a specific step.
- 'deadline_risk': The task deadline is looming (e.g. tomorrow) and multiple steps are still incomplete. Spark motivation without inducing panic, telling them what step is the next quick win.
- 'inactivity': The user has been quiet for some days. Offer a gentle, friendly kick-off nudge.

Make the nudge sound fresh, situational, and directly tie it to the first incomplete subtask.
Return JSON only:
{
  "message": "string", // The engaging nudge message (1-2 sentences)
  "actionStep": "string", // Title of the specific subtask they should do
  "urgency": "low" | "medium" | "high"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("Empty response from Gemini API");
    }

    const parsedData = JSON.parse(text.trim());
    res.json(parsedData);
  } catch (error: any) {
    console.error("Error in /api/generate-nudge:", error);
    res.status(500).json({ error: error.message || "Failed to generate nudge" });
  }
});

// API Route 4: Generate daily personalized productivity insight
app.post("/api/generate-insight", async (req, res) => {
  try {
    const { completedCount, patternsStr } = req.body;

    const prompt = `You are DeadlineMate's nightly productivity advisor.
Analyze the user's progress summary:
- Completed tasks recently: ${completedCount || 0}
- Completion notes / observed habits: "${patternsStr || "completed most steps during morning periods, postponed evening tasks"}"

Generate a short, smart, highly personalized productivity insight (1-2 sentences) suggesting an actionable habit adjustment (e.g., 'You completed 80% of your writing tasks before noon. Let's start blocking mornings for these by default so you're always ahead of schedule.').
Return JSON only:
{
  "insight": "string"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("Empty response from Gemini API");
    }

    const parsedData = JSON.parse(text.trim());
    res.json(parsedData);
  } catch (error: any) {
    console.error("Error in /api/generate-insight:", error);
    res.status(500).json({ error: error.message || "Failed to generate insight" });
  }
});

// Vite Middleware & Static Serving Setup
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

start();
