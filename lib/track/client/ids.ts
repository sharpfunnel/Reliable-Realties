"use client";

const VISITOR_KEY = "rr_vid";
const SESSION_ID_KEY = "rr_sid";
const SESSION_EXPIRY_KEY = "rr_sid_exp";
const SESSION_IDLE_MS = 30 * 60 * 1000; // 30 minutes of inactivity starts a new session

function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getVisitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = uuid();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return uuid();
  }
}

/** Returns [clientId, isNewSession]. Touches the idle-expiry window as a side effect. */
export function getSessionId(): [string, boolean] {
  try {
    const now = Date.now();
    const storedId = sessionStorage.getItem(SESSION_ID_KEY);
    const storedExpiry = Number(sessionStorage.getItem(SESSION_EXPIRY_KEY) ?? 0);

    let isNew = false;
    let id = storedId;

    if (!id || now > storedExpiry) {
      id = uuid();
      isNew = true;
      sessionStorage.setItem(SESSION_ID_KEY, id);
    }

    sessionStorage.setItem(SESSION_EXPIRY_KEY, String(now + SESSION_IDLE_MS));
    return [id, isNew];
  } catch {
    return [uuid(), true];
  }
}
