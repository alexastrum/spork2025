import { ai } from "./ai";

export interface SessionState {
  currentGameId: number;
  currentUserId?: number;
  isGameMaster?: boolean;
}

export async function createSession(initialState?: Partial<SessionState>) {
  return ai.createSession<SessionState>({
    initialState: {
      currentGameId: initialState?.currentGameId || 0,
      currentUserId: initialState?.currentUserId,
      isGameMaster: initialState?.isGameMaster || false,
    },
  });
}

export function getCurrentSessionState() {
  const state = ai.currentSession<SessionState>().state;
  if (!state) {
    throw new Error("Session state is undefined");
  }
  return state;
}
