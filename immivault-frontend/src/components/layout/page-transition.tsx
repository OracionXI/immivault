"use client";

import { usePathname } from "next/navigation";

export function PageTransition({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const section = "/" + pathname.split("/")[1];

    return (
        <div key={section} className="animate-in fade-in slide-in-from-bottom-3 duration-300 ease-out min-h-full">
            {children}
        </div>
    );
}
