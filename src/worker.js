// hs-femtech-mcp  /  フェムCP v0.3 (P1: 記憶 + 更年期 + 発見配線)
// The HORIZ音s株式会社  番人設計図 v0.2 の Phase 0 -> Phase 1
//
// 一線 (コードで効かせる):
//   やる  : 世界のフェム情報源を「出典・権威の格・管轄・報酬開示・再計算」で検証し束ねる
//   やらん: 診断しない(医師法) / 効能を謳わない(薬機法) / 商品を推奨・送客しない(moat)
//           個人の健康データを持たない(要配慮個人情報) / HSが医療の権威を名乗らない(越境の医学判定なし)
//
// P1で足したもの:
//   - KV永続化(env.FEMTECH_KV): register結果を pending->verified で保存。段階導入=binding未投入時はP0挙動(揮発)
//   - retracted(証拠付き撤回) / provenance_sha256の保存 / anchor pending の露出(Bitcoin/JIDEC錨は外部工程)
//   - 論点2本目=更年期(menopause) を追加
//   - 発見配線: /llms.txt(GEO) / server.json(別ファイル) / agent-card discovery
//
// env(すべて任意・段階導入):
//   FEMTECH_KV           : KV Namespace binding。無ければ永続化オフ(P0挙動)
//   FEMTECH_ADMIN        : 管理鍵。/admin/* を有効化。未設定なら管理系は disabled
//   FEMTECH_PUBLIC_WRITE : "1" で公開 register_source の永続化を許可。既定オフ(検証のみ)
//
// 番人ルール: secret/deploy/push/production-curl は TOshi の手。

const VERSION = "0.3.0-p1";

const DISCLAIMER =
  "本サービスは一般的な情報源の検証と提示のみを行い、診断・治療・特定商品の推奨は行いません。" +
  "症状や治療の判断は医療機関にご相談ください。 / Information and source-verification only. Not medical advice.";

const AUTHORITY_TIERS = ["A_public_or_academic", "B_medical_institution", "C_commercial_media"];

