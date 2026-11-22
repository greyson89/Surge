# HANDOFF：Walkr 自動化

更新日期：2026-11-22

這份文件記錄 Walkr 腳本的分析經驗、目前完成的實驗室自動贊助，以及下一個任務「傳說自動繳納」的規劃。下一次接手時先看這份。

## 分析流程（這次確認有效的做法）

1. 使用者**關閉模組與腳本**後抓 HAR，取得 app 原始的請求與回應。
2. 列出 HAR 裡 `production.sw.fourdesire.com/api/v2/` 的請求順序，對照使用者實際的操作步驟。
3. 確認腳本的 `pattern` 真的比對得到請求。這次 EPIC 獎勵沒生效，原因就是 API 換了，規則根本沒觸發。
4. 從回應 JSON 找出請求參數的來源，不要只看請求 body 就下結論。
5. 用 HAR 的實際資料，在 node 裡 mock `$persistentStore`、`$httpClient`、`$notification` 和 `$done` 來模擬腳本。正常、失敗、資料缺少的情況都要測。
6. 抓 HAR 時要留意 `304`：回應會沒有 body。需要內容時，用舊的 HAR 或請使用者重新抓。

## 已確認的機制

| 項目 | 說明 |
|---|---|
| 認證 | 只靠 `authorization: Bearer <JWT>`（RS256），有效期約 3 個月，沒有時間戳、nonce 或 HMAC 簽章 |
| POST body | 只有裝置資訊（`client_version`、`device_model`、`os_version`、`locale`、`country_code`、`platform`、`timezone`），GET 則放在 query |
| 帳號 id | JWT 的 `id` 是 core 帳號 id，不等於 Walkr 玩家 id；core id 會出現在 avatar 路徑 `/users/{coreId}/`，可以用來對應玩家 id |
| 資源同步 | 能量、coins、方塊等由 **app 本機計算**，再透過 `POST /warehouse/u/player` 送上**絕對值**。伺服器 API 的回應（例如 `reward_amount`）要等 app 套用後才會生效 |
| 改回應是否有效 | app 會採用回應中 `fetchable_contents` 陣列的值（共駕能量、EPIC 獎勵）。不要因為 claim 請求只帶 id，就斷定是伺服器決定數值 |
| 快取 | app 會帶 `If-None-Match`；`$httpClient` 不會帶，所以會拿到 200 和完整內容 |
| 規則衝突 | 新增 http-request 腳本時，pattern 不要跟既有的 request 腳本重疊（`pilots`、`pilots/convert`、`warehouse/u/activity`） |

## 實驗室自動贊助（已完成，commit f01aca5）

- `scripts/walkr-lab-capture.js`（http-request，比對 `labs/current` 和 `comments?`）：存下 `WalkrToken`、`WalkrUserAgent`、`WalkrLabCurrentUrl`、`WalkrLabCommentsUrl`，只在值變動時寫入。
- `scripts/walkr-lab-auto-donate.js`（cron `*/30 * * * *`）：
  1. `GET labs/current`：取得 lab id，並用 avatar 對應出自己的玩家 id，存成 `WalkrPlayerId`，格式是 `coreId:playerId`。
  2. `GET comments?commentable_type=lab`：留言中 `comment.type == "donation"` 的就是贊助需求。
  3. `POST labs/{labId}/donate`，body 欄位對應如下：

| body 欄位 | 來源 |
|---|---|
| `requirement_id` | 留言 `id` |
| `identifier` | `comment.identifier`（星球） |
| `timestamp` | `comment.last_requested_at`（這一輪需求的發起時間，不是當下時間） |
| `donation` | `min(自己本輪剩餘額度, 對方差額向上取整)`；連點 N 次會合成一個請求，`N × donation_value` |
| `donation_type` | `comment.donation_type` |

