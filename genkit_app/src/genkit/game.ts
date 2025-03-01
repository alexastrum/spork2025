import { Session, MessageData } from "genkit";
import { db } from "../db";
import { usersTable, gamesTable, messagesTable } from "../db/schema";
import { gameMasterPrompts } from "../db/samples";
import { SessionState } from "./session";
import { gameMasterAgent } from "./prompts/gameMasterPrompt";
import { playerAgent } from "./prompts/playerPrompt";
import { eq, and, inArray } from "drizzle-orm";

// Create a new game
export async function createGame(gameCost: number = 100) {
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

  return game;
}

// Get game by ID
export async function getGame(gameId: number) {
  const game = await db
    .select()
    .from(gamesTable)
    .where(eq(gamesTable.id, gameId))
    .limit(1);

  if (game.length === 0) {
    throw new Error(`Game with ID ${gameId} not found`);
  }

  return game[0];
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
  gameId: number
) {
  const game = await getGame(gameId);
  const messages = await getGameMessages(gameId);

  // Check if we need to eliminate a player (every 100 turns)
  const shouldEliminatePlayer =
    game.currentData.currentTurn > 0 &&
    game.currentData.currentTurn % 100 === 0;

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
    // Remove a random player (in a real implementation, this would be based on game performance)
    const playerToRemoveIndex = Math.floor(
      Math.random() * updatedActivePlayers.length
    );
    updatedActivePlayers.splice(playerToRemoveIndex, 1);
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
