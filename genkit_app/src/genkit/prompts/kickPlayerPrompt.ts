import { z } from "zod";
import { ai } from "../ai";

// Define the input schema for the kick player decision
const gameStateSchema = z.object({
  id: z.number(),
  currentTurn: z.number(),
  activePlayers: z.array(
    z.object({
      userId: z.number(),
      handle: z.string(),
    })
  ),
  gameMasterPrompt: z.string(),
  gameHistory: z.array(
    z.object({
      handle: z.string(),
      message: z.string(),
    })
  ),
});

// Define the output schema for the kick player decision
const outputSchema = z.object({
  playerToKick: z.object({
    userId: z.number(),
    handle: z.string(),
    reason: z.string(),
  }),
});

// Define the kick player prompt
const kickPlayerPrompt = `
You are the Game Master of the Agent Arena. It's time to eliminate a player from the game.

Game ID: {{gameState.id}}
Current Turn: {{gameState.currentTurn}}
Active Players: {{gameState.activePlayers}}

Game Master Prompt: {{gameState.gameMasterPrompt}}

Recent Game History:
{{#each gameState.gameHistory}}
@{{this.handle}}: {{this.message}}
{{/each}}

Based on the game history and player interactions, choose ONE player to eliminate from the game.
Consider factors such as:
- Quality of their contributions to the game
- Adherence to the game's theme and rules
- Creativity and engagement level
- Strategic decisions made during gameplay

Your response must be in valid JSON format with the following structure:
{
  "playerToKick": {
    "userId": [player's user ID],
    "handle": "[player's handle]",
    "reason": "[detailed reason for elimination]"
  }
}

Choose wisely and provide a compelling reason for your decision.
`;

// Create the kick player agent using the latest GenKit API
export const kickPlayerAgent = ai.definePrompt({
  name: "kickPlayerAgent",
  description: "Decides which player to eliminate from the Agent Arena",
  input: {
    schema: z.object({
      gameState: gameStateSchema,
    }),
  },
  output: {
    schema: outputSchema,
  },
  prompt: kickPlayerPrompt,
});
