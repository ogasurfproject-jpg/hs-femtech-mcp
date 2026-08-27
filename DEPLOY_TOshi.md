# hs-femtech-mcp  デプロイ手順(TOshi 手動)  v0.3 (P1)

番人は設計・実装・検証まで。deploy / secret / KV作成 / production-curl は TOshi の手。

## 0. v0.3 で足したもの

- P1 記憶: KV永続化。register 結果を pending -> verified で保存(段階導入=KV未接続なら P0挙動で揮発)
- retracted(証拠付き撤回) / provenance_sha256保存 / anchor pending の露出
- 論点2本目=更年期(menopause)。seed 情報源 6 -> 11、topic 3 -> 5
- 発見配線: /llms.txt、server.json(レジストリ提出用)、agent-card に discovery

## 1. 手元検証(番人実施済み。再現可)

```
cd ~/Desktop/horizon-shield/workers/hs-femtech-mcp
node --check src/worker.js
node test/harness.mjs      # 21 green / 0 red
```

## 2. まず素で再デプロイ(KV無し=検証プレビューのまま。壊れない)

```
npx wrangler whoami        # c15ff64a を確認
npx wrangler deploy
BASE="https://hs-femtech-mcp.oga-surf-project.workers.dev"
curl -s "$BASE/self" | python3 -m json.tool          # persistence:"none" のはず
curl -s "$BASE/llms.txt"                              # 発見用テキスト
curl -s "$BASE/registry?topic=menopause" | python3 -m json.tool   # 更年期5本
```

## 3. P1 記憶をONにする(KV)

```
# 3-1 名前空間を作る
npx wrangler kv namespace create FEMTECH_KV
# → 出た id を wrangler.jsonc の kv_namespaces ブロックに貼り、コメントを外す

# 3-2 管理鍵を入れる(値は控えて iCloud メモへ。番人は持たない)
printf '%s' "$(openssl rand -hex 24)" | npx wrangler secret put FEMTECH_ADMIN

# 3-3 再デプロイ
npx wrangler deploy
curl -s "$BASE/self" | python3 -m json.tool          # persistence:"kv" に変わる

# 3-4 seed 11本を verified で保存(到達性を実fetchで確認して保存)
curl -s "$BASE/admin/reverify_seed?key=<FEMTECH_ADMINの値>" | python3 -m json.tool
# → verified: 11 が返れば、レジストリが揮発から台帳になった

# 3-5 確認: 保存後は status が verified で残る
curl -s "$BASE/registry?status=verified" | python3 -m json.tool
```

## 4. 撤回(証拠付き。虚偽・リンク切れの情報源を落とす)

```
curl -s "$BASE/admin/retract?key=<FEMTECH_ADMIN>&entry_id=<id>&reason=<理由>&evidence=<証拠URL>" | python3 -m json.tool
# reason と evidence の両方が無いと拒否(証拠なき撤回はしない)
```

## 5. アンカー待ち(Bitcoin/JIDEC は外部工程)

```
curl -s "$BASE/anchor/pending" | python3 -m json.tool
# 出た provenance_sha256 を OpenTimestamps/JIDEC で錨。錨後 anchored:true を保存するのは P1.5
```

## 6. 発見配線(AIに引かせる)

- `/llms.txt` が本番で出ることを確認(フロントLLM向けの中立宣言＋エンドポイント＋論点)。
- `server.json` を MCPレジストリに提出(hs-mcp と同じ要領。現行スキーマに合わせて微調整、ツール名は tools/list の8本と一致)。
- shield サイトの llms.txt / sitemap から この worker の /llms.txt と agent-card にリンクを張ると発見されやすい(任意)。

## 番人メモ / 未実装(意図的)

- 公開 register_source の永続化は既定オフ(FEMTECH_PUBLIC_WRITE=1 で許可)。まず admin の reverify_seed で運営が入れる運用を推奨。
- anchored:true の保存(錨結果の書き戻し)= P1.5。
- 多言語の面展開・公開ページ・GEO本格化 = P2。
- 有料コンプラ検証レール = P3(別worker、中立の口と混ぜない)。
- 一線はコードで担保: 全レスポンス disclaimer(fail-closed)、診断/効能/推奨/送客のツールは構造的に不在、jurisdiction必須、compensation開示、SHA-256で第三者再計算可能。
