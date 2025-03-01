import { eq } from "drizzle-orm";

import { db } from ".";
import * as schema from "./schema";
import { SelectSample } from "./schema/sampleTable";

export async function getOrCreateSample() {
  const sampleId = 0;
  if (!sampleId) {
    throw new Error("Sample ID empty");
  }

  const sample = await db.query.sampleTable.findFirst({
    where: eq(schema.sampleTable.id, sampleId),
  });

  if (!sample) {
    const newSample = await db
      .insert(schema.sampleTable)
      .values({
        id: sampleId,
        //...
      })
      .returning();
    return newSample[0] as SelectSample;
  }

  return sample;
}
