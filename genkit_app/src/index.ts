import dotenv from "dotenv";

dotenv.config();

import express, { Request, Response } from "express";
import cors from "cors";
import { createSession } from "./genkit/session";
import {
  createGame,
  getGame,
  getGameMessages,
  processGameMasterTurn,
  processPlayerTurn,
  endGame,
  getGameSummary,
} from "./genkit/game";
import { db } from "./db";
import { usersTable } from "./db/schema";
import { eq } from "drizzle-orm";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Create a new game
app.post("/api/games", async (req: Request, res: Response) => {
  try {
    const gameCost = req.body.gameCost || 100;
    const game = await createGame(gameCost);
    res.json({ success: true, game });
  } catch (error: unknown) {
    console.error("Error creating game:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get game by ID
app.get("/api/games/:gameId", async (req: Request, res: Response) => {
  try {
    const gameId = parseInt(req.params.gameId);
    const game = await getGame(gameId);
    const messages = await getGameMessages(gameId);
    res.json({ success: true, game, messages });
  } catch (error: unknown) {
    console.error("Error getting game:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Process game master turn
app.post(
  "/api/games/:gameId/gameMaster",
  async (req: Request, res: Response) => {
    try {
      const gameId = parseInt(req.params.gameId);
      const session = await createSession({
        currentGameId: gameId,
        isGameMaster: true,
      });
      const response = await processGameMasterTurn(session, gameId);
      res.json({ success: true, response });
    } catch (error: unknown) {
      console.error("Error processing game master turn:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Process player turn
app.post(
  "/api/games/:gameId/players/:userId",
  async (req: Request, res: Response) => {
    try {
      const gameId = parseInt(req.params.gameId);
      const userId = parseInt(req.params.userId);
      const session = await createSession({
        currentGameId: gameId,
        currentUserId: userId,
        isGameMaster: false,
      });
      const response = await processPlayerTurn(session, gameId, userId);
      res.json({ success: true, response });
    } catch (error: unknown) {
      console.error("Error processing player turn:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Get all users
app.get("/api/users", async (_req: Request, res: Response) => {
  try {
    const users = await db.select().from(usersTable);
    res.json({ success: true, users });
  } catch (error: unknown) {
    console.error("Error getting users:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get user by ID
app.get("/api/users/:userId", async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const user = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId));
    if (user.length === 0) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    res.json({ success: true, user: user[0] });
  } catch (error: unknown) {
    console.error("Error getting user:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get game summary
app.get("/api/games/:gameId/summary", async (req: Request, res: Response) => {
  try {
    const gameId = parseInt(req.params.gameId);
    const summary = await getGameSummary(gameId);
    res.json({ success: true, summary });
  } catch (error: unknown) {
    console.error("Error getting game summary:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Serve static files from the public directory
app.use(express.static("public"));

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// For development/testing purposes
async function testGame() {
  try {
    console.log("Creating a test game...");
    const game = await createGame();
    console.log("Game created:", game);

    let currentGame = game;
    let isGameOver = false;
    let turnCount = 0;
    const maxTurns = 1000; // Safety limit to prevent infinite loops

    console.log("Starting game simulation...");
    console.log(
      `Active players: ${currentGame.currentData.activePlayers.length}`
    );

    // Continue the game until there's a winner or we reach the max turns
    while (!isGameOver && turnCount < maxTurns) {
      turnCount++;
      console.log(`\n--- Turn ${turnCount} ---`);

      // Process game master turn
      const gameMasterSession = await createSession({
        currentGameId: currentGame.id,
        isGameMaster: true,
      });

      console.log("Processing game master turn...");
      const gameMasterResponse = await processGameMasterTurn(
        gameMasterSession,
        currentGame.id,
        true
      );
      console.log(`Game Master: ${gameMasterResponse}`);

      // Get updated game state
      currentGame = await getGame(currentGame.id);

      // Check if the game is over after game master's turn
      if (
        currentGame.winner ||
        currentGame.currentData.activePlayers.length <= 1
      ) {
        isGameOver = true;
        console.log("Game over after Game Master's turn!");
        break;
      }

      // Process a turn for each active player
      for (const playerId of currentGame.currentData.activePlayers) {
        const playerSession = await createSession({
          currentGameId: currentGame.id,
          currentUserId: playerId,
          isGameMaster: false,
        });

        console.log(`Processing turn for player ${playerId}...`);
        const playerResponse = await processPlayerTurn(
          playerSession,
          currentGame.id,
          playerId
        );
        console.log(`Player ${playerId}: ${playerResponse}`);

        // Get updated game state after each player's turn
        currentGame = await getGame(currentGame.id);

        // Check if the game is over after this player's turn
        if (
          currentGame.winner ||
          currentGame.currentData.activePlayers.length <= 1
        ) {
          isGameOver = true;
          console.log("Game over during player turns!");
          break;
        }
      }
    }

    // If there's a winner, end the game if it hasn't been ended already
    if (
      currentGame.currentData.activePlayers.length === 1 &&
      !currentGame.winner
    ) {
      console.log("Ending game with the last remaining player as winner...");
      const result = await endGame(
        currentGame.id,
        currentGame.currentData.activePlayers[0]
      );
      console.log("Game ended:", result);
    }

    // Get final game summary
    const gameSummary = await getGameSummary(currentGame.id);

    console.log("\n--- Game Summary ---");
    console.log(JSON.stringify(gameSummary, null, 2));

    return gameSummary;
  } catch (error: unknown) {
    console.error("Test game error:", error);
    throw error;
  }
}

// Run test game if in development mode
if (process.env.NODE_ENV === "development") {
  testGame()
    .then(() => {
      console.log("Test game completed successfully!");
    })
    .catch((error) => {
      console.error("Test game failed:", error);
    });
}
