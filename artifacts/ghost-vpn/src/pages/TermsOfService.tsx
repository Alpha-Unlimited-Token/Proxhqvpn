// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useEffect } from "react";

export default function TermsOfService() {
  useEffect(() => { document.title = "Terms of Service — ProxhqVPN"; }, []);

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="mb-12">
          <div className="text-green-500 text-sm mb-2">ALPHA UNLIMITED TECHNOLOGIES LLC</div>
          <h1 className="text-3xl font-bold text-green-300 mb-2">Terms of Service</h1>
          <div className="text-green-600 text-sm">Effective Date: June 17, 2026 · Last Updated: June 17, 2026</div>
        </div>

        <div className="space-y-10 text-green-400/90 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-green-300 mb-3 border-b border-green-900 pb-2">1. Acceptance of Terms</h2>
            <p>
              By creating an account or using ProxhqVPN (operated by Alpha Unlimited Technologies LLC,
              "Company", "we", "us"), you agree to these Terms of Service ("Terms"). If you do not agree,
              do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-green-300 mb-3 border-b border-green-900 pb-2">2. Eligibility</h2>
            <p>
              You must be at least 18 years old to use ProxhqVPN. By using the service you represent
              that you are 18 or older and have the legal capacity to enter into this agreement. The
              service is not available in jurisdictions where its use is prohibited by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-green-300 mb-3 border-b border-green-900 pb-2">3. Permitted Use</h2>
            <p className="mb-3">ProxhqVPN is provided for lawful purposes only. You may use the service to:</p>
            <ul className="list-none space-y-1 pl-4 mb-3">
              {[
                "Protect your privacy on public networks",
                "Bypass geographic content restrictions where legal",
                "Conduct authorized security testing on systems you own or have written permission to test",
                "Route traffic through VPN nodes for personal or business privacy",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-green-500">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-green-300 mb-3 border-b border-green-900 pb-2">4. Prohibited Use</h2>
            <p className="mb-3 text-red-400/80">You may NOT use ProxhqVPN to:</p>
            <ul className="list-none space-y-1 pl-4">
              {[
                "Access, attack, probe, or scan systems you do not own or lack written authorization to test",
                "Conduct denial-of-service (DoS/DDoS) attacks",
                "Distribute malware, ransomware, spyware, or tracking code",
                "Engage in spam, phishing, or social engineering attacks",
                "Violate any applicable local, national, or international law",
                "Infringe on intellectual property rights",
                "Circumvent export controls or sanctions",
                "Facilitate human trafficking, child exploitation, or other serious crimes",
                "Use the security lab features (SQLi scanner, WAF bypass, etc.) against third-party systems without verified ownership",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-red-500">✗</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 p-3 border border-yellow-800 bg-yellow-900/10 text-yellow-400 text-sm">
              <strong>SECURITY LAB TOOLS:</strong> The security scanning tools (SQL injection scanner,
              WAF bypass, subdomain scanner, etc.) are restricted to verified lab targets only.
              Attempting to scan systems you do not own is a violation of these Terms and may constitute
              a violation of the Computer Fraud and Abuse Act (CFAA), the UK Computer Misuse Act, or
              equivalent laws in your jurisdiction.
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-green-300 mb-3 border-b border-green-900 pb-2">5. Security Infrastructure and Honeypot Systems</h2>
            <p className="mb-3">
              ProxhqVPN operates a passive honeypot and deception network (<strong className="text-green-300">Ghost Trap</strong>)
              as part of its infrastructure protection. By connecting to or probing ProxhqVPN infrastructure,
              you acknowledge that:
            </p>
            <ul className="list-none space-y-1 pl-4 mb-3">
              {[
                "ProxhqVPN nodes may present decoy services (fake open ports, emulated services) designed to detect hostile actors",
                "Any interaction with ProxhqVPN infrastructure may be logged, fingerprinted, and used for security purposes",
                "Unauthorized probing, scanning, or attacking ProxhqVPN infrastructure is prohibited under these Terms and applicable law",
                "Source IP addresses interacting with honeypot services may be shared with third-party threat intelligence databases",
                "Automatic firewall blocking may be applied to IPs detected probing or attacking ProxhqVPN nodes",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-green-500">→</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-green-400/80 text-sm">
              Subscribers using ProxhqVPN legitimately are not affected by these systems. The honeypot
              network only captures traffic directed at decoy services — it has no visibility into
              subscriber VPN traffic, which remains completely private.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-green-300 mb-3 border-b border-green-900 pb-2">6. Accounts and Security</h2>
            <p className="mb-2">
              You are responsible for maintaining the confidentiality of your account credentials.
              You must notify us immediately at{" "}
              <a href="mailto:support@proxhqvpn.com" className="text-green-300 underline">support@proxhqvpn.com</a>{" "}
              if you suspect unauthorized access to your account.
            </p>
            <p>
              We may suspend or terminate accounts that violate these Terms, at our sole discretion,
              with or without notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-green-300 mb-3 border-b border-green-900 pb-2">7. Payments and Subscriptions</h2>
            <p className="mb-2">
              Subscriptions are billed in advance on a monthly or annual basis via Stripe. All fees are
              non-refundable except where required by law. We reserve the right to change pricing with
              30 days' notice.
            </p>
            <p>
              If your payment fails, access may be suspended until payment is resolved. Subscriptions
              automatically renew unless cancelled before the renewal date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-green-300 mb-3 border-b border-green-900 pb-2">8. Service Availability</h2>
            <p>
              We aim for high availability but do not guarantee uninterrupted service. We are not liable
              for downtime, data loss, or service interruptions. We may modify or discontinue features
              with reasonable notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-green-300 mb-3 border-b border-green-900 pb-2">9. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, ALPHA UNLIMITED TECHNOLOGIES LLC SHALL NOT BE
              LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES,
              INCLUDING LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF OR INABILITY
              TO USE THE SERVICE. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT PAID BY YOU IN
              THE TWELVE MONTHS PRECEDING THE CLAIM.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-green-300 mb-3 border-b border-green-900 pb-2">10. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless Alpha Unlimited Technologies LLC, its officers,
              directors, employees, and agents from any claims, damages, or expenses (including legal
              fees) arising from your use of the service or violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-green-300 mb-3 border-b border-green-900 pb-2">11. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the United States. Any disputes shall be resolved
              through binding arbitration in accordance with the rules of the American Arbitration
              Association, except where prohibited by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-green-300 mb-3 border-b border-green-900 pb-2">12. Changes to Terms</h2>
            <p>
              We may update these Terms at any time. Material changes will be communicated by email
              at least 14 days in advance. Continued use of the service after the effective date of
              changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-green-300 mb-3 border-b border-green-900 pb-2">13. Contact</h2>
            <p>
              For questions about these Terms:{" "}
              <a href="mailto:legal@proxhqvpn.com" className="text-green-300 underline">legal@proxhqvpn.com</a>
              <br />
              General support:{" "}
              <a href="mailto:support@proxhqvpn.com" className="text-green-300 underline">support@proxhqvpn.com</a>
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
