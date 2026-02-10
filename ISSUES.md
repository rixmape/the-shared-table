# Project Audit: Data Flow & Synchronization Issues

**Date:** 2026-02-09
**Scope:** Comprehensive codebase analysis of WebSocket, polling, state management, Supabase integration, and React lifecycle patterns

## Executive Summary

This application implements a **real-time collaborative session system** using a hybrid synchronization architecture:

- **Primary Mode:** Supabase Realtime (WebSocket-based)
- **Fallback Mode:** HTTP polling with 1-second intervals
- **Auto-Recovery:** Attempts to reconnect to realtime every 30 seconds

The audit identified several issues affecting data integrity, synchronization reliability, and application stability.

## Medium Priority Issues

### 6. Missing Cleanup for Async Operations

**Severity:** 🟡 MEDIUM
**Impact:** "Can't update unmounted component" warnings

**Affected Locations:**

#### a. `useSupabaseTopics.ts:49-51`

```typescript
useEffect(() => {
  fetchTopicsAndQuestions();  // No abort on unmount
}, []);
```

#### b. `SessionViews.tsx (HostLobbyView):50-58`

```typescript
useEffect(() => {
  if (currentSession?.code) {
    generateSessionQR(currentSession.code)
      .then(setQrCode)  // No cleanup if unmounted
      .catch(...)
  }
}, [currentSession?.code]);
```

#### c. `QuestionViews.tsx (handlePick):107-118`

```typescript
setTimeout(async () => {
  const q = await pickQuestion(me.id);
  if (q) {
    setMyQuestion(q.text);  // No cleanup if unmounted during 800ms delay
  }
}, 800);
```

**Recommendation:**

- Use `isMountedRef` pattern or AbortController
- Clear timeouts in cleanup functions

### 7. Auto-Recovery Sets Health Without Verification

**Severity:** 🟡 MEDIUM
**Impact:** Potential fallback → recovery → fallback loop

**Problem:** Auto-recovery optimistically sets `realtimeHealth` to "healthy" without verifying connection.

**Location:** `useSupabaseSession.ts:467-481`

```typescript
setTimeout(() => {
  setConnectionMode((prev) => ({
    ...prev,
    mode: "realtime",
    realtimeHealth: "healthy",  // Assumes health without checking!
  }));
}, 30000);
```

**Impact:**

- If realtime fails again immediately, triggers: fallback → recovery → fallback loop
- 30-second delay helps but doesn't solve underlying issue

**Recommendation:**

- Don't set health to "healthy" until first successful connection
- Add connection verification step before switching modes

### 8. Session Data Load Race Condition

**Severity:** 🟡 MEDIUM
**Impact:** Duplicate simultaneous session loads

**Problem:** If topics/questions change while session is loading, effect re-runs.

**Location:** `useSupabaseSession.ts:456-464`

```typescript
useEffect(() => {
  if (!sessionId) {
    setSession(null);
    return;
  }
  loadSessionData(sessionId);
}, [sessionId, loadSessionData]);
```

**Issue:**

- `loadSessionData` depends on `[topics, questions]`
- If these change during load, effect re-runs
- Could cause multiple simultaneous loads of same session
- No loading flag to prevent concurrent loads

**Recommendation:**

- Add `isLoading` flag to prevent concurrent loads
- Use ref to track in-flight requests
- Cancel previous load if new one starts

### 9. Vote Submission Has No Optimistic Update

**Severity:** 🟡 MEDIUM
**Impact:** Poor UX during network latency

**Problem:** Vote submission doesn't update local state optimistically.

**Location:** `VotingViews.tsx:109-113`

```typescript
const handleSubmit = () => {
  if (me && selected.length === 3) {
    submitVotes(me.id, selected);  // Fire and forget
  }
};
```

**Impact:**

- User sees "submitted" state only after database update propagates back
- With polling fallback (1 second interval), could have 1+ second delay
- Poor UX during network latency

**Recommendation:**

- Implement optimistic update: immediately mark guest as `hasVoted: true`
- Rollback if submission fails
- Show loading state during submission

### 10. Inconsistent Timestamp Tracking

**Severity:** 🟡 MEDIUM
**Impact:** No unified "freshness" metric

**Problem:** Different hooks track timestamps differently:

- `useSupabaseSession`: `lastPollTime`, `lastSessionUpdate` (separate)
- `usePolling`: `lastFullFetch`, `lastIncrementalFetch` (separate)
- `useSupabaseRealtime`: `lastUpdate` (single)

**Impact:**

- No unified way to determine data "freshness"
- Different components might report different "last update" times
- Parent context exposes `lastUpdate` but comes from different sources depending on mode

**Recommendation:**

- Unify timestamp tracking in a single location
- Use consistent naming across all hooks
- Expose single source of truth for "last sync time"

### 11. Local Question State Not Synced with Global State

**Severity:** 🟡 MEDIUM
**Impact:** Lost state on component remount

**Problem:** Component-local state for picked questions isn't synchronized with global state.

**Location:** `QuestionViews.tsx:94-128`

```typescript
const [myQuestion, setMyQuestion] = useState<string | null>(null);
const [myQuestionRound, setMyQuestionRound] = useState<number | null>(null);
```

**Issues:**

1. If component unmounts and remounts, local state is lost
2. Guest's `hasPicked` status in global state might be true while local shows no question
3. Round transitions might not properly clear local state in edge cases

