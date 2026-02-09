import { AppProvider, useApp } from "@/context/AppContext";
import { AdminLoginView } from "@/views/AdminLoginView";
import { AdminView } from "@/views/AdminView";
import { EndedView } from "@/views/EndedView";
import { HomeView } from "@/views/HomeView";
import { GuestLobbyView, JoinSessionView } from "@/views/JoinViews";
import { GuestQuestionPhaseView, HostQuestionPhaseView } from "@/views/QuestionViews";
import { CreateSessionView, HostLobbyView } from "@/views/SessionViews";
import { HostTopicResultsView, TopicRevealView } from "@/views/TopicViews";
import { GuestVotingView, HostVotingView } from "@/views/VotingViews";

function Router() {
  const { view } = useApp();

  switch (view) {
    case "home":
      return <HomeView />;
    case "adminLogin":
      return <AdminLoginView />;
    case "admin":
      return <AdminView />;
    case "createSession":
      return <CreateSessionView />;
    case "joinSession":
      return <JoinSessionView />;
    case "hostLobby":
      return <HostLobbyView />;
    case "guestLobby":
      return <GuestLobbyView />;
    case "hostVoting":
      return <HostVotingView />;
    case "guestVoting":
      return <GuestVotingView />;
    case "hostTopicResults":
      return <HostTopicResultsView />;
    case "topicReveal":
      return <TopicRevealView />;
    case "hostQuestionPhase":
      return <HostQuestionPhaseView />;
    case "guestQuestionPhase":
      return <GuestQuestionPhaseView />;
    case "hostEnded":
    case "guestEnded":
      return <EndedView />;
    default:
      return <HomeView />;
  }
}

export default function App() {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  );
}
