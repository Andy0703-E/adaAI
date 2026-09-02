import { logger } from "../logger";

export type AuditEvent =
  | "AUTH_LOGIN_SUCCESS"
  | "AUTH_LOGIN_FAILED"
  | "AUTH_REGISTER_SUCCESS"
  | "AUTH_REGISTER_REJECTED"
  | "RATE_LIMIT_BLOCKED"
  | "RESOURCE_FORBIDDEN"
  | "RESOURCE_NOT_FOUND_SUSPICIOUS"
  | "PASSWORD_CHANGE_SUCCESS"
  | "PASSWORD_CHANGE_FAILED"
  | "SESSION_SECURITY_EVENT";

export interface AuditLogData {
  event: AuditEvent;
  requestId: string;
  userId?: string;
  identifierHash?: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

export type AuditListener = (data: AuditLogData) => void;
const auditListeners: AuditListener[] = [];

export function addAuditListener(listener: AuditListener): () => void {
  auditListeners.push(listener);
  return () => {
    const idx = auditListeners.indexOf(listener);
    if (idx !== -1) auditListeners.splice(idx, 1);
  };
}

export function logAuditEvent(data: AuditLogData): void {
  const payload: AuditLogData = {
    ...data,
    createdAt: data.createdAt || new Date().toISOString(),
  };

  auditListeners.forEach((fn) => {
    try {
      fn(payload);
    } catch {
      // ignore
    }
  });

  logger.info(`[SECURITY_AUDIT] ${payload.event}`, {
    requestId: payload.requestId,
    userId: payload.userId,
    identifierHash: payload.identifierHash,
    event: payload.event,
    metadata: payload.metadata,
  });
}