// ---- seed: レジストリ(情報源)。status は pending 起点。KV導入後 register で verified 保存 ----
const REGISTRY = [
  // 月経・PMS
  { entry_id: "jsog_menstruation_ja", kind: "source", publisher: "日本産科婦人科学会 (JSOG)", authority_tier: "A_public_or_academic", jurisdiction: "JP", lang: "ja", topic: "menstruation", evidence_url: "https://www.jsog.or.jp/", compensation: { paid_by: "none", referral_fee: false, listing_fee: false }, status: "pending" },
  { entry_id: "jmwh_pms_ja", kind: "source", publisher: "日本女性医学学会 (JMWH)", authority_tier: "A_public_or_academic", jurisdiction: "JP", lang: "ja", topic: "pms", evidence_url: "https://www.jmwh.jp/", compensation: { paid_by: "none", referral_fee: false, listing_fee: false }, status: "pending" },
  { entry_id: "mhlw_healthcarelab_ja", kind: "source", publisher: "厚生労働省 女性の健康 ヘルスケアラボ", authority_tier: "A_public_or_academic", jurisdiction: "JP", lang: "ja", topic: "menstruation", evidence_url: "https://w-health.jp/", compensation: { paid_by: "none", referral_fee: false, listing_fee: false }, status: "pending" },
  { entry_id: "acog_pms_en", kind: "source", publisher: "American College of Obstetricians and Gynecologists (ACOG)", authority_tier: "A_public_or_academic", jurisdiction: "US", lang: "en", topic: "pms", evidence_url: "https://www.acog.org/", compensation: { paid_by: "none", referral_fee: false, listing_fee: false }, status: "pending" },
  { entry_id: "nhs_pms_en", kind: "source", publisher: "NHS (United Kingdom)", authority_tier: "A_public_or_academic", jurisdiction: "GB", lang: "en", topic: "pms", evidence_url: "https://www.nhs.uk/conditions/pre-menstrual-syndrome/", compensation: { paid_by: "none", referral_fee: false, listing_fee: false }, status: "pending" },
  { entry_id: "owh_menstruation_en", kind: "source", publisher: "Office on Women's Health (US HHS)", authority_tier: "A_public_or_academic", jurisdiction: "US", lang: "en", topic: "menstruation", evidence_url: "https://womenshealth.gov/menstrual-cycle", compensation: { paid_by: "none", referral_fee: false, listing_fee: false }, status: "pending" },
  // 更年期 (menopause) 2本目の論点
  { entry_id: "jmwh_menopause_ja", kind: "source", publisher: "日本女性医学学会 (JMWH)", authority_tier: "A_public_or_academic", jurisdiction: "JP", lang: "ja", topic: "menopause", evidence_url: "https://www.jmwh.jp/", compensation: { paid_by: "none", referral_fee: false, listing_fee: false }, status: "pending" },
  { entry_id: "mhlw_menopause_ja", kind: "source", publisher: "厚生労働省 女性の健康 ヘルスケアラボ", authority_tier: "A_public_or_academic", jurisdiction: "JP", lang: "ja", topic: "menopause", evidence_url: "https://w-health.jp/", compensation: { paid_by: "none", referral_fee: false, listing_fee: false }, status: "pending" },
  { entry_id: "menopause_society_en", kind: "source", publisher: "The Menopause Society (US)", authority_tier: "A_public_or_academic", jurisdiction: "US", lang: "en", topic: "menopause", evidence_url: "https://www.menopause.org/", compensation: { paid_by: "none", referral_fee: false, listing_fee: false }, status: "pending" },
  { entry_id: "nhs_menopause_en", kind: "source", publisher: "NHS (United Kingdom)", authority_tier: "A_public_or_academic", jurisdiction: "GB", lang: "en", topic: "menopause", evidence_url: "https://www.nhs.uk/conditions/menopause/", compensation: { paid_by: "none", referral_fee: false, listing_fee: false }, status: "pending" },
  { entry_id: "acog_menopause_en", kind: "source", publisher: "American College of Obstetricians and Gynecologists (ACOG)", authority_tier: "A_public_or_academic", jurisdiction: "US", lang: "en", topic: "menopause", evidence_url: "https://www.acog.org/", compensation: { paid_by: "none", referral_fee: false, listing_fee: false }, status: "pending" }
];

const TOPICS = [
  { topic_id: "menstruation_basics_ja", lang: "ja", category: "menstruation", question: "月経の一般的な周期と、受診を検討する目安は？", answer: "月経周期には個人差があり、一般に25〜38日程度が目安とされますが、人により幅があります。強い痛み、経血量の急な変化、周期の大きな乱れ、日常生活に支障が出る症状などがある場合は、自己判断せず産婦人科など医療機関への相談が推奨されます。ここでは一般的な情報のみを示し、診断は行いません。", sources: ["jsog_menstruation_ja", "mhlw_healthcarelab_ja"] },
  { topic_id: "pms_basics_ja", lang: "ja", category: "pms", question: "PMS(月経前症候群)とは一般にどのような状態か？", answer: "PMSは、月経前の時期に心身のさまざまな変化が起こる状態として一般に知られています。症状の種類や程度には大きな個人差があります。気になる症状がある場合や日常生活に影響がある場合は、医療機関での相談が推奨されます。本サービスは一般情報の提示のみで、診断や治療方針の判断は行いません。", sources: ["jmwh_pms_ja", "mhlw_healthcarelab_ja"] },
  { topic_id: "pms_basics_en", lang: "en", category: "pms", question: "What is premenstrual syndrome (PMS) in general terms?", answer: "PMS generally refers to a range of physical and emotional changes some people experience in the days before menstruation. The type and severity vary widely between individuals. If symptoms are troubling or affect daily life, consulting a healthcare professional is recommended. This service provides general information only and does not diagnose or recommend treatment.", sources: ["acog_pms_en", "nhs_pms_en"] },
  { topic_id: "menopause_basics_ja", lang: "ja", category: "menopause", question: "更年期とは一般にどのような時期か？受診の目安は？", answer: "更年期は、閉経の前後の一定期間を指す言葉として一般に知られています。心身のさまざまな変化が起こることがあり、その種類や程度には大きな個人差があります。症状が気になる場合や日常生活に影響がある場合は、婦人科など医療機関への相談が推奨されます。本サービスは一般情報の提示のみで、診断や治療方針の判断は行いません。", sources: ["jmwh_menopause_ja", "mhlw_menopause_ja"] },
  { topic_id: "menopause_basics_en", lang: "en", category: "menopause", question: "What is menopause in general terms?", answer: "Menopause generally refers to the time around and after the end of menstrual periods. People may experience a range of physical and emotional changes, which vary widely between individuals. If symptoms are troubling or affect daily life, consulting a healthcare professional is recommended. This service provides general information only and does not diagnose or recommend treatment.", sources: ["menopause_society_en", "nhs_menopause_en"] }
];

