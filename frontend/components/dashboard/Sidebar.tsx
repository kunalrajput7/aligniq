"use client";

import { usePathname } from "next/navigation";
import {
    LayoutGrid,
    Folder,
    Calendar,
    Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";

interface SidebarProps {
    onUploadClick: () => void;
    className?: string;
}

export function Sidebar({ onUploadClick, className }: SidebarProps) {
    const pathname = usePathname();

    // Projects before Meetings
    const navItems = [
        { icon: LayoutGrid, label: "Dashboard", href: "/dashboard" },
        { icon: Folder, label: "Projects", href: "/dashboard/projects" },
        { icon: Calendar, label: "Meetings", href: "/dashboard/meetings" },
    ];

    return (
        <aside className={cn("flex h-screen w-64 flex-col border-r border-slate-200 bg-slate-50/50 backdrop-blur-xl", className)}>
            {/* Logo Area */}
            <div className="flex h-16 items-center px-6">
                <Link href="/dashboard" className="flex items-center">
                    <Image
                        src="/logo.png"
                        alt="AlignIQ"
                        width={128}
                        height={32}
                        className="h-8 w-auto object-contain"
                        priority
                    />
                </Link>
            </div>

            {/* Upload Button */}
            <div className="px-4 py-4">
                <Button
                    onClick={onUploadClick}
                    className="w-full justify-start gap-2 bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                    <Upload className="h-4 w-4" />
                    <span className="font-semibold">Upload Transcript</span>
                </Button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 px-3 py-2">
                {navItems.map((item) => {
                    const isActive = pathname === item.href ||
                        (item.href !== "/dashboard" && pathname.startsWith(item.href));

                    return (
                        <Link
                            key={item.label}
                            href={item.href}
                            className={cn(
                                "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                                isActive
                                    ? "bg-indigo-50 text-indigo-700"
                                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                            )}
                        >
                            <item.icon className={cn(
                                "h-5 w-5",
                                isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
                            )} />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
}
