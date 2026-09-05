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

const VERSION = "0.4.0";

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

// --- A2A Conduct Extension v1 (2026-09-06) ---
// 誰が払うか、行儀の記録(第三者が書いた物)がどこか、繋いだ相手が自分の観測をどこに出せるか。
// card の capabilities.extensions[] に置く(A2A 1.0 の正規の場所)。top-level の compensation は旧読者のために残す。
// 扉 0.3.2 は両方読んで 5 鍵の一致を要求する。仕様は URI そのもの。点数も判定も無い。
const CONDUCT_EXT_URI = "https://gate.horizonshield.dev/ext/conduct/v1";
const FEMTECH_COMPENSATION = { paid_by: "public", referral_fee: false, listing_fee: false, success_fee_pct: 0, disclosure_url: "https://shield.the-horizons-innovation.com/" };
function conductExtension(measuredEndpoint, compensation) {
  return {
    uri: CONDUCT_EXT_URI,
    description: "Who pays this agent, where its measured conduct record lives, and where to file a witness walk. The specification is served at the URI.",
    required: false,
    params: {
      compensation,
      measured_endpoints: [measuredEndpoint],
      conduct_record: "https://gate.horizonshield.dev/history?endpoint=" + encodeURIComponent(measuredEndpoint),
      verdict_recipe: "https://gate.horizonshield.dev/spec",
      witness_intake: "https://ledger.horizonshield.dev/witness",
      register: "https://gate.horizonshield.dev/register",
      rings: {
        spec: "https://github.com/ogasurfproject-jpg/horizon-shield/blob/main/workers/hs-ledger/nenrin/NENRIN_SPEC_v1.md",
        spec_sha256: "9ccba2e325fd2a555fcdb2dec519b8c6bf7a669064674846aea98ecfff824e3d",
        base: "https://raw.githubusercontent.com/ogasurfproject-jpg/mcp-conduct-register/main/rings/",
        path: "<slug>/<YYYY-MM>.json",
        slug: "endpoint URL without https://, lower case, every run of characters outside [a-z0-9] replaced by one hyphen, hyphens trimmed at both ends",
        ledger: "https://ledger.horizonshield.dev/ledger"
      }
    }
  };
}

