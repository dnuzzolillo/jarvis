import OpenAI from "openai";

export const openaiClient = new OpenAI({
    baseURL: process.env.OPENAI_API_BASE_URL || null,
});