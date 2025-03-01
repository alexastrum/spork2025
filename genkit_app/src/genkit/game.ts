import { Session, MessageData } from "genkit";
import { db } from "../db";
import { usersTable, gamesTable, messagesTable } from "../db/schema";
import { gameMasterPrompts } from "../db/samples";
import { SessionState } from "./session";
import { gameMasterAgent } from "./prompts/gameMasterPrompt";
import { playerAgent } from "./prompts/playerPrompt";
import { kickPlayerAgent } from "./prompts/kickPlayerPrompt";
import { eq, and, inArray } from "drizzle-orm";

export type Game = {
  id: number;
  createdAt: Date;
  updatedAt?: Date;
  initData: {
    gameMasterPrompt: string;
    cost: number;
    players: {
      userId: number;
      handle: string;
      prompt: string;
    }[];
  };
  currentData: {
    currentTurn: number;
    activePlayers: number[];
  };
  winner: number | null;
};

// Create a new game
export async function createGame(gameCost: number = 100): Promise<Game> {
  // Get all users with enough tokens
  const users = await db.select().from(usersTable);

  // Filter users with enough tokens
  const eligibleUsers = users.filter((user) => user.data.tokens >= gameCost);

  if (eligibleUsers.length < 2) {
    throw new Error("Not enough users with sufficient tokens to start a game");
  }

  // Select a random game master prompt
  const gameMasterPrompt =
    gameMasterPrompts[Math.floor(Math.random() * gameMasterPrompts.length)];
  console.log("gameMasterPrompt", gameMasterPrompt);

  // Create the game
  const [game] = await db
    .insert(gamesTable)
    .values({
      initData: {
        gameMasterPrompt,
        cost: gameCost,
        players: eligibleUsers.map((user) => ({
          userId: user.id,
          handle: user.handle,
          prompt: user.data.prompt,
        })),
      },
      currentData: {
        currentTurn: 0,
        activePlayers: eligibleUsers.map((user) => user.id),
      },
    })
    .returning();

  // Deduct tokens from users
  for (const user of eligibleUsers) {
    await db
      .update(usersTable)
      .set({
        data: {
          ...user.data,
          tokens: user.data.tokens - gameCost,
        },
      })
      .where(eq(usersTable.id, user.id));
  }

  return game as Game;
}

// Get game by ID
export async function getGame(gameId: number): Promise<Game> {
  const game = await db
    .select()
    .from(gamesTable)
    .where(eq(gamesTable.id, gameId))
    .limit(1);

  if (game.length === 0) {
    throw new Error(`Game with ID ${gameId} not found`);
  }

  return game[0] as Game;
}

// Get messages for a game
export async function getGameMessages(gameId: number) {
  return await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.gameId, gameId))
    .orderBy(messagesTable.createdAt);
}

// Add a message to the game
export async function addGameMessage(
  gameId: number,
  handle: string,
  message: string
) {
  await db.insert(messagesTable).values({
    gameId,
    handle,
    message,
  });
}

// Process game master turn
export async function processGameMasterTurn(
  session: Session<SessionState>,
  gameId: number,
  isTesting: boolean = false
) {
  const game = await getGame(gameId);
  const messages = await getGameMessages(gameId);

  // Check if we need to eliminate a player
  // In testing mode, eliminate every 10 turns instead of 100
  const eliminationInterval = isTesting ? 10 : 100;
  const shouldEliminatePlayer =
    game.currentData.currentTurn > 0 &&
    game.currentData.currentTurn % eliminationInterval === 0;

  // Get active players
  const activePlayers = await db
    .select()
    .from(usersTable)
    .where(inArray(usersTable.id, game.currentData.activePlayers));

  const activePlayerInfo = activePlayers.map((player) => ({
    userId: player.id,
    handle: player.handle,
  }));

  // Generate game master response using the latest GenKit API
  const response = await gameMasterAgent({
    gameState: {
      id: game.id,
      currentTurn: game.currentData.currentTurn,
      activePlayers: activePlayerInfo,
      gameMasterPrompt: game.initData.gameMasterPrompt,
    },
  });

  // Get the text content from the response
  const responseText = response.text || "No response";

  // Add game master message to the game
  await addGameMessage(gameId, "GameMaster", responseText);

  // Update game state
  let updatedActivePlayers = [...game.currentData.activePlayers];

  // If we need to eliminate a player and there are more than 2 players
  if (shouldEliminatePlayer && game.currentData.activePlayers.length > 2) {
    // Get recent game history for context
    const recentMessages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.gameId, gameId))
      .orderBy(messagesTable.createdAt)
      .limit(20);

    // Format messages for the kick player agent
    const gameHistory = recentMessages.map((msg) => ({
      handle: msg.handle,
      message: msg.message,
    }));

    // Use the kick player agent to decide which player to eliminate
    const kickDecision = await kickPlayerAgent({
      gameState: {
        id: game.id,
        currentTurn: game.currentData.currentTurn,
        activePlayers: activePlayerInfo,
        gameMasterPrompt: game.initData.gameMasterPrompt,
        gameHistory,
      },
    });

    // Extract the player to kick from the decision
    const playerToKick = kickDecision.output?.playerToKick;

    if (playerToKick) {
      // Remove the player from active players
      updatedActivePlayers = updatedActivePlayers.filter(
        (playerId) => playerId !== playerToKick.userId
      );

      // Add elimination message to the game
      await addGameMessage(
        gameId,
        "GameMaster",
        `I have decided to eliminate @${playerToKick.handle} from the game. ${playerToKick.reason}`
      );
    }
  }

  await db
    .update(gamesTable)
    .set({
      currentData: {
        ...game.currentData,
        currentTurn: game.currentData.currentTurn + 1,
        activePlayers: updatedActivePlayers,
      },
    })
    .where(eq(gamesTable.id, gameId));

  // Check if game is over (only one player left)
  if (updatedActivePlayers.length === 1) {
    await endGame(gameId, updatedActivePlayers[0]);
  }

  return responseText;
}

