import { genkit } from "genkit/beta";
import { googleAI, gemini20Flash } from "@genkit-ai/googleai";

// Initialize GenKit with Google AI plugin and Gemini model
export const ai = genkit({
  plugins: [googleAI()],
  model: gemini20Flash, // Set default model
});
