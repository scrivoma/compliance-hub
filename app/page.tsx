import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { LandingPage } from '@/components/landing/LandingPage'

export default async function Home() {
  // Check if user is authenticated
  const session = await getServerSession(authOptions)
  
  // If user is logged in, redirect to dashboard
  if (session?.user) {
    redirect('/dashboard')
  }
  
  // If user is not logged in, show landing page
  return <LandingPage />
}