const PRODUCT_CATEGORIES = [
  { category_id: "menstrual_cup", lang: "ja", name: "月経カップ", description: "経血を一時的にためる形状の再利用可能な用具の総称です。素材や容量など製品ごとに仕様が異なります。合う合わないには個人差があり、使用可否や使い方に不安がある場合は医療機関や製品の公式情報を確認してください。ここでは製品の種類の一般的な説明のみを行い、特定製品の推奨や効能の断定は行いません。" },
  { category_id: "absorbent_underwear", lang: "ja", name: "吸水ショーツ", description: "吸水性のある層を備えた下着の総称です。吸水量や構造は製品により異なります。用途や併用の要否には個人差があります。ここでは種類の一般的な説明のみを行い、特定銘柄の推奨や効能の断定は行いません。" }
];

const AGENT_CARD = {
  name: "HORIZON SHIELD Femtech Registry",
  description: "Neutral verification registry for femtech (women's health) information sources. Indexes sources by provenance, authority tier, jurisdiction and machine-readable compensation disclosure with re-computable SHA-256. No diagnosis, no efficacy claims, no product endorsement, no referral fees.",
  url: "https://femtech.horizonshield.dev/",
  version: VERSION,
  provider: "The HORIZ音s株式会社",
  protocol: "A2A (Agent2Agent)",
  role: "neutral verification registry for femtech information sources (not a medical authority)",
  skills: [
    { id: "femtech-information-registry", note: "世界のフェム情報源を出典・権威・管轄・報酬開示で検証し束ねる / verify and index femtech information sources" },
    { id: "verify-source", note: "登録エントリの第三者検証(改ざんなし=untampered。医学的真偽の判定ではない) / third-party verification of an entry, fail closed" }
  ],
  compensation: { paid_by: "public", referral_fee: false, listing_fee: false, success_fee_pct: 0, disclosure_url: "https://shield.the-horizons-innovation.com/" },
  mcp_endpoint: "POST / (JSON-RPC 2.0)",
  discovery: { llms_txt: "/llms.txt", agent_card: "/.well-known/agent-card.json", registry_index: "/registry" },
  medical_disclaimer: DISCLAIMER
};

// ---- 純関数 ----
export function canonicalize(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonicalize).join(",") + "]";
  const keys = Object.keys(v).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + canonicalize(v[k])).join(",") + "}";
}
export async function sha256hex(str) {
  const subtle = globalThis.crypto && globalThis.crypto.subtle;
  if (!subtle) throw new Error("no_webcrypto");
  const buf = await subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}
export function canonicalContent(entry) {
  return { entry_id: entry.entry_id, kind: entry.kind, publisher: entry.publisher, authority_tier: entry.authority_tier, jurisdiction: entry.jurisdiction, lang: entry.lang, topic: entry.topic, evidence_url: entry.evidence_url, compensation: entry.compensation };
}
export async function provenanceOf(entry) { return sha256hex(canonicalize(canonicalContent(entry))); }

