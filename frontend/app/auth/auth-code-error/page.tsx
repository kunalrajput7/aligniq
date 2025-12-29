'use client'

import { motion } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react'

export default function AuthCodeError() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const error = searchParams.get('error')
    const description = searchParams.get('description')

    const errorMessages: Record<string, string> = {
        'otp_expired': 'The verification link has expired. This can happen if the link was already used or if it has been more than an hour since it was requested.',
        'access_denied': 'Access was denied. This might be due to security settings or an invalid verification attempt.',
        'verification_failed': 'The authentication link is invalid. Please make sure you are using the most recent link sent to your email.',
        'no_verification_data': 'No verification data was found. Please try requesting a new link from the login page.',
        'default': 'Something went wrong during the authentication process. Please try again or request a new link.'
    }

    const message = errorMessages[error as string] || errorMessages.default
    const displayDescription = description ? decodeURIComponent(description) : null

    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-black selection:bg-cyan-500/30 overflow-hidden relative">
            {/* Cinematic Background Elements */}
            <div className="noise-overlay fixed inset-0 z-[1] pointer-events-none opacity-20" />
            <div className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-500/5 blur-[120px] rounded-full pointer-events-none z-0" />

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md relative z-10"
            >
                <div className="glass-dark rounded-[2.5rem] p-10 border border-white/5 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 via-transparent to-transparent opacity-50 pointer-events-none" />

                    <div className="relative z-10">
                        <div className="flex justify-center mb-8">
                            <motion.div
                                whileHover={{ scale: 1.1, rotate: -5 }}
                                className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10"
                            >
                                <AlertCircle size={32} className="text-red-400" />
                            </motion.div>
                        </div>

                        <h1 className="text-4xl font-black text-white text-center tracking-tighter uppercase mb-4">
                            Auth Error
                        </h1>
                        <p className="text-white/60 text-center font-light text-sm mb-4 leading-relaxed">
                            {message}
                        </p>
                        {displayDescription && (
                            <p className="text-white/30 text-center font-mono text-[10px] mb-10 break-all p-3 bg-white/5 rounded-xl">
                                {displayDescription}
                            </p>
                        )}

                        <div className="space-y-4">
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => router.push('/login')}
                                className="w-full bg-white text-black py-4 rounded-2xl font-black uppercase tracking-tight hover:bg-red-50 transition-all flex items-center justify-center gap-2 group shadow-xl"
                            >
                                <RefreshCw size={18} className="group-hover:rotate-180 transition-transform duration-500" />
                                Try Again
                            </motion.button>

                            <button
                                onClick={() => router.push('/')}
                                className="w-full py-4 text-white/30 hover:text-white transition-colors text-[10px] uppercase font-black tracking-[0.3em] flex items-center justify-center gap-2 group"
                            >
                                <ArrowLeft size={12} className="group-hover:-translate-x-1 transition-transform" />
                                Back to Home
                                <div className="w-6 h-[1px] bg-white/10 group-hover:w-12 transition-all ml-2" />
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Visual Grid Background */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-0" style={{
                backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                backgroundSize: '32px 32px'
            }} />
        </div>
    )
}
