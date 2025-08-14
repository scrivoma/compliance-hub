'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'

interface VoiceAssistantProps {
  className?: string
}

export function VoiceAssistantElevenLabs({ className = '' }: VoiceAssistantProps) {
  const { data: session } = useSession()

  // Load the ElevenLabs script
  useEffect(() => {
    if (typeof window !== 'undefined' && !document.querySelector('script[src*="convai-widget-embed"]')) {
      const script = document.createElement('script')
      script.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed'
      script.async = true
      script.type = 'text/javascript'
      document.head.appendChild(script)
    }
  }, [])

  // Don't render if user is not authenticated
  if (!session?.user) {
    return null
  }

  return (
    <div className={`${className}`}>
      {/* Native ElevenLabs Widget - handles its own icon and positioning */}
      <elevenlabs-convai agent-id="agent_01k09mvx7aepg9zy3w59k327ye"></elevenlabs-convai>
    </div>
  )
}