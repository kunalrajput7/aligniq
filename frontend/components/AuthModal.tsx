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
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{message}</DialogTitle>
                    <DialogDescription>
                        Enter your email to sign in or create an account.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col space-y-4 py-4">
                    <Auth
                        supabaseClient={supabase}
                        appearance={{ theme: ThemeSupa }}
                        theme="light"
                        providers={[]}
                        redirectTo={`${origin}/auth/callback`}
                        onlyThirdPartyProviders={false}
                    />
                </div>
            </DialogContent>
        </Dialog>
    )
}