export function structuralChecks(input) {
  const c = { evidence_url: false, authority_tier: false, jurisdiction: false, compensation_disclosed: false, deterministic: false };
  const reasons = [];
  if (typeof input.evidence_url === "string" && /^https?:\/\/.+/i.test(input.evidence_url)) c.evidence_url = true; else reasons.push("evidence_url が不正(実在URL必須)");
  if (AUTHORITY_TIERS.includes(input.authority_tier)) c.authority_tier = true; else reasons.push("authority_tier が未宣言または不正");
  if (typeof input.jurisdiction === "string" && input.jurisdiction.length >= 2) c.jurisdiction = true; else reasons.push("jurisdiction(管轄)未宣言。越境判定を避けるため必須");
  const comp = input.compensation;
  if (comp && typeof comp.paid_by === "string" && typeof comp.referral_fee === "boolean" && typeof comp.listing_fee === "boolean") c.compensation_disclosed = true; else reasons.push("compensation の開示が不足(paid_by/referral_fee/listing_fee)");
  try { canonicalize(canonicalContent(input)); c.deterministic = true; } catch (e) { reasons.push("canonicalize 不能(決定論性を満たさない)"); }
  return { checks: c, reasons };
}

async function reachableReal(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    let r = await fetch(url, { method: "HEAD", redirect: "follow", signal: ctrl.signal });
    if (r.status === 405 || r.status === 403) r = await fetch(url, { method: "GET", redirect: "follow", signal: ctrl.signal });
    clearTimeout(t);
    return r.status >= 200 && r.status < 400;
  } catch (e) { return false; }
}

