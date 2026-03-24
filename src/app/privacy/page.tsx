export const metadata = {
    title: "Privacy Policy — Ordena",
    description: "Ordena Privacy Policy",
};

export default function PrivacyPage() {
    const lastUpdated = "March 25, 2026";

    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-3xl mx-auto px-6 py-16">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
                <p className="text-sm text-gray-500 mb-10">Last updated: {lastUpdated}</p>

                <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">

                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Introduction</h2>
                        <p>
                            Ordena (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) provides a case management platform for law firms
                            and legal professionals. This Privacy Policy explains how we collect, use, disclose,
                            and safeguard your information when you use our service at{" "}
                            <span className="font-medium">immivault.vercel.app</span>.
                        </p>
                        <p className="mt-3">
                            By using Ordena, you agree to the collection and use of information in accordance
                            with this policy.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Information We Collect</h2>
                        <h3 className="text-base font-medium text-gray-800 mb-2">Account Information</h3>
                        <p>
                            When you create an account, we collect your name, email address, and organisation
                            details. Authentication is handled by Clerk, Inc.
                        </p>
                        <h3 className="text-base font-medium text-gray-800 mt-4 mb-2">Google Calendar Data</h3>
                        <p>
                            If you connect your Google account, we access your Google Calendar to create,
                            read, update, and delete calendar events on your behalf. We request only the
                            minimum scopes necessary to provide the appointment scheduling feature. We do not
                            store, sell, or share your Google Calendar data with third parties. You may
                            revoke this access at any time via your Google account settings at{" "}
                            <a
                                href="https://myaccount.google.com/permissions"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 underline"
                            >
                                myaccount.google.com/permissions
                            </a>.
                        </p>
                        <h3 className="text-base font-medium text-gray-800 mt-4 mb-2">Client and Case Data</h3>
                        <p>
                            We store case records, client information, documents, tasks, invoices, and
                            appointment data that you and your team enter into Ordena. This data is stored
                            on Convex cloud infrastructure and is accessible only to members of your
                            organisation.
                        </p>
                        <h3 className="text-base font-medium text-gray-800 mt-4 mb-2">Payment Information</h3>
                        <p>
                            Payment processing is handled directly by Stripe, Inc. via your organisation&apos;s
                            own Stripe account. We do not store raw card numbers. Stripe API keys you provide
                            are encrypted at rest using AES-256-GCM encryption.
                        </p>
                        <h3 className="text-base font-medium text-gray-800 mt-4 mb-2">Usage Data</h3>
                        <p>
                            We may collect anonymised usage data such as feature interactions to improve the
                            platform. This data does not include personal or case information.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">3. How We Use Your Information</h2>
                        <ul className="list-disc pl-5 space-y-2">
                            <li>To provide and operate the Ordena platform</li>
                            <li>To sync appointments with Google Calendar when you authorise this</li>
                            <li>To send transactional emails (case assignments, invoice notifications, appointment reminders) via Resend</li>
                            <li>To authenticate users securely via Clerk</li>
                            <li>To process client payments via your organisation&apos;s Stripe account</li>
                            <li>To improve platform reliability and performance</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Google API Services</h2>
                        <p>
                            Ordena&apos;s use and transfer of information received from Google APIs adheres to the{" "}
                            <a
                                href="https://developers.google.com/terms/api-services-user-data-policy"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 underline"
                            >
                                Google API Services User Data Policy
                            </a>
                            , including the Limited Use requirements. Specifically:
                        </p>
                        <ul className="list-disc pl-5 mt-3 space-y-2">
                            <li>We only use Google Calendar data to create and manage appointments within Ordena</li>
                            <li>We do not transfer Google user data to third parties</li>
                            <li>We do not use Google user data for advertising</li>
                            <li>We do not allow humans to read your Google data unless you explicitly request support assistance and grant access</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Data Sharing and Disclosure</h2>
                        <p>We do not sell your personal data. We share data only with the following service providers who process it on our behalf:</p>
                        <ul className="list-disc pl-5 mt-3 space-y-2">
                            <li><span className="font-medium">Convex, Inc.</span> — database and backend infrastructure</li>
                            <li><span className="font-medium">Clerk, Inc.</span> — user authentication</li>
                            <li><span className="font-medium">Vercel, Inc.</span> — frontend hosting</li>
                            <li><span className="font-medium">Resend, Inc.</span> — transactional email delivery</li>
                            <li><span className="font-medium">Stripe, Inc.</span> — payment processing</li>
                            <li><span className="font-medium">Google LLC</span> — calendar integration (only when you authorise)</li>
                        </ul>
                        <p className="mt-3">
                            We may also disclose information if required by law or to protect the rights and
                            safety of our users.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Data Retention</h2>
                        <p>
                            Your data is retained for as long as your organisation account is active.
                            When an organisation is deleted, all associated data is permanently removed
                            after a 30-day grace period. You may request deletion at any time by
                            contacting us.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Security</h2>
                        <p>
                            We implement industry-standard security measures including encryption in transit
                            (TLS), encryption at rest for sensitive credentials (AES-256-GCM), role-based
                            access control, and rate limiting. However, no method of transmission over the
                            internet is 100% secure.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Your Rights</h2>
                        <p>You have the right to:</p>
                        <ul className="list-disc pl-5 mt-3 space-y-2">
                            <li>Access the personal data we hold about you</li>
                            <li>Request correction or deletion of your data</li>
                            <li>Revoke Google Calendar access at any time</li>
                            <li>Export your organisation&apos;s data upon request</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Children&apos;s Privacy</h2>
                        <p>
                            Ordena is not directed at children under 16. We do not knowingly collect
                            personal information from children.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Changes to This Policy</h2>
                        <p>
                            We may update this Privacy Policy from time to time. We will notify registered
                            users of material changes via email. Continued use of Ordena after changes
                            constitutes acceptance of the updated policy.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Contact Us</h2>
                        <p>
                            If you have questions about this Privacy Policy or wish to exercise your rights,
                            please contact us at:{" "}
                            <a href="mailto:aws200workspace@gmail.com" className="text-blue-600 underline">
                                aws200workspace@gmail.com
                            </a>
                        </p>
                    </section>

                </div>

                <div className="mt-12 pt-8 border-t border-gray-200 flex gap-6 text-sm text-gray-500">
                    <a href="/terms" className="hover:text-gray-900 underline">Terms of Service</a>
                    <a href="/dashboard" className="hover:text-gray-900 underline">Back to Ordena</a>
                </div>
            </div>
        </div>
    );
}
