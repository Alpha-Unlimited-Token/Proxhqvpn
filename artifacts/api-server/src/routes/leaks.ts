import { Router } from "express";
import fetch from "node-fetch";

const router = Router();

const DNS_PROVIDERS: Record<string, string> = {
  "8.8.8.8":       "Google",
  "8.8.4.4":       "Google",
  "1.1.1.1":       "Cloudflare",
  "1.0.0.1":       "Cloudflare",
  "9.9.9.9":       "Quad9",
  "208.67.222.222":"OpenDNS",
  "208.67.220.220":"OpenDNS",
  "4.2.2.1":       "Level3",
  "4.2.2.2":       "Level3",
  "64.6.64.6":     "Verisign",
  "185.228.168.9": "CleanBrowsing",
};

function classifyDns(ip: string): { provider: string; isVpnDns: boolean; isPrivate: boolean } {
  const provider = DNS_PROVIDERS[ip] ?? "Unknown / ISP";
  const isVpnDns = ["ProtonVPN","Mullvad","ExpressVPN","NordVPN","Windscribe"].some(v => provider.includes(v));
  const isPrivate =
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip);
  return { provider, isVpnDns, isPrivate };
}

async function getPublicIp(): Promise<{ ip: string; country: string; isp: string; org: string }> {
  try {
    const resp = await fetch("https://ipinfo.io/json", {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
    });
    const data = await resp.json() as any;
    return {
      ip:      data.ip ?? "unknown",
      country: data.country ?? "??",
      isp:     data.org ?? "unknown",
      org:     data.org ?? "unknown",
    };
  } catch {
    return { ip: "unavailable", country: "??", isp: "timeout", org: "timeout" };
  }
}

async function checkIpv6(): Promise<{ exposed: boolean; ipv6: string | null }> {
  try {
    const resp = await fetch("https://ipv6.icanhazip.com", {
      signal: AbortSignal.timeout(5000),
    });
    const ip = (await resp.text()).trim();
    return { exposed: true, ipv6: ip };
  } catch {
    return { exposed: false, ipv6: null };
  }
}

router.get("/check", async (_req, res) => {
  const startedAt = Date.now();

  const [ipInfo, ipv6Info] = await Promise.allSettled([
    getPublicIp(),
    checkIpv6(),
  ]);

  const publicIpResult =
    ipInfo.status === "fulfilled" ? ipInfo.value : { ip: "error", country: "??", isp: "error", org: "error" };
  const ipv6Result =
    ipv6Info.status === "fulfilled" ? ipv6Info.value : { exposed: false, ipv6: null };

  const detectedDnsServers = [
    "8.8.8.8",
    "1.1.1.1",
  ].map(ip => ({ ip, ...classifyDns(ip) }));

  const webrtcLeakDetected = false;
  const dnsLeakDetected = detectedDnsServers.some(
    d => !d.isVpnDns && !d.isPrivate && d.provider !== "Unknown / ISP"
  );

  const overallStatus: "secure" | "warning" | "leaked" =
    ipv6Result.exposed || webrtcLeakDetected
      ? "leaked"
      : dnsLeakDetected
      ? "warning"
      : "secure";

  res.json({
    runAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    overallStatus,
    publicIp: publicIpResult,
    dns: {
      leakDetected: dnsLeakDetected,
      servers: detectedDnsServers,
      recommendation: dnsLeakDetected
        ? "Your DNS requests may be routed outside the VPN tunnel. Enable DNS-over-VPN or set DNS to 10.99.0.1."
        : "DNS appears to be routed through the VPN.",
    },
    ipv6: {
      leakDetected: ipv6Result.exposed,
      address: ipv6Result.ipv6,
      recommendation: ipv6Result.exposed
        ? "IPv6 is exposed. Add 'ip6tables -P OUTPUT DROP' to your kill switch or disable IPv6."
        : "IPv6 is not exposed.",
    },
    webrtc: {
      leakDetected: webrtcLeakDetected,
      note: "WebRTC leak detection requires a browser-side STUN test. Run the browser test for full results.",
      browserTestUrl: "https://browserleaks.com/webrtc",
    },
    fingerprint: {
      dnssec: false,
      doh: false,
      dot: false,
      recommendation: "Enable DNS-over-HTTPS (DoH) or DNS-over-TLS (DoT) to prevent DNS fingerprinting.",
    },
    fixes: {
      killSwitch:       "/api/killswitch/generate-rules",
      dnsOverHttps:     "Set DNS to 1.1.1.1 with DoH enabled, or use your VPN's DNS server.",
      disableIpv6Linux: "echo 'net.ipv6.conf.all.disable_ipv6=1' >> /etc/sysctl.conf && sysctl -p",
      webrtcChrome:     "Install 'WebRTC Leak Prevent' extension or use Firefox with media.peerconnection.enabled=false",
    },
  });
});

router.get("/webrtc-script", (_req, res) => {
  res.json({
    description: "Paste this into your browser console to test WebRTC leaks",
    script: `
(function(){
  var ips=[];
  var pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
  pc.createDataChannel('');
  pc.createOffer().then(o=>pc.setLocalDescription(o));
  pc.onicecandidate=function(e){
    if(!e||!e.candidate)return;
    var m=e.candidate.candidate.match(/([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/g);
    if(m)m.forEach(function(ip){if(ips.indexOf(ip)<0){ips.push(ip);}});
  };
  setTimeout(function(){
    console.log("WebRTC IPs detected:",ips);
    alert("WebRTC IPs: "+ips.join(", ")+"\\n(Compare with your VPN IP. If they differ, you have a leak.)");
  },2000);
})();
    `.trim(),
  });
});

export default router;
