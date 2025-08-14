import Link from 'next/link'
import { FileSearch, Library, Shield } from 'lucide-react'

export function LandingPage() {
  return (
    <div className="relative">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
            <span className="block mb-2">Compliance Hub</span>
            <span className="block text-indigo-600">Sports Betting Regulatory Documents</span>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-base text-gray-500 sm:text-lg md:mt-5 md:max-w-3xl md:text-xl">
            AI-powered search and comprehensive library of regulatory compliance documents for sports betting and online gaming across all US states.
          </p>
          <div className="mx-auto mt-5 max-w-md sm:flex sm:justify-center md:mt-8">
            <Link
              href="/login"
              className="flex w-full items-center justify-center rounded-md border border-transparent bg-indigo-600 px-8 py-3 text-base font-medium text-white hover:bg-indigo-700 md:py-4 md:px-10 md:text-lg"
            >
              Get Started
            </Link>
          </div>
        </div>

        <div className="mt-20">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div className="pt-6">
              <div className="flow-root rounded-lg bg-white px-6 pb-8 shadow">
                <div className="-mt-6">
                  <div className="inline-flex items-center justify-center rounded-md bg-indigo-500 p-3 shadow-lg">
                    <FileSearch className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="mt-8 text-lg font-medium tracking-tight text-gray-900">AI-Powered Search</h3>
                  <p className="mt-5 text-base text-gray-500">
                    Natural language search with AI-extracted citations that link directly to source documents and highlight relevant sections.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <div className="flow-root rounded-lg bg-white px-6 pb-8 shadow">
                <div className="-mt-6">
                  <div className="inline-flex items-center justify-center rounded-md bg-indigo-500 p-3 shadow-lg">
                    <Library className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="mt-8 text-lg font-medium tracking-tight text-gray-900">Document Library</h3>
                  <p className="mt-5 text-base text-gray-500">
                    Browse and filter regulatory documents by state and category. Access PDFs with advanced viewer and search capabilities.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <div className="flow-root rounded-lg bg-white px-6 pb-8 shadow">
                <div className="-mt-6">
                  <div className="inline-flex items-center justify-center rounded-md bg-indigo-500 p-3 shadow-lg">
                    <Shield className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="mt-8 text-lg font-medium tracking-tight text-gray-900">Compliance Teams</h3>
                  <p className="mt-5 text-base text-gray-500">
                    Secure access for compliance teams with organization-based authentication and search history tracking.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}