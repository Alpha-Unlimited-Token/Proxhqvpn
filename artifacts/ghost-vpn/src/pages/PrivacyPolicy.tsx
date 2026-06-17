// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useEffect } from "react";

export default function PrivacyPolicy() {
  useEffect(() => { document.title = "Privacy Policy — ProxhqVPN"; }, []);

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="mb-12">
          <div className="text-green-500 text-sm mb-2">ALPHA UNLIMITED TECHNOLOGIES LLC</div>
          <h1 className="text-3xl font-bold text-green-300 mb-2">Privacy Policy</h1>
          <div className="text-green-600 text-sm">Effective Date: June 17, 2026 · Last Updated: June 17, 2026</div>
        </div>

        <div className="space-y-10 text-green-400/90 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-green-300 mb-3 border-b border-green-900 pb-2">1. Who We Are</h2>
            <p>
              ProxhqVPN is operated by Alpha Unlimited Technologies LLC ("we", "us", "our"). We provide
              VPN, security orchestration, and network privacy services. Our contact email for privacy
              matters is <a href="mailto:privacy@proxhqvpn.com" className="text-green-300 underline">privacy@proxhqvpn.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-green-300 mb-3 border-b border-green-900 pb-2">2. Our No-Log Commitment</h2>
            <p className="mb-3">We do not log or store:</p>
            <ul className="list-none space-y-1 pl-4">
              {[
                "Your originating IP address",
                "DNS queries made through the VPN",
                "VPN connection timestamps or session duration",
                "Traffic content, destinations, or bandwidth usage",
                "Application or protocol usage data",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-green-500">→</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-green-300 mb-3 border-b border-green-900 pb-2">3. What We Do Store</h2>
            <p className="mb-3">To operate the service we store:</p>
            <ul className="list-none space-y-1 pl-4">
              {[
                "Account email address (via Clerk authentication)",
                "Billing information (processed by Stripe — we never see full card numbers)",
                "WireGuard public keys for your enrolled devices (private keys are never stored in plaintext)",
                "Subscription status and plan tier",
                "Security audit event logs (anonymized after 30 days)",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-green-500">→</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-green-300 mb-3 border-b border-green-900 pb-2">4. Data Retention</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-green-900">
                <thead>
                  <tr className="bg-green-900/30">
                    <th className="text-left px-4 py-2 text-green-300">Data Type</th>
                    <th className="text-left px-4 py-2 text-green-300">Retention Period</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Account data", "Until account deletion requested"],
                    ["Billing records", "7 years (legal requirement)"],
                    ["Security audit logs", "30 days, then anonymized"],
                    ["WireGuard device configs", "Until device removed or account deleted"],
                    ["Support communications", "2 years"],
                  ].map(([type, period]) => (
                    <tr key={type} className="border-t border-green-900/50">
                      <td className="px-4 py-2">{type}</td>
                      <td className="px-4 py-2 text-green-300">{period}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-green-300 mb-3 border-b border-green-900 pb-2">5. Third-Party Services</h2>
            <p className="mb-3">We use these third-party services to operate ProxhqVPN:</p>
            <ul className="list-none space-y-1 pl-4">
              {[
                "Clerk — authentication and identity management",
                "Stripe — payment processing (their privacy policy governs billing data)",
                "Vultr — VPN node infrastructure (no user traffic logs)",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-green-500">→</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-green-400/70 text-sm">
              We do not sell, rent, or share your personal data with third parties for marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-green-300 mb-3 border-b border-green-900 pb-2">6. Your Rights (GDPR / CCPA)</h2>
            <p className="mb-3">Depending on your jurisdiction, you have the right to:</p>
            <ul className="list-none space-y-1 pl-4">
              {[
                "Access the personal data we hold about you",
                "Request correction of inaccurate data",
                "Request erasure of your account and data (right to be forgotten)",
                "Data portability",
                "Withdraw consent at any time",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-green-500">→</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3">
              To delete your account and all associated data, go to <strong className="text-green-300">Account → Delete Account</strong>,
              or email <a href="mailto:privacy@proxhqvpn.com" className="text-green-300 underline">privacy@proxhqvpn.com</a>.
              We will process deletion requests within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-green-300 mb-3 border-b border-green-900 pb-2">7. Security</h2>
            <p>
              WireGuard private keys are encrypted at rest using AES-256-GCM. We use TLS 1.3 for all
              connections. Our infrastructure is protected by mTLS, rate limiting, and a hardened firewall
              suite. We never store VPN tunnel private keys in plaintext.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-green-300 mb-3 border-b border-green-900 pb-2">8. Jurisdiction</h2>
            <p>
              Alpha Unlimited Technologies LLC is registered in the United States. This privacy policy
              is governed by U.S. law. For users in the European Economic Area, we comply with GDPR.
              For California residents, we comply with CCPA.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-green-300 mb-3 border-b border-green-900 pb-2">9. Contact</h2>
            <p>
              Privacy requests:{" "}
              <a href="mailto:privacy@proxhqvpn.com" className="text-green-300 underline">privacy@proxhqvpn.com</a>
              <br />
              General:{" "}
              <a href="mailto:support@proxhqvpn.com" className="text-green-300 underline">support@proxhqvpn.com</a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-green-300 mb-3 border-b border-green-900 pb-2">10. Changes to This Policy</h2>
            <p>
              We may update this policy. Material changes will be emailed to account holders at least
              14 days before taking effect. Continued use of the service after that date constitutes
              acceptance of the updated policy.
            </p>
          </section>

        </div>

        <div className="mt-16 pt-8 border-t border-green-900 text-green-600 text-xs">
          © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
          ProxhqVPN is a product of Alpha Unlimited Technologies LLC.
        </div>
      </div>
    </div>
  );
}
