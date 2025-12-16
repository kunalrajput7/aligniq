"use client";

import { ProcessingNotifications } from '@/components/dashboard/ProcessingNotifications';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            {children}
            <ProcessingNotifications />
        </>
    );
}
