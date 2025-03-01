import { genkit } from "genkit/beta";
import { googleAI, gemini20Flash } from "@genkit-ai/googleai";

// Initialize Genkit with Google AI
export const ai = genkit({
  plugins: [googleAI()],
  model: gemini20Flash,
});
