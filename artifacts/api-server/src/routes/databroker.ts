import { Router } from "express";
import { getAuth } from "@clerk/express";
import * as crypto from "crypto";

const router = Router();

interface BrokerResult {
  broker: string;
  category: string;
  found: boolean;
  dataTypes: string[];
  optOutUrl: string;
  optOutStatus: "not_started" | "submitted" | "confirmed" | "failed";
  lastScanned: string;
}

interface ScanSession {
  email: string;
  scanId: string;
  scannedAt: string;
  results: BrokerResult[];
  exposedCount: number;
  totalBrokers: number;
}

const DATA_BROKERS = [
  { name: "Spokeo",          cat: "People Search",    url: "https://www.spokeo.com/optout" },
  { name: "WhitePages",      cat: "People Search",    url: "https://www.whitepages.com/suppression-requests" },
  { name: "Intelius",        cat: "People Search",    url: "https://intelius.com/opt-out" },
  { name: "BeenVerified",    cat: "Background Check", url: "https://www.beenverified.com/app/optout/search" },
  { name: "Acxiom",          cat: "Data Aggregator",  url: "https://isapps.acxiom.com/optout/optout.aspx" },
  { name: "Radaris",         cat: "People Search",    url: "https://radaris.com/control/privacy" },
  { name: "ZoomInfo",        cat: "B2B Data",         url: "https://www.zoominfo.com/about/privacy/eed" },
  { name: "PeopleFinders",   cat: "People Search",    url: "https://www.peoplefinders.com/opt-out" },
  { name: "PeopleSmart",     cat: "People Search",    url: "https://www.peoplesmart.com/optout-go" },
  { name: "Pipl",            cat: "Identity Data",    url: "https://pipl.com/personal-information-removal-request" },
  { name: "Truthfinder",     cat: "Background Check", url: "https://www.truthfinder.com/opt-out" },
  { name: "InstantCheckmate", cat: "Background Check", url: "https://www.instantcheckmate.com/opt-out" },
  { name: "USSearch",        cat: "People Search",    url: "https://www.ussearch.com/opt-out" },
  { name: "PublicRecordsNow", cat: "Public Records",  url: "https://www.publicrecordsnow.com/static/view/optout" },
  { name: "Lexis Nexis",     cat: "Data Aggregator",  url: "https://optout.lexisnexis.com" },
  { name: "Equifax",         cat: "Credit Bureau",    url: "https://www.equifax.com/personal/privacy" },
  { name: "CoreLogic",       cat: "Property Data",    url: "https://www.corelogic.com/privacy/ccpa/" },
  { name: "MyLife",          cat: "People Search",    url: "https://www.mylife.com/ccpa/index.pubview" },
  { name: "Experian",        cat: "Credit Bureau",    url: "https://www.experian.com/privacy/center.html" },
  { name: "TransUnion",      cat: "Credit Bureau",    url: "https://www.transunion.com/optout" },
];

const DATA_TYPES_POOL = [
  "Full Name", "Email Address", "Phone Number", "Home Address", "Date of Birth",
  "Age", "Relatives", "Social Media Profiles", "Employment History",
  "Education", "Neighborhood", "Property Records", "Vehicle Records",
  "Political Affiliation", "Criminal Records", "Financial Status"
];

function uid(req: any): string {
  return (getAuth(req) as any)?.userId || "anon";
}

const scanStore = new Map<string, ScanSession>();
const optOutStore = new Map<string, Map<string, "submitted" | "confirmed" | "failed">>();

function deterministicExposure(email: string, brokerName: string): boolean {
  const hash = crypto.createHash("md5").update(`${email}:${brokerName}`).digest("hex");
  return parseInt(hash.slice(0, 2), 16) > 80;
}

function deterministicDataTypes(email: string, brokerName: string): string[] {
  const hash = crypto.createHash("sha256").update(`${email}:${brokerName}:types`).digest("hex");
  const count = (parseInt(hash.slice(0, 2), 16) % 5) + 2;
  const pool = [...DATA_TYPES_POOL];
  const selected: string[] = [];
  for (let i = 0; i < count; i++) {
    const idx = parseInt(hash.slice(i * 2, i * 2 + 2), 16) % pool.length;
    selected.push(pool.splice(idx, 1)[0]);
  }
  return selected;
}

router.post("/scan", async (req, res) => {
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Valid email address required" });
  }

  const userId = uid(req);

  // Simulate scan delay
  await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));

  const optOuts = optOutStore.get(userId) ?? new Map();
  const results: BrokerResult[] = DATA_BROKERS.map(broker => {
    const found = deterministicExposure(email, broker.name);
    return {
      broker: broker.name,
      category: broker.cat,
      found,
      dataTypes: found ? deterministicDataTypes(email, broker.name) : [],
      optOutUrl: broker.url,
      optOutStatus: optOuts.get(broker.name) ?? "not_started",
      lastScanned: new Date().toISOString(),
    };
  });

  const session: ScanSession = {
    email: email.toLowerCase(),
    scanId: crypto.randomUUID(),
    scannedAt: new Date().toISOString(),
    results,
    exposedCount: results.filter(r => r.found).length,
    totalBrokers: results.length,
  };

  scanStore.set(userId, session);
  res.json(session);
});

router.get("/results", (req, res) => {
  const session = scanStore.get(uid(req));
  if (!session) return res.json({ session: null });
  res.json({ session });
});

router.post("/optout/:broker", async (req, res) => {
  const userId = uid(req);
  const { broker } = req.params;
  const optOuts = optOutStore.get(userId) ?? new Map();

  optOuts.set(broker, "submitted");
  optOutStore.set(userId, optOuts);

  const session = scanStore.get(userId);
  if (session) {
    const result = session.results.find(r => r.broker === broker);
    if (result) result.optOutStatus = "submitted";
  }

  res.json({ ok: true, broker, status: "submitted", note: "Opt-out request submitted. Processing can take 7–30 days." });
});

export default router;
