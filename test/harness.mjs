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

// 18 check_source: 収録済みドメインは in_registry + trust_card + scope限定
const cs1 = await W.tool_check_source({ url: "https://www.nhs.uk/conditions/menopause/" }, {});
ok("check_source: 収録ドメインは in_registry(trust_card付き)", cs1.verdict === "in_registry" && Array.isArray(cs1.trust_card) && cs1.trust_card.length >= 1 && cs1.scope === "provenance_and_disclosure_only");

// 19 未収録は not_in_registry(中立注記+自己診断+代替源)。否定判定をしない
const cs2 = await W.tool_check_source({ url: "https://random-influencer.example/post", topic: "pms" }, {});
ok("check_source: 未収録は中立(neutral_note+self_check+代替源)", cs2.verdict === "not_in_registry" && !!cs2.neutral_note && cs2.self_check.length >= 3 && cs2.verified_alternatives.length >= 1);

// 20 入力なしは no_input
const cs3 = await W.tool_check_source({}, {});
ok("check_source: 入力なしは no_input", cs3.verdict === "no_input");

// 21 掟: 真偽・効能・製品評価のキーを一切返さない
const csAll = JSON.stringify([cs1, cs2, cs3]).toLowerCase();
ok("check_source: 真偽/効能/推奨/安全の判定を返さない", !/(is_true|efficacy|effective|"works"|trustworthy|recommend|scam|"safe"|unsafe)/.test(csAll));

// 22 症状入力は無視(個人健康データを持たない)
const cs4 = await W.tool_check_source({ symptom: "痛い", url: "https://random.example/x" }, {});
ok("check_source: 未知の症状フィールドは無視(健康データ非保持)", !JSON.stringify(cs4).includes("痛い"));

// 23 発見配線: checker が self/agent-card/llms に露出
ok("discovery: self.human_checker=/checker", (await W.selfCheck({})).human_checker === "/checker");
ok("discovery: agent_card.discovery.source_checker=/checker", W.tool_get_agent_card().discovery.source_checker === "/checker");
ok("discovery: llms.txt に /checker", /\/checker/.test(W.llmsTxt()));

// 24 公開ページ: 二言語HTML・中立コピー(両言語)・症状は入力させない
const page = W.checkerPage();
ok("checkerPage: 二言語HTML+中立コピー+症状は入力させない", /<!doctype html>/i.test(page) && /未収録/.test(page) && /Not yet verified/.test(page) && /真偽も裁きません/.test(page) && /never rule on whether a claim is true/i.test(page) && /症状は入力しないでください/.test(page));

// 25 tools/list に check_source(read-only)
const tl2 = await W.handleRpc({ jsonrpc: "2.0", id: 2, method: "tools/list" }, {});
const cst = tl2.result.tools.find(t => t.name === "check_source");
ok("tools/list に check_source(readOnlyHint)", !!cst && cst.annotations.readOnlyHint === true);

// 26 verified バッジ: 収録=Verified source / 未収録=Not in registry / 医学的正しさは主張しない
const bIn = W.badgeSvg(W.REGISTRY[3]);
const bOut = W.badgeSvg(null);
ok("badge: 収録=Verified/未収録=Not in registry/真偽非主張", /Verified source/.test(bIn) && /Not in registry/.test(bOut) && !/accurate|correct|"true"|recommend/i.test(bIn) && /Not a judgment of medical accuracy/.test(bIn) && /<svg/.test(bIn));
const fs1 = await W.findSource({}, new URL("https://h/badge?url=https://www.acog.org/").searchParams);
ok("badge findSource: 収録ドメインを引ける", !!fs1 && /ACOG/.test(fs1.publisher));

// 27 初心者ガイド(startPage): 二言語HTML・診断しない明記・checker導線
const sp = W.startPage();
ok("startPage: 二言語+診断否定+checker導線", /<!doctype html>/i.test(sp) && /New to femtech/.test(sp) && /はじめてのフェムテック/.test(sp) && /does not diagnose/.test(sp) && /診断はせず/.test(sp) && /href="\/checker"/.test(sp));

