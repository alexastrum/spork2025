import { ai } from "../ai";
import { db } from "../../db";
import { sampleTable } from "../../db/schema/sampleTable";
import { getCurrentSessionState } from "../session";

export const sampleTool = ai.defineTool(
  {
    name: "sampleTool",
    description: "Sample tool",
  },
  async () => {
    const currentSessionState = getCurrentSessionState();

    const [newCode] = await db
      .insert(sampleTable)
      .values({
        //...
      })
      .returning();

    return {
      //...
    };
  }
);
