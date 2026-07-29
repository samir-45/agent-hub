import OpenAI from "openai";

if (!process.env.OPENROUTER_API_KEY) {
  throw new Error(
    "OPENROUTER_API_KEY must be set. Please add your OpenRouter API key as a secret.",
  );
}

export const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});