// 28 JSON-RPC 通知(id 無し)には応答しない: HTTP は 202 本文なし、stdio は stdout に何も出さない(2026-09-07 Glama 実行ログの不具合)
ok("isRpcNotification: method あり id 無しだけが通知", W.isRpcNotification({ jsonrpc: "2.0", method: "notifications/initialized" }) && !W.isRpcNotification({ jsonrpc: "2.0", id: 1, method: "ping" }) && !W.isRpcNotification({ jsonrpc: "2.0", id: null, method: "ping" }) && !W.isRpcNotification([{ method: "x" }]));
const notifReq = new Request("http://localhost/", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) });
const notifRes = await mod.default.fetch(notifReq, {}, { waitUntil() {} });
ok("HTTP: notifications/initialized は 202 本文なし", notifRes.status === 202 && (await notifRes.text()) === "");
const pingRes = await mod.default.fetch(new Request("http://localhost/", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 7, method: "ping" }) }), {}, { waitUntil() {} });
ok("HTTP: id 付き ping は今までどおり 200 result", pingRes.status === 200 && (await pingRes.json()).id === 7);

// 29 stdio アダプタ往復: initialize → notifications/initialized → tools/list で、stdout は 2 行(通知に応答しない)
{
  const { spawn } = await import("node:child_process");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const here = path.dirname(fileURLToPath(import.meta.url));
  const child = spawn(process.execPath, [path.join(here, "..", "stdio.js")], { stdio: ["pipe", "pipe", "pipe"] });
  let out = "";
  child.stdout.on("data", (d) => { out += d.toString(); });
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "harness", version: "0" } } }) + "\n");
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }) + "\n");
  child.stdin.end();
  await new Promise((r) => child.on("close", r));
  const lines = out.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  ok("stdio: 3 メッセージ入力で応答は 2 行(通知に応答なし)", lines.length === 2);
  ok("stdio: initialize の応答に serverInfo", lines[0] && lines[0].id === 1 && lines[0].result && lines[0].result.serverInfo && lines[0].result.serverInfo.name === "hs-femtech-mcp");
  ok("stdio: tools/list が 9 本", lines[1] && lines[1].id === 2 && lines[1].result && Array.isArray(lines[1].result.tools) && lines[1].result.tools.length === 9);
  ok("stdio: id:null のエラー応答が無い", !lines.some((l) => l.id === null && l.error));
}