**Recommendation:**

- Derive from global session state instead of local state
- Or persist to sessionStorage/localStorage
- Or sync local state changes back to global state

## Low Priority Issues

### 12. Production Console Logging

**Severity:** 🟢 LOW
**Impact:** Performance overhead, cluttered console

**Problem:** Extensive console.log statements throughout polling and realtime code.

**Locations:** 15+ console statements across polling/realtime files

**Examples:**

- `usePolling.ts`: Lines 162, 175, 231, 246
- `useSupabaseSession.ts`: Lines 237, 252, 258, 272

**Recommendation:**

- Remove or gate behind debug flag
- Use proper logging library with levels
- Strip in production builds

### 13. Inconsistent Error Threshold Between Modes

**Severity:** 🟢 LOW
**Impact:** Different recovery characteristics

**Problem:**

- Realtime: 3 errors → fallback to polling
- Polling: 5 errors → marked as disconnected

**Impact:** Different tolerance levels between modes could cause confusion.

**Recommendation:**

- Unify error thresholds
- Document rationale if they should differ

### 14. No Explicit WebSocket Timeout Configuration

**Severity:** 🟢 LOW
**Impact:** Relies on Supabase defaults

**Location:** `lib/supabase.ts`

**Current Config:**

```typescript
realtime: {
  params: {
    eventsPerSecond: 10,  // Only this is configured
  },
}
```

**Missing:**

- Heartbeat/keepalive settings
- Custom timeout configuration
- Reconnection parameters

**Recommendation:**

- Add explicit timeout configuration
- Configure heartbeat for early failure detection
- Document expected behavior

## Security & Database Issues

### 15. Permissive RLS Policies

**Severity:** 🟠 MAJOR (Security)
**Impact:** Potential for abuse

**Problem:** Most tables use permissive RLS policies allowing anyone to read/write.

**Example:**

```sql
CREATE POLICY "Anyone can read sessions" ON sessions
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert sessions" ON sessions
  FOR INSERT WITH CHECK (true);
```

**Affected Tables:**

- sessions, guests, votes, session_topics, question_pool, picked_questions

**Risks:**

- No rate limiting at database level
- Users could vote in sessions they didn't join
- No audit trail of modifications

**Recommendation:**

- Add session-scoped validation
- Implement rate limiting
- Require guest authentication for modifications

## Summary Statistics

| Category | Critical | Major | Medium | Low | Total |
|----------|----------|-------|--------|-----|-------|
| Data Integrity | 0 | 0 | 2 | 0 | 2 |
| Synchronization | 0 | 0 | 3 | 2 | 5 |
| React Lifecycle | 0 | 0 | 5 | 0 | 5 |
| Security | 0 | 1 | 0 | 0 | 1 |
| Code Quality | 0 | 0 | 1 | 1 | 2 |
| **TOTAL** | **0** | **1** | **11** | **3** | **15** |

## Recommendations Priority Matrix

### Medium Priority (Next Quarter)

1. ⬜ Add cleanup for async operations
2. ⬜ Improve auto-recovery health verification
3. ⬜ Add loading guards for session data
4. ⬜ Implement optimistic updates for votes
5. ⬜ Unify timestamp tracking
6. ⬜ Sync local question state with global state

### Low Priority (Backlog)

1. ⬜ Remove production console logging
2. ⬜ Unify error thresholds
3. ⬜ Add explicit WebSocket configuration
4. ⬜ Review and tighten RLS policies

## Strengths of Current Implementation

Despite the issues above, the architecture has several strong points:

✅ **Hybrid Architecture:** Robust fallback from realtime to polling
✅ **Database Constraints:** Prevent data corruption at schema level
✅ **Comprehensive Logging:** Aids in debugging (though should be removed in production)
✅ **Deduplication Logic:** Prevents duplicate entries in most cases
✅ **Proper Cleanup:** Most hooks properly clean up subscriptions and timers
✅ **Indexed Queries:** Optimized polling with composite indexes
✅ **Phase-Aware Polling:** Adapts to application state
✅ **Connection Health Monitoring:** Tracks and reports connection status

## File Reference Index

### Core Hooks

- `/src/hooks/useSupabaseRealtime.ts` - Realtime subscriptions (347 lines)
- `/src/hooks/usePolling.ts` - Polling mechanism (264 lines)
- `/src/hooks/useSupabaseSession.ts` - Session orchestration (500 lines)
- `/src/hooks/useSupabaseAuth.ts` - Authentication (29 lines)
- `/src/hooks/useSupabaseTopics.ts` - Topics/questions (51 lines)

### Services

- `/src/services/sessionService.ts` - Session CRUD
- `/src/services/guestService.ts` - Guest management
- `/src/services/questionService.ts` - Question operations

### Context & Utils

- `/src/context/AppContext.tsx` - Global state (397 lines)
- `/src/utils/polling.ts` - Polling utilities (105 lines)

### Database

- `/supabase/migrations/001_initial_schema.sql` - Schema
- `/supabase/migrations/002_add_polling_indexes.sql` - Indexes
- `/supabase/migrations/003_enable_realtime.sql` - Realtime config

### Configuration

- `/src/lib/supabase.ts` - Client setup
- `/.env.example` - Environment variables

**End of Audit Report**
