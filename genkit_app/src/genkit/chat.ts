import { MessageData, Session } from "genkit";

import { SessionState } from "./session";
import { sampleAgent } from "./prompts/samplePrompt";

export async function getChatForSession(session: Session<SessionState>) {
  if (!session.state?.currentGameId) {
    throw new Error("Session sample is undefined");
  }

  const dbMessages: {
    userMessage: string;
    agentMessage: string;
  }[] = [];

  // ...

  const messages = dbMessages.reduce((acc, message) => {
    if (message.userMessage) {
      acc.push({
        role: "user",
        content: [{ text: message.userMessage }],
      });
    }
    if (message.agentMessage) {
      acc.push({
        role: "model",
        content: [{ text: message.agentMessage }],
      });
    }
    return acc;
  }, [] as MessageData[]);

  // Use the regular onboarding agent for verified users
  return session.chat(sampleAgent, {
    messages,
    input: {
      sample: {
        value: "sample",
        //...
      },
    },
  });
}
