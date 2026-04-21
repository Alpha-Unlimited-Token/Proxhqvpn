/**
 * ProxhqVPN Desktop — Server Configuration
 *
 * UPDATE THIS before distributing the desktop app:
 * Set PROXHQ_SERVER_URL to your deployed ProxhqVPN server URL.
 */

const PROXHQ_SERVER_URL = process.env.PROXHQ_SERVER_URL
  || "https://your-proxhqvpn-domain.replit.app";

module.exports = { PROXHQ_SERVER_URL };
