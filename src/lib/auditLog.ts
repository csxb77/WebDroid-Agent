const AUDIT_KEY = 'webdroid-agent-audit-log'
const MAX_AUDIT_ENTRIES = 200

export type AuditEventType =
  | 'unrestricted_mode_enabled'
  | 'unrestricted_mode_disabled'
  | 'irreversible_action_blocked'
  | 'sensitive_action_confirmed'
  | 'sensitive_action_cancelled'

export type AuditEntry = {
  type: AuditEventType
  timestamp: number
  detail?: string
}

export type AuditStorage = Pick<Storage, 'getItem' | 'setItem'>

export function loadAuditLog(storage: AuditStorage = localStorage): AuditEntry[] {
  try {
    const raw = storage.getItem(AUDIT_KEY)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed
      .map((item) => normalizeAuditEntry(item))
      .filter((entry): entry is AuditEntry => entry !== null)
  } catch {
    return []
  }
}

export function saveAuditLog(entries: readonly AuditEntry[], storage: AuditStorage = localStorage) {
  try {
    storage.setItem(AUDIT_KEY, JSON.stringify(entries.slice(-MAX_AUDIT_ENTRIES)))
  } catch {
    // Persisting the audit log is best-effort; never interrupt the app on failure.
  }
}

export function appendAuditEntry(
  entry: AuditEntry,
  storage: AuditStorage = localStorage,
): AuditEntry[] {
  const next = [...loadAuditLog(storage), entry].slice(-MAX_AUDIT_ENTRIES)
  saveAuditLog(next, storage)
  return next
}

function normalizeAuditEntry(value: unknown): AuditEntry | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  const candidate = value as Record<string, unknown>
  if (typeof candidate.type !== 'string' || typeof candidate.timestamp !== 'number') {
    return null
  }
  return {
    type: candidate.type as AuditEventType,
    timestamp: candidate.timestamp,
    ...(typeof candidate.detail === 'string' ? { detail: candidate.detail } : {}),
  }
}
