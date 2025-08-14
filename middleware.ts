import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    // Middleware function runs after authentication check
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => {
        // Return true if user has a valid token
        return !!token
      },
    },
    pages: {
      signIn: '/login',
    },
  }
)

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/search/:path*',
    '/library/:path*',
    '/admin/:path*',
    '/settings/:path*',
    // Protect API routes but allow PDF serving
    '/api/documents/upload/:path*',
    '/api/search/:path*',
    '/api/users/:path*',
    '/api/settings/:path*',
    '/api/voice/:path*',
    // Note: /api/documents/[id]/pdf is handled by getServerSession in the route
  ],
}