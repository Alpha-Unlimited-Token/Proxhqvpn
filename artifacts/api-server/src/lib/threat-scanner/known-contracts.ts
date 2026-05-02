// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
/**
 * Curated database of known-malicious, known-vulnerable, and high-risk
 * Ethereum contract and wallet addresses, categorised by attack vector.
 *
 * Sources: Chainalysis, OpenSanctions, Etherscan labels, Rekt.news, OFAC SDN.
 * All addresses stored lowercase.
 */

export type ContractCategory =
  | "bridge_exploit"
  | "mixing_service"
  | "known_exploiter"
  | "flash_loan_provider"
  | "defi_exploit_target"
  | "token_drainer"
  | "mev_bot"
  | "darknet_market"
  | "sanctioned"
  | "rug_pull"
  | "governance_attacker"
  | "cross_chain_bridge";

export interface KnownContract {
  address:     string;
  name:        string;
  category:    ContractCategory;
  severity:    "info" | "low" | "medium" | "high" | "critical";
  description: string;
  lossUSD?:    number;
  date?:       string;
  chain?:      string;
}

// ── Tornado Cash / mixing services ───────────────────────────────────────────
const MIXERS: KnownContract[] = [
  { address: "0x12d66f87a04a9e220c9d5078724a806bfec3e8ab", name: "Tornado Cash 0.1 ETH", category: "mixing_service", severity: "high", description: "Tornado Cash privacy pool — 0.1 ETH denomination" },
  { address: "0x47ce0c6ed5b0ce3d3a51fdb1c52dc66a7c3c2936", name: "Tornado Cash 1 ETH",   category: "mixing_service", severity: "high", description: "Tornado Cash privacy pool — 1 ETH denomination" },
  { address: "0x910cbd523d972eb0a6f4cae4618ad62622b39dbf", name: "Tornado Cash 10 ETH",  category: "mixing_service", severity: "high", description: "Tornado Cash privacy pool — 10 ETH denomination" },
  { address: "0xa160cdab225685da1d56aa342ad8841c3b53f291", name: "Tornado Cash 100 ETH", category: "mixing_service", severity: "critical", description: "Tornado Cash privacy pool — 100 ETH denomination" },
  { address: "0xd4b88df4d29f5cedd6857912842cff3b20c8cfa",  name: "Tornado Cash DAI 100k", category: "mixing_service", severity: "high", description: "Tornado Cash DAI 100,000 pool" },
  { address: "0xfd8610d20aa15b7b2e3be39b396a1bc3516c7144", name: "Tornado Cash USDC 100k", category: "mixing_service", severity: "high", description: "Tornado Cash USDC 100,000 pool" },
  { address: "0x07687e702b410fa43f4cb4af7fa097918ffd2730", name: "Tornado Cash USDT 100k", category: "mixing_service", severity: "high", description: "Tornado Cash USDT 100,000 pool" },
  { address: "0x23773e65ed146a459667214b11fb36222159941",  name: "Tornado Cash WBTC",    category: "mixing_service", severity: "high", description: "Tornado Cash wBTC pool" },
  { address: "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b", name: "Tornado Cash Router",  category: "mixing_service", severity: "high", description: "Tornado Cash router — all denominations" },
  { address: "0x84443cfd09a48af6ef360c6976c5392ac5023a1f", name: "Tornado Cash Nova",   category: "mixing_service", severity: "high", description: "Tornado Cash Nova (arbitrary amounts)" },
  { address: "0x94be88213a387e992dd87de56950a9aef34b9448", name: "Tornado Cash USDC 1M", category: "mixing_service", severity: "critical", description: "Tornado Cash USDC 1,000,000 pool" },
  { address: "0xb1c8094b234dce6e03f10a5b673c1d8c69739a00", name: "Tornado Cash DAI 1M",  category: "mixing_service", severity: "critical", description: "Tornado Cash DAI 1,000,000 pool" },
  { address: "0x610b717796ad172b316836ac95a2ffad065ceab4", name: "Tornado Cash DAI 10M", category: "mixing_service", severity: "critical", description: "Tornado Cash DAI 10,000,000 pool" },
  // CoinMixer / ChipMixer
  { address: "0x3cbded43efdaf0fc77b9c55f6fc9988fcc9b37d9", name: "ChipMixer Deposit",    category: "mixing_service", severity: "high", description: "ChipMixer dark-web cryptocurrency tumbler" },
  // Aztec Connect
  { address: "0xff1f2b4adb9df6fc8eafecdcbf96a2b351680455", name: "Aztec Connect Bridge",  category: "mixing_service", severity: "medium", description: "Aztec Connect zero-knowledge privacy bridge" },
];

