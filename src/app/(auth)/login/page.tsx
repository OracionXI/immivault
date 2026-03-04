"use client";

import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
    return (
        <div className="w-full flex justify-center">
            <SignIn
                routing="hash"
                fallbackRedirectUrl="/dashboard"
                signUpUrl="/signup"
                appearance={{
                    elements: {
                        socialButtonsBlock: { display: "none" },
                        dividerRow: { display: "none" },
                    },
                }}
            />
        </div>
    );
}

