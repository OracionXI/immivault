"use client";

import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
    return (
        <div className="w-full flex justify-center">
            <SignIn
                routing="hash"
                fallbackRedirectUrl="/dashboard"
                signUpUrl="/signup"
            />
        </div>
    );
}