// ── Bridge exploits ───────────────────────────────────────────────────────────
const BRIDGE_EXPLOITS: KnownContract[] = [
  { address: "0x1a2a1c938ce3ec39b6d47113c7955baa9dd454f2", name: "Ronin Bridge (Axie)", category: "bridge_exploit", severity: "critical", description: "Ronin Bridge hacked for $625M (Lazarus Group)", lossUSD: 625_000_000, date: "2022-03-29" },
  { address: "0x98f3c9e6e3face36baad05fe09d375ef1464288b", name: "Wormhole Bridge",     category: "bridge_exploit", severity: "critical", description: "Wormhole exploited for $320M via signature forgery", lossUSD: 320_000_000, date: "2022-02-02" },
  { address: "0x88a69b4e698a4b090df6cf5bd7b2d47325ad30a3", name: "Nomad Bridge",        category: "bridge_exploit", severity: "critical", description: "Nomad Bridge drained for $190M via merkle proof bug", lossUSD: 190_000_000, date: "2022-08-01" },
  { address: "0x250e76987d838a75310c34bf422ea9f1ac4cc906", name: "Poly Network",         category: "bridge_exploit", severity: "critical", description: "Poly Network cross-chain router exploited for $611M", lossUSD: 611_000_000, date: "2021-08-10" },
  { address: "0xd938a5a97586375dabb4dcb03ba55e98f37fe8e3", name: "Horizon Bridge",       category: "bridge_exploit", severity: "critical", description: "Harmony Horizon Bridge — $100M stolen", lossUSD: 100_000_000, date: "2022-06-23" },
  { address: "0x6b7a87899490ece1443e7b93e11a0bd63ce2b0b2", name: "AnySwap/Multichain",  category: "bridge_exploit", severity: "critical", description: "Multichain MPC bridge drained $130M+", lossUSD: 130_000_000, date: "2023-07-06" },
  { address: "0x40ec5b33f54e0e8a33a975908c5ba1c14e5bbbdf", name: "Polygon Bridge",       category: "cross_chain_bridge", severity: "medium", description: "Official Polygon PoS bridge — high-value cross-chain transfers" },
  { address: "0x8731d54e9d02c286767d56ac03e8037c07e01e98", name: "Stargate Finance",     category: "cross_chain_bridge", severity: "low", description: "Stargate cross-chain liquidity protocol" },
  { address: "0x3ee18b2214aff97000d974cf647e7c347e8fa585", name: "Wormhole Token Bridge", category: "cross_chain_bridge", severity: "medium", description: "Wormhole ERC20 token bridge (ETH side)" },
  { address: "0x4aa42145aa6ebf72e164c9bbc74fbd3788045016", name: "xDai Bridge",           category: "cross_chain_bridge", severity: "low", description: "xDai/Gnosis Chain bridge" },
  { address: "0x69014c11f9e0fcda9e5890c2a53f4f2f0d6ee71e", name: "BNB Bridge",            category: "bridge_exploit", severity: "critical", description: "BSC Token Hub exploited for $586M", lossUSD: 586_000_000, date: "2022-10-06" },
  { address: "0x2d38b9bfa2d523ac5d99e1012a33a5c7536e39b0", name: "Celer cBridge",         category: "cross_chain_bridge", severity: "low", description: "Celer cBridge cross-chain protocol" },
];

