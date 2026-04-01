import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

/**
 * Handles the OAuth redirect callback from Clerk (Google, GitHub).
 * Clerk exchanges the OAuth code for a session and redirects to
 * `redirectUrlComplete` specified in the OAuth call.
 */
export default function SSOCallbackPage() {
    return <AuthenticateWithRedirectCallback />;
}
