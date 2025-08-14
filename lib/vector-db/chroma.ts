import { ChromaClient } from 'chromadb'
import OpenAI from 'openai'

const CHROMA_HOST = process.env.CHROMA_HOST || 'localhost'
const CHROMA_PORT = process.env.CHROMA_PORT || '8000'
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!

class VectorDatabase {
  private client: ChromaClient
  private openai: OpenAI
  private collection: any
  private initialized: boolean = false
  
  constructor() {
    console.log(`Connecting to ChromaDB at ${CHROMA_HOST}:${CHROMA_PORT}`)
    this.client = new ChromaClient({
      path: `http://${CHROMA_HOST}:${CHROMA_PORT}`
    })
    
    this.openai = new OpenAI({
      apiKey: OPENAI_API_KEY
    })
  }
  
  async createEmbedding(text: string): Promise<number[]> {
    try {
      console.log(`Creating embedding for text (${text.length} chars)...`)
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text
      })
      
      console.log('✓ Embedding created successfully')
      return response.data[0].embedding
    } catch (error) {
      console.error('Failed to create embedding:', error)
      console.error('Error details:', error)
      throw error
    }
  }
  
  async initialize() {
    if (this.initialized) return
    
    try {
      this.collection = await this.client.getOrCreateCollection({
        name: 'compliance-documents',
        metadata: {
          description: 'Sports betting compliance documents with embeddings'
        }
      })
      
      this.initialized = true
      console.log('ChromaDB collection initialized')
    } catch (error) {
      console.error('Failed to initialize ChromaDB:', error)
      throw error
    }
  }
  
  async addDocument({
    id,
    content,
    metadata
  }: {
    id: string
    content: string
    metadata: Record<string, any>
  }) {
    try {
      if (!this.initialized) {
        await this.initialize()
      }
      
      console.log(`Adding document to ChromaDB: ${id}`)
      
      // Create embedding manually
      const embedding = await this.createEmbedding(content)
      
      console.log(`Adding to collection: ${id}`)
      await this.collection.add({
        ids: [id],
        documents: [content],
        metadatas: [metadata],
        embeddings: [embedding]
      })
      
      console.log(`✓ Successfully added to ChromaDB: ${id}`)
      return id
    } catch (error) {
      console.error('Failed to add document to ChromaDB:', error)
      console.error('Error details:', error)
      throw error
    }
  }
  
  async searchDocuments(query: string, limit: number = 5) {
    try {
      if (!this.initialized) {
        await this.initialize()
      }
      
      // Create embedding for the query
      const queryEmbedding = await this.createEmbedding(query)
      
      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: limit,
        include: ['documents', 'metadatas', 'distances']
      })
      
      return results
    } catch (error) {
      console.error('Failed to search documents:', error)
      throw error
    }
  }
  
  async deleteDocument(id: string) {
    try {
      if (!this.initialized) {
        await this.initialize()
      }
      
      await this.collection.delete({
        ids: [id]
      })
    } catch (error) {
      console.error('Failed to delete document:', error)
      throw error
    }
  }
}

export const vectorDB = new VectorDatabase()
export { VectorDatabase }