// ── Known attacker / exploiter wallets ────────────────────────────────────────
const KNOWN_EXPLOITERS: KnownContract[] = [
  { address: "0x098b716b8aaf21512996dc57eb0615e2383e2f96", name: "Ronin Attacker (Lazarus)", category: "known_exploiter", severity: "critical", description: "Ronin Bridge primary attacker wallet — Lazarus Group (DPRK)", lossUSD: 625_000_000 },
  { address: "0x629e7da20197a5429d30da36e77d06cdf796b71a", name: "Wormhole Exploiter",      category: "known_exploiter", severity: "critical", description: "Wormhole Bridge attacker wallet" },
  { address: "0x56d8b635a7c88fd1104d23d632af40c1c3aac4e3", name: "Nomad Exploiter",         category: "known_exploiter", severity: "critical", description: "Primary Nomad Bridge drainer" },
  { address: "0xb66cd966670d962c227b3eaba30a872dbfb995db", name: "Euler Exploiter",          category: "known_exploiter", severity: "critical", description: "Euler Finance flash loan attacker ($197M)" },
  { address: "0x1c5dcdd006ea78a7e4783f9e6021c32935a10fb4", name: "Beanstalk Attacker",       category: "known_exploiter", severity: "critical", description: "Beanstalk Farms governance exploit attacker" },
  { address: "0x489a8756c18c0b8b24ec2a2b9ff3d4d447f79bec", name: "BNB Bridge Exploiter",    category: "known_exploiter", severity: "critical", description: "BSC Token Hub hack — $586M" },
  { address: "0xeb31973e0febf3e3d7058234a5ebbae1ab4b8c23", name: "KuCoin Hacker",            category: "known_exploiter", severity: "critical", description: "KuCoin exchange hack — $281M (Lazarus Group)" },
  { address: "0x8bbf1dccbedd5c70d8e793d432fb06a7a42f7e3b", name: "Poly Network Exploiter",  category: "known_exploiter", severity: "critical", description: "Poly Network primary attacker" },
  { address: "0x4f47bc496083c727c5fbe3ce9cdf2b0882be2b32", name: "Cream Finance Attacker",  category: "known_exploiter", severity: "critical", description: "Cream Finance flash loan attack — $130M" },
  { address: "0x1da5821544e25c636c1417ba96ade4cf6d2f9b5a", name: "Tornado Cash Deployer",   category: "known_exploiter", severity: "high",     description: "Tornado Cash original deployer address" },
  { address: "0xd5cd84d6f044abe314ee7e414d37cae8773ef9d3", name: "Mango Markets Attacker",  category: "known_exploiter", severity: "critical", description: "Mango Markets oracle manipulation — $117M" },
  { address: "0x9c07a72177c5a05410ca338c8a4c08671ca6b3e2", name: "BadgerDAO Attacker",       category: "known_exploiter", severity: "critical", description: "BadgerDAO frontend injection attack — $120M" },
  { address: "0x0629172a87aafc8fde1dfabe7ef397e6892fa5e7", name: "Indexed Finance Attacker", category: "known_exploiter", severity: "critical", description: "Indexed Finance oracle manipulation" },
  { address: "0x05f4a42e251f2d52b8ed15e9fedaacfcef1fad27", name: "FTX/Alameda Research",     category: "known_exploiter", severity: "critical", description: "FTX collapse / Alameda trading address" },
  { address: "0x59abf3837fa962d6853b4cc0a19513aa031fd32b", name: "SushiSwap RouteProcessor Exploiter", category: "known_exploiter", severity: "critical", description: "SushiSwap approval exploit — $3.3M" },
  { address: "0x3e57d6946f893314324c975aa9cebbda3825eb71", name: "Multichain Exploiter",    category: "known_exploiter", severity: "critical", description: "Multichain bridge drainer" },
];

