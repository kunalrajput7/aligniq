"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface UsernameModalProps {
    userId: string;
    isOpen: boolean;
    onSuccess: (username: string) => void;
}

export function UsernameModal({ userId, isOpen, onSuccess }: UsernameModalProps) {
    const [username, setUsername] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const supabase = createClient();
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username.trim()) return;

        setIsLoading(true);
        setError(null);

        try {
            // Check uniqueness
            const { data: existingUser, error: checkError } = await supabase
                .from('profiles')
                .select('username')
                .eq('username', username)
                .maybeSingle(); // Use maybeSingle to avoid 406 error if no rows found

            if (checkError) throw checkError;

            if (existingUser) {
                setError('Username is already taken');
                setIsLoading(false);
                return;
            }

            // Update profile (upsert to ensure it exists)
            const { error: updateError } = await supabase
                .from('profiles')
                .upsert({
                    id: userId,
                    username: username,
                    updated_at: new Date().toISOString()
                });

            if (updateError) throw updateError;

            onSuccess(username);
        } catch (err: any) {
            console.error('Error updating username:', err);
            setError(err.message || 'Failed to update username');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={() => { }}>
            <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle>Choose a Username</DialogTitle>
                    <DialogDescription>
                        Please set a unique username to complete your profile.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Input
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                            disabled={isLoading}
                        />
                        {error && <p className="text-sm text-red-500">{error}</p>}
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading || !username}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Set Username'}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
