/**
 * Polling utilities for data synchronization
 * Provides data merging functions and polling configuration helpers
 */

import { Guest, PickedQuestion, SessionPhase } from "../types";

/**
 * Merges new guests into existing guest list without duplicates
 */
export const mergeGuests = (existing: Guest[], newGuests: Guest[]): Guest[] => {
  // Create a map of new guests by ID for O(1) lookup
  const newGuestsMap = new Map(newGuests.map((g) => [g.id, g]));

  // Update existing guests or keep them unchanged
  const merged = existing.map((existingGuest) => {
    const updated = newGuestsMap.get(existingGuest.id);
    if (updated) {
      // Remove from map so we don't add duplicates
      newGuestsMap.delete(existingGuest.id);
      return updated;
    }
    return existingGuest;
  });

  // Add any truly new guests that weren't in existing array
  const additions = Array.from(newGuestsMap.values());
  return [...merged, ...additions];
};

/**
 * Merges new votes into existing vote record
 * Structure: { guestId: [topicId1, topicId2, ...] }
 */
export const mergeVotes = (
  existing: Record<string, string[]>,
  newVotes: Array<{ guest_id: string; topic_id: string }>,
): Record<string, string[]> => {
  const merged = { ...existing };

  newVotes.forEach((vote) => {
    if (!merged[vote.guest_id]) {
      merged[vote.guest_id] = [];
    }
    // Add vote if not already present
    if (!merged[vote.guest_id].includes(vote.topic_id)) {
      merged[vote.guest_id].push(vote.topic_id);
    }
  });

  return merged;
};

/**
 * Merges new picked questions into existing list without duplicates
 */
export const mergePickedQuestions = (existing: PickedQuestion[], newPicks: PickedQuestion[]): PickedQuestion[] => {
  const existingIds = new Set(existing.map((p) => p.questionId));
  const additions = newPicks.filter((p) => !existingIds.has(p.questionId));
  return [...existing, ...additions];
};

/**
 * Determines polling interval based on current session phase
 * More frequent polling during interactive phases (lobby, voting)
 * Less frequent during passive phases (results display)
 *
 * @param phase - Current session phase
 * @returns Poll interval in milliseconds (0 = stop polling)
 */
export const getIntervalForPhase = (phase: SessionPhase): number => {
  switch (phase) {
    case "lobby":
      return 1000; // 1s - guests joining frequently
    case "voting":
      return 1000; // 1s - votes coming in, critical for UX
    case "topicResults":
      return 1000; // 1s - mostly static display
    case "topicReveal":
      return 1000; // 1s - mostly static display
    case "questionPhase":
      return 1000; // 1s - guests picking questions
    case "ended":
      return 0; // Stop polling - session inactive
    default:
      return 1000; // 1s - default fallback
  }
};

/**
 * Calculates exponential backoff delay for error recovery
 * Pattern: 2s → 4s → 8s → 16s → 30s (capped)
 *
 * @param errorCount - Number of consecutive errors
 * @returns Delay in milliseconds before next retry
 */
export const getBackoffDelay = (errorCount: number): number => {
  const baseDelay = 2000; // 2 seconds
  const maxDelay = 30000; // 30 seconds cap
  return Math.min(baseDelay * Math.pow(2, errorCount), maxDelay);
};

/**
 * Formats a timestamp as ISO string for database queries
 * Ensures consistent timezone handling
 */
export const toISOString = (date: Date): string => {
  return date.toISOString();
};

/**
 * Checks if timestamp A is newer than timestamp B
 */
export const isNewer = (a: Date | string, b: Date | string): boolean => {
  const dateA = typeof a === "string" ? new Date(a) : a;
  const dateB = typeof b === "string" ? new Date(b) : b;
  return dateA.getTime() > dateB.getTime();
};