// 30 GET / の頁(2026-11-07): Accept が text/html を好む時だけ HTML(title あり)、ほかは今までの JSON の byte のまま。
// 基準の byte は /?format=json(2026-11-19 までは名の無い path の JSON を基準にしていた。名の無い path は 404 になった)。
// 2026-11-13: Accept が text/html も JSON の型も text/event-stream も挙げていない要求は、browser か crawler の
// User-Agent で、script の fetch でない時にも頁。どちらにも Vary: Accept, User-Agent, Sec-Fetch-Mode。
{
  const VARY = "Accept, User-Agent, Sec-Fetch-Mode";
  const get = async (path, accept, method = "GET", more = {}) => {
    const r = await mod.default.fetch(new Request("http://localhost" + path, { method, headers: accept === undefined ? { ...more } : { accept, ...more } }), {}, { waitUntil() {} });
    return { s: r.status, ct: r.headers.get("content-type") || "", vary: r.headers.get("vary"), body: await r.text() };
  };
  const ref = await get("/?format=json");
  const BROWSER = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8";
  const jsonCases = [undefined, "", "*/*", "application/json", "application/json, text/html", "application/json;q=0.5, text/html", "text/html;q=0.5, application/json", "text/html;q=0, */*", "text/html;q=abc", "text/*", "application/json, text/event-stream, */*"];
  let same = 0;
  for (const a of jsonCases) { const r = await get("/", a); if (r.s === 200 && r.ct === ref.ct && r.body === ref.body && r.vary === VARY) same++; }
  ok("GET /: Accept 無し、*/*、application/json が先などの " + jsonCases.length + " 通りは今までの JSON と byte まで同じ、Vary は 3 つ", same === jsonCases.length && ref.ct.startsWith("application/json") && ref.vary === VARY);
  const fj = await get("/?format=json", BROWSER);
  ok("GET /?format=json: browser の Accept でも JSON の byte のまま", fj.body === ref.body && fj.ct === ref.ct && fj.vary === VARY);
  const htmlCases = [BROWSER, "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "text/html", "text/html, application/json", "TEXT/HTML;charset=utf-8, application/json;q=0.9", "application/json;q=0, text/html"];
  let pages = 0;
  for (const a of htmlCases) { const r = await get("/", a); if (r.s === 200 && r.ct === "text/html; charset=utf-8" && /<title>[^<]{10,}<\/title>/.test(r.body) && r.vary === VARY) pages++; }
  ok("GET /: browser と Bingbot の Accept、text/html が先などの " + htmlCases.length + " 通りは 200 text/html で title あり、Vary は 3 つ", pages === htmlCases.length);
  const pg = (await get("/", BROWSER)).body;
  const esc = (x) => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  ok("GET / の頁: JSON そのものを載せ、JSON への link があり、noindex は無い", pg.includes("<pre>" + esc(ref.body) + "</pre>") && pg.includes('href="/?format=json"') && !/noindex/i.test(pg));
  const hd = await get("/", BROWSER, "HEAD");
  ok("HEAD /: browser の Accept で 200 text/html、本文なし", hd.s === 200 && hd.ct.startsWith("text/html") && hd.body === "");
  const other = await get("/no-such-path", BROWSER);
  ok("名の無い path は browser の Accept でも JSON のまま(頁にするのは / だけ)", other.ct.startsWith("application/json") && other.vary === null);

  // 2026-11-13: text/html を頼まない browser と crawler にも頁。
  const BING = "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36";
  const CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  const crawlers = [BING, "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)", "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", "DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0 Safari/537.36 BingPreview/1.0b", CHROME, "MOZILLA/5.0 (compatible; SomeCrawler/1.0)"];
  const open = [undefined, "", "*/*", "text/*", "image/*, */*;q=0.5"];
  let bp = 0;
  for (const ua of crawlers) for (const a of open) { const r = await get("/", a, "GET", { "user-agent": ua }); if (r.s === 200 && r.ct === "text/html; charset=utf-8" && /<title>[^<]{10,}<\/title>/.test(r.body) && r.vary === VARY) bp++; }
  ok("GET /: browser か crawler の User-Agent で、Accept 無し、空、*/*、text/*、image/* の 35 通りは頁(title あり)", bp === 35);
  const machines = [undefined, "", "curl/8.7.1", "python-requests/2.32.3", "Python-urllib/3.13", "node", "undici", "Go-http-client/2.0", "axios/1.7.7", "nenrin-verify/0.6.0", "okhttp/4.12.0", "Wget/1.21.4", "glama-inspector/1", "mcp-client/1.0", "Mozilla/5.0 (Macintosh; Darwin 25.3.0; en-US) PowerShell/7.4.6", "Boto3/1.35.10 md/Botocore#1.35.10 ua/2.0 os/macos#25.3.0 lang/python#3.12.7", "Mozilla/5.0+(compatible; UptimeRobot/2.0; http://www.uptimerobot.com/)", "python-requests/2.32.3 robotics-lab"];
  let mj = 0;
  for (const ua of machines) for (const a of open) { const r = await get("/", a, "GET", ua === undefined ? {} : { "user-agent": ua }); if (r.s === 200 && r.ct === ref.ct && r.body === ref.body && r.vary === VARY) mj++; }
  ok("GET /: program の User-Agent(curl、Python、Node、Go、MCP の client)か無しの 90 通り(PowerShell、Boto3、UptimeRobot、robotics を含む)は今までの JSON と byte まで同じ", mj === 90);
  const named = ["application/json", "application/json, text/event-stream, */*", "text/event-stream", "application/ld+json, */*", "APPLICATION/JSON;q=0.1, */*", "application/json, text/html", "text/html;q=0, */*", "text/html;q=abc", "text/html;q=0.5, application/json"];
  let nj = 0;
  for (const a of named) for (const ua of [BING, CHROME]) { const r = await get("/", a, "GET", { "user-agent": ua }); if (r.s === 200 && r.ct === ref.ct && r.body === ref.body && r.vary === VARY) nj++; }
  ok("GET /: bingbot や browser でも、JSON か event-stream を挙げた要求、text/html が今まで勝たなかった要求の 18 通りは JSON のまま", nj === 18);
  let sc = 0;
  for (const mode of ["cors", "same-origin", "no-cors", "websocket", "CORS"]) for (const a of [undefined, "*/*"]) { const r = await get("/", a, "GET", { "user-agent": CHROME, "sec-fetch-mode": mode }); if (r.s === 200 && r.ct === ref.ct && r.body === ref.body && r.vary === VARY) sc++; }
  ok("GET /: browser の中の script の fetch(Sec-Fetch-Mode が cors、same-origin、no-cors、websocket)の 10 通りは JSON のまま", sc === 10);
  let nv = 0;
  for (const mode of ["navigate", "NAVIGATE", " navigate "]) { const r = await get("/", "*/*", "GET", { "user-agent": CHROME, "sec-fetch-mode": mode }); if (r.ct === "text/html; charset=utf-8" && r.vary === VARY) nv++; }
  const ch = await get("/", BROWSER, "GET", { "user-agent": CHROME, "sec-fetch-mode": "cors" });
  ok("GET /: Sec-Fetch-Mode が navigate なら */* でも頁。text/html を好む Accept は cors でも頁(11-07 の決まりは狭めない)", nv === 3 && ch.ct === "text/html; charset=utf-8");
  const fjb = await get("/?format=json", "*/*", "GET", { "user-agent": BING });
  const hdb = await get("/", "*/*", "HEAD", { "user-agent": BING });
  const otb = await get("/no-such-path", "*/*", "GET", { "user-agent": BING });
  const pgb = (await get("/", "*/*", "GET", { "user-agent": BING })).body;
  ok("bingbot の */*: ?format=json は JSON、HEAD は text/html で本文なし、名の無い path は触らない、頁は browser の頁と byte まで同じ", fjb.body === ref.body && fjb.ct === ref.ct && hdb.s === 200 && hdb.ct.startsWith("text/html") && hdb.body === "" && otb.ct.startsWith("application/json") && otb.vary === null && pgb === pg);
  const desc = (/<meta name="description" content="([^"]*)">/.exec(pg) || [])[1] || "";
  ok("GET / の頁: meta description は 25〜160 字、h1 は 1 つ、lang あり", desc.length >= 25 && desc.length <= 160 && (pg.match(/<h1>/g) || []).length === 1 && /<html lang="[a-z]{2}">/.test(pg));
  // 2026-11-13: Bing は 70 字より長い title を Title too long と数える。
  const ttl = (/<title>([^<]*)<\/title>/.exec(pg) || [])[1] || "";
  ok("GET / の頁: title は 10〜69 字(Bing の Title too long は 70 字より長い title)、hs-femtech-mcp: で始まる", [...ttl].length >= 10 && [...ttl].length <= 69 && ttl.startsWith("hs-femtech-mcp: "));
}