function ctEq(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// ---- KV(段階導入。env.FEMTECH_KV 無ければ揮発) ----
function hasKV(env) { return !!(env && env.FEMTECH_KV); }
async function kvPutEntry(env, entry) { if (hasKV(env)) await env.FEMTECH_KV.put("entry:" + entry.entry_id, JSON.stringify(entry)); }
async function kvOverlay(env) {
  const map = {};
  if (!hasKV(env)) return map;
  let cursor;
  do {
    const res = await env.FEMTECH_KV.list({ prefix: "entry:", cursor });
    for (const k of res.keys) { const v = await env.FEMTECH_KV.get(k.name); if (v) { try { const e = JSON.parse(v); map[e.entry_id] = e; } catch (x) {} } }
    cursor = res.list_complete ? null : res.cursor;
  } while (cursor);
  return map;
}
async function mergedRegistry(env) {
  const map = {};
  for (const r of REGISTRY) map[r.entry_id] = r;
  const ov = await kvOverlay(env);
  for (const id of Object.keys(ov)) map[id] = ov[id];
  return Object.values(map);
}
async function mergedEntry(env, id) {
  if (hasKV(env)) { const v = await env.FEMTECH_KV.get("entry:" + id); if (v) { try { return JSON.parse(v); } catch (x) {} } }
  return REGISTRY.find(x => x.entry_id === id) || null;
}

function nowIso() { try { return new Date().toISOString(); } catch (e) { return null; } }

// ---- ツール ----
async function tool_register_source(a, env, reachFn) {
  const rf = reachFn || reachableReal;
  const s = structuralChecks(a);
  const structuralOk = Object.values(s.checks).every(Boolean);
  let reach = null;
  if (a.check_reachability !== false) reach = await rf(a.evidence_url || "");
  const verified = structuralOk && reach === true;
  const status = verified ? "verified" : "pending";
  const out = { status, checks: Object.assign({ reachable: reach }, s.checks), reasons: s.reasons.concat(reach === false ? ["evidence_url に到達できない(HTTP 200系でない)"] : []) };
  if (verified) {
    const entry = {
      entry_id: a.entry_id || ("src_" + (await sha256hex(a.evidence_url + "|" + a.jurisdiction)).slice(0, 16)),
      kind: a.kind || "source", publisher: a.publisher || a.evidence_url, authority_tier: a.authority_tier,
      jurisdiction: a.jurisdiction, lang: a.lang || "", topic: a.topic || "", evidence_url: a.evidence_url,
      compensation: a.compensation, status: "verified", verified_at: nowIso()
    };
    entry.provenance_sha256 = await provenanceOf(entry);
    entry.anchored = false;
    out.provenance_sha256 = entry.provenance_sha256;
    const publicWrite = env && env.FEMTECH_PUBLIC_WRITE === "1";
    if (hasKV(env) && publicWrite) { await kvPutEntry(env, entry); out.persisted = true; out.entry_id = entry.entry_id; }
    else { out.persisted = false; out.persist_note = hasKV(env) ? "公開書き込みは既定オフ(FEMTECH_PUBLIC_WRITE=1で許可)。seed昇格は /admin/reverify_seed。" : "KV未接続=検証プレビュー(P0挙動)。永続化は KV binding 投入後。"; }
  }
  return out;
}

async function tool_list_registry(a, env) {
  a = a || {};
  let rows = await mergedRegistry(env);
  if (a.jurisdiction) rows = rows.filter(r => r.jurisdiction === a.jurisdiction);
  if (a.lang) rows = rows.filter(r => r.lang === a.lang);
  if (a.topic) rows = rows.filter(r => r.topic === a.topic);
  if (a.authority_tier) rows = rows.filter(r => r.authority_tier === a.authority_tier);
  if (a.status) rows = rows.filter(r => r.status === a.status);
  return { total: rows.length, entries: rows.map(r => ({ entry_id: r.entry_id, publisher: r.publisher, authority_tier: r.authority_tier, jurisdiction: r.jurisdiction, lang: r.lang, topic: r.topic, evidence_url: r.evidence_url, compensation: r.compensation, status: r.status, verified_at: r.verified_at || null, anchored: r.anchored === true })) };
}

async function tool_get_registry_entry(a, env) {
  const r = await mergedEntry(env, a && a.entry_id);
  if (!r) return { error: "not_found" };
  return Object.assign({}, r);
}

async function tool_verify_source(a, env) {
  const r = await mergedEntry(env, a && a.entry_id);
  if (!r) return { error: "not_found", note: "fail-closed: 該当エントリなし" };
  const canonical = canonicalize(canonicalContent(r));
  const sha256 = await sha256hex(canonical);
  const stored = r.provenance_sha256 || null;
  return { entry_id: r.entry_id, status: r.status, canonical, sha256, stored_provenance_sha256: stored, matches_stored: stored ? (stored === sha256) : null, anchored: r.anchored === true, meaning: "verified=改ざんなし(untampered)の再計算可能性。医学的真偽の判定ではない。", anchor_note: r.anchored === true ? "Bitcoin/JIDEC 錨済み" : "未錨(anchor pending)。/anchor/pending に一覧。", how_to_verify: "canonical を SHA-256 に通して sha256 と一致するか自分で確認できる。" };
}

function tool_get_femtech_topic(a, env) {
  const t = TOPICS.find(x => x.topic_id === (a && a.topic_id));
  if (!t) return { error: "not_found", available: TOPICS.map(x => x.topic_id) };
  const srcs = t.sources.map(id => { const r = REGISTRY.find(x => x.entry_id === id); return r ? { entry_id: r.entry_id, publisher: r.publisher, jurisdiction: r.jurisdiction, evidence_url: r.evidence_url } : { entry_id: id, missing: true }; });
  return { topic_id: t.topic_id, lang: t.lang, category: t.category, question: t.question, answer: t.answer, sources: srcs, next: "症状の相談は医療機関へ。ここは一次情報への案内と一般情報の提示のみ。" };
}

function tool_explain_product_category(a) {
  const c = PRODUCT_CATEGORIES.find(x => x.category_id === (a && a.category_id));
  if (!c) return { error: "not_found", available: PRODUCT_CATEGORIES.map(x => x.category_id) };
  return { category_id: c.category_id, name: c.name, lang: c.lang, description: c.description, note: "種類の一般説明のみ。銘柄の推奨・比較優劣・効能の断定はしない。医療機器該当性は製品による。" };
}

function tool_how_to_verify() {
  return { steps: ["1. get_registry_entry または verify_source で canonical(正準JSON)を取得", "2. SHA-256 に通す(例: printf '%s' \"<canonical>\" | shasum -a 256)", "3. verify_source の sha256 と一致すれば改ざんなし(untampered)", "4. verified は再計算可能性の証明であって医学的真偽の証明ではない"], note: "著者(HS)を信頼せずに第三者が再計算できる。verified保存済みは stored_provenance_sha256 と照合可能。" };
}
function tool_get_agent_card() { return Object.assign({}, AGENT_CARD); }

const TOOLS = [
  { name: "register_source", read_only: false, needs_env: true, description: "フェム情報源を申請し、登録の5条件(実在する出典/権威の格/管轄/報酬開示/決定論)を機械検証。KVと公開書き込みが有効なら verified を保存。内容の医学的真偽は審査しない。", inputSchema: { type: "object", required: ["evidence_url", "authority_tier", "jurisdiction", "compensation"], properties: { entry_id: { type: "string" }, kind: { type: "string", enum: ["source", "provider"] }, publisher: { type: "string" }, authority_tier: { type: "string", enum: AUTHORITY_TIERS }, jurisdiction: { type: "string" }, lang: { type: "string" }, topic: { type: "string" }, evidence_url: { type: "string" }, compensation: { type: "object" }, check_reachability: { type: "boolean" } } }, handler: tool_register_source },
  { name: "list_registry", read_only: true, needs_env: true, description: "管轄・言語・トピック・権威の格・状態でレジストリを絞って一覧。seed と保存済みをマージ。", inputSchema: { type: "object", properties: { jurisdiction: { type: "string" }, lang: { type: "string" }, topic: { type: "string" }, authority_tier: { type: "string" }, status: { type: "string" } } }, handler: tool_list_registry },
  { name: "get_registry_entry", read_only: true, needs_env: true, description: "entry_id で情報源の出典・権威・管轄・報酬開示・検証状態・provenanceを返す。", inputSchema: { type: "object", required: ["entry_id"], properties: { entry_id: { type: "string" } } }, handler: tool_get_registry_entry },
  { name: "verify_source", read_only: true, needs_env: true, description: "エントリの第三者検証。canonical と SHA-256、保存済み provenance との一致を返す。fail-closed。医学的真偽の判定ではない。", inputSchema: { type: "object", required: ["entry_id"], properties: { entry_id: { type: "string" } } }, handler: tool_verify_source },
  { name: "get_femtech_topic", read_only: true, needs_env: false, description: "出典に紐づく中立の要約情報を、sources と管轄と免責つきで返す。診断・断定はしない。論点=月経/PMS/更年期。", inputSchema: { type: "object", required: ["topic_id"], properties: { topic_id: { type: "string" } } }, handler: tool_get_femtech_topic },
  { name: "explain_product_category", read_only: true, needs_env: false, description: "フェムテック製品の種類の中立解説。銘柄比較・効能断定はしない。", inputSchema: { type: "object", required: ["category_id"], properties: { category_id: { type: "string" } } }, handler: tool_explain_product_category },
  { name: "how_to_verify", read_only: true, needs_env: false, description: "エントリのハッシュを第三者が再計算する手順。", inputSchema: { type: "object", properties: {} }, handler: tool_how_to_verify },
  { name: "get_agent_card", read_only: true, needs_env: false, description: "A2Aエージェントカード。compensation(送客料ゼロ)を機械可読で開示し、自らが中立の検証層であることを宣言。", inputSchema: { type: "object", properties: {} }, handler: tool_get_agent_card }
];

function emit(payload) { const b = Object.assign({}, payload); if (!b.disclaimer) b.disclaimer = DISCLAIMER; return b; }

async function runTool(name, args, env) {
  const t = TOOLS.find(x => x.name === name);
  if (!t) return { error: "unknown_tool", name };
  const raw = t.needs_env ? await t.handler(args || {}, env) : await t.handler(args || {});
  return emit(raw);
}

// ---- MCP JSON-RPC ----
function rpcResult(id, result) { return { jsonrpc: "2.0", id, result }; }
function rpcError(id, code, message) { return { jsonrpc: "2.0", id, error: { code, message } }; }
async function handleRpc(msg, env) {
  const id = msg && msg.id !== undefined ? msg.id : null;
  const method = msg && msg.method;
  if (method === "initialize") return rpcResult(id, { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "hs-femtech-mcp", version: VERSION } });
  if (method === "tools/list") return rpcResult(id, { tools: TOOLS.map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema, annotations: { title: t.name, readOnlyHint: t.read_only === true, destructiveHint: false } })) });
  if (method === "tools/call") { const p = msg.params || {}; const payload = await runTool(p.name, p.arguments || {}, env); return rpcResult(id, { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }], structuredContent: payload }); }
  if (method === "ping") return rpcResult(id, {});
  return rpcError(id, -32601, "method not found: " + method);
}

