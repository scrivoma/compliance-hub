import OpenAI from 'openai'

// Create OpenAI client lazily to avoid build-time errors
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy-key-for-build'
})

// Check at runtime when actually used
export function validateOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required')
  }
}