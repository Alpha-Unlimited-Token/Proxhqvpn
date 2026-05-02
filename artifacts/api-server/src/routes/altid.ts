// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { z } from "zod";
import * as crypto from "crypto";

const router = Router();

// ── Random data pools ─────────────────────────────────────────────────────────
const FIRST_NAMES_M = ["Ethan","Marcus","Jordan","Liam","Nathan","Alex","Ryan","Lucas","Dylan","Tyler","Caden","Owen","Blake","Drew","Miles"];
const FIRST_NAMES_F = ["Olivia","Emma","Sophia","Ava","Mia","Isabella","Luna","Aria","Layla","Chloe","Riley","Zoey","Nora","Maya","Ella"];
const LAST_NAMES    = ["Carter","Brooks","Hayes","Morgan","Reed","Ross","Bell","Coleman","Mitchell","Jenkins","Patterson","Porter","Grant","Hughes","Foster"];
const DOMAINS       = ["protonmail.com","tutanota.com","guerrillamail.com","mailnull.com","tempmail.org","sharklasers.com","mailinator.com"];
const CITIES        = [
  { city: "Denver",       state: "CO", zip: "80201" },
  { city: "Portland",     state: "OR", zip: "97201" },
  { city: "Austin",       state: "TX", zip: "78701" },
  { city: "Charlotte",    state: "NC", zip: "28201" },
  { city: "Phoenix",      state: "AZ", zip: "85001" },
  { city: "Minneapolis",  state: "MN", zip: "55401" },
  { city: "Indianapolis", state: "IN", zip: "46201" },
  { city: "Columbus",     state: "OH", zip: "43201" },
];
const STREET_NAMES  = ["Oak","Maple","Cedar","Pine","Elm","Birch","Walnut","River","Sunset","Highland"];
const STREET_TYPES  = ["St","Ave","Blvd","Dr","Ln","Ct","Way","Pl","Rd"];
const OCCUPATIONS   = ["Software Engineer","Graphic Designer","Data Analyst","Marketing Manager","Product Manager","UX Designer","Business Analyst","Consultant","Writer","Researcher"];

function rng(n: number): number { return Math.floor(Math.random() * n); }
function pick<T>(arr: T[]): T   { return arr[rng(arr.length)]; }
function randInt(min: number, max: number): number { return min + rng(max - min + 1); }

function generateUsername(first: string, last: string): string {
  const styles = [
    () => `${first.toLowerCase()}${last.toLowerCase()}${randInt(10, 99)}`,
    () => `${first.toLowerCase()}_${last.toLowerCase()}`,
    () => `${first.toLowerCase()}${rng(9000) + 1000}`,
    () => `${last.toLowerCase()}${first.charAt(0).toLowerCase()}${randInt(10, 999)}`,
    () => `${pick(["ghost","shadow","neo","void","anon","echo"])}${first.toLowerCase()}`,
  ];
  return pick(styles)();
}

function generatePhone(): string {
  const area = randInt(201, 989).toString().padStart(3, "0");
  const line  = randInt(100, 999).toString().padStart(3, "0");
  const last4 = randInt(1000, 9999);
  return `+1 (${area}) ${line}-${last4}`;
}

function generateDob(): { dob: string; age: number } {
  const year = randInt(1975, 2001);
  const month = randInt(1, 12).toString().padStart(2, "0");
  const day   = randInt(1, 28).toString().padStart(2, "0");
  const dob   = `${year}-${month}-${day}`;
  const age   = new Date().getFullYear() - year;
  return { dob, age };
}

export interface AltIdentity {
  id:         string;
  gender:     "male" | "female";
  firstName:  string;
  lastName:   string;
  fullName:   string;
  username:   string;
  email:      string;
  phone:      string;
  dob:        string;
  age:        number;
  address:    string;
  city:       string;
  state:      string;
  zip:        string;
  occupation: string;
  password:   string;   // suggested random strong password
  generatedAt: string;
  note:        string;
}

function generateIdentity(): AltIdentity {
  const gender    = Math.random() > 0.5 ? "male" : "female";
  const firstName = pick(gender === "male" ? FIRST_NAMES_M : FIRST_NAMES_F);
  const lastName  = pick(LAST_NAMES);
  const username  = generateUsername(firstName, lastName);
  const domain    = pick(DOMAINS);
  const email     = `${username}@${domain}`;
  const phone     = generatePhone();
  const { dob, age } = generateDob();
  const loc       = pick(CITIES);
  const streetNum = randInt(100, 9999);
  const streetName = `${pick(STREET_NAMES)} ${pick(STREET_TYPES)}`;
  const address   = `${streetNum} ${streetName}`;
  const occupation = pick(OCCUPATIONS);
  const password  = crypto.randomBytes(12).toString("base64").replace(/[+/=]/g, "x") + "!1Aa";

  return {
    id:         crypto.randomUUID(),
    gender,
    firstName,
    lastName,
    fullName:   `${firstName} ${lastName}`,
    username,
    email,
    phone,
    dob,
    age,
    address,
    city:       loc.city,
    state:      loc.state,
    zip:        loc.zip,
    occupation,
    password,
    generatedAt: new Date().toISOString(),
    note:       "For privacy protection only. Do not use for fraud or illegal activity.",
  };
}

// In-memory saved identities per user
const savedIdentities: Record<string, AltIdentity[]> = {};

// GET /altid/generate — generate a new random identity
router.get("/generate", (_req, res) => {
  const identity = generateIdentity();
  res.json({ identity });
});

// POST /altid/generate — generate multiple identities
router.post("/generate", (req, res) => {
  const { count } = z.object({ count: z.number().min(1).max(10).default(1) }).parse(req.body);
  const identities = Array.from({ length: count }, generateIdentity);
  res.json({ identities });
});

// GET /altid/saved — list saved identities
router.get("/saved", (req, res) => {
  const userId    = (req.auth as any)?.userId ?? "anonymous";
  const identities = savedIdentities[userId] ?? [];
  res.json({ identities, count: identities.length });
});

// POST /altid/saved — save an identity
router.post("/saved", (req, res) => {
  const userId = (req.auth as any)?.userId ?? "anonymous";
  const identity = z.object({
    id:         z.string(),
    gender:     z.enum(["male","female"]),
    firstName:  z.string(),
    lastName:   z.string(),
    fullName:   z.string(),
    username:   z.string(),
    email:      z.string(),
    phone:      z.string(),
    dob:        z.string(),
    age:        z.number(),
    address:    z.string(),
    city:       z.string(),
    state:      z.string(),
    zip:        z.string(),
    occupation: z.string(),
    password:   z.string(),
    generatedAt: z.string(),
    note:       z.string(),
  }).parse(req.body);

  if (!savedIdentities[userId]) savedIdentities[userId] = [];
  if (savedIdentities[userId].length >= 50) {
    return res.status(400).json({ error: "Maximum 50 saved identities reached." });
  }
  savedIdentities[userId].push(identity);
  res.status(201).json({ saved: identity });
});

// DELETE /altid/saved/:id — delete a saved identity
router.delete("/saved/:id", (req, res) => {
  const userId = (req.auth as any)?.userId ?? "anonymous";
  const { id } = req.params;
  const list   = savedIdentities[userId] ?? [];
  const idx    = list.findIndex(i => i.id === id);
  if (idx === -1) return res.status(404).json({ error: "Identity not found." });
  const [removed] = list.splice(idx, 1);
  res.json({ removed });
});

export default router;
