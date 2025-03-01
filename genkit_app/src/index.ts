import dotenv from "dotenv";

dotenv.config();

import {
  createGame,
  processGameTurn,
  getGameSummary,
  getGameMessages,
} from "./genkit/game";
import { SelectGame } from "./db/schema";
import { createSampleUsers } from "./db/samples";

// ANSI color codes for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
};

// Map to store player colors
const playerColors = new Map<string, string>();

// Get a color for a player
function getPlayerColor(handle: string): string {
  // Game Master always uses default color
  if (handle === "GameMaster") {
    return colors.reset;
  }

  // If player already has a color, return it
  if (playerColors.has(handle)) {
    return playerColors.get(handle) || colors.reset;
  }

  // Assign a new color to the player
  const availableColors = [
    colors.red,
    colors.green,
    colors.yellow,
    colors.blue,
    colors.magenta,
    colors.cyan,
    colors.bright + colors.red,
    colors.bright + colors.green,
    colors.bright + colors.yellow,
    colors.bright + colors.blue,
    colors.bright + colors.magenta,
    colors.bright + colors.cyan,
  ];

  const colorIndex = playerColors.size % availableColors.length;
  const color = availableColors[colorIndex];
  playerColors.set(handle, color);

  return color;
}

// Format a message with player's color and handle
function formatMessage(handle: string, message: string): string {
  const color = getPlayerColor(handle);
  const prefix =
    handle === "GameMaster"
      ? `${colors.bright}[Game Master]${colors.reset}`
      : `${color}[${handle}]${colors.reset}`;

  return `${prefix} ${message}`;
}

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

  // Display game information
  console.log("\n=== GAME CREATED ===");
  console.log(`Game ID: ${game.id}`);
  console.log(
    `Players: ${game.initData.players.map((p) => p.handle).join(", ")}`
  );
  console.log(`Game Cost: ${game.initData.cost} tokens per player`);
  console.log("\n=== GAME MASTER PROMPT ===");
  console.log(game.initData.gameMasterPrompt);
  console.log("\n=== GAME STARTING ===");

  const maxTurns = 1000; // Safety limit to prevent infinite loops
  let currentTurn = 0;
  let isGameOver = false;

  // Process turns until the game is over or we reach the max turns
  while (!isGameOver && currentTurn < maxTurns) {
    console.log(`\n--- Turn ${currentTurn + 1} ---`);

    try {
      // Process the current turn
      const response = await processGameTurn(game.id);

      // Get the latest message to display with proper formatting
      const messages = await getGameMessages(game.id);
      if (messages.length > 0) {
        const latestMessage = messages[messages.length - 1];
        console.log(formatMessage(latestMessage.handle, latestMessage.message));
      } else {
        console.log(response); // Fallback if no messages
      }

      // Check if the game is over
      const summary = await getGameSummary(game.id);
      isGameOver = summary.isGameOver;

      if (isGameOver) {
        console.log("\n=== GAME OVER ===");
        console.log(
          `Winner: ${
            summary.winner
              ? formatMessage(summary.winner.handle, "is the WINNER!")
              : "None"
          }`
        );

        // Display final stats
        console.log("\n=== FINAL STATS ===");
        console.log(`Total Turns: ${summary.totalTurns}`);
        console.log(`Initial Players: ${summary.initialPlayerCount}`);
        console.log(`Messages per player:`);

        Object.entries(summary.messagesByPlayer).forEach(([handle, count]) => {
          console.log(formatMessage(handle, `sent ${count} messages`));
        });

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
