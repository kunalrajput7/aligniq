'use client'

import { createClient } from '@/lib/supabase'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Sparkles, ArrowRight, Lock, CheckCircle2, AlertCircle } from 'lucide-react'

export default function ResetPassword() {
    const supabase = createClient()
    const router = useRouter()
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    useEffect(() => {
        // Check if we have a session (should be present if redirected from recovery link)
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                setMessage({ type: 'error', text: 'Invalid or expired reset link. Please request a new one.' })
            }
        }
        checkSession()
    }, [supabase.auth])

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault()
        if (password !== confirmPassword) {
            setMessage({ type: 'error', text: 'Passwords do not match.' })
            return
        }

        if (password.length < 6) {
            setMessage({ type: 'error', text: 'Password must be at least 6 characters.' })
            return
        }

        setLoading(true)
        setMessage(null)

        const { error } = await supabase.auth.updateUser({ password })

        if (error) {
            setMessage({ type: 'error', text: error.message })
        } else {
            setMessage({ type: 'success', text: 'Password updated successfully! Redirecting to login...' })
            setTimeout(() => {
                router.push('/login')
            }, 2000)
        }
        setLoading(false)
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-black selection:bg-cyan-500/30 overflow-hidden relative">
            {/* Cinematic Background Elements */}
            <div className="noise-overlay fixed inset-0 z-[1] pointer-events-none opacity-20" />
            <div className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 blur-[120px] rounded-full pointer-events-none z-0" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md relative z-10"
            >
                <div className="glass-dark rounded-[2.5rem] p-10 border border-white/5 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-transparent opacity-50 pointer-events-none" />

                    <div className="relative z-10">
                        <div className="flex justify-center mb-8">
                            <motion.div
                                whileHover={{ scale: 1.1, rotate: 5 }}
                                className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10"
                            >
                                <Lock size={32} className="text-cyan-400" />
                            </motion.div>
                        </div>

                        <h1 className="text-4xl font-black text-white text-center tracking-tighter uppercase mb-2">
                            Reset Password
                        </h1>
                        <p className="text-white/40 text-center font-light text-sm mb-10">
                            Secure your account with a new password.
                        </p>

                        <form onSubmit={handleReset} className="space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-black tracking-widest text-white/30 ml-1">New Password</label>
                                    <div className="relative group/input">
                                        <input
                                            type="password"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-white/20 outline-none focus:border-cyan-500/50 focus:bg-white/[0.07] transition-all group-hover/input:border-white/20"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-black tracking-widest text-white/30 ml-1">Confirm Password</label>
                                    <div className="relative group/input">
                                        <input
                                            type="password"
                                            required
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-white/20 outline-none focus:border-cyan-500/50 focus:bg-white/[0.07] transition-all group-hover/input:border-white/20"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>
                            </div>

                            {message && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className={`p-4 rounded-2xl flex items-start gap-3 ${message.type === 'success' ? 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'
                                        }`}
                                >
                                    {message.type === 'success' ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> : <AlertCircle size={18} className="mt-0.5 shrink-0" />}
                                    <p className="text-xs font-medium leading-relaxed">{message.text}</p>
                                </motion.div>
                            )}

                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                disabled={loading}
                                className="w-full bg-white text-black py-4 rounded-2xl font-black uppercase tracking-tight hover:bg-cyan-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group shadow-xl"
                            >
                                {loading ? 'Updating...' : 'Update Password'}
                                {!loading && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
                            </motion.button>
                        </form>
                    </div>
                </div>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-8 text-center"
                >
                    <button
                        onClick={() => router.push('/login')}
                        className="text-white/20 hover:text-white transition-colors text-[10px] uppercase font-black tracking-[0.3em] flex items-center justify-center gap-2 mx-auto group"
                    >
                        Return to Login
                        <div className="w-6 h-[1px] bg-white/10 group-hover:w-12 group-hover:bg-cyan-500 transition-all" />
                    </button>
                </motion.div>
            </motion.div>

            {/* Visual Grid Background */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-0" style={{
                backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                backgroundSize: '32px 32px'
            }} />
        </div>
    )
}
