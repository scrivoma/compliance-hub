import { promises as fs } from 'fs'
import { join } from 'path'

const SETTINGS_FILE = join(process.cwd(), 'rag-settings.json')

export interface RAGSettings {
  llmProvider: 'anthropic' | 'openai' | 'google'
  model: string
  customModel: string
  sourceDocuments: number
  temperature: number
  maxTokens: number
}

export const DEFAULT_SETTINGS: RAGSettings = {
  llmProvider: 'anthropic',
  model: 'claude-3-5-haiku-20241022',
  customModel: '',
  sourceDocuments: 20,
  temperature: 0.1,
  maxTokens: 2000
}

export async function getCurrentSettings(): Promise<RAGSettings> {
  try {
    const fileContent = await fs.readFile(SETTINGS_FILE, 'utf-8')
    const settings = JSON.parse(fileContent)
    return { ...DEFAULT_SETTINGS, ...settings }
  } catch (error) {
    // File doesn't exist or is invalid, return defaults
    return DEFAULT_SETTINGS
  }
}

export async function saveSettings(settings: RAGSettings): Promise<void> {
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2))
}