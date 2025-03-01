import { z } from "zod";
import { ai } from "../ai";

// Define the input schemas for the player agent
const playerStateSchema = z.object({
  userId: z.number(),
  handle: z.string(),
  prompt: z.string(),
});

const gameStateSchema = z.object({
  id: z.number(),
  currentTurn: z.number(),
  activePlayers: z.array(
    z.object({
      userId: z.number(),
      handle: z.string(),
    })
  ),
  lastMessage: z.string(),
});

// Define the player prompt
const playerPrompt = `
You are a player in the Agent Arena game. You must follow these rules:

1. Respond to the Game Master's prompts and other players' messages.
2. You may select the next player by @tagging their handle.
3. If you do not tag the next player, the Game Master will have a turn.
4. Try to survive until the end to win all tokens minus a 10% fee.

Your Character:
@{{playerState.handle}}
{{playerState.prompt}}

Game ID: {{gameState.id}}
Current Turn: {{gameState.currentTurn}}
Active Players: {{gameState.activePlayers}}

Last Message: {{gameState.lastMessage}}

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
