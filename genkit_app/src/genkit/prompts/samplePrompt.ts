import { z } from "zod";
import { ai } from "../ai";

// Define the input schema for the sample agent
const sampleSchema = z.object({
  value: z.string(),
});

// Define the sample prompt
const samplePrompt = `
This is a sample prompt for testing purposes.

Sample value: {{sample.value}}

Please respond with a simple greeting.
`;

// Create the sample agent using the latest GenKit API
export const sampleAgent = ai.definePrompt({
  name: "sampleAgent",
  description: "Sample agent for testing",
  input: {
    schema: z.object({
      sample: sampleSchema,
    }),
  },
  prompt: samplePrompt,
});
