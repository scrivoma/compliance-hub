export interface VoiceResponse {
  text: string
  audioUrl?: string
  type: 'text' | 'audio' | 'function_call'
  metadata?: Record<string, any>
}

export interface VoiceConnectionConfig {
  model: string
  systemInstruction?: string
  tools?: any[]
  generationConfig?: {
    temperature?: number
    maxOutputTokens?: number
    responseMimeType?: string
  }
}

export interface AudioConfig {
  sampleRate: number
  channels: number
  format: 'PCM16' | 'WEBM'
}

export class GeminiLiveClient {
  private ws: WebSocket | null = null
  private isConnected = false
  private messageHandlers: Map<string, (data: any) => void> = new Map()
  private config: VoiceConnectionConfig
  private audioConfig: AudioConfig
  private sessionId: string | null = null

  constructor(config: VoiceConnectionConfig) {
    this.config = {
      model: 'models/gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
        responseMimeType: 'audio/pcm'
      },
      ...config
    }
    
    this.audioConfig = {
      sampleRate: 16000,
      channels: 1,
      format: 'PCM16'
    }
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Get ephemeral token for secure connection
        this.getEphemeralToken().then(token => {
          const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${token}`
          
          this.ws = new WebSocket(wsUrl)
          
          this.ws.onopen = () => {
            console.log('Gemini Live API connected')
            this.isConnected = true
            this.setupSession()
            resolve()
          }
          
          this.ws.onmessage = (event) => {
            this.handleMessage(event.data)
          }
          
          this.ws.onclose = (event) => {
            console.log('Gemini Live API disconnected:', event.code, event.reason)
            this.isConnected = false
            this.cleanup()
          }
          
          this.ws.onerror = (error) => {
            console.error('Gemini Live API error:', error)
            this.isConnected = false
            reject(error)
          }
        }).catch(reject)
        
      } catch (error) {
        reject(error)
      }
    })
  }

  private async getEphemeralToken(): Promise<string> {
    try {
      const response = await fetch('/api/voice/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to get ephemeral token')
      }
      
      const { token } = await response.json()
      return token
    } catch (error) {
      console.error('Error getting ephemeral token:', error)
      throw error
    }
  }

  private setupSession(): void {
    if (!this.ws || !this.isConnected) return

    const setupMessage = {
      setup: {
        model: this.config.model,
        systemInstruction: {
          parts: [{
            text: this.config.systemInstruction || this.getDefaultSystemInstruction()
          }]
        },
        generationConfig: this.config.generationConfig,
        tools: this.config.tools || []
      }
    }

    this.sendMessage(setupMessage)
  }

  private getDefaultSystemInstruction(): string {
    return `You are an AI compliance assistant for a sports betting and online gaming regulatory document system.

Your role:
1. Help users search through regulatory documents across different US states
2. Provide accurate, citation-backed information about compliance requirements
3. Ask clarifying questions about which states or jurisdictions the user is interested in
4. Be conversational but professional
5. Always cite specific document sources when providing regulatory information

When a user asks about regulations:
1. First ask which state(s) they're interested in if not specified
2. Search the document database for relevant information
3. Provide clear, accurate answers with proper citations
4. Offer to search additional states for comparison if helpful

Keep responses concise but informative. Use natural, conversational language suitable for voice interaction.`
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data)
      
      if (message.setupComplete) {
        this.sessionId = message.setupComplete.metadata?.sessionId
        console.log('Gemini Live session setup complete')
        this.messageHandlers.get('setup_complete')?.(message)
      }
      
      if (message.serverContent) {
        this.handleServerContent(message.serverContent)
      }
      
      if (message.toolCall) {
        this.handleToolCall(message.toolCall)
      }
      
    } catch (error) {
      console.error('Error handling message:', error)
    }
  }

  private handleServerContent(content: any): void {
    if (content.modelTurn) {
      const parts = content.modelTurn.parts || []
      
      for (const part of parts) {
        if (part.text) {
          this.messageHandlers.get('text_response')?.(part.text)
        }
        
        if (part.inlineData && part.inlineData.mimeType?.startsWith('audio/')) {
          const audioData = part.inlineData.data
          this.messageHandlers.get('audio_response')?.(audioData)
        }
      }
    }
  }

  private handleToolCall(toolCall: any): void {
    // Handle function calls for document search
    this.messageHandlers.get('tool_call')?.(toolCall)
  }

  async sendAudio(audioData: ArrayBuffer): Promise<void> {
    if (!this.ws || !this.isConnected) {
      throw new Error('Not connected to Gemini Live API')
    }

    const message = {
      realtimeInput: {
        mediaChunks: [{
          mimeType: 'audio/pcm',
          data: this.arrayBufferToBase64(audioData)
        }]
      }
    }

    this.sendMessage(message)
  }

  async sendText(text: string): Promise<void> {
    if (!this.ws || !this.isConnected) {
      throw new Error('Not connected to Gemini Live API')
    }

    const message = {
      clientContent: {
        turns: [{
          role: 'user',
          parts: [{
            text: text
          }]
        }],
        turnComplete: true
      }
    }

    this.sendMessage(message)
  }

  private sendMessage(message: any): void {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify(message))
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    bytes.forEach(byte => binary += String.fromCharCode(byte))
    return btoa(binary)
  }

  onMessage(type: string, handler: (data: any) => void): void {
    this.messageHandlers.set(type, handler)
  }

  offMessage(type: string): void {
    this.messageHandlers.delete(type)
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close()
    }
    this.cleanup()
  }

  private cleanup(): void {
    this.ws = null
    this.isConnected = false
    this.sessionId = null
    this.messageHandlers.clear()
  }

  get connected(): boolean {
    return this.isConnected
  }
}

// Utility functions for audio processing
export function convertWebMToPCM(webmBlob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    
    webmBlob.arrayBuffer().then(arrayBuffer => {
      return audioContext.decodeAudioData(arrayBuffer)
    }).then(audioBuffer => {
      // Convert to 16-bit PCM at 16kHz
      const length = audioBuffer.length
      const sampleRate = audioBuffer.sampleRate
      const targetSampleRate = 16000
      const channels = 1 // Mono
      
      // Resample if necessary
      let resampledBuffer = audioBuffer
      if (sampleRate !== targetSampleRate) {
        const ratio = sampleRate / targetSampleRate
        const newLength = Math.floor(length / ratio)
        const resampledData = new Float32Array(newLength)
        
        for (let i = 0; i < newLength; i++) {
          const index = Math.floor(i * ratio)
          resampledData[i] = audioBuffer.getChannelData(0)[index]
        }
        
        resampledBuffer = audioContext.createBuffer(1, newLength, targetSampleRate)
        resampledBuffer.copyToChannel(resampledData, 0)
      }
      
      // Convert to 16-bit PCM
      const pcmData = new Int16Array(resampledBuffer.length)
      const channelData = resampledBuffer.getChannelData(0)
      
      for (let i = 0; i < channelData.length; i++) {
        pcmData[i] = Math.max(-32768, Math.min(32767, channelData[i] * 32767))
      }
      
      resolve(pcmData.buffer)
    }).catch(reject)
  })
}

export function base64ToAudioUrl(base64Data: string, mimeType: string = 'audio/pcm'): string {
  const byteCharacters = atob(base64Data)
  const byteNumbers = new Array(byteCharacters.length)
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  
  const byteArray = new Uint8Array(byteNumbers)
  const blob = new Blob([byteArray], { type: mimeType })
  
  return URL.createObjectURL(blob)
}