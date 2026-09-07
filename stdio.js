/**
 * stdio.js : hs-femtech-mcp を stdio の MCP サーバーとして起動するアダプタ。
 * 用途: Glama 等の検査コンテナの中で、サーバー本体(src/worker.js)をこのプロセス内で直接動かす。
 * 仕組み: stdin の JSON-RPC 行を HTTP リクエストに包んで本体の fetch ハンドラへ渡し、
 *         応答 JSON を 1 行 1 メッセージで stdout に書く。外部エンドポイントへの中継はしない。
 * KV バインドが無い環境では、本体の設計どおり(段階導入)永続化が切れて揮発動作になる。判定と tool 一覧は同じ。
 * 同じ形の物が horizon-shield の workers/hs-mcp/stdio.js にある(KIRA が Glama で採点された経路)。
 */
import worker from "./src/worker.js";
import { createInterface } from "node:readline";
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto;

// stdout は JSON-RPC 専用。console.log 系の出力は全て stderr へ逃がす。
const toErr = (...a) => process.stderr.write(a.map(String).join(" ") + "\n");
console.log = toErr;
console.info = toErr;
console.warn = toErr;

const env = {};   // FEMTECH_KV 無し = 揮発(P0)。FEMTECH_ADMIN 無し = admin 口は閉じたまま。
const ctx = { waitUntil() {} };

const rl = createInterface({ input: process.stdin, terminal: false });
let queue = Promise.resolve();

rl.on("line", (line) => {
  const text = line.trim();
  if (!text) return;
  queue = queue.then(async () => {
    let id = null;
    try { const p = JSON.parse(text); if (p && p.id !== undefined) id = p.id; } catch (_e) {}
    try {
      const req = new Request("http://localhost/", {
        method: "POST",
        headers: { "content-type": "application/json", "accept": "application/json" },
        body: text,
      });
      const res = await worker.fetch(req, env, ctx);
      const body = (await res.text()).trim();
      if (!body) return; // 通知(202)は応答なし
      const obj = JSON.parse(body); // 1 行化の保証(改行入り JSON 対策)
      process.stdout.write(JSON.stringify(obj) + "\n");
    } catch (e) {
      process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32603, message: String(e && e.message || e).slice(0, 200) } }) + "\n");
      console.error("[hs-femtech-mcp stdio] error:", String(e).slice(0, 300));
    }
  });
});

rl.on("close", () => { queue.then(() => process.exit(0)); });
