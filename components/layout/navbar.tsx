'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'
import { Search, LogOut, User, Library, Settings, Shield } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { useTheme } from 'next-themes'
import { useState, useEffect } from 'react'

export function Navbar() {
  const { data: session } = useSession()
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const isAdmin = session?.user?.role === 'ADMIN'

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <nav className="bg-background border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link href="/" className="flex items-center">
              <Image 
                src={mounted && theme === 'dark' ? "/IC360-logo_dark2.png" : "/IC360-logo.png"}
                alt="IC360 Logo" 
                width={200} 
                height={50} 
                className="h-12 w-auto object-contain"
                priority
              />
            </Link>
            {session && (
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-foreground hover:text-primary"
                >
                  Dashboard
                </Link>
                <Link
                  href="/search"
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-foreground hover:text-primary"
                >
                  <Search className="h-4 w-4 mr-1" />
                  AI Search
                </Link>
                <Link
                  href="/documents"
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-foreground hover:text-primary"
                >
                  <Library className="h-4 w-4 mr-1" />
                  Documents
                </Link>
                {isAdmin && (
                  <>
                    <Link
                      href="/admin"
                      className="inline-flex items-center px-1 pt-1 text-sm font-medium text-foreground hover:text-primary"
                    >
                      <Shield className="h-4 w-4 mr-1" />
                      Doc Admin
                    </Link>
                    <Link
                      href="/settings"
                      className="inline-flex items-center px-1 pt-1 text-sm font-medium text-foreground hover:text-primary"
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      Settings
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            {session ? (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">
                    <User className="inline h-4 w-4 mr-1" />
                    {session.user?.name || session.user?.email}
                  </span>
                  {isAdmin && (
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                      <Shield className="h-3 w-3 mr-1" />
                      Admin
                    </span>
                  )}
                </div>
                <button
                  onClick={() => signOut()}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
                >
                  <LogOut className="h-4 w-4 mr-1" />
                  Sign Out
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}