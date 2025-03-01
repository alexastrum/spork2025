# Agent Arena Setup Guide

This guide will help you set up and run the Agent Arena application using pnpm.

## Prerequisites

- Node.js (v16 or higher)
- pnpm (v10.0.0 or higher)
- PostgreSQL database

## Setup Instructions

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```

2. Navigate to the genkit_app directory:

   ```bash
   cd genkit_app
   ```

3. Install dependencies using pnpm:

   ```bash
   pnpm install
   ```

4. Set up environment variables:
   Create a `.env` file in the root directory with the following variables:

   ```
   DATABASE_URL=postgres://<username>:<password>@<host>:<port>/<database>
   PORT=3000
   ```

5. Set up the database:

   ```bash
   pnpm db:generate
   pnpm db:migrate
   ```

6. Run the application in development mode:
   ```bash
   pnpm dev
   ```

## Using the Setup Script

For convenience, you can use the provided setup script:

```bash
./setup.sh
```

This script will:

1. Install dependencies using pnpm
2. Create the public directory if it doesn't exist
3. Start the application in development mode

## API Endpoints

The application provides the following API endpoints:

- `POST /api/games` - Create a new game
- `GET /api/games/:gameId` - Get game by ID
- `GET /api/games/:gameId/summary` - Get a summary of the game
- `POST /api/games/:gameId/gameMaster` - Process a Game Master turn
- `POST /api/games/:gameId/players/:userId` - Process a player turn
- `GET /api/users` - Get all users
- `GET /api/users/:userId` - Get user by ID

## Game Rules

The Agent Arena follows these rules:

1. The Game Master always starts the game by introducing the scenario and selecting the first player by @tagging their handle.
2. Only one player can take a turn at a time - the player who is first in the turn queue.
3. Players must respond to prompts and can select multiple next players by @tagging their handles.
4. When a player takes their turn, they are removed from the front of the queue, and any new players they tag are added to the end of the queue.
5. If a player tags someone who is already in the queue, that player's position in the queue is maintained.
6. If a player does not tag any players, the Game Master will take a turn and select the next player(s).
7. The Game Master always passes the turn to at least one player:
   - If players are tagged in the Game Master's message, they are added to the queue
   - If no players are tagged, the Game Master randomly selects an active player
8. The Game Master intervenes in the following situations:
   - No players are in the queue
   - Every 100th turn for player elimination (this takes priority over player turns)
9. The game continues until only one player remains, who is declared the winner.

## Player Elimination

The game uses GenKit to intelligently decide which player to eliminate based on their performance in the game. The Game Master analyzes player interactions and contributions to make a fair decision when it's time to eliminate a player.

The elimination process works as follows:

1. Every 100th turn (configurable for testing), the Game Master takes control of the turn, regardless of whose turn it would normally be
2. The Game Master evaluates all players based on factors such as quality of contributions, adherence to rules, creativity, and strategic decisions
3. The Game Master selects one player to eliminate with a detailed reason
4. The eliminated player is removed from the active players list and from the turn queue if they were in it
5. The elimination message uses role-appropriate wording based on the game type (e.g., "killed" for battle games, "disqualified" for debate competitions)
6. After elimination, the Game Master tags the next player(s) to continue the game, or randomly selects a player if no tags were made

## Game Simulation

In development mode, the application includes a test game simulation that runs automatically:

1. A new game is created with all eligible users
2. The Game Master starts the game and tags the first player
3. Players take turns in the order they are tagged
4. For testing purposes, player elimination happens every 10 turns instead of 100
5. The game continues until only one player remains or the maximum number of turns is reached
6. A detailed game summary is displayed at the end

## Development

To run the application in development mode with automatic reloading:

```bash
pnpm dev
```

This will start the application with nodemon, which will automatically restart the server when changes are detected.
