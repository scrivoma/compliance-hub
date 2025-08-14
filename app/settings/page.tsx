'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Save, RefreshCw, Settings as SettingsIcon, Users, Shield, Plus, Trash2, Edit } from 'lucide-react'

interface RAGSettings {
  llmProvider: 'anthropic' | 'openai' | 'google'
  model: string
  customModel: string
  sourceDocuments: number
  temperature: number
  maxTokens: number
}

interface User {
  id: string
  email: string
  name: string
  role: 'USER' | 'ADMIN'
  organization: string
  createdAt: string
}

interface NewUser {
  email: string
  name: string
  password: string
  role: 'USER' | 'ADMIN'
  organization: string
}

const PROVIDER_MODELS = {
  anthropic: [
    'claude-opus-4-20250514',
    'claude-sonnet-4-20250514',
    'claude-3-7-sonnet-20250219',
    'claude-3-5-haiku-20241022',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-sonnet-20240620',
    'claude-3-opus-20240229',
    'claude-3-haiku-20240307'
  ],
  openai: [
    'gpt-o4-mini',
    'gpt-o3',
    'gpt-4.1',
    'gpt-4.1-mini',
    'gpt-o3-mini',
    'gpt-4.5',
    'gpt-o1',
    'gpt-4o-mini',
    'gpt-4o',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo'
  ],
  google: [
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite-preview-06-17',
    'gemini-2.5-flash-preview-native-audio-dialog',
    'gemini-2.5-flash-exp-native-audio-thinking-dialog',
    'gemini-2.5-flash-preview-tts',
    'gemini-2.5-pro-preview-tts',
    'gemini-2.0-flash',
    'gemini-2.0-flash-preview-image-generation',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b',
    'gemini-1.5-pro',
    'gemini-embedding-exp-03-07',
    'text-embedding-004',
    'embedding-001'
  ]
}

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const [activeTab, setActiveTab] = useState<'rag' | 'users'>('rag')
  const [settings, setSettings] = useState<RAGSettings>({
    llmProvider: 'anthropic',
    model: 'claude-3-5-haiku-20241022',
    customModel: '',
    sourceDocuments: 5,
    temperature: 0.1,
    maxTokens: 2000
  })
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [useCustomModel, setUseCustomModel] = useState(false)
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [newUser, setNewUser] = useState<NewUser>({
    email: '',
    name: '',
    password: '',
    role: 'USER',
    organization: ''
  })

  useEffect(() => {
    loadSettings()
    if (session?.user?.role === 'ADMIN') {
      loadUsers()
    }
  }, [session])

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings/rag')
      if (response.ok) {
        const data = await response.json()
        setSettings(data.settings)
        setUseCustomModel(!!data.settings.customModel)
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users)
      }
    } catch (error) {
      console.error('Failed to load users:', error)
    }
  }

  const createUser = async () => {
    setSaving(true)
    setMessage('')
    
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newUser)
      })

      if (response.ok) {
        setMessage('User created successfully!')
        setNewUser({
          email: '',
          name: '',
          password: '',
          role: 'USER',
          organization: ''
        })
        setShowCreateUser(false)
        loadUsers()
        setTimeout(() => setMessage(''), 3000)
      } else {
        const data = await response.json()
        setMessage(`Error: ${data.error}`)
      }
    } catch (error) {
      setMessage('Failed to create user')
    } finally {
      setSaving(false)
    }
  }

  const deleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return
    
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setMessage('User deleted successfully!')
        loadUsers()
        setTimeout(() => setMessage(''), 3000)
      } else {
        const data = await response.json()
        setMessage(`Error: ${data.error}`)
      }
    } catch (error) {
      setMessage('Failed to delete user')
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    setMessage('')
    
    try {
      const settingsToSave = { ...settings }
      if (!useCustomModel) {
        settingsToSave.customModel = ''
      }

      const response = await fetch('/api/settings/rag', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ settings: settingsToSave })
      })

      if (response.ok) {
        setMessage('Settings saved successfully!')
        setTimeout(() => setMessage(''), 3000)
      } else {
        const data = await response.json()
        setMessage(`Error: ${data.error}`)
      }
    } catch (error) {
      setMessage('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const resetToDefaults = () => {
    setSettings({
      llmProvider: 'anthropic',
      model: 'claude-3-5-haiku-20241022',
      customModel: '',
      sourceDocuments: 5,
      temperature: 0.1,
      maxTokens: 2000
    })
    setUseCustomModel(false)
  }

  if (status === 'loading' || loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-8"></div>
          <div className="space-y-6">
            <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">Please log in to access settings.</p>
        </div>
      </div>
    )
  }

  // Check if user is authenticated and has admin role
  if (session.user.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-center mb-4">
            <SettingsIcon className="h-12 w-12 text-red-500 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 text-center mb-2">Access Denied</h1>
          <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
            You need administrator privileges to access system settings.
          </p>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4">
            <div className="flex">
              <Shield className="h-5 w-5 text-yellow-400 mr-2 flex-shrink-0" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Settings are restricted to administrators only. Please contact your system administrator if you need access.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const isAdmin = session.user.role === 'ADMIN'

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="mb-8">
        <div className="flex items-center mb-4">
          <SettingsIcon className="h-8 w-8 text-indigo-600 dark:text-indigo-400 mr-3" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Configure your application settings and preferences.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-8">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('rag')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'rag'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-center space-x-2">
                <SettingsIcon className="h-5 w-5" />
                <span>RAG Settings</span>
              </div>
            </button>
            
            {isAdmin && (
              <button
                onClick={() => setActiveTab('users')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'users'
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>User Management</span>
                </div>
              </button>
            )}
          </nav>
        </div>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.includes('Error') 
            ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200' 
            : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-200'
        }`}>
          {message}
        </div>
      )}

      {/* RAG Settings Tab */}
      {activeTab === 'rag' && (
        <div className="space-y-8">
        {/* LLM Provider and Model */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Language Model</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                LLM Provider
              </label>
              <select
                value={settings.llmProvider}
                onChange={(e) => {
                  const provider = e.target.value as RAGSettings['llmProvider']
                  setSettings({
                    ...settings,
                    llmProvider: provider,
                    model: PROVIDER_MODELS[provider][0]
                  })
                  setUseCustomModel(false)
                }}
                className="block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="openai">OpenAI (GPT)</option>
                <option value="google">Google (Gemini)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Model
              </label>
              {useCustomModel ? (
                <input
                  type="text"
                  value={settings.customModel}
                  onChange={(e) => setSettings({ ...settings, customModel: e.target.value })}
                  placeholder="Enter custom model name"
                  className="block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                />
              ) : (
                <select
                  value={settings.model}
                  onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                  className="block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  {PROVIDER_MODELS[settings.llmProvider].map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="mt-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={useCustomModel}
                onChange={(e) => setUseCustomModel(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 dark:text-indigo-400 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 bg-white dark:bg-gray-700"
              />
              <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Use custom model name</span>
            </label>
          </div>
        </div>

        {/* Search Configuration */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Search Configuration</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Source Documents
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={settings.sourceDocuments}
                onChange={(e) => setSettings({ ...settings, sourceDocuments: parseInt(e.target.value) || 5 })}
                className="block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Number of document chunks to retrieve (1-20)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Temperature
              </label>
              <input
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={settings.temperature}
                onChange={(e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) || 0.1 })}
                className="block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Creativity level (0.0 = focused, 2.0 = creative)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Max Tokens
              </label>
              <input
                type="number"
                min="100"
                max="8000"
                value={settings.maxTokens}
                onChange={(e) => setSettings({ ...settings, maxTokens: parseInt(e.target.value) || 2000 })}
                className="block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Maximum response length (100-8000)</p>
            </div>
          </div>
        </div>

        {/* Current Configuration Preview */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 border border-gray-200 dark:border-gray-600">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Current Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">Provider:</span>
              <span className="ml-2 capitalize text-gray-900 dark:text-gray-100">{settings.llmProvider}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">Model:</span>
              <span className="ml-2 text-gray-900 dark:text-gray-100">{useCustomModel ? settings.customModel : settings.model}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">Source Documents:</span>
              <span className="ml-2 text-gray-900 dark:text-gray-100">{settings.sourceDocuments}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">Temperature:</span>
              <span className="ml-2 text-gray-900 dark:text-gray-100">{settings.temperature}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <button
            onClick={resetToDefaults}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </button>
          
          <button
            onClick={saveSettings}
            disabled={saving}
            className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 dark:bg-indigo-600 hover:bg-indigo-700 dark:hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {saving ? (
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
        </div>
      )}

      {/* User Management Tab */}
      {activeTab === 'users' && isAdmin && (
        <div className="space-y-8">
          {/* User Management Header */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">User Management</h2>
                <p className="text-gray-600 dark:text-gray-400 mt-1">Create and manage user accounts</p>
              </div>
              <button
                onClick={() => setShowCreateUser(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 dark:bg-indigo-600 hover:bg-indigo-700 dark:hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create User
              </button>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Organization
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.name}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user.role === 'ADMIN' 
                            ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300' 
                            : 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                        }`}>
                          {user.role === 'ADMIN' ? (
                            <><Shield className="h-3 w-3 mr-1" /> Admin</>
                          ) : (
                            'User'
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {user.organization}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => deleteUser(user.id)}
                          className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 ml-4"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Create User Modal */}
          {showCreateUser && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
              <div className="relative top-20 mx-auto p-5 border border-gray-200 dark:border-gray-700 w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
                <div className="mt-3">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Create New User</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                      <input
                        type="text"
                        value={newUser.name}
                        onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                        className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                        placeholder="Full name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                      <input
                        type="email"
                        value={newUser.email}
                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                        className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                        placeholder="user@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                      <input
                        type="password"
                        value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                        placeholder="Password"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Organization</label>
                      <input
                        type="text"
                        value={newUser.organization}
                        onChange={(e) => setNewUser({ ...newUser, organization: e.target.value })}
                        className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                        placeholder="Organization name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
                      <select
                        value={newUser.role}
                        onChange={(e) => setNewUser({ ...newUser, role: e.target.value as 'USER' | 'ADMIN' })}
                        className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      >
                        <option value="USER">User</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2 mt-6">
                    <button
                      onClick={() => setShowCreateUser(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={createUser}
                      disabled={saving}
                      className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 dark:bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-500 disabled:opacity-50"
                    >
                      {saving ? 'Creating...' : 'Create User'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}