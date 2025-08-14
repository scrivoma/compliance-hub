'use client'

import { useEffect, useState } from 'react'
import { Mic, MicOff, X } from 'lucide-react'

export interface AnimatedSphereProps {
  isConnected: boolean
  isListening: boolean
  isSpeaking: boolean
  isProcessing: boolean
  onClose: () => void
  className?: string
}

export function AnimatedSphere({
  isConnected,
  isListening,
  isSpeaking,
  isProcessing,
  onClose,
  className = ''
}: AnimatedSphereProps) {
  const [audioLevel, setAudioLevel] = useState(0)

  // Simulate audio levels for speaking animation
  useEffect(() => {
    if (isSpeaking) {
      const interval = setInterval(() => {
        setAudioLevel(Math.random() * 0.8 + 0.2) // Random level between 0.2 and 1.0
      }, 100)
      
      return () => clearInterval(interval)
    } else {
      setAudioLevel(0)
    }
  }, [isSpeaking])

  const getSphereState = () => {
    if (!isConnected) return 'disconnected'
    if (isSpeaking) return 'speaking'
    if (isListening) return 'listening'
    if (isProcessing) return 'processing'
    return 'idle'
  }

  const state = getSphereState()

  const sphereConfig = {
    disconnected: {
      baseColor: 'bg-gray-400',
      glowColor: 'shadow-gray-400/20',
      animation: '',
      size: 'w-32 h-32'
    },
    idle: {
      baseColor: 'bg-gradient-to-br from-indigo-500 to-purple-600',
      glowColor: 'shadow-indigo-500/30',
      animation: 'animate-pulse',
      size: 'w-32 h-32'
    },
    listening: {
      baseColor: 'bg-gradient-to-br from-blue-500 to-cyan-500',
      glowColor: 'shadow-blue-500/40',
      animation: 'animate-pulse',
      size: 'w-36 h-36'
    },
    processing: {
      baseColor: 'bg-gradient-to-br from-yellow-500 to-orange-500',
      glowColor: 'shadow-yellow-500/40',
      animation: 'animate-spin',
      size: 'w-34 h-34'
    },
    speaking: {
      baseColor: 'bg-gradient-to-br from-green-500 to-emerald-500',
      glowColor: 'shadow-green-500/50',
      animation: '',
      size: 'w-40 h-40'
    }
  }

  const config = sphereConfig[state]

  // Calculate dynamic scale based on audio level for speaking state
  const dynamicScale = isSpeaking ? 1 + (audioLevel * 0.3) : 1

  const handleBackdropClick = (e: React.MouseEvent) => {
    // Only close if clicking directly on the backdrop, not on child elements
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div 
      className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center ${className}`}
      onClick={handleBackdropClick}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 transition-colors flex items-center justify-center"
        aria-label="Close voice assistant"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Connection status indicator */}
      <div className="absolute top-6 left-6 flex items-center space-x-2 text-white/80 text-sm">
        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
      </div>

      {/* Main sphere container */}
      <div className="relative flex flex-col items-center space-y-8">
        
        {/* Animated sphere */}
        <div className="relative">
          {/* Outer glow rings for speaking state */}
          {isSpeaking && (
            <>
              <div 
                className="absolute inset-0 rounded-full bg-green-400/20 animate-ping"
                style={{ 
                  transform: `scale(${1.5 + audioLevel * 0.5})`,
                  animationDuration: '1s'
                }}
              />
              <div 
                className="absolute inset-0 rounded-full bg-green-400/10 animate-ping"
                style={{ 
                  transform: `scale(${2 + audioLevel * 0.8})`,
                  animationDuration: '1.5s'
                }}
              />
            </>
          )}
          
          {/* Main sphere */}
          <div
            className={`
              ${config.size} 
              ${config.baseColor} 
              ${config.glowColor}
              ${config.animation}
              rounded-full 
              shadow-2xl
              transition-all 
              duration-300 
              ease-in-out
              relative
              overflow-hidden
            `}
            style={{
              transform: `scale(${dynamicScale})`,
              boxShadow: isSpeaking 
                ? `0 0 ${40 + audioLevel * 60}px ${10 + audioLevel * 20}px rgba(34, 197, 94, ${0.3 + audioLevel * 0.4})`
                : undefined
            }}
          >
            {/* Inner sphere elements */}
            <div className="absolute inset-2 rounded-full bg-white/10 backdrop-blur-sm" />
            <div className="absolute inset-4 rounded-full bg-white/5" />
            
            {/* Center icon based on state */}
            <div className="absolute inset-0 flex items-center justify-center">
              {state === 'listening' && (
                <Mic className="h-8 w-8 text-white animate-pulse" />
              )}
              {state === 'disconnected' && (
                <MicOff className="h-8 w-8 text-white/60" />
              )}
              {(state === 'speaking' || state === 'processing') && (
                <div className="flex space-x-1">
                  <div className="w-2 h-6 bg-white/80 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-8 bg-white/80 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-6 bg-white/80 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                </div>
              )}
            </div>

            {/* Animated particles for speaking state */}
            {isSpeaking && (
              <div className="absolute inset-0 overflow-hidden rounded-full">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-2 h-2 bg-white/30 rounded-full animate-ping"
                    style={{
                      left: `${20 + Math.cos(i * Math.PI / 4) * 30}%`,
                      top: `${50 + Math.sin(i * Math.PI / 4) * 30}%`,
                      animationDelay: `${i * 0.2}s`,
                      animationDuration: `${1 + Math.random()}s`
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Status text */}
        <div className="text-center space-y-2">
          <div className="text-white text-lg font-medium">
            {state === 'disconnected' && 'Disconnected'}
            {state === 'idle' && 'Ready to chat'}
            {state === 'listening' && 'Listening...'}
            {state === 'processing' && 'Processing...'}
            {state === 'speaking' && 'Speaking...'}
          </div>
          
          {state === 'listening' && (
            <div className="text-white/60 text-sm">
              Speak now, I'm listening
            </div>
          )}
          
          {state === 'idle' && isConnected && (
            <div className="text-white/60 text-sm">
              Start talking or ask me anything
            </div>
          )}
          
          {state === 'disconnected' && (
            <div className="text-white/60 text-sm">
              Connection lost. Please try again.
            </div>
          )}
        </div>

        {/* Audio level indicator for listening */}
        {isListening && (
          <div className="flex space-x-1 h-8 items-end">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-2 bg-blue-400 rounded-full animate-pulse"
                style={{
                  height: `${20 + Math.random() * 20}px`,
                  animationDelay: `${i * 0.1}s`
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}