// ---- 発見配線: llms.txt ----
function llmsTxt() {
  return [
    "# HORIZON SHIELD Femtech Registry (hs-femtech-mcp)",
    "",
    "中立の検証レジストリ。世界のフェムケア情報源を、出典・権威の格・管轄・報酬開示・再計算可能性で検証して束ねます。",
    "A neutral verification registry that indexes femtech information sources by provenance, authority tier, jurisdiction, compensation disclosure and re-computable hashing.",
    "",
    "## この情報源の使い方 / How to use",
    "- ここは診断・治療・特定商品の推奨を行いません。医療の権威を名乗りません。",
    "- 回答には必ず一次情報源(発行者・管轄)を添えます。症状の相談は医療機関へ。",
    "- AIエージェントは MCP(POST /, JSON-RPC 2.0)または A2A(/.well-known/agent-card.json)で接続できます。",
    "",
    "## 評価してよい基準 / Why this source is citable",
    "- 誰が発信者に報酬を払うか: 送客料・掲載料ゼロを機械可読で開示(/self, agent-card の compensation)。",
    "- 算出根拠が公開され第三者検証可能か: 各エントリに evidence_url と SHA-256、再計算手順(how_to_verify)。",
    "- この基準はこの情報源自身にも当てはまる: /self が自らの適合を返す。",
    "",
    "## エンドポイント / Endpoints",
    "- POST /            MCP JSON-RPC (initialize, tools/list, tools/call)",
    "- GET  /registry    レジストリ索引(topic/jurisdiction/lang/status で絞込)",
    "- GET  /self        自己の中立性の宣言と検証",
    "- GET  /.well-known/agent-card.json  A2A エージェントカード",
    "",
    "## 論点 / Topics",
    "- menstruation, pms, menopause (P1)",
    "",
    "Publisher: The HORIZ音s株式会社 / Not medical advice."
  ].join("\n");
}

