# HANDOFF：Walkr 自動化

更新日期：2026-11-24

這份文件記錄 Walkr 腳本的分析經驗、實驗室自動贊助與傳說自動繳納的實作狀態。下一次接手時先看這份。

## 分析流程（這次確認有效的做法）

1. 使用者**關閉模組與腳本**後抓 HAR，取得 app 原始的請求與回應。
2. 列出 HAR 裡 `production.sw.fourdesire.com/api/v2/` 的請求順序，對照使用者實際的操作步驟。
3. 確認腳本的 `pattern` 真的比對得到請求。這次 EPIC 獎勵沒生效，原因就是 API 換了，規則根本沒觸發。
4. 從回應 JSON 找出請求參數的來源，不要只看請求 body 就下結論。
5. 用 HAR 的實際資料，在 node 裡 mock `$persistentStore`、`$httpClient`、`$notification` 和 `$done` 來模擬腳本。正常、失敗、資料缺少的情況都要測。
6. 抓 HAR 時要留意 `304`：回應會沒有 body。需要內容時，用舊的 HAR 或請使用者重新抓。
7. HAR 的 entries **不一定照時間排序**（這次的傳說 HAR 是倒序），分析或取樣時要先依 `startedDateTime` 排序。
8. 收到 HAR 先比對檔案是否重複（`cmp`）。這次 `繳納三項資源然後繳納能量.har` 其實是實驗室的 HAR。
9. 遊戲名詞的意思以使用者的說明為準，不要自己從欄位名稱推測。例如 `virtual-*` 是星球收取的資源，不是「虛擬物品」。
10. `har-test/` 的 HAR 含有 `authorization` token，不能提交。
11. `modules/walkr.sgmodule` 是 CRLF 換行，用程式改寫後要確認換行沒有被改掉。
12. 管理介面可以在本機用 node 起一個 server：把 page、api、epic 腳本放進 vm 執行，再用瀏覽器預覽來驗證。

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

## 管理介面（2026-11-24，取代 Settings 腳本）

`https://walkr.mysurge.com/`，用頂部 tab 切換分頁，網址 hash（`#epic`、`#pilot`、`#account`、`#lab`、`#system`）會記住目前分頁。`scripts/walkr-settings.js` 已移到 `scripts/deprecated/`，也從模組移除。手機上原本用 Settings 寫入的值仍然留在 persistentStore，介面會直接讀出來。

| 分頁 | 內容與參數 |
|---|---|
| 🚀 傳說 | 繳納狀態（預覽、立即繳納）、自動繳納設定、單次測試；傳說獎勵 `WalkrEpicRewardType/Money/Cubes` |
| 👟 共駕步數 | `WalkrCovertBaseEnergy`、`WalkrEnergyPerStep`（顯示預估額外步數）；今日步數狀態（唯讀）；艦橋 `WalkrBridgeDisplayEnergy`（畫面顯示值，預設 160000）、`WalkrBridgeClaimEnergy`（實際領取值，預設 80000） |
| 💰 帳號資源 | `WalkrIsExecuteMoneyModify`、`WalkrMoney`、`WalkrIsExecuteCubeModify`、`WalkrCube`；危險區塊，開啟和儲存前都會確認 |
| 🧪 實驗室 | `WalkrLabAutoEnabled`（預設開啟）；顯示玩家 id、已處理輪次，可以清除 `WalkrDonateHandledRounds` |
| ⚙️ 系統 | token 是否擷取、到期時間（從 JWT 的 `exp` 解出）、帳號 id、App 版本、UA、網址擷取狀態 |

- 頁面的一般設定由 `FORMS` 描述欄位，`renderForm` 產生表單。toggle 點擊後立即寫入，其他欄位按「儲存」才寫入，並會驗證是否必填、整數、範圍。
- `walkr-config-api.js` 只允許白名單內的參數：`WRITABLE_KEYS` 可讀寫，`READONLY_KEYS` 只能讀，`RESETTABLE_KEYS` 只能清除。`/api/status` 回傳摘要，token 不會原樣回傳。新增參數時要同時改白名單。
- 防 CSRF：頁面所有請求都帶 `X-Walkr-Admin: 1`。API 的 write、reset 與 epic 的 http-request 路線沒有這個 header 就拒絕（跨域送出自訂 header 會觸發 preflight 而被擋）。
- 步數狀態的 `date` 是 app 上傳步數時的當地午夜 epoch 秒，不是今天的話，介面會標示「前次紀錄」。
- 今日步數狀態刻意不提供重置：步數是當天累計值，中途重置會讓上傳的步數變少。
- mock 測試包含 API 白名單、token 不外洩、艦橋預設值、實驗室開關，並用瀏覽器在手機寬度驗證過各分頁。

