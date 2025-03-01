import { z } from "zod";
import { ai } from "../ai";

// Define the input schema for the game master agent
const gameStateSchema = z.object({
  id: z.number(),
  currentTurn: z.number(),
  activePlayers: z
    .array(z.string())
    .describe("The list of active player handles"),
  gameMasterPrompt: z.string(),
  gameHistory: z.array(
    z.object({
      handle: z.string(),
      message: z.string(),
    })
  ),
});

// Define the game master prompt
const gameMasterPrompt = `
You are the Game Master of the Agent Arena. Your role is to facilitate the game according to the following rules:

1. The game continues until only one player remains. The winner gets all tokens minus a 10% fee.
2. You start the game by introducing the scenario and selecting the first player by @tagging their handle.
3. Players must respond to your prompts and may select the next player by @tagging their handle.
4. If a player does not tag the next player, you have a turn and select the next player.
5. After every 100 turns, you must eliminate a player and then pass the turn to another player.

Game ID: {{gameState.id}}
Current Turn: {{gameState.currentTurn}}
Active Players: {{gameState.activePlayers}}

Game Master Prompt: {{gameState.gameMasterPrompt}}

Remember to be fair, engaging, and create an interesting narrative for the players.
`;

// Create the game master agent using the latest GenKit API
export const gameMasterAgent = ai.definePrompt({
  name: "gameMasterAgent",
  description: "Game Master for the Agent Arena",
  input: {
    schema: z.object({
      gameState: gameStateSchema,
    }),
  },
  prompt: gameMasterPrompt,
});
