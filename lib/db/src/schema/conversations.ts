import { integer, pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { modelsTable } from "./models";

export const conversations = pgTable(
  "conversations",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id"),
    modelId: integer("model_id")
      .notNull()
      .references(() => modelsTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("conversations_user_model_idx").on(table.userId, table.modelId),
  ]
);

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
