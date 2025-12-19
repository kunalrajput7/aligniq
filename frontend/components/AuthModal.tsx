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
    const [origin, setOrigin] = useState('')

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
    }, [onClose])

    if (!origin) return null

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md bg-black/80 backdrop-blur-2xl border-white/10 text-white p-8 rounded-[2rem] overflow-hidden">
                {/* Background Glow */}
                <div className="absolute -top-24 -left-24 w-48 h-48 bg-cyan-500/10 blur-[60px] rounded-full -z-1" />

                <DialogHeader className="relative z-10">
                    <DialogTitle className="text-3xl font-black tracking-tighter uppercase text-white mb-2">
                        {message}
                    </DialogTitle>
                    <DialogDescription className="text-white/40 font-light">
                        Unlock high-performance meeting intelligence.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col space-y-4 py-4 relative z-10">
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
                            }
                        }}
                        theme="dark"
                        providers={[]}
                        redirectTo={`${origin}/auth/callback`}
                        onlyThirdPartyProviders={false}
                    />
                </div>
            </DialogContent>
        </Dialog>
    )
}
