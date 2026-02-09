export interface RealtimePayload<T = any> {
  schema: string;
  table: string;
  commit_timestamp: string;
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: T;
  old: T | Record<string, never>;
  errors: any[] | null;
}

export type RealtimeConnectionState = "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "ERROR" | "CLOSED";

export interface RealtimeCallbacks {
  onGuestInsert?: (payload: RealtimePayload) => void;
  onGuestUpdate?: (payload: RealtimePayload) => void;
  onVoteInsert?: (payload: RealtimePayload) => void;
  onPickedQuestionInsert?: (payload: RealtimePayload) => void;
  onSessionTopicInsert?: (payload: RealtimePayload) => void;
  onSessionUpdate?: (payload: RealtimePayload) => void;
  onQuestionPoolUpdate?: (payload: RealtimePayload) => void;
  onConnectionStateChange?: (mode: "realtime" | "polling") => void;
}

export interface RealtimeHookConfig extends RealtimeCallbacks {
  sessionId: string | null;
  enabled?: boolean;
}

export interface RealtimeHookReturn {
  isConnected: boolean;
  connectionHealth: "healthy" | "degraded" | "disconnected";
  lastUpdate: Date | null;
  errorCount: number;
}
