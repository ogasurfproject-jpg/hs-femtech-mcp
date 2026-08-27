// hs-femtech-mcp v0.3 (P1) セルフテスト(ネットワーク不要・決定論)
// 実行: node test/harness.mjs
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const mod = await import("../src/worker.js");
const W = mod._internals;
const canon = mod.canonicalize;
const sha = mod.sha256hex;

// 記憶テスト用の in-memory KV モック(Cloudflare KV 互換の最小)
function memKV() {
  const m = new Map();
  return {
    async put(k, v) { m.set(k, v); },
    async get(k) { return m.has(k) ? m.get(k) : null; },
    async list({ prefix = "", cursor } = {}) {
      const keys = [...m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name }));
      return { keys, list_complete: true, cursor: null };
    },
    _dump: m
  };
}
const reachTrue = async () => true;

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log("  green ", name); } else { fail++; console.log("  RED   ", name); } }

// 1-2 決定論
ok("canonicalize が決定論的", canon({ b: 1, a: [3, { y: 2, x: 1 }] }) === canon({ a: [3, { x: 1, y: 2 }], b: 1 }));
const h1 = await sha("x"), h2 = await sha("x");
ok("sha256 が決定論的", h1 === h2 && /^[0-9a-f]{64}$/.test(h1));

// 3 全ツールに disclaimer(runTool は env を渡す)
let allDisc = true;
for (const t of W.TOOLS) {
  const args = t.name === "register_source" ? { evidence_url: "https://example.com/", authority_tier: "A_public_or_academic", jurisdiction: "JP", compensation: { paid_by: "none", referral_fee: false, listing_fee: false }, check_reachability: false }
    : (t.name === "get_registry_entry" || t.name === "verify_source") ? { entry_id: "jsog_menstruation_ja" }
    : t.name === "get_femtech_topic" ? { topic_id: "pms_basics_ja" }
    : t.name === "explain_product_category" ? { category_id: "menstrual_cup" } : {};
  const r = await W.runTool(t.name, args, {});
  if (!r.disclaimer) { allDisc = false; console.log("     no disclaimer:", t.name); }
}
ok("全ツールに disclaimer 必須注入", allDisc);

// 4 診断・効能ツールが構造的に無い
ok("diagnose/eff-claim ツール不在", !W.TOOLS.some(t => /diagnos|prescrib|cure|treat_/i.test(t.name)));

// 5-6 構造検証
ok("構造5条件そろうと reasons ゼロ", W.structuralChecks({ evidence_url: "https://x/", authority_tier: "A_public_or_academic", jurisdiction: "JP", compensation: { paid_by: "none", referral_fee: false, listing_fee: false } }).reasons.length === 0);
ok("欠落を検出", W.structuralChecks({ evidence_url: "no", authority_tier: "X", compensation: {} }).reasons.length >= 3);

// 7 KV無し=検証プレビュー(P0挙動、persist しない)
const p0 = await W.tool_register_source({ evidence_url: "https://x/", authority_tier: "A_public_or_academic", jurisdiction: "JP", compensation: { paid_by: "none", referral_fee: false, listing_fee: false } }, {}, reachTrue);
ok("KV無しは verified でも persisted:false", p0.status === "verified" && p0.persisted === false);

// 8 P1 記憶: KV+公開書込ON で register が保存され、list に verified で出る
const env = { FEMTECH_KV: memKV(), FEMTECH_ADMIN: "k", FEMTECH_PUBLIC_WRITE: "1" };
const reg = await W.tool_register_source({ entry_id: "unit_test_src", evidence_url: "https://unit.test/", authority_tier: "A_public_or_academic", jurisdiction: "JP", topic: "pms", compensation: { paid_by: "none", referral_fee: false, listing_fee: false } }, env, reachTrue);
ok("register が KV に保存(persisted:true)", reg.persisted === true && reg.status === "verified");
const listed = await W.tool_list_registry({ status: "verified" }, env);
ok("list に保存エントリが verified で出る", listed.entries.some(e => e.entry_id === "unit_test_src" && e.status === "verified"));

// 9 verify_source: 保存済み provenance と再計算が一致
const v = await W.tool_verify_source({ entry_id: "unit_test_src" }, env);
const recompute = await sha(v.canonical);
ok("verify: 再計算=返却sha256, stored一致", recompute === v.sha256 && v.matches_stored === true);

// 10 admin reverify_seed: seed11本を(到達true注入で)verified 保存
const env2 = { FEMTECH_KV: memKV(), FEMTECH_ADMIN: "k" };
const rv = await W.adminReverifySeed(env2, reachTrue);
ok("reverify_seed で seed 全11本 verified 保存", rv.ok === true && rv.verified === 11 && rv.total === 11);
const merged = await W.mergedRegistry(env2);
ok("merge後 seed が verified に昇格", merged.filter(e => e.status === "verified").length === 11);

// 11 retract: 証拠付きで撤回、なしは拒否
const noEv = await W.adminRetract(env2, new URL("https://h/admin/retract?entry_id=acog_pms_en&reason=x"));
ok("撤回は証拠必須(reason+evidenceなしは拒否)", noEv.ok === false);
const ret = await W.adminRetract(env2, new URL("https://h/admin/retract?entry_id=acog_pms_en&reason=stale&evidence=https://proof/"));
const after = await W.mergedEntry(env2, "acog_pms_en");
ok("証拠付きで retracted 保存", ret.ok === true && after.status === "retracted");

// 12 anchor pending: verified で未錨のものが並ぶ
const ap = await W.anchorPending(env2);
ok("anchor pending が provenance を並べる", ap.count >= 1 && ap.pending.every(p => /^[0-9a-f]{64}$/.test(p.provenance_sha256)));

// 13 menopause 論点が入っている
const mj = W.tool_get_femtech_topic({ topic_id: "menopause_basics_ja" });
ok("更年期 topic(ja) が sources 付きで存在", mj.category === "menopause" && Array.isArray(mj.sources) && mj.sources.length >= 1);
ok("seed に menopause 情報源が5本", W.REGISTRY.filter(r => r.topic === "menopause").length === 5);

// 14 発見配線
ok("llms.txt に neutral と topics", /menopause/.test(W.llmsTxt()) && /Not medical advice/.test(W.llmsTxt()) && /送客料・掲載料ゼロ/.test(W.llmsTxt()));

// 15 agent_card 送客料ゼロ・discovery
const card = W.tool_get_agent_card();
ok("agent_card: 送客料ゼロ+discovery", card.compensation.referral_fee === false && card.discovery && card.discovery.llms_txt === "/llms.txt");

// 16 tools/list 一意・64字以内・annotations
const tl = await W.handleRpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, {});
const names = tl.result.tools.map(t => t.name);
ok("tools/list 一意・64字以内・annotations", new Set(names).size === names.length && names.every(n => n.length <= 64) && tl.result.tools.every(t => t.annotations));

// 17 self が persistence 状態を返す
const s1 = await W.selfCheck({});
const s2 = await W.selfCheck({ FEMTECH_KV: memKV() });
ok("self: neutral+persistence(none/kv)を反映", s1.neutral === true && s1.persistence === "none" && s2.persistence === "kv" && s1.medical_authority_claimed === false);

console.log(`\n  ${pass} green / ${fail} red`);
if (fail > 0) process.exit(1);
