import {
  pgTable,
  bigserial,
  timestamp,
  text,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Define the users table
export const usersTable = pgTable("users", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdateFn(() => new Date())
    .notNull(),
  handle: text("handle").notNull().unique(),
  data: jsonb("data").notNull().$type<{
    prompt: string;
    tokens: number;
  }>(),
});

// Create Zod schemas for type validation
export const insertUserSchema = createInsertSchema(usersTable, {
  data: z.object({
    prompt: z.string(),
    tokens: z.number().int().positive(),
  }),
});

export const selectUserSchema = createSelectSchema(usersTable, {
  data: z.object({
    prompt: z.string(),
    tokens: z.number().int(),
  }),
});

// TypeScript types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type SelectUser = z.infer<typeof selectUserSchema>;
