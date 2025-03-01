import {
  pgTable,
  bigserial,
  timestamp,
  text,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { gamesTable } from "./games";

// Define the messages table
export const messagesTable = pgTable("messages", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  gameId: integer("game_id")
    .notNull()
    .references(() => gamesTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  handle: text("handle").notNull(),
  message: text("message").notNull(),
});

// Create Zod schemas for type validation
export const insertMessageSchema = createInsertSchema(messagesTable);

export const selectMessageSchema = createSelectSchema(messagesTable);

// TypeScript types
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type SelectMessage = z.infer<typeof selectMessageSchema>;
