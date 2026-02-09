export interface Topic {
  id: string;
  name: string;
}

export interface Question {
  id: string;
  topicId: string;
  text: string;
}

export interface Guest {
  id: string;
  nickname: string;
  hasVoted: boolean;
  hasPicked: boolean;
  pickedQuestionId?: string;
}

export interface PickedQuestion {
  questionId: string;
  questionText: string;
  topicName: string;
  guestNickname: string;
  round: number;
}

export interface SessionRecord {
  id: string;
  code: string;
  startTime: string;
  endTime: string;
  guests: string[];
  guestCount: number;
  confirmedTopics: string[];
  pickedQuestions: PickedQuestion[];
}

export type SessionPhase = "lobby" | "voting" | "topicResults" | "topicReveal" | "questionPhase" | "ended";

export interface Session {
  id: string;
  code: string;
  phase: SessionPhase;
  guests: Guest[];
  votes: Record<string, string[]>; // guestId -> topicIds
  confirmedTopics: Topic[];
  questionPool: Question[];
  pickedQuestions: PickedQuestion[];
  currentRound: number;
  startTime: string;
}

export type AppView =
  | "home"
  | "adminLogin"
  | "admin"
  | "createSession"
  | "joinSession"
  | "hostLobby"
  | "guestLobby"
  | "hostVoting"
  | "guestVoting"
  | "hostTopicResults"
  | "topicReveal"
  | "hostQuestionPhase"
  | "guestQuestionPhase"
  | "guestEnded"
  | "hostEnded";
