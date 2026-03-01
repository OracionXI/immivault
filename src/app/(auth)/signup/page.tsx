"use client";

import { SignUp } from "@clerk/nextjs";

export default function SignupPage() {
    return (
        <div className="w-full flex justify-center">
            <SignUp
                routing="hash"
                fallbackRedirectUrl="/dashboard"
                signInUrl="/login"
            />
        </div>
    );
}