## 傳說（Epic）自動繳納（已實作，尚未在手機上實測）

詳細機制與各階段資料見 `docs/walkr-epic-events.md`（使用者之後會補常見傳說的資料）。

### 檔案

- `scripts/walkr-epic-auto-contribute.js`：一支腳本，四種執行方式
  - cron `*/10`（`$argument` 空白）：受 `WalkrEpicAutoEnabled` 控制，沒有繳納時只記 log 不通知
  - `argument=run`：手動立即繳納
  - `argument=test`：依 `WalkrEpicTestItem/Amount/Hitpoints` 送出單次繳納，顯示伺服器原始回應
  - http-request `walkr.mysurge.com/api/epic/{run|status|test}`：給管理介面呼叫，`status` 只預覽不繳納
- `scripts/walkr-config-page.js`、`scripts/walkr-config-api.js`：管理介面，詳見下方「管理介面」章節
- 「立即繳納」和 cron 一樣依 `WalkrEpicMode` 繳納，差別只在不受 `WalkrEpicAutoEnabled` 開關限制。
- `fleets/current` 的 query 直接沿用 `WalkrLabCurrentUrl` 的裝置參數（實測兩者相同），不需修改 capture 腳本

### 繳納邏輯

1. `GET fleets/current`；`event_status == "event"` 為第一段、`"path"` 為第二段。
2. 第一段：`resources` 一律 0 格繳滿；其他類型標準模式每項用 3 格繳 `min(需求量 1/2, 剩餘量)`，無限模式 0 格繳滿。`virtual-*` 只算 `resource_a`。
3. 回應 `refresh:true`（步驟完成）時重新讀取，若進入 `path` 接著繳能量。
4. 第二段：標準模式 2 格繳 1/4、1 格繳 1/8（剩餘量 ≤ 1/8 時只用 1 格）；無限模式 0 格繳滿。
5. 每個請求間隔 2.5 秒；任一筆失敗就停止。結果存在 `WalkrEpicLastResult`，通知標題 `🚀 Walkr Epic`。
6. 預覽會顯示飛行時間（`flightLine`）：
   - `fleets/current` 回應中的 `last_consumed_at` 就是讀取的時間，代表伺服器在讀取當下已經結算好燃燒量，`consumed_energy` 是即時值。
   - 燃燒速度是 `required_energy / (path.time × 3600)` 每秒。剩餘時間 = `(required - consumed) / 速度`。
   - `fleet.energy` 不夠燒完剩餘需求時，顯示還能飛多久、還差多少能量。
   - event 狀態則顯示下一段需要飛行的時數。

### 參數

| key | 說明 | 預設 |
|---|---|---|
| `WalkrEpicAutoEnabled` | cron 是否執行 | true |
| `WalkrEpicMode` | `standard` / `unlimited` | standard |
| `WalkrEpicSharePercent` | 第一段每項自己最多繳需求量的 %（讓隊友有機會貢獻），能量不受限制 | 100 |
| `WalkrEpicTestItem` | 測試項目 a/b/c/energy，空白自動 | 空白 |
| `WalkrEpicTestAmount` | 測試數量，空白為剩餘量 | 空白 |
| `WalkrEpicTestHitpoints` | 測試請求的格數 | 1 |

### 使用者手機測試清單（2026-11-23 起）

1. 開一次 Walkr，讓 capture 腳本存下 token 和網址。
2. 開 `https://walkr.mysurge.com/` 按「預覽」，確認讀得到階段和飛行時間。
3. 用「單次測試繳納」測：currency、virtual、能量各送 0 格或 1 格，再配上很大的數量，看伺服器接不接受、會不會截到剩餘量。
4. 測試結果回填 `docs/walkr-epic-events.md`；如果 0 格可行，再請使用者把模式切成「無限」。

### 待確認

- **無限模式是否可行**：resources 送 0 格伺服器不擋，currency / virtual / 能量送 0 格、大數量是否接受還沒測。使用者會用單次測試確認，結果要回填到 `docs/walkr-epic-events.md`，必要時調整 `planEventDonations`、`planEnergyDonations`。
- 標準模式第一段只知道「3 格 = 需求量 1/2」，較小的選項不清楚（virtual-food 用 2 格繳 100/250）。
- `preparation` 類型（第一階段）沒有繳納紀錄，暫時當作 currency 處理。
- 測試方式：node mock `$persistentStore`、`$httpClient` 等，以 HAR 的 `fleets/current` 模擬伺服器（clamp、refresh、耐力），共 25 個情境。測試程式放在 session 的 scratchpad，不在 repo 內，下次要重寫 harness。
- 實際飛行時間跟預估相差多少還沒驗證。伺服器在短時間內的燃燒量看起來有取整（3 秒內 `consumed_energy` 一直是 1）。
