import { boolean, integer, pgTable, real, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const modelsTable = pgTable("models", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  modelId: text("model_id").notNull(),
  description: text("description"),
  temperature: real("temperature").notNull().default(0.7),
  maxTokens: integer("max_tokens").notNull().default(8192),
  systemPrompt: text("system_prompt"),
  topP: real("top_p").notNull().default(1.0),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertModelSchema = createInsertSchema(modelsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertModel = z.infer<typeof insertModelSchema>;
export type ModelRecord = typeof modelsTable.$inferSelect;
