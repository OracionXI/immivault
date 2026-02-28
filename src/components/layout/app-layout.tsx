"use client";

import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <TooltipProvider delayDuration={0}>
            <div className="flex h-screen overflow-hidden bg-background">
                <Sidebar />
                <div className="flex flex-1 flex-col overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-6">{children}</main>
                </div>
            </div>
        </TooltipProvider>
    );
}
