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
- `POST /api/games/:gameId/gameMaster` - Process game master turn
- `POST /api/games/:gameId/players/:userId` - Process player turn
- `GET /api/users` - Get all users
- `GET /api/users/:userId` - Get user by ID

## Player Elimination

The game now uses GenKit to intelligently decide which player to eliminate based on their performance in the game. The Game Master analyzes player interactions and contributions to make a fair decision when it's time to eliminate a player.

The elimination process works as follows:

1. Every 100 turns (configurable for testing), the Game Master evaluates all players
2. The Game Master considers factors such as quality of contributions, adherence to rules, creativity, and strategic decisions
3. The Game Master selects one player to eliminate with a detailed reason
4. The eliminated player is removed from the active players list

## Game Simulation

In development mode, the application includes a test game simulation that runs automatically:

1. A new game is created with all eligible users
2. The Game Master and players take turns until there's a winner
3. For testing purposes, player elimination happens every 10 turns instead of 100
4. The game continues until only one player remains or the maximum number of turns is reached
5. A detailed game summary is displayed at the end

## Development

To run the application in development mode with automatic reloading:

```bash
pnpm dev
```

This will start the application with nodemon, which will automatically restart the server when changes are detected.
