import type { AppView, Guest, PickedQuestion, Question, Session, SessionPhase, SessionRecord, Topic } from "@/types";
import { createContext, ReactNode, useCallback, useContext, useState } from "react";

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function generateSessionCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// Default topics and questions for demo
const DEFAULT_TOPICS: Topic[] = [
  { id: "t1", name: "Family" },
  { id: "t2", name: "Dreams & Ambitions" },
  { id: "t3", name: "Childhood Memories" },
  { id: "t4", name: "Travel & Adventure" },
  { id: "t5", name: "Food & Culture" },
  { id: "t6", name: "Love & Relationships" },
  { id: "t7", name: "Life Lessons" },
  { id: "t8", name: "Fears & Courage" },
];

const DEFAULT_QUESTIONS: Question[] = [
  { id: "q1", topicId: "t1", text: "What's a meal that reminds you of home?" },
  { id: "q2", topicId: "t1", text: "Who in your family has influenced you the most, and how?" },
  { id: "q3", topicId: "t1", text: "What's a family tradition you'd love to keep alive?" },
  { id: "q4", topicId: "t1", text: "What's the best advice a family member ever gave you?" },
  { id: "q5", topicId: "t2", text: "What's a dream you've never told anyone about?" },
  { id: "q6", topicId: "t2", text: "If money were no object, what would you do with your life?" },
  { id: "q7", topicId: "t2", text: "What's one goal you're quietly working toward right now?" },
  { id: "q8", topicId: "t2", text: "What did you want to be when you were ten years old?" },
  { id: "q9", topicId: "t3", text: "What's your earliest memory?" },
  { id: "q10", topicId: "t3", text: "What game did you play most as a kid?" },
  { id: "q11", topicId: "t3", text: "What's a childhood smell that takes you right back?" },
  { id: "q12", topicId: "t3", text: "Who was your childhood best friend, and where are they now?" },
  { id: "q13", topicId: "t4", text: "What's the most beautiful place you've ever visited?" },
  { id: "q14", topicId: "t4", text: "Where in the world would you go if you could leave tomorrow?" },
  { id: "q15", topicId: "t4", text: "What's a trip that changed the way you see the world?" },
  { id: "q16", topicId: "t4", text: "What's the strangest food you've tried while traveling?" },
  { id: "q17", topicId: "t5", text: "What's your ultimate comfort food?" },
  { id: "q18", topicId: "t5", text: "If you could only eat one cuisine for the rest of your life, which would it be?" },
  { id: "q19", topicId: "t5", text: "What's a dish you've always wanted to learn how to cook?" },
  { id: "q20", topicId: "t5", text: "What's a cultural practice from another country that you admire?" },
  { id: "q21", topicId: "t6", text: "What's the most important lesson love has taught you?" },
  { id: "q22", topicId: "t6", text: "How do you show someone you care about them?" },
  { id: "q23", topicId: "t6", text: "What's the kindest thing someone has ever done for you?" },
  { id: "q24", topicId: "t6", text: "What does a perfect day with someone you love look like?" },
  { id: "q25", topicId: "t7", text: "What's a mistake that turned out to be a blessing?" },
  { id: "q26", topicId: "t7", text: "What's something you believed strongly five years ago but don't anymore?" },
  { id: "q27", topicId: "t7", text: "What's the hardest truth you've had to accept?" },
  { id: "q28", topicId: "t7", text: "What would you tell your younger self?" },
  { id: "q29", topicId: "t8", text: "What's something you're afraid of that most people aren't?" },
  { id: "q30", topicId: "t8", text: "What's the bravest thing you've ever done?" },
  { id: "q31", topicId: "t8", text: "When was the last time you did something for the first time?" },
  { id: "q32", topicId: "t8", text: "What fear have you overcome that you're proud of?" },
];

interface AppState {
  view: AppView;
  topics: Topic[];
  questions: Question[];
  sessions: SessionRecord[];
  currentSession: Session | null;
  currentGuestId: string | null;
  isAdmin: boolean;
}