// ── Flash loan providers ──────────────────────────────────────────────────────
const FLASH_LOAN_PROVIDERS: KnownContract[] = [
  { address: "0x398ec7346dcd622edc5ae82352f02be94c62d119", name: "Aave V1 LendingPool",   category: "flash_loan_provider", severity: "medium", description: "Aave V1 — flash loans used in reentrancy attacks" },
  { address: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9", name: "Aave V2 LendingPool",  category: "flash_loan_provider", severity: "medium", description: "Aave V2 lending pool — primary flash loan source" },
  { address: "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2", name: "Aave V3 Pool",          category: "flash_loan_provider", severity: "medium", description: "Aave V3 liquidity pool" },
  { address: "0x1e0447b19bb6ecfdae1e4ae1694b0c3659614e4e", name: "dYdX Solo Margin",      category: "flash_loan_provider", severity: "medium", description: "dYdX flash loans — zero fee" },
  { address: "0xba12222222228d8ba445958a75a0704d566bf2c8", name: "Balancer Vault",         category: "flash_loan_provider", severity: "medium", description: "Balancer V2 vault — free flash loans" },
  { address: "0xe592427a0aece92de3edee1f18e0157c05861564", name: "Uniswap V3 Router",     category: "flash_loan_provider", severity: "low",    description: "Uniswap V3 swap router (flash swap capable)" },
  { address: "0x7a250d5630b4cf539739df2c5dacb4c659f2488d", name: "Uniswap V2 Router",     category: "flash_loan_provider", severity: "low",    description: "Uniswap V2 router (flash swap capable)" },
  { address: "0x00000000219ab540356cbb839cbe05303d7705fa", name: "ETH2 Deposit Contract", category: "flash_loan_provider", severity: "info",   description: "Ethereum 2.0 beacon chain deposit contract — monitoring for validator-level activity" },
];

// ── DeFi exploit targets ──────────────────────────────────────────────────────
const DEFI_EXPLOIT_TARGETS: KnownContract[] = [
  { address: "0xc1e088fc1323b20bcbee9bd1b9fc9546db5624c5", name: "Beanstalk Protocol",    category: "defi_exploit_target", severity: "critical", description: "Beanstalk Farms — $182M flash loan governance attack", lossUSD: 182_000_000 },
  { address: "0x27182842e098f60e3d576794a5bffb0777e025d3", name: "Euler Finance",          category: "defi_exploit_target", severity: "critical", description: "Euler Finance — $197M donation+liquidation exploit", lossUSD: 197_000_000 },
  { address: "0x892b9b7b43dfb0c5695f6a1f789dc8f01bba2a71", name: "Cream Finance",          category: "defi_exploit_target", severity: "critical", description: "Cream Finance — $130M flash loan price manipulation", lossUSD: 130_000_000 },
  { address: "0x6354e79f21b56c11f48bcd7c451be456d7102a36", name: "BadgerDAO Bridge",       category: "defi_exploit_target", severity: "critical", description: "BadgerDAO smart contract frontend attack", lossUSD: 120_000_000 },
  { address: "0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b", name: "Compound Comptroller",  category: "defi_exploit_target", severity: "medium",   description: "Compound Finance comptroller" },
  { address: "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419", name: "Chainlink ETH/USD",      category: "defi_exploit_target", severity: "medium",   description: "Chainlink oracle — manipulation target in multiple attacks" },
  { address: "0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9", name: "Compound cUSDT",         category: "defi_exploit_target", severity: "medium",   description: "Compound cUSDT token" },
  { address: "0x57ab1ec28d129707052df4df418d58a2d46d5f51", name: "Synthetix sUSD",         category: "defi_exploit_target", severity: "medium",   description: "Synthetix sUSD — manipulation target" },
  { address: "0xb8c77482e45f1f44de1745f52c74426c631bdd52", name: "BNB Token",              category: "defi_exploit_target", severity: "medium",   description: "BNB ERC20 token — cross-chain bridge target" },
  { address: "0x956f47f50a910163d8bf957cf5846d573e7f87ca", name: "FEI Protocol",           category: "defi_exploit_target", severity: "high",     description: "Fei Protocol — Rari Capital $80M reentrancy", lossUSD: 80_000_000 },
];

// ── Token drainers / phishing contracts ──────────────────────────────────────
const TOKEN_DRAINERS: KnownContract[] = [
  { address: "0x0000000000004946c0e9f43f4dee607b0ef1fa1c", name: "Known Drainer v1",       category: "token_drainer", severity: "critical", description: "Well-known phishing drainer contract" },
  { address: "0x00000000000000adc04c56bf30ac9d3c0aaf14dc", name: "Seaport (NFT Phishing)", category: "token_drainer", severity: "high",     description: "Seaport signature exploited in NFT phishing campaigns" },
  { address: "0x1111111254eeb25477b68fb85ed929f73a960582", name: "1inch Router (approve exploit target)", category: "token_drainer", severity: "medium", description: "1inch aggregator — unlimited approval target" },
  { address: "0x74de5d4fcbf63e00296fd95d33236b9794016631", name: "MetaMask Approve Drainer", category: "token_drainer", severity: "critical", description: "Fake MetaMask swap contract draining approvals" },
  { address: "0xb2aaaf700a11e62a63c3c3e127bb82c54ff85d93", name: "NFT Phishing Drainer",  category: "token_drainer", severity: "critical", description: "NFT phishing smart contract" },
  { address: "0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f", name: "SushiSwap Router (fake)", category: "token_drainer", severity: "high",    description: "Fake SushiSwap router used in phishing" },
];

// ── MEV bots / sandwich attackers ─────────────────────────────────────────────
const MEV_BOTS: KnownContract[] = [
  { address: "0x000000000035b5e5ad9019092c665357240f594e", name: "MEV Bot — jaredfromsubway.eth", category: "mev_bot", severity: "medium", description: "Notorious sandwich bot responsible for $1M+ in MEV extraction" },
  { address: "0xae2fc483527b8ef99eb5d9b44875f005ba1fae13", name: "MEV Bot — jaredfromsubway #2",  category: "mev_bot", severity: "medium", description: "jaredfromsubway.eth secondary sandwich bot" },
  { address: "0x6b75d8af000000e20b7a7ddf000ba900b4009a80", name: "Flashbots Relay",              category: "mev_bot", severity: "info",   description: "Flashbots MEV relay — bundles may contain sandwich attacks" },
  { address: "0x00000000003b3cc22af3ae1eac0440bcee416b40", name: "MEV Sandwich Bot Alpha",       category: "mev_bot", severity: "medium", description: "High-volume sandwich attack bot" },
  { address: "0x3b17056cc4439c61cee46b5f7ef7a47d95c9e5c", name: "MEV Arbitrage Bot",            category: "mev_bot", severity: "low",    description: "Known cross-DEX arbitrage bot" },
];

// ── OFAC sanctioned / darknet ─────────────────────────────────────────────────
const SANCTIONED: KnownContract[] = [
  { address: "0x7f367cc41522ce07553e823bf3be79a889debe1b", name: "OFAC Sanctioned — Lazarus",   category: "sanctioned", severity: "critical", description: "OFAC SDN — Lazarus Group wallet (DPRK state hacker)" },
  { address: "0xd882cfc20f52f2599d84b8e8d58c7fb62cfe344b", name: "OFAC Sanctioned — Lazarus 2", category: "sanctioned", severity: "critical", description: "OFAC SDN — Lazarus Group secondary wallet" },
  { address: "0x901bb9583b24d97e995513c6778dc6888ab6870e", name: "OFAC Sanctioned — Mixer",     category: "sanctioned", severity: "critical", description: "OFAC sanctioned cryptocurrency mixer" },
  { address: "0xa7e5d5a720f06526557c513402f2e6b5fa20b008", name: "OFAC Sanctioned — Darknet",   category: "sanctioned", severity: "critical", description: "OFAC sanctioned darknet market address" },
  { address: "0x8576acc5c05d6ce88f4e49bf65bdf0c62f91353c", name: "OFAC Sanctioned — Ronin 2",  category: "sanctioned", severity: "critical", description: "OFAC SDN list — Ronin bridge hack proceeds" },
  { address: "0x1da5821544e25c636c1417ba96ade4cf6d2f9b5a", name: "Lazarus Group #1",            category: "sanctioned", severity: "critical", description: "Lazarus Group (North Korea) — OFAC designated" },
  { address: "0x7f367cc41522ce07553e823bf3be79a889debe1b", name: "Lazarus Group #2",            category: "sanctioned", severity: "critical", description: "Lazarus Group — OFAC designated terrorist financing" },
  { address: "0x098b716b8aaf21512996dc57eb0615e2383e2f96", name: "Ronin Hacker (OFAC)",        category: "sanctioned", severity: "critical", description: "OFAC SDN — Ronin bridge primary attacker" },
];

// ── Rug pulls ─────────────────────────────────────────────────────────────────
const RUG_PULLS: KnownContract[] = [
  { address: "0xa62894d5196bc44e4c3978400ad07e7b30352372", name: "Squid Game Token Rug",     category: "rug_pull", severity: "critical", description: "Squid Game token — $3.3M rug pull" },
  { address: "0x4d224452801aced8b2f0aebe155379bb5d594381", name: "ApeCoin (Coordinated Dump)", category: "rug_pull", severity: "medium", description: "ApeCoin launch — coordinated dump pattern detected" },
  { address: "0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85", name: "ENS Domains (phishing)",    category: "rug_pull", severity: "low",    description: "ENS NFT contract — common phishing vector" },
];

// ── Governance attackers ──────────────────────────────────────────────────────
const GOVERNANCE_ATTACKERS: KnownContract[] = [
  { address: "0xbfff1650f4b5ddf5870f36704ca2e4a67c2f6fb7", name: "Beanstalk Flash Governance", category: "governance_attacker", severity: "critical", description: "Used $1B flash loan to seize Beanstalk governance and drain $182M" },
  { address: "0xa2bfef8c09c9cca17f52854dbda1e6c04c47cd33", name: "Build Finance Attacker",     category: "governance_attacker", severity: "high", description: "Build Finance hostile governance takeover" },
  { address: "0xe516d78d784c78d7ac0102629e75428b3df3edd5", name: "Compound Governance Whale",  category: "governance_attacker", severity: "medium", description: "Massive governance token accumulation — voting manipulation risk" },
];

// ── All contracts combined ────────────────────────────────────────────────────
export const ALL_KNOWN_CONTRACTS: KnownContract[] = [
  ...MIXERS,
  ...BRIDGE_EXPLOITS,
  ...KNOWN_EXPLOITERS,
  ...FLASH_LOAN_PROVIDERS,
  ...DEFI_EXPLOIT_TARGETS,
  ...TOKEN_DRAINERS,
  ...MEV_BOTS,
  ...SANCTIONED,
  ...RUG_PULLS,
  ...GOVERNANCE_ATTACKERS,
];

// Build a fast lookup map: address → KnownContract
export const KNOWN_CONTRACT_MAP = new Map<string, KnownContract>(
  ALL_KNOWN_CONTRACTS.map(c => [c.address.toLowerCase(), c]),
);

// Per-category lookup sets for BigQuery IN-list building
export function contractsByCategory(cat: ContractCategory): string[] {
  return ALL_KNOWN_CONTRACTS
    .filter(c => c.category === cat)
    .map(c => c.address.toLowerCase());
}

export const ALL_KNOWN_ADDRESSES = ALL_KNOWN_CONTRACTS.map(c => c.address.toLowerCase());
