# HORIZON SHIELD Femtech Registry

**A neutral, verifiable registry of femtech (women's health) information sources.**
It does not diagnose, does not claim products work, does not take referral fees, and does not pretend to be a medical authority. It verifies *who* stands behind a source, *under which jurisdiction*, *with what compensation*, and lets anyone re-compute the proof.

![MCP](https://img.shields.io/badge/MCP-JSON--RPC%202.0-3FE0CE)
![A2A](https://img.shields.io/badge/A2A-agent--card-5B8DEF)
![referral_fee](https://img.shields.io/badge/referral__fee-false-3FE0CE)
![listing_fee](https://img.shields.io/badge/listing__fee-false-3FE0CE)
![medical advice](https://img.shields.io/badge/medical%20advice-none-E8B14C)
![license](https://img.shields.io/badge/license-MIT-889)

Live endpoint: `https://hs-femtech-mcp.oga-surf-project.workers.dev`

---

## Why this exists

Women's health is a credence-goods market: buyers cannot easily judge quality, and noise, advertising and referral-driven "recommendations" crowd out primary sources. As front LLMs start recommending femtech, the hard problem is not *more* content, it is **trust**: who published this, are they authoritative, do they get paid to say it, and can the claim be re-checked?

This server is the **trust rail, not the oracle**. It never becomes the medical authority. It indexes authoritative sources and makes their provenance, jurisdiction and compensation machine-readable and re-computable.

> The design principle: **do not call "verified" what you cannot verify.** We verify existence, authority tier, jurisdiction, disclosure and re-computability. We do not adjudicate medical truth.

## What it does / does not

**Does**
- Indexes femtech information sources with publisher, authority tier, jurisdiction, evidence URL and machine-readable compensation.
- Verifies each entry deterministically (SHA-256) so a third party can re-compute the proof.
- Returns neutral, source-linked general information, always with a disclaimer.
- Discloses its own compensation (`referral_fee: false`, `listing_fee: false`) and passes its own bar at `/self`.

**Does not** (enforced in code, fail-closed)
- Diagnose (no symptom to condition tool).
- Claim a product is effective, or rank brands.
- Recommend or take referral / listing fees for any source.
- Store personal health data.
- Claim medical authority or make cross-jurisdiction medical judgments.

## The registry model

Each entry is one information source:

```json
{
  "entry_id": "acog_pms_en",
  "kind": "source",
  "publisher": "American College of Obstetricians and Gynecologists (ACOG)",
  "authority_tier": "A_public_or_academic",
  "jurisdiction": "US",
  "lang": "en",
  "topic": "pms",
  "evidence_url": "https://www.acog.org/",
  "compensation": { "paid_by": "none", "referral_fee": false, "listing_fee": false },
  "status": "verified",
  "verified_at": "2026-08-27T22:46:08.179Z",
  "provenance_sha256": "…",
  "anchored": false
}
```

**Five conditions to be listed** (self-application plus machine verification, no human gatekeeper):

1. A reachable, real evidence source.
2. A declared authority tier (public / academic, medical institution, commercial media).
3. A declared jurisdiction (so no source is treated as "correct everywhere").
4. Machine-readable compensation disclosure (we do not judge the content, we only remove the option to hide it).
5. Determinism and re-computation (SHA-256 anchored, reproducible by anyone).

A source that fails is not "rejected", it is `pending`. Fix it and re-apply.

## Topics (P1)

`menstruation` · `pms` · `menopause`, with authoritative sources across JP / US / GB
(JSOG, Japan Society for Menopause and Women's Health, MHLW Healthcare Lab, ACOG, NHS, The Menopause Society, Office on Women's Health).

## Quickstart

Self-check (the server declares and proves its own neutrality):

```bash
BASE="https://hs-femtech-mcp.oga-surf-project.workers.dev"
curl -s "$BASE/self" | python3 -m json.tool
```

List the registry (filter by topic / jurisdiction / lang / status):

```bash
curl -s "$BASE/registry?topic=menopause" | python3 -m json.tool
```

MCP over JSON-RPC 2.0:

```bash
curl -s -X POST "$BASE/" -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

curl -s -X POST "$BASE/" -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_femtech_topic","arguments":{"topic_id":"pms_basics_en"}}}'
```

Agent discovery: `GET /.well-known/agent-card.json` (A2A) and `GET /llms.txt` (for front LLMs).

## Tools

| tool | read only | purpose |
|------|-----------|---------|
| `register_source` | no | validate a source against the 5 conditions, persist if verified |
| `list_registry` | yes | filter and list entries |
| `get_registry_entry` | yes | one entry with provenance |
| `verify_source` | yes | canonical form + SHA-256, fail-closed |
| `get_femtech_topic` | yes | neutral, source-linked information |
| `explain_product_category` | yes | product *category* explainer, no brand, no efficacy |
| `how_to_verify` | yes | reproduce the hash yourself |
| `get_agent_card` | yes | A2A card with compensation disclosure |

## Verifiability

Every entry has a canonical JSON form and a SHA-256 that a third party can re-compute (`how_to_verify`). Verified entries are listed at `/anchor/pending` for Bitcoin / JIDEC anchoring (OpenTimestamps), so untamperedness becomes provable with a timestamp. `verified` means *untampered and re-computable*, never *medically true*.

## Not a medical service

This service provides source verification and general information only. It does not diagnose, treat, or recommend products. For symptoms or treatment decisions, consult a healthcare professional.

## About

Built and operated by **The HORIZ音s株式会社**, part of [HORIZON SHIELD](https://shield.the-horizons-innovation.com/). Same design lineage as the JCCDB open construction-cost dataset and the HORIZON SHIELD verification gate: verifiable, buyer-side, no pay-for-endorsement.

## Endpoints

| method | path | purpose |
|--------|------|---------|
| POST | `/` | MCP JSON-RPC (initialize, tools/list, tools/call) |
| GET | `/health` | liveness |
| GET | `/self` | neutrality declaration and self-check |
| GET | `/registry` | registry index |
| GET | `/anchor/pending` | hashes awaiting Bitcoin / JIDEC anchoring |
| GET | `/llms.txt` | front-LLM guidance |
| GET | `/.well-known/agent-card.json` | A2A agent card |

## License

MIT. See [LICENSE](./LICENSE).