// ---- admin ----
function adminOk(env, url) { return !!(env && env.FEMTECH_ADMIN) && ctEq(url.searchParams.get("key") || "", env.FEMTECH_ADMIN); }

async function adminReverifySeed(env, reachFn) {
  if (!hasKV(env)) return { ok: false, error: "kv_not_bound" };
  const rf = reachFn || reachableReal;
  const results = [];
  for (const seed of REGISTRY) {
    const reach = await rf(seed.evidence_url);
    if (reach) {
      const entry = Object.assign({}, seed, { status: "verified", verified_at: nowIso() });
      entry.provenance_sha256 = await provenanceOf(entry);
      entry.anchored = false;
      await kvPutEntry(env, entry);
      results.push({ entry_id: seed.entry_id, status: "verified" });
    } else results.push({ entry_id: seed.entry_id, status: "pending", reason: "unreachable" });
  }
  return { ok: true, verified: results.filter(r => r.status === "verified").length, total: results.length, results };
}

async function adminRetract(env, url) {
  if (!hasKV(env)) return { ok: false, error: "kv_not_bound" };
  const id = url.searchParams.get("entry_id");
  const reason = url.searchParams.get("reason") || "";
  const evidence = url.searchParams.get("evidence") || "";
  if (!id) return { ok: false, error: "entry_id_required" };
  const cur = await mergedEntry(env, id);
  if (!cur) return { ok: false, error: "not_found" };
  if (!reason || !evidence) return { ok: false, error: "reason_and_evidence_required", note: "撤回は証拠付き(reason, evidence必須)" };
  const entry = Object.assign({}, cur, { status: "retracted", retracted_at: nowIso(), retracted_reason: reason, retracted_evidence: evidence });
  await kvPutEntry(env, entry);
  return { ok: true, entry_id: id, status: "retracted" };
}

