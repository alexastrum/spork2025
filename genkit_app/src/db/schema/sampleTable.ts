import { pgTable, bigserial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Define the table
export const sampleTable = pgTable("samples", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdateFn(() => new Date())
    .notNull(),
  //...
});

// Create Zod schemas for type validation
export const insertSampleSchema = createInsertSchema(sampleTable, {});

export const selectSampleSchema = createSelectSchema(sampleTable, {});

// TypeScript types
export type InsertSample = z.infer<typeof insertSampleSchema>;
export type SelectSample = z.infer<typeof selectSampleSchema>;
