import dotenv from "dotenv";

dotenv.config();

import { createGame, processGameTurn, getGameSummary } from "./genkit/game";
import { SelectGame } from "./db/schema";
import { createSampleUsers } from "./db/samples";

// For development/testing purposes
async function testGame() {
  let game: SelectGame;
  try {
    console.log("Creating a test game...");
    game = await createGame();
  } catch (error: unknown) {
    console.log("Game creation failed, creating sample users...");
    await createSampleUsers();
    game = await createGame();
  }
  console.log("Game created:", game);

  const maxTurns = 1000; // Safety limit to prevent infinite loops
  let currentTurn = 0;
  let isGameOver = false;

  console.log("Starting game simulation...");

  // Process turns until the game is over or we reach the max turns
  while (!isGameOver && currentTurn < maxTurns) {
    console.log(`\n--- Turn ${currentTurn + 1} ---`);

    try {
      // Process the current turn
      const response = await processGameTurn(game.id);
      console.log(response);

      // Check if the game is over
      const summary = await getGameSummary(game.id);
      isGameOver = summary.isGameOver;

      if (isGameOver) {
        console.log("\n=== GAME OVER ===");
        console.log(
          `Winner: ${summary.winner ? summary.winner.handle : "None"}`
        );
        console.log("Game Summary:", summary);
        break;
      }

      currentTurn++;
    } catch (error) {
      console.error("Error processing turn:", error);
      break;
    }

    // Add a small delay between turns to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (currentTurn >= maxTurns) {
    console.log(
      `\nReached maximum number of turns (${maxTurns}). Ending game simulation.`
    );
  }

  return game;
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
