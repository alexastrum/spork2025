import { ai } from "./ai";

export interface SessionState {
  currentGameId: number;
}

export async function createSession(initialState?: Partial<SessionState>) {
  return ai.createSession<SessionState>({
    initialState: {
      currentGameId: initialState?.currentGameId || 0,
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
