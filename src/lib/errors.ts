/** Extract a human-readable message from any thrown value (including Convex errors). */
export function getErrorMessage(error: unknown): string {
    // Convex ConvexError exposes the thrown data via .data
    if (error !== null && typeof error === "object") {
        const data = (error as Record<string, unknown>).data;
        if (typeof data === "string") return data;
        if (data !== null && typeof data === "object") {
            const msg = (data as Record<string, unknown>).message;
            if (typeof msg === "string") return msg;
        }
    }
    // Fallback: parse error.message as JSON (older Convex format)
    const raw = error instanceof Error ? error.message : String(error);
    try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        return typeof parsed.message === "string" ? parsed.message : raw;
    } catch {
        return raw;
    }
}
