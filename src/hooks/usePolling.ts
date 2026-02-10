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
  // State reduced to UI-only fields
  const [state, setState] = useState<{
    isPolling: boolean;
    connectionHealth: ConnectionHealth;
  }>({
    isPolling: false,
    connectionHealth: "healthy",
  });

  // Refs for cleanup and preventing overlapping polls
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);

  // Refs for logic values (prevent effect restarts on changes)
  const consecutiveErrorsRef = useRef<number>(0);
  const lastFullFetchRef = useRef<Date | null>(null);
  const lastIncrementalFetchRef = useRef<Date | null>(null);

  // Callback refs for stable wrappers
  const onIncrementalPollRef = useRef(onIncrementalPoll);
  const onFullReloadRef = useRef(onFullReload);

  // Sync callback refs on every render
  useEffect(() => {
    onIncrementalPollRef.current = onIncrementalPoll;
  }, [onIncrementalPoll]);

  useEffect(() => {
    onFullReloadRef.current = onFullReload;
  }, [onFullReload]);

  // Create stable callback wrappers with empty dependency arrays
  const stableOnIncrementalPoll = useCallback(async () => {
    await onIncrementalPollRef.current();
  }, []);

  const stableOnFullReload = useCallback(async () => {
    await onFullReloadRef.current();
  }, []);

  /**
   * Manual refresh function exposed to UI
   * Triggers immediate full reload and resets error count
   */
  const manualRefresh = useCallback(() => {
    if (!sessionId || !enabled) return;

    const doRefresh = async () => {
      try {
        await stableOnFullReload();
        const now = new Date();

        // Update refs (source of truth)
        lastFullFetchRef.current = now;
        lastIncrementalFetchRef.current = now;
        consecutiveErrorsRef.current = 0;

        // Update state (UI only)
        setState((s) => ({
          ...s,
          connectionHealth: "healthy",
        }));
      } catch (error) {
        console.error("[Polling] Manual refresh failed:", error);

        // Update ref first
        consecutiveErrorsRef.current += 1;
        const newErrors = consecutiveErrorsRef.current;

        // Update state for UI
        setState((s) => ({
          ...s,
          connectionHealth: newErrors >= 4 ? "disconnected" : "degraded",
        }));
      }
    };

    doRefresh();
  }, [sessionId, enabled, stableOnFullReload]);

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

        // Read from ref for decision logic
        // Full reload every 30 seconds as safety net to prevent state drift
        const shouldFullReload =
          !lastFullFetchRef.current || now.getTime() - lastFullFetchRef.current.getTime() > 30000;

        if (shouldFullReload) {
          console.log("[Polling] Executing full reload");
          await stableOnFullReload();

          if (!isMountedRef.current) return;

          // Update refs
          lastFullFetchRef.current = now;
          lastIncrementalFetchRef.current = now;
          consecutiveErrorsRef.current = 0;

          // Update state (UI only)
          setState((s) => ({ ...s, connectionHealth: "healthy" }));
        } else {
          console.log("[Polling] Executing incremental poll");
          await stableOnIncrementalPoll();

          if (!isMountedRef.current) return;

          // Update refs
          lastIncrementalFetchRef.current = now;
          consecutiveErrorsRef.current = 0;

          // Update state (UI only)
          setState((s) => ({ ...s, connectionHealth: "healthy" }));
        }
      } catch (error) {
        console.error("[Polling] Poll failed:", error);
        if (!isMountedRef.current) return;

        // Update ref
        consecutiveErrorsRef.current += 1;
        const newErrors = consecutiveErrorsRef.current;

        // Calculate health
        let newHealth: ConnectionHealth = "healthy";
        if (newErrors >= 5) {
          newHealth = "disconnected";
        } else if (newErrors >= 2) {
          newHealth = "degraded";
        }

        console.warn(`[Polling] ${newErrors} consecutive errors, health: ${newHealth}`);

        // Update state (UI only)
        setState((s) => ({ ...s, connectionHealth: newHealth }));
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

      // Read from ref for backoff calculation
      const delay = consecutiveErrorsRef.current > 0 ? getBackoffDelay(consecutiveErrorsRef.current) : interval;

      console.log(`[Polling] Next poll in ${delay}ms (errors: ${consecutiveErrorsRef.current})`);

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
  }, [enabled, sessionId, phase, stableOnIncrementalPoll, stableOnFullReload]);

  return {
    isPolling: state.isPolling,
    connectionHealth: state.connectionHealth,
    lastUpdate: lastIncrementalFetchRef.current || lastFullFetchRef.current,
    manualRefresh,
  };
}
