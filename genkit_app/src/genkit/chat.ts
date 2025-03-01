import { MessageData, Session } from "genkit";

import { SessionState } from "./session";
import { sampleAgent } from "./prompts/samplePrompt";
import {
  getGame,
  getGameMessages,
  processGameMasterTurn,
  processPlayerTurn,
} from "./game";
import { db } from "../db";
import { messagesTable } from "../db/schema";
import { eq } from "drizzle-orm";

export async function getChatForSession(session: Session<SessionState>) {
  if (!session.state?.currentGameId) {
    throw new Error("Session game ID is undefined");
  }

  const gameId = session.state.currentGameId;
  const userId = session.state.currentUserId;
  const isGameMaster = session.state.isGameMaster;

  // Get messages for the current game
  const dbMessages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.gameId, gameId))
    .orderBy(messagesTable.createdAt);

  // Process the appropriate turn based on the session state
  if (isGameMaster) {
    // Process game master turn
    const response = await processGameMasterTurn(session, gameId);
    return {
      role: "model",
      content: [{ text: response }],
    };
  } else if (userId) {
    // Process player turn
    const response = await processPlayerTurn(session, gameId, userId);
    return {
      role: "user",
      content: [{ text: response }],
    };
  } else {
    // Fallback to sample agent if no valid state
    const response = await sampleAgent({
      sample: {
        value: "sample",
      },
    });

    return {
      role: "model",
      content: [{ text: response.text || "No response" }],
    };
  }
}
