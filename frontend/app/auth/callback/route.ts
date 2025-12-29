import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { type EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const token_hash = searchParams.get('token_hash')
    const type = searchParams.get('type') as EmailOtpType | null
    const next = searchParams.get('next') ?? '/dashboard'

    // Check for errors from Supabase
    const error = searchParams.get('error')
    const error_code = searchParams.get('error_code')
    const error_description = searchParams.get('error_description')

    if (error || error_code) {
        return NextResponse.redirect(`${origin}/auth/auth-code-error?error=${error_code || error}&description=${encodeURIComponent(error_description || '')}`)
    }

    const supabase = createClient()

    if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (!exchangeError) {
            if (type === 'recovery') {
                return NextResponse.redirect(`${origin}/reset-password`)
            }
            return NextResponse.redirect(`${origin}${next}`)
        }
        return NextResponse.redirect(`${origin}/auth/auth-code-error?error=${exchangeError.name}&description=${encodeURIComponent(exchangeError.message)}`)
    }

    if (token_hash && type) {
        const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash, type })
        if (!verifyError) {
            if (type === 'recovery') {
                return NextResponse.redirect(`${origin}/reset-password`)
            }
            return NextResponse.redirect(`${origin}${next}`)
        }
        return NextResponse.redirect(`${origin}/auth/auth-code-error?error=${verifyError.name}&description=${encodeURIComponent(verifyError.message)}`)
    }

    // Default error if no code or token_hash is present
    return NextResponse.redirect(`${origin}/auth/auth-code-error?error=no_verification_data`)
}
