"use client"

import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { createClient } from '@/lib/supabase'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

interface AuthModalProps {
    isOpen: boolean
    onClose: () => void
    message?: string
}

export function AuthModal({ isOpen, onClose, message = "Sign in to your account" }: AuthModalProps) {
    const supabase = createClient()
    const [view, setView] = useState<'login' | 'forgot_password'>('login')
    const [resetEmail, setResetEmail] = useState('')
    const [resetLoading, setResetLoading] = useState(false)
    const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    useEffect(() => {
        setOrigin(window.location.origin)

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                onClose()
                window.location.href = '/dashboard'
            }
        })

        return () => subscription.unsubscribe()
    }, [onClose, supabase.auth])

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
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open) {
                onClose()
                // Reset view after a delay to allow animation to finish
                setTimeout(() => setView('login'), 300)
            }
        }}>
            <DialogContent className="sm:max-w-md bg-black/80 backdrop-blur-2xl border-white/10 text-white p-8 rounded-[2rem] overflow-hidden">
                {/* Background Glow */}
                <div className="absolute -top-24 -left-24 w-48 h-48 bg-cyan-500/10 blur-[60px] rounded-full -z-1" />

                <DialogHeader className="relative z-10">
                    <DialogTitle className="text-3xl font-black tracking-tighter uppercase text-white mb-2">
                        {view === 'login' ? message : 'Reset Password'}
                    </DialogTitle>
                    <DialogDescription className="text-white/40 font-light">
                        {view === 'login' ? 'Unlock high-performance meeting intelligence.' : 'Enter your email to receive instructions.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col space-y-4 py-4 relative z-10">
                    {view === 'login' ? (
                        <>
                            <div className="relative">
                                <Auth
                                    supabaseClient={supabase}
                                    appearance={{
                                        theme: ThemeSupa,
                                        variables: {
                                            default: {
                                                colors: {
                                                    brand: '#06b6d4',
                                                    brandAccent: '#22d3ee',
                                                    inputBackground: 'rgba(255, 255, 255, 0.05)',
                                                    inputText: '#fff',
                                                    inputBorder: 'rgba(255, 255, 255, 0.1)',
                                                    inputPlaceholder: 'rgba(255, 255, 255, 0.3)',
                                                }
                                            }
                                        },
                                        style: {
                                            anchor: { display: 'none' }, // Hide default links
                                            input: { borderRadius: '0.75rem', padding: '1rem' },
                                            button: { borderRadius: '0.75rem', padding: '1rem', fontWeight: 'bold', textTransform: 'uppercase' },
                                        }
                                    }}
                                    theme="dark"
                                    providers={[]}
                                    redirectTo={`${origin}/auth/callback`}
                                    showLinks={false}
                                    onlyThirdPartyProviders={false}
                                />

                                <div className="flex flex-col gap-2 mt-4 text-center text-sm">
                                    <button
                                        onClick={() => setView('forgot_password')}
                                        className="text-white/40 hover:text-white transition-colors text-xs font-medium"
                                    >
                                        Forgot your password?
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="space-y-6">
                            <form onSubmit={handleResetPassword} className="space-y-4">
                                <div>
                                    <input
                                        type="email"
                                        required
                                        value={resetEmail}
                                        onChange={(e) => setResetEmail(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent transition-all"
                                        placeholder="name@example.com"
                                    />
                                </div>

                                {resetMessage && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={`p-3 rounded-xl text-xs font-medium ${resetMessage.type === 'success' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                            }`}
                                    >
                                        {resetMessage.text}
                                    </motion.div>
                                )}

                                <button
                                    type="submit"
                                    disabled={resetLoading}
                                    className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-4 rounded-xl transition-all disabled:opacity-50 uppercase tracking-tight text-sm shadow-lg shadow-cyan-900/20"
                                >
                                    {resetLoading ? 'Sending...' : 'Send Instructions'}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setView('login')}
                                    className="w-full text-white/40 hover:text-white text-xs transition-colors font-medium"
                                >
                                    Back to Sign In
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