- `donated_counter` 的格式是 `玩家id|500+500,玩家id|2000`，每人每輪最多 `max_donation_count`（5）次。
- 成功或 4xx 的需求，會以 `requirement_id:last_requested_at` 為 key 記在 `WalkrDonateHandledRounds`（最多 100 筆），同一輪不再重送。
- 完成後的通知標題是 `🚀 Walkr Auto Donate`，副標題是總計，內文每人一行（✅ / ❌）。
- 已知限制：自動贊助不會扣自己的能量，也拿不到 coins 獎勵（使用者可以接受）；comments 一次只取 30 則。
- **尚未在手機上實測。**

## 下一個任務：傳說（Epic）自動繳納

### 需求（使用者描述）

- 傳說是大家一起參與的多階段任務：繳納資源 → 等待飛船時間 → 進入下一階段……全部完成後才領取所有獎勵。
- 每個階段內又分兩步：**先繳納資源**（食物、coins、星球生產的資源），**再繳納能量**。
- 痛點：任務很長，常常忘記繳納，任務就卡在那個階段浪費時間。
- 目標：仿照實驗室自動贊助，用 cron 定期檢查，該繳的時候自動繳納。

### 目前已知（來自既有 HAR，尚未針對繳納分析）

- `GET /api/v2/fleets/current`：目前參與的艦隊與傳說。沒有參與時回傳 `{"fleet": null}`。主要欄位：
  - `fleet`：`id`、`energy`、`consumed_energy`、`contribution_amount`、`value_a/b/c`、`event_status`、`epic{id,name}`
  - `event`：目前階段，含 `identifier`、`event_type`、`resource_a/b/c`、`label_a/b/c`
  - `path`：`time`（飛行時間）、`required_energy`
  - `members[]`：`id`、`avatar`、`contribution`、`role`；可以用 avatar 對應出自己
  - `hitpoints`：`value_a/b/c`、`next_hitpoint_at`
- `GET /api/v2/epics`：傳說列表；`GET /api/v2/fleets/history`：歷史紀錄。
- `POST /api/v2/fleets/{id}/finish`：完成時領取獎勵，已有 `walkr-change-epic-reward.js` 在處理。
- 艦隊留言：`GET /comments?commentable_type=fleet&commentable_id={fleetId}`。
- 推測（未驗證）：`resource_a/b/c` 和 `value_a/b/c` 應該是階段需求與目前進度；繳納資源時 app 可能也會用 `warehouse/u/player` 同步扣除。

### 需要使用者抓的 HAR

請在**關閉 Walkr 模組**的狀態下抓，每種情況最好各一份：

1. 進入傳說畫面，查看目前階段（取得 `fleets/current` 的完整內容，避免拿到 304）。
2. 繳納第一步的資源，每一種資源各一次：食物、coins、星球生產的資源（每種格式可能不同）。
3. 繳納第二步的能量。
4. 如果可以，也抓「階段完成、等待飛船中」和「下一階段開始」時的 `fleets/current`。

### 分析時要確認的問題

- 繳納 API 的端點與 body，以及資源種類怎麼表示（key、identifier，或 a/b/c）。
- 單次繳納量有沒有上限；`fleets/current` 中哪個欄位代表「還差多少」。
- 怎麼判斷目前在「資源」還是「能量」步驟，以及什麼時候在「等待飛船」（不應該繳納）。
- 繳納資源後 app 是否用 `warehouse/u/player` 扣除。如果是，自動繳納不會扣到本機資源，要評估這樣是否可以接受。
- 自己的資源不足時，伺服器會不會拒絕。
- 是否有角色限制（例如只有隊長能推進階段）。

### 實作方向（等 HAR 分析後再確認）

- 沿用 `WalkrToken`，可能需要讓 capture 腳本也擷取 `fleets/current` 的網址，新增時注意不要跟既有的 pattern 重疊。
- 新增 cron 腳本：讀取 `fleets/current` → 判斷階段與步驟 → 繳納 → 發通知（格式比照 Auto Donate），同一階段要防止重送。
