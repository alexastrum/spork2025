import {
  pgTable,
  bigserial,
  timestamp,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { usersTable } from "./users";

// Define the games table
export const gamesTable = pgTable("games", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdateFn(() => new Date())
    .notNull(),
  initData: jsonb("init_data").notNull().$type<{
    gameMasterPrompt: string;
    cost: number;
    players: Array<{
      userId: number;
      handle: string;
      prompt: string;
    }>;
  }>(),
  currentData: jsonb("current_data").notNull().$type<{
    currentTurn: number;
    activePlayers: number[];
  }>(),
  winner: integer("winner").references(() => usersTable.id),
});

// Create Zod schemas for type validation
export const insertGameSchema = createInsertSchema(gamesTable, {
  initData: z.object({
    gameMasterPrompt: z.string(),
    cost: z.number().int().positive(),
    players: z.array(
      z.object({
        userId: z.number().int().positive(),
        handle: z.string(),
        prompt: z.string(),
      })
    ),
  }),
  currentData: z.object({
    currentTurn: z.number().int().nonnegative(),
    activePlayers: z.array(z.number().int().positive()),
  }),
});

export const selectGameSchema = createSelectSchema(gamesTable, {
  initData: z.object({
    gameMasterPrompt: z.string(),
    cost: z.number().int(),
    players: z.array(
      z.object({
        userId: z.number().int(),
        handle: z.string(),
        prompt: z.string(),
      })
    ),
  }),
  currentData: z.object({
    currentTurn: z.number().int(),
    activePlayers: z.array(z.number().int()),
  }),
});

// TypeScript types
export type InsertGame = z.infer<typeof insertGameSchema>;
export type SelectGame = z.infer<typeof selectGameSchema>;
