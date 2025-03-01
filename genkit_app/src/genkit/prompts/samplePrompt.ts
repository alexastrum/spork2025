import { z } from "zod";

import { ai } from "../ai";

const samplePrompt = `
...
{{sample.value}}
`;

export const sampleAgent = ai.definePrompt({
  name: "sampleAgent",
  description: "",
  input: {
    schema: z.object({
      sample: z.object({
        value: z.string(),
        //...
      }),
    }),
  },
  tools: [],
  system: samplePrompt,
});
