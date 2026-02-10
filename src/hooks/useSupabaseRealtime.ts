import { supabase } from "@/lib/supabase";
import type {
  RealtimeConnectionState,
  RealtimeHookConfig,
  RealtimeHookReturn,
  RealtimePayload,
} from "@/types/realtime";
import { REALTIME_LISTEN_TYPES, RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";

const MAX_ERRORS_BEFORE_FALLBACK = 3;

export function useSupabaseRealtime(config: RealtimeHookConfig): RealtimeHookReturn {
  const {
    sessionId,
    enabled = true,
    onGuestInsert,
    onGuestUpdate,
    onVoteInsert,
    onPickedQuestionInsert,
    onSessionTopicInsert,
    onSessionUpdate,
    onQuestionPoolUpdate,
    onConnectionStateChange,
  } = config;

  const [connectionState, setConnectionState] = useState<RealtimeConnectionState>("DISCONNECTED");
  const [errorCount, setErrorCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const errorCountRef = useRef(0);
  const lastErrorTimestampRef = useRef<number>(0);
  const ERROR_DEBOUNCE_MS = 100; // Ignore duplicate errors within 100ms

  // Transform database column names to camelCase
  const transformGuest = useCallback(
    (row: any) => ({
      id: row.id,
      sessionId: row.session_id,
      nickname: row.nickname,
      hasVoted: row.has_voted,
      hasPicked: row.has_picked,
      pickedQuestionId: row.picked_question_id,
      joinedAt: row.joined_at,
    }),
    [],
  );

  const transformVote = useCallback(
    (row: any) => ({
      id: row.id,
      sessionId: row.session_id,
      guestId: row.guest_id,
      topicId: row.topic_id,
      createdAt: row.created_at,
    }),
    [],
  );

  const transformPickedQuestion = useCallback(
    (row: any) => ({
      id: row.id,
      sessionId: row.session_id,
      guestId: row.guest_id,
      questionId: row.question_id,
      round: row.round,
      pickedAt: row.picked_at,
    }),
    [],
  );

  const transformSessionTopic = useCallback(
    (row: any) => ({
      id: row.id,
      sessionId: row.session_id,
      topicId: row.topic_id,
      createdAt: row.created_at,
    }),
    [],
  );

  const transformSession = useCallback(
    (row: any) => ({
      id: row.id,
      code: row.code,
      phase: row.phase,
      currentRound: row.current_round,
      startTime: row.start_time,
      endTime: row.end_time,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
    [],
  );

  const transformQuestionPoolItem = useCallback(
    (row: any) => ({
      id: row.id,
      sessionId: row.session_id,
      questionId: row.question_id,
      position: row.position,
      picked: row.picked,
      createdAt: row.created_at,
    }),
    [],
  );

  // Handle connection state changes
  const handleConnectionState = useCallback(
    (state: RealtimeConnectionState) => {
      console.log("[Realtime] Connection state changed:", state);
      setConnectionState(state);

      if (state === "CONNECTED") {
        console.log("[Realtime] Successfully connected, resetting error count");
        errorCountRef.current = 0;
        setErrorCount(0);
        lastErrorTimestampRef.current = 0; // Reset error timestamp
        onConnectionStateChange?.("realtime");
      } else if (state === "ERROR" || state === "CLOSED") {
        // Defensive deduplication: Check if error occurred very recently
        const now = Date.now();
        const timeSinceLastError = now - lastErrorTimestampRef.current;

        if (timeSinceLastError < ERROR_DEBOUNCE_MS) {
          console.log(`[Realtime] Ignoring duplicate error (${timeSinceLastError}ms since last)`);
          return; // Skip duplicate error
        }

        lastErrorTimestampRef.current = now;
        errorCountRef.current += 1;
        setErrorCount(errorCountRef.current);
        console.log("[Realtime] Error/closed state, error count:", errorCountRef.current);

        if (errorCountRef.current >= MAX_ERRORS_BEFORE_FALLBACK) {
          console.log("[Realtime] Max errors reached, switching to polling");
          onConnectionStateChange?.("polling");
        }
      }
    },
    [onConnectionStateChange],
  );

  // Create and manage Realtime subscription
  useEffect(() => {
    if (!enabled || !sessionId) {
      console.log("[Realtime] Disabled or no sessionId, skipping subscription");
      return;
    }

    console.log("[Realtime] Setting up subscriptions for session:", sessionId);

    // Create channel for this session
    const channel = supabase.channel(`session:${sessionId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: "" },
      },
    });

    channelRef.current = channel;
    handleConnectionState("CONNECTING");

    // Subscribe to guests table - INSERT events
    channel.on(
      REALTIME_LISTEN_TYPES.POSTGRES_CHANGES,
      {
        event: "INSERT",
        schema: "public",
        table: "guests",
        filter: `session_id=eq.${sessionId}`,
      },
      (payload: RealtimePayload) => {
        console.log("[Realtime] Guest inserted:", payload);
        setLastUpdate(new Date());
        if (onGuestInsert) {
          onGuestInsert({
            ...payload,
            new: transformGuest(payload.new),
          });
        }
      },
    );

    // Subscribe to guests table - UPDATE events
    channel.on(
      REALTIME_LISTEN_TYPES.POSTGRES_CHANGES,
      {
        event: "UPDATE",
        schema: "public",
        table: "guests",
        filter: `session_id=eq.${sessionId}`,
      },
      (payload: RealtimePayload) => {
        console.log("[Realtime] Guest updated:", payload);
        setLastUpdate(new Date());
        if (onGuestUpdate) {
          onGuestUpdate({
            ...payload,
            new: transformGuest(payload.new),
          });
        }
      },
    );

    // Subscribe to votes table - INSERT events
    channel.on(
      REALTIME_LISTEN_TYPES.POSTGRES_CHANGES,
      {
        event: "INSERT",
        schema: "public",
        table: "votes",
        filter: `session_id=eq.${sessionId}`,
      },
      (payload: RealtimePayload) => {
        console.log("[Realtime] Vote inserted:", payload);
        setLastUpdate(new Date());
        if (onVoteInsert) {
          onVoteInsert({
            ...payload,
            new: transformVote(payload.new),
          });
        }
      },
    );

    // Subscribe to picked_questions table - INSERT events
    channel.on(
      REALTIME_LISTEN_TYPES.POSTGRES_CHANGES,
      {
        event: "INSERT",
        schema: "public",
        table: "picked_questions",
        filter: `session_id=eq.${sessionId}`,
      },
      (payload: RealtimePayload) => {
        console.log("[Realtime] Picked question inserted:", payload);
        setLastUpdate(new Date());
        if (onPickedQuestionInsert) {
          onPickedQuestionInsert({
            ...payload,
            new: transformPickedQuestion(payload.new),
          });
        }
      },
    );

    // Subscribe to session_topics table - INSERT events
    channel.on(
      REALTIME_LISTEN_TYPES.POSTGRES_CHANGES,
      {
        event: "INSERT",
        schema: "public",
        table: "session_topics",
        filter: `session_id=eq.${sessionId}`,
      },
      (payload: RealtimePayload) => {
        console.log("[Realtime] Session topic inserted:", payload);
        setLastUpdate(new Date());
        if (onSessionTopicInsert) {
          onSessionTopicInsert({
            ...payload,
            new: transformSessionTopic(payload.new),
          });
        }
      },
    );

    // Subscribe to sessions table - UPDATE events
    channel.on(
      REALTIME_LISTEN_TYPES.POSTGRES_CHANGES,
      {
        event: "UPDATE",
        schema: "public",
        table: "sessions",
        filter: `id=eq.${sessionId}`,
      },
      (payload: RealtimePayload) => {
        console.log("[Realtime] Session updated:", payload);
        setLastUpdate(new Date());
        if (onSessionUpdate) {
          onSessionUpdate({
            ...payload,
            new: transformSession(payload.new),
          });
        }
      },
    );

    // Subscribe to question_pool table - UPDATE events
    channel.on(
      REALTIME_LISTEN_TYPES.POSTGRES_CHANGES,
      {
        event: "UPDATE",
        schema: "public",
        table: "question_pool",
        filter: `session_id=eq.${sessionId}`,
      },
      (payload: RealtimePayload) => {
        console.log("[Realtime] Question pool updated:", payload);
        setLastUpdate(new Date());
        if (onQuestionPoolUpdate) {
          onQuestionPoolUpdate({
            ...payload,
            new: transformQuestionPoolItem(payload.new),
          });
        }
      },
    );

    // Subscribe to the channel
    channel.subscribe((status, err) => {
      console.log("[Realtime] Subscribe callback:", status, err ? err.message : "no error");

      if (status === "SUBSCRIBED") {
        handleConnectionState("CONNECTED");
      } else if (status === "CHANNEL_ERROR") {
        handleConnectionState("ERROR");
      } else if (status === "TIMED_OUT") {
        handleConnectionState("ERROR");
      } else if (status === "CLOSED") {
        handleConnectionState("CLOSED");
      }
    });

    // Cleanup function
    return () => {
      console.log("[Realtime] Cleaning up channel");
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [
    enabled,
    sessionId,
    onGuestInsert,
    onGuestUpdate,
    onVoteInsert,
    onPickedQuestionInsert,
    onSessionTopicInsert,
    onSessionUpdate,
    onQuestionPoolUpdate,
    handleConnectionState,
    transformGuest,
    transformVote,
    transformPickedQuestion,
    transformSessionTopic,
    transformSession,
    transformQuestionPoolItem,
  ]);

  // Determine connection health
  const connectionHealth: "healthy" | "degraded" | "disconnected" =
    connectionState === "CONNECTED" ? "healthy" : connectionState === "CONNECTING" ? "degraded" : "disconnected";

  return {
    isConnected: connectionState === "CONNECTED",
    connectionHealth,
    lastUpdate,
    errorCount,
  };
}