const AGENT_CARD = {
  capabilities: { streaming: false, pushNotifications: false, extensions: [conductExtension("https://femtech.horizonshield.dev/mcp", FEMTECH_COMPENSATION)] },
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
  compensation: FEMTECH_COMPENSATION,
  mcp_endpoint: "POST / (JSON-RPC 2.0)",
  discovery: { llms_txt: "/llms.txt", agent_card: "/.well-known/agent-card.json", registry_index: "/registry", source_checker: "/checker", source_check_api: "/check-source", verified_badge: "/badge", beginner_guide: "/start" },
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

// ---- 出どころチェッカー(check_source) ----
// 鉄の掟: 返すのは「誰が・どの立場で・利益相反の開示があるか」だけ。
//   真偽の判定なし / 製品の良し悪しなし / 会社への否定なし / 症状入力なし(個人健康データ非保持)。
const AUTHORITY_LABEL = {
  A_public_or_academic: "公的機関・学会（一次情報）",
  B_medical_institution: "医療機関",
  C_commercial_media: "商業メディア"
};
const SELF_CHECK = [
  "その情報を出しているのは誰ですか。公的機関・学会・医療機関ですか、それとも個人や販売者ですか。",
  "根拠(出典)が公開されていて、あなた自身がたどれますか。",
  "どの国・地域の基準の話ですか。「どこでも正しい」とは限りません。",
  "その発信者は、紹介料やスポンサーなど、そう言うことで報酬を受け取っていませんか（利益相反の開示があるか）。"
];
function hostOf(u) {
  try { return new URL(/^https?:\/\//i.test(u) ? u : ("https://" + u)).hostname.replace(/^www\./i, "").toLowerCase(); }
  catch (e) { return ""; }
}
async function tool_check_source(a, env) {
  a = a || {};
  const rawUrl = typeof a.url === "string" ? a.url.trim() : "";
  const rawPub = typeof a.publisher === "string" ? a.publisher.trim() : "";
  const topic = typeof a.topic === "string" ? a.topic.trim() : "";
  if (!rawUrl && !rawPub) {
    return { found: null, verdict: "no_input", input_note: "URL か 発信元の名前を渡してください。内容の真偽は判定しません。誰が・どの立場で・利益相反の開示があるか、だけを返します。", self_check: SELF_CHECK, available_topics: ["menstruation", "pms", "menopause"], scope: "provenance_and_disclosure_only" };
  }
  const host = hostOf(rawUrl);
  const pubLc = rawPub.toLowerCase();
  const rows = await mergedRegistry(env);
  const matches = rows.filter(r => {
    if (r.status === "retracted") return false;
    const eh = hostOf(r.evidence_url);
    const hostHit = host && eh && (eh === host || eh.endsWith("." + host) || host.endsWith("." + eh));
    const pubHit = pubLc && r.publisher && (r.publisher.toLowerCase().includes(pubLc) || pubLc.includes(r.publisher.toLowerCase()));
    return hostHit || pubHit;
  });
  if (matches.length) {
    return {
      found: true, verdict: "in_registry", query: { url: rawUrl || null, publisher: rawPub || null },
      trust_card: matches.map(r => ({ publisher: r.publisher, authority_tier: r.authority_tier, authority_label: AUTHORITY_LABEL[r.authority_tier] || r.authority_tier, jurisdiction: r.jurisdiction, topic: r.topic, evidence_url: r.evidence_url, compensation: r.compensation, status: r.status, verified_at: r.verified_at || null, provenance_sha256: r.provenance_sha256 || null, recheck: "verify_source(entry_id: " + r.entry_id + ") で自分で再計算できます。" })),
      meaning: "この出どころは当レジストリに収録されています。ここで示すのは「誰が・どの立場で・利益相反の開示があるか」であって、内容の医学的な正しさではありません。",
      scope: "provenance_and_disclosure_only"
    };
  }
  const topicSet = topic ? [topic] : ["menstruation", "pms", "menopause"];
  const alternatives = rows.filter(r => r.status !== "retracted" && topicSet.includes(r.topic)).slice(0, 6).map(r => ({ publisher: r.publisher, authority_tier: r.authority_tier, authority_label: AUTHORITY_LABEL[r.authority_tier] || r.authority_tier, jurisdiction: r.jurisdiction, topic: r.topic, evidence_url: r.evidence_url }));
  return {
    found: false, verdict: "not_in_registry", query: { url: rawUrl || null, publisher: rawPub || null },
    neutral_note: "この出どころは当レジストリに未収録です。これは「信用できない」という意味ではありません。私たちがまだ検証していない、という意味です。内容の真偽は判定しません。",
    self_check: SELF_CHECK, verified_alternatives: alternatives,
    how_to_get_verified: "発信者は register_source（実在する出典・権威の格・管轄・報酬開示・再計算の5条件）を満たせば収録されます。",
    scope: "provenance_and_disclosure_only"
  };
}

const TOOLS = [
  { name: "register_source", read_only: false, needs_env: true, description: "フェム情報源を申請し、登録の5条件(実在する出典/権威の格/管轄/報酬開示/決定論)を機械検証。KVと公開書き込みが有効なら verified を保存。内容の医学的真偽は審査しない。", inputSchema: { type: "object", required: ["evidence_url", "authority_tier", "jurisdiction", "compensation"], properties: { entry_id: { type: "string" }, kind: { type: "string", enum: ["source", "provider"] }, publisher: { type: "string" }, authority_tier: { type: "string", enum: AUTHORITY_TIERS }, jurisdiction: { type: "string" }, lang: { type: "string" }, topic: { type: "string" }, evidence_url: { type: "string" }, compensation: { type: "object" }, check_reachability: { type: "boolean" } } }, handler: tool_register_source },
  { name: "list_registry", read_only: true, needs_env: true, description: "管轄・言語・トピック・権威の格・状態でレジストリを絞って一覧。seed と保存済みをマージ。", inputSchema: { type: "object", properties: { jurisdiction: { type: "string" }, lang: { type: "string" }, topic: { type: "string" }, authority_tier: { type: "string" }, status: { type: "string" } } }, handler: tool_list_registry },
  { name: "get_registry_entry", read_only: true, needs_env: true, description: "entry_id で情報源の出典・権威・管轄・報酬開示・検証状態・provenanceを返す。", inputSchema: { type: "object", required: ["entry_id"], properties: { entry_id: { type: "string" } } }, handler: tool_get_registry_entry },
  { name: "verify_source", read_only: true, needs_env: true, description: "エントリの第三者検証。canonical と SHA-256、保存済み provenance との一致を返す。fail-closed。医学的真偽の判定ではない。", inputSchema: { type: "object", required: ["entry_id"], properties: { entry_id: { type: "string" } } }, handler: tool_verify_source },
  { name: "get_femtech_topic", read_only: true, needs_env: false, description: "出典に紐づく中立の要約情報を、sources と管轄と免責つきで返す。診断・断定はしない。論点=月経/PMS/更年期。", inputSchema: { type: "object", required: ["topic_id"], properties: { topic_id: { type: "string" } } }, handler: tool_get_femtech_topic },
  { name: "explain_product_category", read_only: true, needs_env: false, description: "フェムテック製品の種類の中立解説。銘柄比較・効能断定はしない。", inputSchema: { type: "object", required: ["category_id"], properties: { category_id: { type: "string" } } }, handler: tool_explain_product_category },
  { name: "how_to_verify", read_only: true, needs_env: false, description: "エントリのハッシュを第三者が再計算する手順。", inputSchema: { type: "object", properties: {} }, handler: tool_how_to_verify },
  { name: "get_agent_card", read_only: true, needs_env: false, description: "A2Aエージェントカード。compensation(送客料ゼロ)を機械可読で開示し、自らが中立の検証層であることを宣言。", inputSchema: { type: "object", properties: {} }, handler: tool_get_agent_card },
  { name: "check_source", read_only: true, needs_env: true, description: "気になる健康情報のURLまたは発信元の名前を渡すと、その出どころが当レジストリで検証済みか（誰が・権威の格・管轄・利益相反の開示）を返す。未収録なら「信用できない」ではなく「未検証」として、自分で確かめる観点と検証済みの一次情報源を案内する。内容の医学的真偽・製品の良し悪しは一切判定しない。症状入力は受け取らない。", inputSchema: { type: "object", properties: { url: { type: "string" }, publisher: { type: "string" }, topic: { type: "string" } } }, handler: tool_check_source }
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
    "- GET  /checker     人が使う「出どころチェッカー」ページ",
    "- GET  /start       はじめての人向けガイド(中立の入口)",
    "- GET  /check-source?url=...  出どころの検証状態(誰が・権威・管轄・報酬開示)をJSONで返す。真偽は判定しない。",
    "- GET  /self        自己の中立性の宣言と検証",
    "- GET  /.well-known/agent-card.json  A2A エージェントカード",
    "",
    "## 論点 / Topics",
    "- menstruation, pms, menopause (P1)",
    "",
    "Publisher: The HORIZ音s株式会社 / Not medical advice."
  ].join("\n");
}

// ---- 公開ページ: Source Checker / 出どころチェッカー (warm, bilingual EN default) ----
function checkerPage() {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Source Checker | HORIZON SHIELD Femtech Registry</title>
<meta name="description" content="Paste a link or a source name and see who is really behind a piece of women's health information. No diagnosis, no product recommendations, no judgment of truth. We only check the source.">
<style>
  :root{--bg:#FBF5F1;--card:#FFFFFF;--ink:#2E2630;--soft:#8A7F86;--line:#ECE0E5;--teal:#7A3F63;--tealbg:#F3E7EE;--clay:#B76A4A;--claybg:#F8EBE1;--shadow:0 6px 22px rgba(70,40,60,.08)}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,'Segoe UI','Hiragino Sans','Noto Sans CJK JP',sans-serif;line-height:1.75;-webkit-font-smoothing:antialiased}
  .wrap{max-width:720px;margin:0 auto;padding:28px 20px 90px}
  .top{display:flex;align-items:center;justify-content:space-between;margin-bottom:32px}
  .brand{display:flex;align-items:center;gap:10px}
  .brand .mk{width:26px;height:30px}
  .brand .nm{font-size:12.5px;letter-spacing:1.5px;color:var(--soft);font-weight:700;text-transform:uppercase}
  .brand .nm b{color:var(--ink)}
  .lang{display:flex;gap:2px;background:#F1E7DC;border-radius:999px;padding:3px}
  .lang button{border:0;background:transparent;color:var(--soft);font-size:13px;font-weight:600;padding:6px 13px;border-radius:999px;cursor:pointer}
  .lang button.on{background:#fff;color:var(--ink);box-shadow:0 1px 3px rgba(0,0,0,.08)}
  h1{font-family:Georgia,'Times New Roman','Noto Serif CJK JP',serif;font-size:34px;line-height:1.25;margin:0 0 14px;font-weight:700;letter-spacing:-.2px}
  .lead{color:#5f574e;font-size:17px;margin:0}
  .guard{color:var(--teal);font-size:14px;font-weight:600;margin:14px 0 26px}
  .panel{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:22px;box-shadow:var(--shadow)}
  label{display:block;font-size:14px;color:var(--soft);margin-bottom:9px;font-weight:600}
  .row{display:flex;gap:10px;flex-wrap:wrap}
  input[type=text]{flex:1;min-width:220px;background:#FCFAF7;border:1.5px solid var(--line);border-radius:12px;color:var(--ink);padding:14px 15px;font-size:16px}
  input[type=text]:focus{outline:none;border-color:var(--teal);background:#fff}
  button#go{background:var(--teal);color:#fff;border:0;border-radius:12px;padding:14px 26px;font-size:16px;font-weight:700;cursor:pointer}
  button#go:disabled{opacity:.55}
  .hint{font-size:13px;color:var(--soft);margin-top:11px}
  #result{margin-top:16px}
  .card{border-radius:16px;padding:18px;margin-top:12px;border:1px solid var(--line);background:#FCFAF7}
  .card.ok{border-color:#E3CBD9;background:var(--tealbg)}
  .card.learn{border-color:#ECC7B6;background:var(--claybg)}
  .chip{display:inline-block;font-size:12px;font-weight:800;letter-spacing:.4px;padding:4px 12px;border-radius:999px}
  .chip.ok{background:#EBD6E1;color:#6d3457}
  .chip.learn{background:#F0D9C9;color:#a4522f}
  .pub{font-size:18px;font-weight:700;margin:12px 0 6px;font-family:Georgia,'Noto Serif CJK JP',serif}
  .kv{font-size:14.5px;color:#4c453d;margin:4px 0;display:flex;gap:8px;flex-wrap:wrap}
  .kv span{color:var(--soft);min-width:104px;font-weight:600}
  .meaning{color:#6a6157;font-size:13.5px;margin:12px 0 0}
  .note{font-size:15px;margin:10px 0 0;color:#5a5148}
  .sub{font-weight:700;margin:15px 0 4px;font-size:14.5px}
  .checks{margin:6px 0 0;padding-left:20px}
  .checks li{margin:6px 0;color:#4c453d}
  .alts{list-style:none;padding:0;margin:6px 0 0}
  .alts li{margin:9px 0;color:#4c453d;font-size:14.5px}
  a{color:var(--teal);text-decoration:none;word-break:break-all;font-weight:600}
  .sect{margin-top:44px}
  .sect h2{font-family:Georgia,'Noto Serif CJK JP',serif;font-size:22px;margin:0 0 6px}
  .sect .lead{font-size:15px;margin-bottom:14px}
  ol.spot{padding-left:0;counter-reset:s;margin:0}
  ol.spot li{background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 15px;margin:8px 0;list-style:none;color:#4c453d}
  ol.spot li::before{counter-increment:s;content:counter(s);color:var(--teal);font-weight:800;margin-right:10px}
  .foot{margin-top:44px;padding-top:18px;border-top:1px solid var(--line);color:var(--soft);font-size:13px}
  .foot a{color:var(--clay);text-decoration:underline;font-weight:600}
  .soft{color:var(--soft)}
</style></head>
<body><div class="wrap">
  <div class="top">
    <div class="brand">
      <svg class="mk" viewBox="0 0 56 64" fill="none"><path d="M28 3 L51 12 V30 C51 46 41 56 28 61 C15 56 5 46 5 30 V12 Z" stroke="#7A3F63" stroke-width="2.5" fill="rgba(122,63,99,.07)"/><path d="M35 22 A13 13 0 1 0 35 44 A10 10 0 1 1 35 22 Z" fill="#7A3F63"/></svg>
      <div class="nm"><b>HORIZON SHIELD</b> <span data-i18n="brand_sub">Femtech Registry</span></div>
    </div>
    <div class="lang"><button id="lang-en" type="button">EN</button><button id="lang-ja" type="button">日本語</button></div>
  </div>

  <h1 data-i18n="h1">Who is really behind that health advice?</h1>
  <p class="lead" data-i18n="lead">Paste a link, or the name of a source. We check where it comes from, neutrally.</p>
  <p class="guard" data-i18n="guard">No diagnosis. No product recommendations. We never rule on whether a claim is true. We only check the source.</p>

  <div class="panel">
    <label for="q" data-i18n="inlabel">A link to the health information, or the name of the source</label>
    <div class="row">
      <input id="q" type="text" autocomplete="off">
      <button id="go" type="button" data-i18n="btn">Check</button>
    </div>
    <div class="hint" data-i18n="hint">Please do not enter symptoms. This checks sources, not your health.</div>
    <div id="result"></div>
  </div>

  <div class="sect">
    <h2 data-i18n="spot_title">Four questions to check it yourself</h2>
    <p class="lead" data-i18n="spot_lead">Apply these four to anything, and the reliability of its origin comes into view.</p>
    <ol class="spot" id="spot-list"></ol>
  </div>

  <div class="foot">
    <span data-i18n="foot">This service verifies and points to information sources only. It does not diagnose, treat, or recommend products. For symptoms or treatment, please consult a healthcare professional.</span><br>
    <a href="/registry" data-i18n="registry_link">Verified sources</a> &nbsp;·&nbsp; <a href="/llms.txt" data-i18n="ai_link">Connect your AI</a> &nbsp;·&nbsp; <a href="https://github.com/ogasurfproject-jpg/hs-femtech-mcp">GitHub</a><br>
    The HORIZ音s株式会社 / Not medical advice.
  </div>
</div>
<script>
(function(){
  var TIER={A_public_or_academic:{en:"Public / academic (primary source)",ja:"公的機関・学会（一次情報）"},B_medical_institution:{en:"Medical institution",ja:"医療機関"},C_commercial_media:{en:"Commercial media",ja:"商業メディア"}};
  var T={
    en:{brand_sub:"Femtech Registry",h1:"Who is really behind that health advice?",lead:"Paste a link, or the name of a source. We check where it comes from, neutrally.",guard:"No diagnosis. No product recommendations. We never rule on whether a claim is true. We only check the source.",inlabel:"A link to the health information, or the name of the source",inph:"https://... or an organization or site name",btn:"Check",hint:"Please do not enter symptoms. This checks sources, not your health.",checking:"Checking...",verified_tag:"Verified source",verified_meaning:"This source is in our registry. What we show is who is behind it, in what role, and whether a conflict of interest is disclosed. It is not a judgment of medical correctness.",role:"Role",jurisdiction:"Jurisdiction",topic:"Topic",coi:"Conflict of interest",primary:"Primary source",recompute:"Recompute (SHA-256)",notverified_tag:"Not yet verified",notverified_note:"This source is not in our registry yet. That does not mean it is untrustworthy. It only means we have not verified it. We do not judge whether the content is true.",selfcheck_title:"How to check it yourself",selfcheck:["Who is publishing it? A public body, a medical society, a clinic, or an individual or seller?","Is the evidence (the source) public, and can you trace it yourself?","Which country or region's standard is this? Nothing is correct everywhere.","Does the publisher earn anything for saying it, through referrals or sponsors? Is any conflict of interest disclosed?"],alts_title:"Verified primary sources on this topic",open:"Open",spot_title:"Four questions to check it yourself",spot_lead:"Apply these four to anything, and the reliability of its origin comes into view.",paidby:"paid by",ref:"referral fee",list:"listing fee",yes:"yes",no:"no",none:"not disclosed",foot:"This service verifies and points to information sources only. It does not diagnose, treat, or recommend products. For symptoms or treatment, please consult a healthcare professional.",registry_link:"Verified sources",ai_link:"Connect your AI",err:"Something went wrong. Please try again.",empty:"Please enter a link or the name of a source."},
    ja:{brand_sub:"フェム情報源レジストリ",h1:"その健康情報、誰が言ってますか。",lead:"URLか発信元の名前を入れてください。その「出どころ」を中立に確かめます。",guard:"診断はしません。製品も勧めません。真偽も裁きません。確かめるのは、出どころだけです。",inlabel:"気になる健康情報のURL、または発信元の名前",inph:"https://... または 学会・機関・サイト名",btn:"チェック",hint:"症状は入力しないでください。ここは出どころを見る場所で、体調の相談窓口ではありません。",checking:"確認しています...",verified_tag:"収録・検証済み",verified_meaning:"この出どころは当レジストリに収録されています。ここで示すのは「誰が・どの立場で・利益相反の開示があるか」であって、内容の医学的な正しさではありません。",role:"立場",jurisdiction:"管轄",topic:"論点",coi:"利益相反",primary:"一次情報",recompute:"再計算(SHA-256)",notverified_tag:"未収録（未検証）",notverified_note:"この出どころは当レジストリに未収録です。これは「信用できない」という意味ではありません。私たちがまだ検証していない、という意味です。内容の真偽は判定しません。",selfcheck_title:"自分で確かめる観点",selfcheck:["出しているのは誰ですか。公的機関・学会・医療機関ですか、それとも個人や販売者ですか。","根拠(出典)が公開されていて、あなた自身がたどれますか。","どの国・地域の基準の話ですか。「どこでも正しい」とは限りません。","その発信者は、紹介料やスポンサーなど、そう言うことで報酬を得ていませんか（利益相反の開示があるか）。"],alts_title:"この論点で検証済みの一次情報源",open:"開く",spot_title:"自分で見分ける4つの問い",spot_lead:"どんな情報でも、この4つを当てれば出どころの確からしさが見えます。",paidby:"発信者への支払い",ref:"紹介料",list:"掲載料",yes:"あり",no:"なし",none:"開示なし",foot:"本サービスは一般的な情報源の検証と提示のみを行い、診断・治療・特定商品の推奨は行いません。症状や治療の判断は医療機関にご相談ください。",registry_link:"検証済みの情報源",ai_link:"AIに繋ぐ",err:"通信に失敗しました。もう一度お試しください。",empty:"URLか発信元の名前を入れてください。"}
  };
  var lang="en", last=null;
  function t(k){ return (T[lang] && T[lang][k]!=null) ? T[lang][k] : k; }
  function esc(s){ return String(s==null?"":s).replace(/[&<>]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;"}[c];}); }
  function tier(x){ var o=TIER[x]; return o? o[lang] : x; }
  function comp(c){ if(!c) return t("none"); return t("paidby")+": "+esc(c.paid_by)+" / "+t("ref")+": "+(c.referral_fee?t("yes"):t("no"))+" / "+t("list")+": "+(c.listing_fee?t("yes"):t("no")); }
  function render(d){
    last=d; var out=document.getElementById("result");
    if(!d){ out.innerHTML=""; return; }
    if(d.verdict==="in_registry"){
      var h='<div class="card ok"><span class="chip ok">'+esc(t("verified_tag"))+'</span>';
      (d.trust_card||[]).forEach(function(x){
        h+='<div class="pub">'+esc(x.publisher)+'</div>';
        h+='<div class="kv"><span>'+esc(t("role"))+'</span>'+esc(tier(x.authority_tier))+'</div>';
        h+='<div class="kv"><span>'+esc(t("jurisdiction"))+'</span>'+esc(x.jurisdiction)+' · '+esc(t("topic"))+': '+esc(x.topic)+'</div>';
        h+='<div class="kv"><span>'+esc(t("coi"))+'</span>'+esc(comp(x.compensation))+'</div>';
        h+='<div class="kv"><span>'+esc(t("primary"))+'</span><a href="'+esc(x.evidence_url)+'" target="_blank" rel="noopener">'+esc(x.evidence_url)+'</a></div>';
        if(x.provenance_sha256){ h+='<div class="kv"><span>'+esc(t("recompute"))+'</span>'+esc(x.provenance_sha256).slice(0,24)+'…</div>'; }
      });
      h+='<p class="meaning">'+esc(t("verified_meaning"))+'</p></div>';
      out.innerHTML=h;
    } else if(d.verdict==="not_in_registry"){
      var n='<div class="card learn"><span class="chip learn">'+esc(t("notverified_tag"))+'</span>';
      n+='<p class="note">'+esc(t("notverified_note"))+'</p>';
      n+='<div class="sub">'+esc(t("selfcheck_title"))+'</div><ol class="checks">';
      (t("selfcheck")||[]).forEach(function(s){ n+='<li>'+esc(s)+'</li>'; });
      n+='</ol>';
      if((d.verified_alternatives||[]).length){
        n+='<div class="sub">'+esc(t("alts_title"))+'</div><ul class="alts">';
        d.verified_alternatives.forEach(function(a){ n+='<li><b>'+esc(a.publisher)+'</b> · '+esc(tier(a.authority_tier))+' · '+esc(a.jurisdiction)+' &nbsp;<a href="'+esc(a.evidence_url)+'" target="_blank" rel="noopener">'+esc(t("open"))+'</a></li>'; });
        n+='</ul>';
      }
      n+='</div>';
      out.innerHTML=n;
    } else { out.innerHTML=""; }
  }
  function setLang(l){
    lang=l; document.documentElement.lang=l;
    document.querySelectorAll("[data-i18n]").forEach(function(el){ el.textContent=t(el.getAttribute("data-i18n")); });
    document.getElementById("q").setAttribute("placeholder", t("inph"));
    document.getElementById("lang-en").className = (l==="en")?"on":"";
    document.getElementById("lang-ja").className = (l==="ja")?"on":"";
    var sl=document.getElementById("spot-list"); sl.innerHTML="";
    (t("selfcheck")||[]).forEach(function(s){ var li=document.createElement("li"); li.textContent=s; sl.appendChild(li); });
    if(last) render(last);
  }
  function run(){
    var q=document.getElementById("q"); var v=(q.value||"").trim(); if(!v) return;
    var out=document.getElementById("result"); var go=document.getElementById("go");
    go.disabled=true; out.innerHTML='<div class="card"><span class="soft">'+esc(t("checking"))+'</span></div>';
    var key=(v.indexOf("http")===0||v.indexOf(".")>-1)?"url":"publisher";
    fetch("/check-source?"+key+"="+encodeURIComponent(v)).then(function(r){return r.json();}).then(function(d){ render(d); }).catch(function(){ out.innerHTML='<div class="card learn">'+esc(t("err"))+'</div>'; }).then(function(){ go.disabled=false; });
  }
  document.getElementById("go").addEventListener("click", run);
  document.getElementById("q").addEventListener("keydown", function(e){ if(e.key==="Enter") run(); });
  document.getElementById("lang-en").addEventListener("click", function(){ setLang("en"); });
  document.getElementById("lang-ja").addEventListener("click", function(){ setLang("ja"); });
  setLang("en");
})();
</script>
</body></html>`;
}

// ---- verified バッジ(埋め込み用SVG) ----
// 認証するのは「収録・provenance/開示」であって医学的正しさではない(title/textで明示)。
function badgeSvg(row) {
  const W = 300, H = 50;
  const verified = !!row;
  const accent = verified ? "#7A3F63" : "#8A8177";
  const border = verified ? "#E3CBD9" : "#E3DBD3";
  const line1 = verified ? "Verified source" : "Not in registry";
  const line2 = verified ? "HORIZON SHIELD · provenance & disclosure" : "HORIZON SHIELD Femtech Registry";
  const tip = verified
    ? "Listed in the HORIZON SHIELD Femtech Registry: who published it and their compensation are disclosed and recomputable. Not a judgment of medical accuracy."
    : "This source is not in the HORIZON SHIELD Femtech Registry. This is not a judgment that it is untrustworthy.";
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + line1 + '">' +
    '<title>' + tip + '</title>' +
    '<rect x="0.5" y="0.5" width="' + (W-1) + '" height="' + (H-1) + '" rx="10" fill="#FFFFFF" stroke="' + border + '"/>' +
    '<g transform="translate(14,10)"><path d="M14 1 L26 6 V16 C26 24 21 29 14 31 C7 29 2 24 2 16 V6 Z" stroke="' + accent + '" stroke-width="1.7" fill="none"/><path d="M18 11 A7 7 0 1 0 18 23 A5.4 5.4 0 1 1 18 11 Z" fill="' + accent + '"/></g>' +
    '<text x="52" y="21" font-family="Georgia, serif" font-size="15" font-weight="700" fill="' + accent + '">' + line1 + '</text>' +
    '<text x="52" y="38" font-family="-apple-system, Segoe UI, sans-serif" font-size="10.5" fill="#8A7F86">' + line2 + '</text>' +
    '</svg>';
}
async function findSource(env, q) {
  const rows = await mergedRegistry(env);
  const eid = q.get("entry_id");
  if (eid) { const r = rows.find(x => x.entry_id === eid && x.status !== "retracted"); if (r) return r; }
  const bh = hostOf(q.get("url") || "");
  const bp = (q.get("publisher") || "").toLowerCase();
  if (!bh && !bp) return null;
  return rows.find(r => {
    if (r.status === "retracted") return false;
    const eh = hostOf(r.evidence_url);
    const hh = bh && eh && (eh === bh || eh.endsWith("." + bh) || bh.endsWith("." + eh));
    const ph = bp && r.publisher && (r.publisher.toLowerCase().includes(bp) || bp.includes(r.publisher.toLowerCase()));
    return hh || ph;
  }) || null;
}

// ---- 公開ページ: はじめてのフェム / Start Here (beginner guide, Plum, bilingual) ----
function startPage() {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>New to femtech? Start here | HORIZON SHIELD Femtech Registry</title>
<meta name="description" content="New to femtech? A calm, neutral starting point for women's health information. Learn the one habit that matters: check the source. No diagnosis, no product recommendations.">
<style>
  :root{--bg:#FBF5F1;--card:#FFFFFF;--ink:#2E2630;--soft:#8A7F86;--line:#ECE0E5;--plum:#7A3F63;--plumbg:#F3E7EE;--clay:#B76A4A;--shadow:0 6px 22px rgba(70,40,60,.08)}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,'Segoe UI','Hiragino Sans','Noto Sans CJK JP',sans-serif;line-height:1.8;-webkit-font-smoothing:antialiased}
  .wrap{max-width:720px;margin:0 auto;padding:28px 20px 90px}
  .top{display:flex;align-items:center;justify-content:space-between;margin-bottom:34px}
  .brand{display:flex;align-items:center;gap:10px}
  .brand .nm{font-size:12.5px;letter-spacing:1.5px;color:var(--soft);font-weight:700;text-transform:uppercase}
  .brand .nm b{color:var(--ink)}
  .lang{display:flex;gap:2px;background:#F1E7EB;border-radius:999px;padding:3px}
  .lang button{border:0;background:transparent;color:var(--soft);font-size:13px;font-weight:600;padding:6px 13px;border-radius:999px;cursor:pointer}
  .lang button.on{background:#fff;color:var(--ink);box-shadow:0 1px 3px rgba(0,0,0,.08)}
  h1{font-family:Georgia,'Times New Roman','Noto Serif CJK JP',serif;font-size:34px;line-height:1.24;margin:0 0 14px;font-weight:700;letter-spacing:-.2px}
  .lead{color:#5f545c;font-size:17px;margin:0 0 30px}
  h2{font-family:Georgia,'Noto Serif CJK JP',serif;font-size:23px;margin:38px 0 10px}
  p{color:#4c434a;font-size:16px;margin:0 0 14px}
  .checks{counter-reset:s;padding:0;margin:14px 0 0;list-style:none}
  .checks li{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 15px;margin:8px 0;color:#4c434a}
  .checks li::before{counter-increment:s;content:counter(s);color:var(--plum);font-weight:800;margin-right:10px}
  .cta{display:inline-block;margin-top:16px;background:var(--plum);color:#fff;font-weight:700;font-size:16px;padding:13px 24px;border-radius:12px;text-decoration:none}
  .topic{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px 20px;margin:12px 0;box-shadow:var(--shadow)}
  .topic h3{margin:0 0 4px;font-size:17px;font-family:Georgia,'Noto Serif CJK JP',serif}
  .topic .src{margin:6px 0 0;padding:0;list-style:none}
  .topic .src li{margin:6px 0;font-size:14.5px;color:#4c434a}
  .topic .src a{color:var(--plum);text-decoration:none;font-weight:600}
  .topic .jz{color:var(--soft);font-size:12.5px;font-weight:600;margin-left:4px}
  .callout{background:var(--plumbg);border:1px solid #E3CBD9;border-radius:16px;padding:18px 20px;margin:16px 0}
  .callout p{margin:0;color:#5a4a54;font-size:15px}
  .foot{margin-top:46px;padding-top:18px;border-top:1px solid var(--line);color:var(--soft);font-size:13px}
  .foot a{color:var(--clay);text-decoration:underline;font-weight:600}
  svg.mk{width:26px;height:30px}
</style></head>
<body><div class="wrap">
  <div class="top">
    <div class="brand">
      <svg class="mk" viewBox="0 0 56 64" fill="none"><path d="M28 3 L51 12 V30 C51 46 41 56 28 61 C15 56 5 46 5 30 V12 Z" stroke="#7A3F63" stroke-width="2.5" fill="rgba(122,63,99,.07)"/><path d="M35 22 A13 13 0 1 0 35 44 A10 10 0 1 1 35 22 Z" fill="#7A3F63"/></svg>
      <div class="nm"><b>HORIZON SHIELD</b> <span data-i18n="brand_sub">Femtech Registry</span></div>
    </div>
    <div class="lang"><button id="lang-en" type="button">EN</button><button id="lang-ja" type="button">日本語</button></div>
  </div>

  <h1 data-i18n="h1">New to femtech? Start here.</h1>
  <p class="lead" data-i18n="lead">Femtech is technology and information for women's health, from periods and PMS to menopause. There is a lot of it, and AI recommends it now too. Here is how to find information you can trust, without taking anyone's word for it.</p>

  <h2 data-i18n="s1t">First, what is femtech?</h2>
  <p data-i18n="s1b">Femtech covers products and information for women's health: menstruation, PMS, menopause, fertility, and more. It is a fast growing field, which means solid primary sources and a lot of marketing sit side by side. Telling them apart is the whole game.</p>

  <h2 data-i18n="s2t">The one habit that matters: check the source</h2>
  <p data-i18n="s2b">You do not need to be an expert. Before you trust a piece of health information, look at where it comes from. These four questions do most of the work.</p>
  <ol class="checks" id="checks"></ol>
  <a class="cta" href="/checker" data-i18n="cta">Try the source checker</a>

  <h2 data-i18n="s3t">Trusted places to start</h2>
  <p data-i18n="s3b">These are public bodies and medical societies. They publish general information with their name on it. Always general information, never a diagnosis.</p>

  <div class="topic"><h3 data-i18n="t_mens">Menstruation</h3><ul class="src">
    <li><a href="https://www.jsog.or.jp/" target="_blank" rel="noopener">Japan Society of Obstetrics and Gynecology (JSOG)</a><span class="jz">JP</span></li>
    <li><a href="https://w-health.jp/" target="_blank" rel="noopener">MHLW Women's Health Care Lab</a><span class="jz">JP</span></li>
    <li><a href="https://womenshealth.gov/menstrual-cycle" target="_blank" rel="noopener">Office on Women's Health</a><span class="jz">US</span></li>
  </ul></div>
  <div class="topic"><h3 data-i18n="t_pms">PMS</h3><ul class="src">
    <li><a href="https://www.jmwh.jp/" target="_blank" rel="noopener">Japan Society for Menopause and Women's Health (JMWH)</a><span class="jz">JP</span></li>
    <li><a href="https://www.acog.org/" target="_blank" rel="noopener">American College of Obstetricians and Gynecologists (ACOG)</a><span class="jz">US</span></li>
    <li><a href="https://www.nhs.uk/conditions/pre-menstrual-syndrome/" target="_blank" rel="noopener">NHS</a><span class="jz">GB</span></li>
  </ul></div>
  <div class="topic"><h3 data-i18n="t_meno">Menopause</h3><ul class="src">
    <li><a href="https://www.jmwh.jp/" target="_blank" rel="noopener">Japan Society for Menopause and Women's Health (JMWH)</a><span class="jz">JP</span></li>
    <li><a href="https://www.menopause.org/" target="_blank" rel="noopener">The Menopause Society</a><span class="jz">US</span></li>
    <li><a href="https://www.nhs.uk/conditions/menopause/" target="_blank" rel="noopener">NHS</a><span class="jz">GB</span></li>
  </ul></div>

  <div class="callout"><p data-i18n="isnt">The HORIZON SHIELD Femtech Registry checks who is behind a source. It does not diagnose, does not recommend products, and does not take referral fees. For symptoms or treatment, please consult a healthcare professional.</p></div>

  <div class="foot">
    <a href="/checker" data-i18n="l_check">Source checker</a> &nbsp;·&nbsp; <a href="/registry" data-i18n="l_reg">Verified sources</a> &nbsp;·&nbsp; <a href="/llms.txt" data-i18n="l_ai">Connect your AI</a><br>
    The HORIZ音s株式会社 / Not medical advice.
  </div>
</div>
<script>
(function(){
  var T={
   en:{brand_sub:"Femtech Registry",h1:"New to femtech? Start here.",lead:"Femtech is technology and information for women's health, from periods and PMS to menopause. There is a lot of it, and AI recommends it now too. Here is how to find information you can trust, without taking anyone's word for it.",s1t:"First, what is femtech?",s1b:"Femtech covers products and information for women's health: menstruation, PMS, menopause, fertility, and more. It is a fast growing field, which means solid primary sources and a lot of marketing sit side by side. Telling them apart is the whole game.",s2t:"The one habit that matters: check the source",s2b:"You do not need to be an expert. Before you trust a piece of health information, look at where it comes from. These four questions do most of the work.",cta:"Try the source checker",s3t:"Trusted places to start",s3b:"These are public bodies and medical societies. They publish general information with their name on it. Always general information, never a diagnosis.",t_mens:"Menstruation",t_pms:"PMS",t_meno:"Menopause",isnt:"The HORIZON SHIELD Femtech Registry checks who is behind a source. It does not diagnose, does not recommend products, and does not take referral fees. For symptoms or treatment, please consult a healthcare professional.",l_check:"Source checker",l_reg:"Verified sources",l_ai:"Connect your AI",checks:["Who is publishing it? A public body, a medical society, a clinic, or an individual or seller?","Is the evidence (the source) public, and can you trace it yourself?","Which country or region's standard is this? Nothing is correct everywhere.","Does the publisher earn anything for saying it, through referrals or sponsors? Is any conflict of interest disclosed?"]},
   ja:{brand_sub:"フェム情報源レジストリ",h1:"はじめてのフェムテック。",lead:"フェムテックは、月経やPMSから更年期まで、女性の健康のための技術と情報のことです。情報はあふれていて、今はAIも勧めてきます。ここでは、誰かの言葉を鵜呑みにせずに、信頼できる情報を見つける方法をお伝えします。",s1t:"まず、フェムテックとは？",s1b:"フェムテックは、女性の健康のための製品と情報の総称です。月経・PMS・更年期・妊娠など。急成長の分野で、しっかりした一次情報と、たくさんの宣伝が隣り合っています。その見分けが肝心です。",s2t:"大事な習慣はひとつ：出どころを見る",s2b:"専門家である必要はありません。健康情報を信じる前に、その出どころを見る。この4つの問いで、ほとんど分かります。",cta:"出どころチェッカーを試す",s3t:"まず頼れる場所",s3b:"公的機関と学会です。名前を出して一般情報を発信しています。あくまで一般情報で、診断ではありません。",t_mens:"月経",t_pms:"PMS",t_meno:"更年期",isnt:"HORIZON SHIELD Femtech Registry は、情報源の「誰が言っているか」を確かめます。診断はせず、製品も勧めず、送客手数料も受け取りません。症状や治療の判断は、医療機関にご相談ください。",l_check:"出どころチェッカー",l_reg:"検証済みの情報源",l_ai:"AIに繋ぐ",checks:["出しているのは誰ですか。公的機関・学会・医療機関ですか、それとも個人や販売者ですか。","根拠(出典)が公開されていて、あなた自身がたどれますか。","どの国・地域の基準の話ですか。「どこでも正しい」とは限りません。","その発信者は、紹介料やスポンサーなど、そう言うことで報酬を得ていませんか（利益相反の開示があるか）。"]}
  };
  var lang="en";
  function t(k){ return (T[lang]&&T[lang][k]!=null)?T[lang][k]:k; }
  function setLang(l){
    lang=l; document.documentElement.lang=l;
    document.querySelectorAll("[data-i18n]").forEach(function(el){ el.textContent=t(el.getAttribute("data-i18n")); });
    document.getElementById("lang-en").className=(l==="en")?"on":"";
    document.getElementById("lang-ja").className=(l==="ja")?"on":"";
    var c=document.getElementById("checks"); c.innerHTML="";
    (t("checks")||[]).forEach(function(s){ var li=document.createElement("li"); li.textContent=s; c.appendChild(li); });
  }
  document.getElementById("lang-en").addEventListener("click", function(){ setLang("en"); });
  document.getElementById("lang-ja").addEventListener("click", function(){ setLang("ja"); });
  setLang("en");
})();
</script>
</body></html>`;
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
  return { server: "hs-femtech-mcp", version: VERSION, neutral: meetsCompensation, persistence: hasKV(env) ? "kv" : "none", compensation: AGENT_CARD.compensation, medical_authority_claimed: false, human_checker: "/checker", note: "中立の検証層。医療の権威を名乗らない。送客料・掲載料ゼロを宣言。" };
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
    if (url.pathname === "/checker") return new Response(checkerPage(), { headers: { "content-type": "text/html; charset=utf-8", "access-control-allow-origin": "*" } });
    if (url.pathname === "/start") return new Response(startPage(), { headers: { "content-type": "text/html; charset=utf-8", "access-control-allow-origin": "*" } });
    if (url.pathname === "/check-source" && request.method === "GET") return j(emit(await tool_check_source(Object.fromEntries(url.searchParams), env)));
    if (url.pathname === "/badge") return new Response(badgeSvg(await findSource(env, url.searchParams)), { headers: { "content-type": "image/svg+xml; charset=utf-8", "access-control-allow-origin": "*", "cache-control": "public, max-age=300" } });
    if (url.pathname === "/anchor/pending" && request.method === "GET") return j(await anchorPending(env));

    if (url.pathname === "/admin/reverify_seed") { if (!adminOk(env, url)) return j({ ok: false, error: "forbidden" }, 403); return j(await adminReverifySeed(env)); }
    if (url.pathname === "/admin/retract") { if (!adminOk(env, url)) return j({ ok: false, error: "forbidden" }, 403); return j(await adminRetract(env, url)); }

    if (request.method === "POST") {
      let msg; try { msg = await request.json(); } catch (e) { return j(rpcError(null, -32700, "parse error"), 400); }
      try { return j(await handleRpc(msg, env)); } catch (e) { return j(rpcError(msg && msg.id !== undefined ? msg.id : null, -32603, "internal: " + (e && e.message)), 500); }
    }

    return j({ server: "hs-femtech-mcp", version: VERSION, description: "中立のフェム情報源 検証レジストリ。診断・推奨・効能なし。 / Neutral femtech source-verification registry.", endpoints: ["POST / (MCP JSON-RPC)", "GET /health", "GET /self", "GET /llms.txt", "GET /.well-known/agent-card.json", "GET /registry", "GET /checker", "GET /start", "GET /check-source?url=...", "GET /badge?url=...", "GET /anchor/pending"], topics: ["menstruation", "pms", "menopause"], disclaimer: DISCLAIMER });
  }
};

export const _internals = { TOOLS, REGISTRY, TOPICS, PRODUCT_CATEGORIES, AGENT_CARD, DISCLAIMER, SELF_CHECK, runTool, handleRpc, structuralChecks, tool_register_source, tool_verify_source, tool_get_femtech_topic, tool_get_agent_card, tool_list_registry, tool_get_registry_entry, tool_explain_product_category, tool_how_to_verify, tool_check_source, checkerPage, startPage, badgeSvg, findSource, selfCheck, adminReverifySeed, adminRetract, anchorPending, mergedRegistry, mergedEntry, kvPutEntry, llmsTxt, provenanceOf };