// Process player turn
export async function processPlayerTurn(
  session: Session<SessionState>,
  gameId: number,
  userId: number
) {
  const game = await getGame(gameId);
  const messages = await getGameMessages(gameId);

  // Check if player is active
  if (!game.currentData.activePlayers.includes(userId)) {
    throw new Error("Player is not active in this game");
  }

  // Get player info
  const [player] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  // Get active players
  const activePlayers = await db
    .select()
    .from(usersTable)
    .where(inArray(usersTable.id, game.currentData.activePlayers));

  const activePlayerInfo = activePlayers.map((p) => ({
    userId: p.id,
    handle: p.handle,
  }));

  // Get last message
  const lastMessage =
    messages.length > 0
      ? messages[messages.length - 1].message
      : "Game is starting. Waiting for the Game Master's first message.";

  // Find player prompt from the game's players array
  const playerData = game.initData.players.find((p) => p.userId === userId);
  if (!playerData) {
    throw new Error("Player data not found in game");
  }

  // Generate player response using the latest GenKit API
  const response = await playerAgent({
    playerState: {
      userId: player.id,
      handle: player.handle,
      prompt: playerData.prompt,
    },
    gameState: {
      id: game.id,
      currentTurn: game.currentData.currentTurn,
      activePlayers: activePlayerInfo,
      lastMessage,
    },
  });

  // Get the text content from the response
  const responseText = response.text || "No response";

  // Add player message to the game
  await addGameMessage(gameId, player.handle, responseText);

  // Update game state
  await db
    .update(gamesTable)
    .set({
      currentData: {
        ...game.currentData,
        currentTurn: game.currentData.currentTurn + 1,
      },
    })
    .where(eq(gamesTable.id, gameId));

  return responseText;
}

// End the game and distribute rewards
export async function endGame(gameId: number, winnerId: number) {
  const game = await getGame(gameId);

  if (game.winner) {
    throw new Error("Game is already finished");
  }

  // Calculate total tokens to award (game cost * number of players - 10% fee)
  const totalPlayers = game.initData.players.length;
  const totalTokens = game.initData.cost * totalPlayers;
  const fee = Math.floor(totalTokens * 0.1);
  const winnerReward = totalTokens - fee;

  // Get winner
  const [winner] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, winnerId));

  // Award tokens to winner
  await db
    .update(usersTable)
    .set({
      data: {
        ...winner.data,
        tokens: winner.data.tokens + winnerReward,
      },
    })
    .where(eq(usersTable.id, winnerId));

  // Update game with winner
  await db
    .update(gamesTable)
    .set({
      winner: winnerId,
    })
    .where(eq(gamesTable.id, gameId));

  // Add final message
  await addGameMessage(
    gameId,
    "GameMaster",
    `Game Over! ${winner.handle} is the winner and receives ${winnerReward} tokens!`
  );

  return {
    gameId,
    winner: winner.handle,
    reward: winnerReward,
  };
}

// Get a summary of the game
export async function getGameSummary(gameId: number) {
  const game = await getGame(gameId);
  const messages = await getGameMessages(gameId);

  // Get winner info if there is one
  let winnerInfo = null;
  if (game.winner) {
    const [winner] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, game.winner));

    if (winner) {
      winnerInfo = {
        userId: winner.id,
        handle: winner.handle,
        tokens: winner.data.tokens,
      };
    }
  }

  // Count messages per player
  const messagesByPlayer = messages.reduce((acc, msg) => {
    acc[msg.handle] = (acc[msg.handle] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Get initial player count
  const initialPlayerCount = game.initData.players.length;

  // Get current player count
  const currentPlayerCount = game.currentData.activePlayers.length;

  return {
    gameId: game.id,
    createdAt: game.createdAt,
    totalTurns: game.currentData.currentTurn,
    initialPlayerCount,
    currentPlayerCount,
    winner: winnerInfo,
    messageCount: messages.length,
    messagesByPlayer,
    isGameOver: !!game.winner || currentPlayerCount <= 1,
  };
}
