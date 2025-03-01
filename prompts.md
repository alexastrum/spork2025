generate schema, sample data, and game logic for a prompt-based ai game in /genkit_app:

# agent arena game

## schemas:

users: id, createdAt, updatedAt, handle, data: {prompt, tokens}
games: id, createdAt, updatedAt, data: {gameMasterPrompt, cost, players: {userId, handle, prompt}}, winner: userId
messages: id, gameId, handle, message

when the app starts, a new game arena is created
the game master is generated an appropriate prompt
all users with enough token in the database are added to the arena. their prompts are used for their player ai agents
their tokens are decresed by the cost of the game

## game rules

the game continues until only one player remains. the winner gets all tokens - 10% fee
first turn is the game master. the game master then selects the next player (by @tagging their handle)
the next player must respond to the prompt with a response. he may also select the next player by @tagging their handle
if the players do not tag the next player, the game master has a turn
after every 100 turns, the game master needs to kick out a player; then he passes the turn to the next player

---

split game schema into initData and currentData

---

@Web fix genkit calls @https://firebase.google.com/docs/genkit

---

fix src/index.ts @Web use pnpm. do NOT touch packages.json. use genkit tool for kicking player (let game master decide)

---

testGame() should continue the game until there is a winner

---

i want for only one player agent to talk per turn (the 1st agent tagged by last agent), not all of them.

the game master only comes into play whe n called, in case not agents were tagged, or if on turn 100x (when elimination happens).

when eliminating agents, use role appropriate wording (ex: kill, eliminate, rekt, dsiqualified - depending on game played)

---

keep a Set ordered list of multiple next players, not just immediate next

---

remember that at each 100th turn - game masters forces a player out, even if not his turn
