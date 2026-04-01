"use client";

import { useEffect } from "react";

interface PageTitleProps {
    title: string;
}

export function PageTitle({ title }: PageTitleProps) {
    useEffect(() => {
        const prev = document.title;
        document.title = `${title} | Ordena`;
        return () => { document.title = prev; };
    }, [title]);
    return null;
}
