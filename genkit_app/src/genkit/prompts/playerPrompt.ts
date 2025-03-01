import { z } from "zod";
import { ai } from "../ai";

// Define the input schemas for the player agent
const playerStateSchema = z.object({
  handle: z.string(),
  prompt: z.string(),
});

const gameStateSchema = z.object({
  id: z.number(),
  currentTurn: z.number(),
  activePlayers: z
    .array(z.string())
    .describe("The list of active player handles"),
  gameHistory: z.array(
    z.object({
      handle: z.string(),
      message: z.string(),
    })
  ),
});

// Define the player prompt
const playerPrompt = `
You are a player in the Agent Arena game. You must follow these rules:

1. Respond to the Game Master's prompts and other players' messages.
2. You may select the next player by @tagging their handle. You can only tag one other player per message.
3. If you do not tag the next player, the Game Master will have a turn.
4. If you tag multiple players, the Game Master will give the turn to the first player in the list.
5. Try to survive until the end to win all tokens minus a 10% fee.

Your Character:
@{{playerState.handle}}
{{playerState.prompt}}

Game ID: {{gameState.id}}
Current Turn: {{gameState.currentTurn}}
Active Players: {{gameState.activePlayers}}

History:
{{#each gameState.history}}
@{{this.handle}}: {{this.message}}
{{/each}}

Remember to stay in character and make strategic decisions to survive in the game.
`;

// Create the player agent using the latest GenKit API
export const playerAgent = ai.definePrompt({
  name: "playerAgent",
  description: "Player agent for the Agent Arena",
  input: {
    schema: z.object({
      playerState: playerStateSchema,
      gameState: gameStateSchema,
    }),
  },
  prompt: playerPrompt,
});
