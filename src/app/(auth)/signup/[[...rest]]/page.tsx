"use client";

import { SignUp } from "@clerk/nextjs";

export default function SignupPage() {
    return (
        <div className="w-full flex justify-center">
            <SignUp
                routing="path"
                path="/signup"
                fallbackRedirectUrl="/onboarding"
                signInUrl="/login"
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
