'use client'
import { createClient } from '@/lib/supabase'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { useEffect, useState } from 'react'

export default function Login() {
    const supabase = createClient()
    const [origin, setOrigin] = useState('')
    const [view, setView] = useState<'login' | 'forgot_password'>('login')
    const [resetEmail, setResetEmail] = useState('')
    const [resetLoading, setResetLoading] = useState(false)
    const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    useEffect(() => {
        setOrigin(window.location.origin)
    }, [])

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setResetLoading(true)
        setResetMessage(null)

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
                redirectTo: `${origin}/auth/callback?next=/reset-password`,
            })

            if (error) throw error

            setResetMessage({
                type: 'success',
                text: 'Check your email for the password reset link.',
            })
        } catch (error: any) {
            setResetMessage({
                type: 'error',
                text: error.message || 'An error occurred',
            })
        } finally {
            setResetLoading(false)
        }
    }

    if (!origin) return null

    return (
        <div className="flex min-h-screen flex-col items-center justify-center py-2 bg-gray-50 dark:bg-gray-900">
            <div className="w-full max-w-md px-8 py-10 bg-white rounded-lg shadow-md dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                {view === 'login' ? (
                    <>
                        <h1 className="mb-6 text-3xl font-bold text-center text-gray-900 dark:text-white">Welcome Back</h1>
                        <div className="relative">
                            <Auth
                                supabaseClient={supabase}
                                appearance={{
                                    theme: ThemeSupa,
                                    style: {
                                        anchor: { display: 'none' }, // Hide default links to avoid confusion
                                        container: { width: '100%' },
                                    },
                                }}
                                theme="dark"
                                providers={[]}
                                redirectTo={`${origin}/auth/callback`}
                                showLinks={false} // Hide default footer links
                            />

                            {/* Custom Footer Links */}
                            <div className="flex flex-col gap-2 mt-4 text-center text-sm">
                                <button
                                    onClick={() => setView('forgot_password')}
                                    className="text-gray-500 hover:text-gray-300 transition-colors"
                                >
                                    Forgot your password?
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="space-y-6">
                        <div className="text-center">
                            <h1 className="text-2xl font-bold text-white mb-2">Reset Password</h1>
                            <p className="text-gray-400 text-sm">Enter your email to receive instructions.</p>
                        </div>

                        <form onSubmit={handleResetPassword} className="space-y-4">
                            <div>
                                <input
                                    type="email"
                                    required
                                    value={resetEmail}
                                    onChange={(e) => setResetEmail(e.target.value)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                    placeholder="Your email address"
                                />
                            </div>

                            {resetMessage && (
                                <div className={`p-3 rounded-md text-sm ${resetMessage.type === 'success' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-red-500/10 text-red-400'
                                    }`}>
                                    {resetMessage.text}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={resetLoading}
                                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-md transition-colors disabled:opacity-50"
                            >
                                {resetLoading ? 'Sending...' : 'Send Instructions'}
                            </button>

                            <button
                                type="button"
                                onClick={() => setView('login')}
                                className="w-full text-gray-500 hover:text-white text-sm transition-colors"
                            >
                                Back to Sign In
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    )
}
