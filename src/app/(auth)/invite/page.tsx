"use client";

import { SignUp } from "@clerk/nextjs";

export default function InviteSignUpPage() {
    return (
        <div className="w-full flex justify-center">
            <SignUp
                routing="hash"
                fallbackRedirectUrl="/waiting"
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
