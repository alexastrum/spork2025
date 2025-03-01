import dotenv from "dotenv";

dotenv.config();

import { createSession } from "./genkit/session";
import { getChatForSession } from "./genkit/chat";

async function main() {
  console.log("main()");

  const session = await createSession();
  const chat = await getChatForSession(session);
  const result = await chat.send("Hello, world!");
  console.log(result.text);
}

main();