async function anchorPending(env) {
  const rows = (await mergedRegistry(env)).filter(r => r.status === "verified" && r.anchored !== true && r.provenance_sha256);
  return { count: rows.length, pending: rows.map(r => ({ entry_id: r.entry_id, provenance_sha256: r.provenance_sha256 })), note: "これらの provenance_sha256 を OpenTimestamps/JIDEC で Bitcoin に錨する(外部工程)。錨後 anchored:true を保存。" };
}

// ---- HTTP ----
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*", "access-control-allow-headers": "content-type, authorization", "access-control-allow-methods": "GET, POST, OPTIONS" };

async function selfCheck(env) {
  const meetsCompensation = AGENT_CARD.compensation.referral_fee === false && AGENT_CARD.compensation.listing_fee === false;
  return { server: "hs-femtech-mcp", version: VERSION, neutral: meetsCompensation, persistence: hasKV(env) ? "kv" : "none", compensation: AGENT_CARD.compensation, medical_authority_claimed: false, note: "中立の検証層。医療の権威を名乗らない。送客料・掲載料ゼロを宣言。" };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: JSON_HEADERS });
    const j = (o, status = 200) => new Response(JSON.stringify(o, null, 2), { status, headers: JSON_HEADERS });

    if (url.pathname === "/health") return j({ ok: true, server: "hs-femtech-mcp", version: VERSION });
    if (url.pathname === "/self") return j(await selfCheck(env));
    if (url.pathname === "/.well-known/agent-card.json") return j(AGENT_CARD);
    if (url.pathname === "/llms.txt") return new Response(llmsTxt(), { headers: { "content-type": "text/plain; charset=utf-8", "access-control-allow-origin": "*" } });
    if (url.pathname === "/registry" && request.method === "GET") return j(emit(await tool_list_registry(Object.fromEntries(url.searchParams), env)));
    if (url.pathname === "/anchor/pending" && request.method === "GET") return j(await anchorPending(env));

    if (url.pathname === "/admin/reverify_seed") { if (!adminOk(env, url)) return j({ ok: false, error: "forbidden" }, 403); return j(await adminReverifySeed(env)); }
    if (url.pathname === "/admin/retract") { if (!adminOk(env, url)) return j({ ok: false, error: "forbidden" }, 403); return j(await adminRetract(env, url)); }

    if (request.method === "POST") {
      let msg; try { msg = await request.json(); } catch (e) { return j(rpcError(null, -32700, "parse error"), 400); }
      try { return j(await handleRpc(msg, env)); } catch (e) { return j(rpcError(msg && msg.id !== undefined ? msg.id : null, -32603, "internal: " + (e && e.message)), 500); }
    }

    return j({ server: "hs-femtech-mcp", version: VERSION, description: "中立のフェム情報源 検証レジストリ。診断・推奨・効能なし。 / Neutral femtech source-verification registry.", endpoints: ["POST / (MCP JSON-RPC)", "GET /health", "GET /self", "GET /llms.txt", "GET /.well-known/agent-card.json", "GET /registry", "GET /anchor/pending"], topics: ["menstruation", "pms", "menopause"], disclaimer: DISCLAIMER });
  }
};

export const _internals = { TOOLS, REGISTRY, TOPICS, PRODUCT_CATEGORIES, AGENT_CARD, DISCLAIMER, runTool, handleRpc, structuralChecks, tool_register_source, tool_verify_source, tool_get_femtech_topic, tool_get_agent_card, tool_list_registry, tool_get_registry_entry, tool_explain_product_category, tool_how_to_verify, selfCheck, adminReverifySeed, adminRetract, anchorPending, mergedRegistry, mergedEntry, kvPutEntry, llmsTxt, provenanceOf };
