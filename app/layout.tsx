import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Navbar } from '@/components/layout/navbar'
import { VoiceAssistantElevenLabs } from '@/components/voice/VoiceAssistantElevenLabs'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Compliance Hub - Sports Betting Regulatory Documents',
  description: 'AI-powered regulatory compliance document library for sports betting and online gaming',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-gray-50 dark:bg-gray-900`}>
        <Providers>
          <Navbar />
          <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {children}
          </main>
          <VoiceAssistantElevenLabs />
        </Providers>
      </body>
    </html>
  )
}