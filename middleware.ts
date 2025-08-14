import { withAuth } from 'next-auth/middleware'

export default withAuth({
  pages: {
    signIn: '/login',
  },
})

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