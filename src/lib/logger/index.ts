import { sanitizeLogData } from "./sanitize";
import { LogContext } from "./context";

export interface LogEntry {
  level: "INFO" | "WARN" | "ERROR";
  timestamp: string;
  message: string;
  context?: LogContext;
}

export type LogListener = (entry: LogEntry) => void;

const listeners: LogListener[] = [];

export function addLogListener(listener: LogListener): () => void {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

function writeLog(level: "INFO" | "WARN" | "ERROR", message: string, context?: LogContext) {
  const timestamp = new Date().toISOString();
  const sanitizedContext = context ? (sanitizeLogData(context) as LogContext) : undefined;
  const entry: LogEntry = {
    level,
    timestamp,
    message,
    context: sanitizedContext,
  };

  listeners.forEach((fn) => {
    try {
      fn(entry);
    } catch {
      // ignore
    }
  });

  const serialized = sanitizedContext ? JSON.stringify(sanitizedContext) : "";
  if (level === "ERROR") {
    console.error(`[ERROR] ${timestamp} - ${message}`, serialized);
  } else if (level === "WARN") {
    console.warn(`[WARN] ${timestamp} - ${message}`, serialized);
  } else {
    console.log(`[INFO] ${timestamp} - ${message}`, serialized);
  }
}

export const logger = {
  info(message: string, context?: LogContext) {
    writeLog("INFO", message, context);
  },
  warn(message: string, context?: LogContext) {
    writeLog("WARN", message, context);
  },
  error(message: string, context?: LogContext) {
    writeLog("ERROR", message, context);
  },
};

export * from "./context";
export * from "./sanitize";
