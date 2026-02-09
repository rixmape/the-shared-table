/**
 * usePolling Hook
 *
 * Manages polling lifecycle for session data synchronization
 * Features:
 * - Phase-aware polling intervals (2-3s for active phases)
 * - Automatic full reload every 30s as safety net
 * - Exponential backoff on errors
 * - Connection health monitoring
 * - Proper cleanup on unmount
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { SessionPhase } from "../types";
import { getBackoffDelay, getIntervalForPhase } from "../utils/polling";

export type ConnectionHealth = "healthy" | "degraded" | "disconnected";

export interface UsePollingOptions {
  /** Enable/disable polling */
  enabled: boolean;
  /** Session ID to poll for */
  sessionId: string | null;
  /** Current session phase (determines poll interval) */
  phase: SessionPhase;
  /** Callback for incremental polls (fetch only new data) */
  onIncrementalPoll: () => Promise<void>;
  /** Callback for full reload (fetch all data) */
  onFullReload: () => Promise<void>;
}

export interface UsePollingReturn {
  /** Whether polling is currently active */
  isPolling: boolean;
  /** Connection health status */
  connectionHealth: ConnectionHealth;
  /** Timestamp of last successful update */
  lastUpdate: Date | null;
  /** Manually trigger a full refresh */
  manualRefresh: () => void;
}

interface PollingState {
  isPolling: boolean;
  lastFullFetch: Date | null;
  lastIncrementalFetch: Date | null;
  consecutiveErrors: number;
  connectionHealth: ConnectionHealth;
}

/**
 * Custom hook for managing polling-based data synchronization
 */
export function usePolling({
  enabled,
  sessionId,
  phase,
  onIncrementalPoll,
  onFullReload,
}: UsePollingOptions): UsePollingReturn {
  const [state, setState] = useState<PollingState>({
    isPolling: false,
    lastFullFetch: null,
    lastIncrementalFetch: null,
    consecutiveErrors: 0,
    connectionHealth: "healthy",
  });

  // Refs for cleanup and preventing overlapping polls
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);

  /**
   * Manual refresh function exposed to UI
   * Triggers immediate full reload and resets error count
   */
  const manualRefresh = useCallback(() => {
    if (!sessionId || !enabled) return;

    const doRefresh = async () => {
      try {
        await onFullReload();
        const now = new Date();
        setState((s) => ({
          ...s,
          lastFullFetch: now,
          lastIncrementalFetch: now,
          consecutiveErrors: 0,
          connectionHealth: "healthy",
        }));
      } catch (error) {
        console.error("[Polling] Manual refresh failed:", error);
        setState((s) => ({
          ...s,
          consecutiveErrors: s.consecutiveErrors + 1,
          connectionHealth: s.consecutiveErrors >= 4 ? "disconnected" : "degraded",
        }));
      }
    };

    doRefresh();
  }, [sessionId, enabled, onFullReload]);

  /**
   * Main polling loop
   * Alternates between incremental polls and full reloads
   */
  useEffect(() => {
    // Reset mounted flag on mount
    isMountedRef.current = true;

    // Early exit if polling disabled or no session
    if (!enabled || !sessionId) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setState((s) => ({ ...s, isPolling: false }));
      return;
    }

    // Get polling interval for current phase
    const interval = getIntervalForPhase(phase);

    // Stop polling if phase doesn't require it (e.g., 'ended')
    if (interval === 0) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setState((s) => ({ ...s, isPolling: false }));
      return;
    }

    /**
     * Execute one poll cycle
     * Decides between incremental poll and full reload
     */
    const executePoll = async () => {
      // Prevent overlapping polls
      if (isPollingRef.current) {
        console.warn("[Polling] Skipping poll - previous poll still in progress");
        return;
      }

      // Check if component still mounted
      if (!isMountedRef.current) {
        return;
      }

      isPollingRef.current = true;

      try {
        const now = new Date();

        // Determine if we should do a full reload
        // Full reload every 30 seconds as safety net to prevent state drift
        const shouldFullReload = !state.lastFullFetch || now.getTime() - state.lastFullFetch.getTime() > 30000; // 30 seconds

        if (shouldFullReload) {
          console.log("[Polling] Executing full reload");
          await onFullReload();

          if (!isMountedRef.current) return;

          setState((s) => ({
            ...s,
            lastFullFetch: now,
            lastIncrementalFetch: now,
            consecutiveErrors: 0,
            connectionHealth: "healthy",
          }));
        } else {
          console.log("[Polling] Executing incremental poll");
          await onIncrementalPoll();

          if (!isMountedRef.current) return;

          setState((s) => ({
            ...s,
            lastIncrementalFetch: now,
            consecutiveErrors: 0,
            connectionHealth: "healthy",
          }));
        }
      } catch (error) {
        console.error("[Polling] Poll failed:", error);

        if (!isMountedRef.current) return;

        // Update error count and connection health
        setState((s) => {
          const newErrors = s.consecutiveErrors + 1;
          let newHealth: ConnectionHealth = "healthy";

          if (newErrors >= 5) {
            newHealth = "disconnected";
          } else if (newErrors >= 2) {
            newHealth = "degraded";
          }

          console.warn(`[Polling] ${newErrors} consecutive errors, health: ${newHealth}`);

          return {
            ...s,
            consecutiveErrors: newErrors,
            connectionHealth: newHealth,
          };
        });
      } finally {
        isPollingRef.current = false;
      }
    };

    /**
     * Schedule next poll
     * Uses exponential backoff if errors occurred
     */
    const scheduleNextPoll = () => {
      if (!isMountedRef.current) return;

      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Calculate delay (use backoff if errors, otherwise use phase interval)
      const delay = state.consecutiveErrors > 0 ? getBackoffDelay(state.consecutiveErrors) : interval;

      console.log(`[Polling] Next poll in ${delay}ms`);

      timeoutRef.current = setTimeout(() => {
        executePoll().then(scheduleNextPoll);
      }, delay);
    };

    // Mark as polling and start
    setState((s) => ({ ...s, isPolling: true }));

    // Execute first poll immediately, then schedule subsequent polls
    executePoll().then(scheduleNextPoll);

    // Cleanup on unmount or dependency change
    return () => {
      console.log("[Polling] Cleaning up");
      isMountedRef.current = false;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      isPollingRef.current = false;
    };
  }, [enabled, sessionId, phase, state.consecutiveErrors, state.lastFullFetch, onIncrementalPoll, onFullReload]);

  return {
    isPolling: state.isPolling,
    connectionHealth: state.connectionHealth,
    lastUpdate: state.lastIncrementalFetch || state.lastFullFetch,
    manualRefresh,
  };
}
