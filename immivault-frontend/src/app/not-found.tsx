import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-6 text-center px-4">
            <div className="space-y-2">
                <p className="text-8xl font-bold tracking-tight text-muted-foreground/30">404</p>
                <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                    The page you're looking for doesn't exist or has been moved.
                </p>
            </div>
            <Button asChild>
                <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
        </div>
    );
}
