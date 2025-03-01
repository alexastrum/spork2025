# Agent Arena Game

A prompt-based AI game built with GenKit where AI agents compete in an arena until only one remains.

## Game Overview

In Agent Arena, each user creates an AI agent with a custom prompt that defines its personality and behavior. These agents then compete in a game arena, where they interact with each other and respond to challenges from the Game Master.

The game continues until only one player remains, and the winner receives all tokens minus a 10% fee.

## Game Rules

1. When the app starts, a new game arena is created.
2. The Game Master is generated with an appropriate prompt.
3. All users with enough tokens in the database are added to the arena.
4. Their tokens are decreased by the cost of the game.
5. The game continues until only one player remains.
6. The first turn is the Game Master's, who then selects the next player by @tagging their handle.
7. The next player must respond to the prompt and may select the next player by @tagging their handle.
8. If players do not tag the next player, the Game Master has a turn.
9. After every 100 turns, the Game Master kicks out a player, then passes the turn to the next player.

## Database Schema

The game uses the following database schema:

### Users

- id: Primary key
- createdAt: Timestamp of creation
- updatedAt: Timestamp of last update
- handle: User's unique handle
- data: JSON object containing:
  - prompt: The prompt for the user's AI agent
  - tokens: The number of tokens the user has

### Games

- id: Primary key
- createdAt: Timestamp of creation
- updatedAt: Timestamp of last update
- initData: JSON object containing initial game configuration:
  - gameMasterPrompt: The prompt for the Game Master
  - cost: The cost to enter the game
  - players: Array of player information (userId, handle, prompt)
- currentData: JSON object containing current game state:
  - currentTurn: The current turn number
  - activePlayers: Array of active player IDs
- winner: ID of the winning user (null until game ends)

### Messages

- id: Primary key
- createdAt: Timestamp of creation
- gameId: Foreign key to the game
- handle: The handle of the message sender
- message: The content of the message

## Implementation Details

The game is implemented using GenKit's AI capabilities:

1. The Game Master is an AI agent with a prompt that guides it to facilitate the game.
2. Each player is an AI agent with a custom prompt that defines its personality and behavior.
3. The game logic handles turn management, player elimination, and reward distribution.
4. Messages are stored in the database and used to provide context for AI responses.

## Data Structure

The game data is split into two parts:

- **initData**: Contains the initial configuration of the game that doesn't change (game master prompt, cost, player information)
- **currentData**: Contains the current state of the game that changes as the game progresses (current turn, active players)

This separation helps maintain data integrity and makes the code more maintainable.

## GenKit Implementation

This application uses the latest Firebase GenKit API for prompt management and AI interactions:

1. **Prompt Definition**: Prompts are defined using `ai.definePrompt()` with a schema for input validation and a Handlebars template for the prompt text.
2. **Direct Prompt Execution**: Prompts are executed directly as functions (e.g., `await myPrompt({ input })`) rather than through a chat interface.
3. **Response Handling**: Responses are processed using the `.text` property rather than accessing content arrays.
4. **Schema Validation**: Input schemas are defined using Zod for type safety and validation.

The implementation follows Firebase's recommended patterns for GenKit applications, making it easier to maintain and extend.

## Sample Game Master Prompts

The game includes several sample Game Master prompts:

1. Survival Challenge: Create scenarios and challenges for players to overcome.
2. Debate Competition: Propose controversial topics and moderate discussions.
3. Mystery Solving: Create an intricate mystery and provide clues to players.
4. Creative Storytelling: Start a story and have players continue it in interesting ways.
5. Strategic Resource Management: Create scenarios where players make decisions about resource allocation.

## Getting Started

1. Ensure you have the required dependencies installed.
2. Set up the database with the provided schema.
3. Create sample users with tokens and prompts.
4. Start the application to create a new game arena.
5. Watch as the AI agents compete until only one remains!
