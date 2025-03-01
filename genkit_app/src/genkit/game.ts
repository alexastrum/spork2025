import { db } from "../db";
import { createSampleGameMasterPrompts } from "../db/samples";
import {
  usersTable,
  gamesTable,
  messagesTable,
  SelectGame,
  SelectMessage,
} from "../db/schema";
import { eq } from "drizzle-orm";

/**
 * Create a new game. Select random users to be players, unless userIds are provided.
 */
export async function createGame(
  gameCost: number = 100,
  userIds?: number[]
): Promise<SelectGame> {
  // Get all users with enough tokens
  const users = await db.select().from(usersTable);

  // Filter users with enough tokens
  const eligibleUsers = users.filter((user) => user.data.tokens >= gameCost);

  if (eligibleUsers.length < 2) {
    throw new Error("Not enough users with sufficient tokens to start a game");
  }

  // Select a random game master prompt
  const gameMasterPrompt = await createSampleGameMasterPrompts();
  console.log("GameMasterPrompt", gameMasterPrompt, "---------------");

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
        activePlayers: eligibleUsers.map((user) => user.handle),
        nextPlayer: "GameMaster",
        lastEliminationTurn: 0,
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
export async function getGame(gameId: number): Promise<SelectGame> {
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
export async function getGameMessages(
  gameId: number
): Promise<SelectMessage[]> {
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

// Use the next player prompt to process a turn in the game
// If needed, use the kick player prompt to eliminate a player
// 1st turn is always Game Master's turn
// If only one player is left, give the Game Master the last turn and end the game
export async function processGameTurn(gameId: number): Promise<string> {
  const game = await getGame(gameId);
  const messages = await getGameMessages(gameId);

  // Check if game is already over
  if (game.winner || game.currentData.activePlayers.length <= 1) {
    if (!game.winner && game.currentData.activePlayers.length === 1) {
      // End the game with the last player as winner
      const lastPlayerHandle = game.currentData.activePlayers[0];
      const lastPlayer = game.initData.players.find(
        (p) => p.handle === lastPlayerHandle
      );

      if (lastPlayer) {
        await endGame(gameId, lastPlayer.userId);
        return `Game over! Player ${lastPlayerHandle} wins!`;
      } else {
        return "Error: Could not find the last player's ID.";
      }
    }
    return "Game is already over.";
  }

  // Get active players with their handles
  const activePlayers = game.initData.players
    .filter((player) => game.currentData.activePlayers.includes(player.handle))
    .map((player) => ({
      userId: player.userId,
      handle: player.handle,
    }));

  // Determine whose turn it is
  const currentTurn = game.currentData.currentTurn;
  const nextPlayer = game.currentData.nextPlayer;

  // Check if we need to eliminate a player
  const eliminationTurn =
    currentTurn > 0 &&
    currentTurn >=
      game.currentData.lastEliminationTurn + game.initData.players.length * 3;
  let response = "";

  if (eliminationTurn) {
    // Use the kickPlayerAgent to decide which player to eliminate
    const { kickPlayerAgent } = await import("./prompts/kickPlayerPrompt");

    // Prepare game history for the prompt
    const gameHistory = messages.slice(-20).map((msg) => ({
      handle: msg.handle,
      message: msg.message,
    }));

    // Call the kickPlayerAgent
    const kickResponse = await kickPlayerAgent({
      gameState: {
        id: game.id,
        currentTurn,
        activePlayers: game.currentData.activePlayers,
        gameMasterPrompt: game.initData.gameMasterPrompt,
        gameHistory,
      },
    });

    // Extract the result from the response
    const kickResult = kickResponse.text
      ? JSON.parse(kickResponse.text)
      : { playerToKick: { handle: "", reason: "" } };

    // Find the player to kick
    const playerToKick = activePlayers.find(
      (p) => p.handle === kickResult.playerToKick.handle
    );

    if (playerToKick) {
      // Remove player from active players
      const updatedActivePlayers = game.currentData.activePlayers.filter(
        (handle) => handle !== playerToKick.handle
      );

      // Update game state
      await db
        .update(gamesTable)
        .set({
          currentData: {
            ...game.currentData,
            activePlayers: updatedActivePlayers,
            nextPlayer: "GameMaster",
            lastEliminationTurn: currentTurn,
          },
        })
        .where(eq(gamesTable.id, gameId));

      // Add elimination message
      const eliminationMessage = `I have decided to ${kickResult.playerToKick.reason}`;
      await addGameMessage(gameId, "GameMaster", eliminationMessage);

      response = eliminationMessage;

      // Check if game is over after elimination
      if (updatedActivePlayers.length === 1) {
        const lastPlayerHandle = updatedActivePlayers[0];
        const lastPlayer = game.initData.players.find(
          (p) => p.handle === lastPlayerHandle
        );

        if (lastPlayer) {
          await endGame(gameId, lastPlayer.userId);
          return `Game over! Player ${lastPlayerHandle} wins!`;
        }
      }
    }
  }

  // Process the current turn
  if (nextPlayer === "GameMaster") {
    // Game Master's turn
    const { gameMasterAgent } = await import("./prompts/gameMasterPrompt");

    // Prepare game history for the prompt
    const gameHistory = messages.slice(-20).map((msg) => ({
      handle: msg.handle,
      message: msg.message,
    }));

    // Call the gameMasterAgent
    const gameMasterResponseObj = await gameMasterAgent({
      gameState: {
        id: game.id,
        currentTurn,
        activePlayers: game.currentData.activePlayers,
        gameMasterPrompt: game.initData.gameMasterPrompt,
        gameHistory,
      },
    });

    // Extract the text from the response
    const gameMasterResponse = gameMasterResponseObj.text || "";

    // Add Game Master's message
    await addGameMessage(gameId, "GameMaster", gameMasterResponse);

    // Extract tagged players from Game Master's message
    const nextPlayerHandle =
      extractNextTaggedPlayer(
        gameMasterResponse,
        activePlayers,
        "GameMaster"
      ) || "GameMaster";

    // Update game state with next player

    await db
      .update(gamesTable)
      .set({
        currentData: {
          ...game.currentData,
          currentTurn: currentTurn + 1,
          nextPlayer: nextPlayerHandle,
        },
      })
      .where(eq(gamesTable.id, gameId));

    response = gameMasterResponse;
  } else {
    // Player's turn
    const { playerAgent } = await import("./prompts/playerPrompt");

    // Find the current player
    const currentPlayer = activePlayers.find((p) => p.handle === nextPlayer);

    if (!currentPlayer) {
      // If player not found, default to Game Master
      await db
        .update(gamesTable)
        .set({
          currentData: {
            ...game.currentData,
            nextPlayer: "GameMaster",
          },
        })
        .where(eq(gamesTable.id, gameId));

      return "Player not found, defaulting to Game Master's turn.";
    }

    // Get player's prompt
    const playerPrompt =
      game.initData.players.find((p) => p.userId === currentPlayer.userId)
        ?.prompt || "";

    // Prepare game history for the prompt
    const gameHistory = messages.slice(-20).map((msg) => ({
      handle: msg.handle,
      message: msg.message,
    }));

    // Call the playerAgent
    const playerResponseObj = await playerAgent({
      playerState: {
        handle: currentPlayer.handle,
        prompt: playerPrompt,
      },
      gameState: {
        id: game.id,
        currentTurn,
        activePlayers: game.currentData.activePlayers,
        gameHistory,
      },
    });

    // Extract the text from the response
    const playerResponse = playerResponseObj.text || "";

    // Add player's message
    await addGameMessage(gameId, currentPlayer.handle, playerResponse);

    // Extract tagged players from player's message
    const nextPlayerHandle =
      extractNextTaggedPlayer(
        playerResponse,
        activePlayers,
        currentPlayer.handle
      ) || "GameMaster";

    // Update game state
    await db
      .update(gamesTable)
      .set({
        currentData: {
          ...game.currentData,
          currentTurn: currentTurn + 1,
          nextPlayer: nextPlayerHandle,
        },
      })
      .where(eq(gamesTable.id, gameId));

    response = playerResponse;
  }

  return response;
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

// Extract all tagged players from a message
function extractNextTaggedPlayer(
  message: string,
  activePlayers: { userId: number; handle: string }[],
  currentPlayer: string
): string | undefined {
  // Look for @username pattern in the message
  const tagRegex = /@(\w+)/g;
  const tags = [...message.matchAll(tagRegex)].map((match) => match[1]);

  // Find all tags that match active player's handle
  const taggedPlayerHandles = tags
    .map((tag) => {
      const taggedPlayer = activePlayers.find(
        (player) => player.handle.toLowerCase() === tag.toLowerCase()
      );

      if (taggedPlayer) {
        return taggedPlayer.handle;
      }

      return null;
    })
    .filter((handle: string | null): handle is string => handle !== null);

  return taggedPlayerHandles.find((handle) => handle !== currentPlayer);
}