interface AppContextType extends AppState {
  setView: (v: AppView) => void;
  // Admin
  login: (password: string) => boolean;
  logout: () => void;
  addTopic: (name: string) => void;
  editTopic: (id: string, name: string) => void;
  removeTopic: (id: string) => void;
  addQuestion: (topicId: string, text: string) => void;
  editQuestion: (id: string, text: string, topicId: string) => void;
  removeQuestion: (id: string) => void;
  deleteSessionRecord: (id: string) => void;
  // Session
  createSession: () => void;
  joinSession: (code: string, nickname: string) => string | null;
  addSimGuest: (nickname: string) => void;
  advancePhase: (phase: SessionPhase) => void;
  // Voting
  submitVotes: (guestId: string, topicIds: string[]) => void;
  simGuestVotes: () => void;
  // Topic confirm
  confirmTopics: (topicIds: string[]) => void;
  // Question
  pickQuestion: (guestId: string) => Question | null;
  nextRound: () => void;
  endSession: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    view: "home",
    topics: DEFAULT_TOPICS,
    questions: DEFAULT_QUESTIONS,
    sessions: [],
    currentSession: null,
    currentGuestId: null,
    isAdmin: false,
  });

  const setView = useCallback((view: AppView) => {
    setState((s) => ({ ...s, view }));
  }, []);

  // ─── Admin ───
  const login = useCallback((password: string): boolean => {
    if (password === "sharedtable2026") {
      setState((s) => ({ ...s, isAdmin: true, view: "admin" }));
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setState((s) => ({ ...s, isAdmin: false, view: "home" }));
  }, []);

  const addTopic = useCallback((name: string) => {
    setState((s) => ({ ...s, topics: [...s.topics, { id: generateId(), name }] }));
  }, []);

  const editTopic = useCallback((id: string, name: string) => {
    setState((s) => ({
      ...s,
      topics: s.topics.map((t) => (t.id === id ? { ...t, name } : t)),
    }));
  }, []);

  const removeTopic = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      topics: s.topics.filter((t) => t.id !== id),
      questions: s.questions.filter((q) => q.topicId !== id),
    }));
  }, []);

  const addQuestion = useCallback((topicId: string, text: string) => {
    setState((s) => ({
      ...s,
      questions: [...s.questions, { id: generateId(), topicId, text }],
    }));
  }, []);

  const editQuestion = useCallback((id: string, text: string, topicId: string) => {
    setState((s) => ({
      ...s,
      questions: s.questions.map((q) => (q.id === id ? { ...q, text, topicId } : q)),
    }));
  }, []);

  const removeQuestion = useCallback((id: string) => {
    setState((s) => ({ ...s, questions: s.questions.filter((q) => q.id !== id) }));
  }, []);

  const deleteSessionRecord = useCallback((id: string) => {
    setState((s) => ({ ...s, sessions: s.sessions.filter((sr) => sr.id !== id) }));
  }, []);

  // ─── Session ───
  const createSession = useCallback(() => {
    const session: Session = {
      id: generateId(),
      code: generateSessionCode(),
      phase: "lobby",
      guests: [],
      votes: {},
      confirmedTopics: [],
      questionPool: [],
      pickedQuestions: [],
      currentRound: 1,
      startTime: new Date().toISOString(),
    };
    setState((s) => ({ ...s, currentSession: session, view: "hostLobby" }));
  }, []);

  const joinSession = useCallback((_code: string, _nickname: string): string | null => {
    return null; // actual joining handled via state
  }, []);

  const addSimGuest = useCallback((nickname: string) => {
    setState((s) => {
      if (!s.currentSession) return s;
      const guest: Guest = {
        id: generateId(),
        nickname,
        hasVoted: false,
        hasPicked: false,
      };
      return {
        ...s,
        currentSession: {
          ...s.currentSession,
          guests: [...s.currentSession.guests, guest],
        },
      };
    });
  }, []);

  const advancePhase = useCallback((phase: SessionPhase) => {
    setState((s) => {
      if (!s.currentSession) return s;
      return {
        ...s,
        currentSession: { ...s.currentSession, phase },
        view:
          phase === "voting"
            ? "hostVoting"
            : phase === "topicResults"
              ? "hostTopicResults"
              : phase === "topicReveal"
                ? "topicReveal"
                : phase === "questionPhase"
                  ? "hostQuestionPhase"
                  : s.view,
      };
    });
  }, []);

  // ─── Voting ───
  const submitVotes = useCallback((guestId: string, topicIds: string[]) => {
    setState((s) => {
      if (!s.currentSession) return s;
      return {
        ...s,
        currentSession: {
          ...s.currentSession,
          votes: { ...s.currentSession.votes, [guestId]: topicIds },
          guests: s.currentSession.guests.map((g) => (g.id === guestId ? { ...g, hasVoted: true } : g)),
        },
      };
    });
  }, []);

  const simGuestVotes = useCallback(() => {
    setState((s) => {
      if (!s.currentSession) return s;
      const newVotes = { ...s.currentSession.votes };
      const updatedGuests = s.currentSession.guests.map((g) => {
        if (!g.hasVoted) {
          const shuffled = [...s.topics].sort(() => Math.random() - 0.5);
          newVotes[g.id] = shuffled.slice(0, 3).map((t) => t.id);
          return { ...g, hasVoted: true };
        }
        return g;
      });
      return {
        ...s,
        currentSession: {
          ...s.currentSession,
          votes: newVotes,
          guests: updatedGuests,
        },
      };
    });
  }, []);

  // ─── Topic Confirm ───
  const confirmTopics = useCallback((topicIds: string[]) => {
    setState((s) => {
      if (!s.currentSession) return s;
      const confirmed = s.topics.filter((t) => topicIds.includes(t.id));
      const pool = s.questions.filter((q) => topicIds.includes(q.topicId));
      return {
        ...s,
        currentSession: {
          ...s.currentSession,
          confirmedTopics: confirmed,
          questionPool: pool.sort(() => Math.random() - 0.5),
          phase: "topicReveal",
        },
        view: "topicReveal",
      };
    });
  }, []);

  // ─── Question ───
  const pickQuestion = useCallback((guestId: string): Question | null => {
    let picked: Question | null = null;
    setState((s) => {
      if (!s.currentSession || s.currentSession.questionPool.length === 0) return s;
      const q = s.currentSession.questionPool[0];
      picked = q;
      const guest = s.currentSession.guests.find((g) => g.id === guestId);
      const topic = s.topics.find((t) => t.id === q.topicId);
      const pq: PickedQuestion = {
        questionId: q.id,
        questionText: q.text,
        topicName: topic?.name || "Unknown",
        guestNickname: guest?.nickname || "Unknown",
        round: s.currentSession.currentRound,
      };
      return {
        ...s,
        currentSession: {
          ...s.currentSession,
          questionPool: s.currentSession.questionPool.slice(1),
          pickedQuestions: [...s.currentSession.pickedQuestions, pq],
          guests: s.currentSession.guests.map((g) =>
            g.id === guestId ? { ...g, hasPicked: true, pickedQuestionId: q.id } : g,
          ),
        },
      };
    });
    return picked;
  }, []);

  const nextRound = useCallback(() => {
    setState((s) => {
      if (!s.currentSession) return s;
      return {
        ...s,
        currentSession: {
          ...s.currentSession,
          currentRound: s.currentSession.currentRound + 1,
          guests: s.currentSession.guests.map((g) => ({
            ...g,
            hasPicked: false,
            pickedQuestionId: undefined,
          })),
        },
      };
    });
  }, []);

  const endSession = useCallback(() => {
    setState((s) => {
      if (!s.currentSession) return s;
      const record: SessionRecord = {
        id: s.currentSession.id,
        code: s.currentSession.code,
        startTime: s.currentSession.startTime,
        endTime: new Date().toISOString(),
        guests: s.currentSession.guests.map((g) => g.nickname),
        guestCount: s.currentSession.guests.length,
        confirmedTopics: s.currentSession.confirmedTopics.map((t) => t.name),
        pickedQuestions: s.currentSession.pickedQuestions,
      };
      return {
        ...s,
        sessions: [...s.sessions, record],
        currentSession: { ...s.currentSession, phase: "ended" },
        view: "hostEnded",
      };
    });
  }, []);

  return (
    <AppContext.Provider
      value={{
        ...state,
        setView,
        login,
        logout,
        addTopic,
        editTopic,
        removeTopic,
        addQuestion,
        editQuestion,
        removeQuestion,
        deleteSessionRecord,
        createSession,
        joinSession,
        addSimGuest,
        advancePhase,
        submitVotes,
        simGuestVotes,
        confirmTopics,
        pickQuestion,
        nextRound,
        endSession,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
