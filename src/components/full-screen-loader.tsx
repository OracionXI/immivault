"use client";

import { Loader2 } from "lucide-react";

interface FullScreenLoaderProps {
    message?: string;
}

export function FullScreenLoader({ message }: FullScreenLoaderProps) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            {message && (
                <p className="text-sm text-muted-foreground">{message}</p>
            )}
        </div>
    );
}
