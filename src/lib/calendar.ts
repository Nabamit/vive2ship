export interface CalendarEvent {
  id: string;
  summary: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
}

// Fetch calendar events for the next 7 days
export const fetchUpcomingEvents = async (accessToken: string): Promise<CalendarEvent[]> => {
  try {
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`;
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Google Calendar API error:", errText);
      throw new Error(`Calendar fetch failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error("Error in fetchUpcomingEvents:", error);
    throw error;
  }
};

// Write a schedule block to Google Calendar
export const createCalendarEvent = async (
  accessToken: string,
  eventData: {
    title: string;
    description: string;
    start: string; // ISO 8601 string
    end: string; // ISO 8601 string
  }
): Promise<string> => {
  try {
    const url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
    
    const body = {
      summary: eventData.title,
      description: eventData.description,
      start: {
        dateTime: eventData.start,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      },
      end: {
        dateTime: eventData.end,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      },
      reminders: {
        useDefault: true
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Google Calendar API Event Creation error:", errText);
      throw new Error(`Event creation failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.id; // returns eventId
  } catch (error) {
    console.error("Error in createCalendarEvent:", error);
    throw error;
  }
};