// 31 bot の GET /、robots.txt と sitemap.xml、名の無い GET と HEAD の path は 404(2026-11-19)
{
  const VARY = "Accept, User-Agent, Sec-Fetch-Mode";
  const req = (path, { method = "GET", accept, ua, body, host = "https://femtech.horizonshield.dev" } = {}) => {
    const h = {}; if (accept !== undefined) h.accept = accept; if (ua !== undefined) h["user-agent"] = ua; if (body !== undefined) h["content-type"] = "application/json";
    return mod.default.fetch(new Request(host + path, { method, headers: h, body }), {}, { waitUntil() {} });
  };
  const get = async (path, o) => { const r = await req(path, o); return { s: r.status, ct: r.headers.get("content-type") || "", vary: r.headers.get("vary"), body: await r.text() }; };
  const ref = await get("/?format=json");
  const BROWSER = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8";
  const pg = (await get("/", { accept: BROWSER })).body;
  const bots = ["Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36", "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)", "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.204 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", "Googlebot/2.1 (+http://www.google.com/bot.html)"];
  let bp = 0, bj = 0;
  for (const ua of bots) {
    for (const a of [undefined, "*/*", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"]) {
      const r = await get("/", { accept: a, ua });
      const d = (/<meta name="description" content="([^"]*)">/.exec(r.body) || [])[1] || "";
      if (r.s === 200 && r.ct === "text/html; charset=utf-8" && r.body === pg && r.vary === VARY && /<title>[^<]{10,69}<\/title>/.test(r.body) && d.length >= 25 && /<html lang="[a-z]{2}">/.test(r.body) && (r.body.match(/<h1>/g) || []).length === 1) bp++;
    }
    for (const a of ["application/json", "application/json, text/event-stream, */*"]) { const r = await get("/", { accept: a, ua }); if (r.s === 200 && r.ct === ref.ct && r.body === ref.body && r.vary === VARY) bj++; }
  }
  ok("GET /: bingbot と Googlebot の 5 つの名乗りで Accept 無し、*/*、browser の形の 15 通りは browser と byte まで同じ頁(title、description、lang、h1 1 つ)", bp === 15);
  ok("GET /: bingbot と Googlebot が application/json を挙げた 10 通りは今までどおり JSON", bj === 10);
  let pj = 0;
  for (const ua of [undefined, "curl/8.7.1", "Python-urllib/3.13", "python-requests/2.32.3", "node", "undici", "mcp-client/1.0", "glama-inspector/1"]) for (const a of [undefined, "*/*", "application/json", "application/json, text/event-stream, */*"]) { const r = await get("/", { accept: a, ua }); if (r.s === 200 && r.ct === ref.ct && r.body === ref.body && r.vary === VARY) pj++; }
  ok("GET /: curl、Python(urllib と requests)、Node、MCP の client の 32 通りは今までの JSON と byte まで同じ", pj === 32);

  const sm = await get("/sitemap.xml");
  ok("GET /sitemap.xml: 200 application/xml の urlset(sitemaps.org 0.9)、root の 1 URL、lastmod 無し", sm.s === 200 && sm.ct === "application/xml; charset=utf-8" && sm.body === '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>https://femtech.horizonshield.dev/</loc></url>\n</urlset>\n');
  const rb = await get("/robots.txt");
  ok("GET /robots.txt: text/plain で User-agent: *、Allow: /、Sitemap の行が 1 つ(sitemap.xml)", rb.s === 200 && rb.ct === "text/plain; charset=utf-8" && rb.body === "User-agent: *\nAllow: /\n\nSitemap: https://femtech.horizonshield.dev/sitemap.xml\n");

  // 名の無い GET と HEAD の path は 404。本文は path によらず同じ bytes の {"error":"not found"}、HEAD は本文無し。
  const unknown = ["/no-such-path", "/favicon.ico", "/sse", "/health/", "/registry/x", "/mcp/x", "/x.txt", "/.well-known/no-such", "/robots.txt/x", "/" + "a".repeat(5000)];
  let u404 = 0, uh404 = 0;
  for (const pth of unknown) {
    const r = await get(pth); if (r.s === 404 && r.ct.startsWith("application/json") && r.body === '{"error":"not found"}') u404++;
    const h = await req(pth, { method: "HEAD" }); if (h.status === 404 && (await h.text()) === "") uh404++;
  }
  ok("名の無い path 10 通り(5,000 字の path を含む)の GET は 404 で本文はどれも同じ bytes の {\"error\":\"not found\"}、HEAD は 404 で本文無し", u404 === unknown.length && uh404 === unknown.length);
  let nh = 0;
  for (const pth of ["/registry", "/check-source", "/anchor/pending", "/a2a", "/health", "/self", "/llms.txt", "/checker", "/start", "/badge"]) { const h = await req(pth, { method: "HEAD" }); if (h.status === 200) nh++; }
  let rh = 0;
  for (const a of [undefined, "*/*", "application/json", BROWSER]) { const h = await req("/", { method: "HEAD", accept: a }); const b = await h.text(); const wantHtml = a === BROWSER; if (h.status === 200 && b === (wantHtml ? "" : ref.body) && h.headers.get("vary") === VARY && (h.headers.get("content-type") || "").startsWith(wantHtml ? "text/html" : "application/json")) rh++; }
  ok("名を決めた path の HEAD 10 通りは今までどおり 200、/ の HEAD は Accept 4 通りとも今までどおり(200、Vary 3 つ、型は Accept の決まりどおり。頁は本文無し、JSON は GET と同じ本文を返す形のまま。本番の端は HEAD の本文を落とす)", nh === 10 && rh === 4);
  // / に Accept: text/event-stream だけの GET は今までどおり JSON の byte(MCP の Streamable HTTP の client が打つ形)。
  const es = await get("/", { accept: "text/event-stream" });
  ok("GET / に Accept: text/event-stream だけは今までの JSON と byte まで同じ、Vary も同じ", es.s === 200 && es.ct === ref.ct && es.body === ref.body && es.vary === VARY);
  // /mcp は一覧と記録に載る MCP の口。GET、HEAD、POST、OPTIONS とも今までどおり(GET は / の JSON の byte、Vary 無し)。
  let mg = 0;
  for (const a of [undefined, "application/json", "text/event-stream"]) { const r = await get("/mcp", { accept: a }); if (r.s === 200 && r.ct === ref.ct && r.body === ref.body && r.vary === null) mg++; }
  const mh = await req("/mcp", { method: "HEAD" }); const mo = await req("/mcp", { method: "OPTIONS" });
  const mp = await req("/mcp", { method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id: 9, method: "tools/list" }) }); const mpj = JSON.parse(await mp.text());
  ok("/mcp: GET(Accept 無し、application/json、text/event-stream)は / の JSON と byte まで同じ、HEAD は 200、POST の tools/list は 9 本、OPTIONS は 200", mg === 3 && mh.status === 200 && mp.status === 200 && mpj.result.tools.length === 9 && mo.status === 200);
  // code が名を決めて返している GET の path は今までどおり(名の無い path の 404 に落ちない)。
  const known = [["/", "application/json"], ["/?format=json", "application/json"], ["/health", "application/json"], ["/self", "application/json"], ["/llms.txt", "text/plain"], ["/.well-known/agent-card.json", "application/json"], ["/.well-known/jwks.json", "application/json"], ["/registry", "application/json"], ["/checker", "text/html"], ["/start", "text/html"], ["/check-source?url=https%3A%2F%2Fwww.jsog.or.jp%2F", "application/json"], ["/badge", "image/svg+xml"], ["/anchor/pending", "application/json"], ["/a2a", "application/json"], ["/robots.txt", "text/plain"], ["/sitemap.xml", "application/xml"]];
  let k200 = 0; const kbad = [];
  for (const [pth, ct] of known) { const r = await get(pth); if (r.s === 200 && r.ct.startsWith(ct)) k200++; else kbad.push(pth + " " + r.s); }
  const adm = [await get("/admin/reverify_seed"), await get("/admin/retract")];
  ok("名を決めた GET の path 16 通りは 200 で今の型、/admin の 2 つは今までどおり 403" + (kbad.length ? "(" + kbad.join(", ") + ")" : ""), k200 === known.length && adm.every((r) => r.s === 403));
  // MCP(POST / の JSON-RPC)、A2A、OPTIONS は替えない。
  const rpc = async (path, msg) => { const r = await req(path, { method: "POST", body: JSON.stringify(msg) }); return { s: r.status, body: await r.text() }; };
  const tl = await rpc("/", { jsonrpc: "2.0", id: 1, method: "tools/list" });
  const ini = await rpc("/", { jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "h", version: "0" } } });
  const nt = await rpc("/", { jsonrpc: "2.0", method: "notifications/initialized" });
  const other = await rpc("/no-such-path", { jsonrpc: "2.0", id: 3, method: "ping" });
  const a2a = await rpc("/a2a", { jsonrpc: "2.0", id: 4, method: "message/send", params: { message: { role: "user", parts: [{ kind: "text", text: "https://www.jsog.or.jp/" }], messageId: "m1" } } });
  const op = await req("/no-such-path", { method: "OPTIONS" });
  ok("POST / の tools/list(9 本)と initialize、通知の 202、名の無い path への POST の JSON-RPC、POST /a2a、OPTIONS は今までどおり",
    tl.s === 200 && JSON.parse(tl.body).result.tools.length === 9 && ini.s === 200 && JSON.parse(ini.body).result.serverInfo.name === "hs-femtech-mcp" && nt.s === 202 && other.s === 200 && JSON.parse(other.body).id === 3 && a2a.s === 200 && JSON.parse(a2a.body).id === 4 && op.status === 200);
}

console.log(`\n  ${pass} green / ${fail} red`);
if (fail > 0) process.exit(1);
