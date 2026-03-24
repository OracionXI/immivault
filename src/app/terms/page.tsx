export const metadata = {
    title: "Terms of Service — Ordena",
    description: "Ordena Terms of Service",
};

export default function TermsPage() {
    const lastUpdated = "March 25, 2026";

    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-3xl mx-auto px-6 py-16">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
                <p className="text-sm text-gray-500 mb-10">Last updated: {lastUpdated}</p>

                <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">

                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Acceptance of Terms</h2>
                        <p>
                            By accessing or using Ordena (&quot;Service&quot;), operated by Ordena (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;),
                            you agree to be bound by these Terms of Service. If you do not agree, do not
                            use the Service.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Description of Service</h2>
                        <p>
                            Ordena is a cloud-based case management platform designed for law firms and
                            legal professionals. Features include client management, case tracking, task
                            management, document storage, appointment scheduling, and billing.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Eligibility</h2>
                        <p>
                            You must be at least 18 years old and have the legal authority to enter into
                            these Terms on behalf of your organisation. By using Ordena, you represent
                            that you meet these requirements.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Account Responsibilities</h2>
                        <ul className="list-disc pl-5 space-y-2">
                            <li>You are responsible for maintaining the confidentiality of your account credentials</li>
                            <li>You are responsible for all activity that occurs under your account</li>
                            <li>You must notify us immediately of any unauthorised use of your account</li>
                            <li>Organisation administrators are responsible for managing their team members&apos; access</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Acceptable Use</h2>
                        <p>You agree not to:</p>
                        <ul className="list-disc pl-5 mt-3 space-y-2">
                            <li>Use the Service for any unlawful purpose or in violation of any regulations</li>
                            <li>Upload or transmit malicious code, viruses, or harmful data</li>
                            <li>Attempt to gain unauthorised access to any part of the Service</li>
                            <li>Reverse engineer, decompile, or disassemble the Service</li>
                            <li>Use the Service to store or process data you are not authorised to handle</li>
                            <li>Resell or sublicense access to the Service without our written consent</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Google Calendar Integration</h2>
                        <p>
                            Ordena offers optional integration with Google Calendar. By connecting your
                            Google account, you authorise Ordena to access, create, modify, and delete
                            calendar events on your behalf, solely for the purpose of managing appointments
                            within the Service. You may revoke this authorisation at any time via your
                            Google account settings. Our use of Google Calendar data complies with the{" "}
                            <a
                                href="https://developers.google.com/terms/api-services-user-data-policy"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 underline"
                            >
                                Google API Services User Data Policy
                            </a>.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Data Ownership</h2>
                        <p>
                            You retain ownership of all data you input into Ordena (&quot;Your Data&quot;). You grant
                            us a limited licence to store, process, and display Your Data solely to provide
                            the Service. We do not claim ownership of Your Data and will not use it for
                            purposes outside of operating the Service.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Payment and Billing</h2>
                        <p>
                            Subscription fees (if applicable) are billed in advance. All fees are
                            non-refundable except as required by law. Payment processing for client
                            invoices within Ordena is handled via your organisation&apos;s own Stripe account —
                            Ordena does not process or hold client funds directly.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Organisation Deletion</h2>
                        <p>
                            Administrators may initiate organisation deletion at any time. Upon initiation,
                            a 30-day grace period applies during which the deletion can be cancelled. After
                            30 days, all organisation data is permanently and irreversibly deleted.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Intellectual Property</h2>
                        <p>
                            The Service, including its design, code, and branding, is owned by Ordena and
                            protected by intellectual property laws. You may not copy, reproduce, or create
                            derivative works from any part of the Service without our written permission.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Disclaimer of Warranties</h2>
                        <p>
                            The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind,
                            either express or implied. We do not warrant that the Service will be
                            uninterrupted, error-free, or free of harmful components.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Limitation of Liability</h2>
                        <p>
                            To the maximum extent permitted by law, Ordena shall not be liable for any
                            indirect, incidental, special, consequential, or punitive damages arising from
                            your use of the Service, even if we have been advised of the possibility of
                            such damages.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">13. Termination</h2>
                        <p>
                            We reserve the right to suspend or terminate your access to the Service at
                            our discretion, with or without notice, if we reasonably believe you have
                            violated these Terms. You may terminate your account at any time via the
                            Settings page.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">14. Changes to Terms</h2>
                        <p>
                            We may update these Terms from time to time. We will notify you of material
                            changes via email or a notice within the Service. Continued use of Ordena
                            after changes take effect constitutes your acceptance of the updated Terms.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">15. Governing Law</h2>
                        <p>
                            These Terms are governed by applicable law. Any disputes shall be resolved
                            through binding arbitration or in the courts of competent jurisdiction.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">16. Contact</h2>
                        <p>
                            For questions about these Terms, contact us at:{" "}
                            <a href="mailto:aws200workspace@gmail.com" className="text-blue-600 underline">
                                aws200workspace@gmail.com
                            </a>
                        </p>
                    </section>

                </div>

                <div className="mt-12 pt-8 border-t border-gray-200 flex gap-6 text-sm text-gray-500">
                    <a href="/privacy" className="hover:text-gray-900 underline">Privacy Policy</a>
                    <a href="/dashboard" className="hover:text-gray-900 underline">Back to Ordena</a>
                </div>
            </div>
        </div>
    );
}
