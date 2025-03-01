import { ai } from "../genkit/ai";
import { db } from "./index";
import { usersTable } from "./schema";

/** Generate a handle using AI */
async function generateAIHandle(index: number): Promise<string> {
  // Generate a creative handle using GenKit
  const handlePrompt = `Generate a single unique username/handle for a player in a competitive game. 
  The handle should be creative, memorable, and between 3-15 characters.
  It should feel like a genuine online gaming handle that a player might choose.
  Return ONLY the handle, with no explanation or additional text.
  Make it unique - don't use common handles like "Player1" or generic terms.
  Examples of good handles: "NightStalker", "QuantumQuasar", "FrostByte", "ShadowWeaver", "PixelPunisher"`;

  try {
    const response = await ai.generate({
      prompt: handlePrompt,
    });

    // Clean up the response to ensure it's a valid handle
    let handle = (response.text || "").trim();

    // Remove any quotes or extra characters
    handle = handle.replace(/["']/g, "");

    // If the AI didn't generate a valid handle, use a fallback
    if (!handle || handle.length < 3 || handle.length > 20) {
      const prefixes = ["Agent", "Player", "Gamer", "Bot"];
      const suffix = Math.floor(Math.random() * 1000);
      handle = `${
        prefixes[Math.floor(Math.random() * prefixes.length)]
      }${suffix}`;
    }

    // Add index to ensure uniqueness if multiple handles are generated in the same run
    return `${handle}${index}`;
  } catch (error) {
    console.error("Error generating AI handle:", error);
    // Fallback to simple random handle
    const prefixes = ["Agent", "Player", "User", "Gamer", "Bot"];
    const suffix = Math.floor(Math.random() * 1000);
    return `${prefixes[Math.floor(Math.random() * prefixes.length)]}${suffix}`;
  }
}

export async function createSampleUsers(): Promise<
  {
    handle: string;
    prompt: string;
    tokens: number;
  }[]
> {
  // Generate 3-5 random users
  const numUsers = Math.floor(Math.random() * 3) + 3; // 3 to 5 users
  const users = [];

  // Generate character prompts using GenKit
  const characterPrompt = `Create a unique character for an AI agent in a text-based game. 
  The character should have a distinct personality, background, and motivations.
  Format the response as a concise character description that can be used as a prompt for the AI agent.
  Make the character interesting, with clear goals and a unique voice.
  Keep the description under 200 words.`;

  for (let i = 0; i < numUsers; i++) {
    // Generate AI handle
    const handle = await generateAIHandle(i);

    // Generate character prompt using GenKit
    const response = await ai.generate({
      prompt: characterPrompt,
    });

    const prompt =
      response.text ||
      `I am ${handle}, a strategic player who aims to win by making alliances and breaking them at the right time.`;

    // Create user with random token amount (100-500)
    const tokens = Math.floor(Math.random() * 401) + 100;

    const user = {
      handle,
      prompt,
      tokens,
    };

    users.push(user);

    // Insert user into database
    await db.insert(usersTable).values({
      handle: user.handle,
      data: {
        prompt: user.prompt,
        tokens: user.tokens,
      },
    });
  }

  console.log(`Created ${users.length} sample users`);
  return users;
}

export async function createSampleGameMasterPrompts(): Promise<string> {
  // Generate a random game scenario using GenKit
  const gameTypes = [
    "survival game",
    "mystery investigation",
    "fantasy adventure",
    "political intrigue",
    "space exploration",
    "post-apocalyptic scenario",
    "supernatural horror",
    "competitive tournament",
  ];

  const selectedGameType =
    gameTypes[Math.floor(Math.random() * gameTypes.length)];

  const gameMasterPromptTemplate = `Create a game master prompt for a ${selectedGameType} scenario.
  The prompt should establish the setting, rules, and objectives for the players.
  Players will be AI agents competing against each other, with only one winner at the end.
  Include specific details about the environment, challenges, and win conditions.
  The game master should have a distinct personality and tone appropriate for the ${selectedGameType}.
  Keep the prompt under 300 words.`;

  // Generate game master prompt using GenKit
  const response = await ai.generate({
    prompt: gameMasterPromptTemplate,
  });

  const gameMasterPrompt =
    response.text ||
    `Welcome to the Agent Arena! This is a ${selectedGameType} where only one player will survive. Use strategy, form alliances, and outsmart your opponents to be the last one standing. The winner takes all the tokens minus a 10% fee. Good luck!`;

  console.log("Generated game master prompt:", gameMasterPrompt);
  return gameMasterPrompt;
}
