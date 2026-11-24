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
13. `git add` 只要有一個路徑不存在，整批都不會加入。這次因為這樣，第一個 commit（c47baa8）只包含檔案搬移就推上去了，後來才補上 560762c。commit 前要先用 `git diff --cached --stat` 確認內容。
14. 用 mock 的 http-request 腳本做管理介面時，要考慮 CSRF：任何網頁都能對 mock 網域送出 no-cors 請求。要求自訂 header 是最簡單的防護。
15. 每次寫完程式都要跑 `/code-review`。這兩輪各抓到一個真正的問題：傳說結束時 cron 不通知，以及 CSRF。

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
| 🚀 傳說 | 繳納狀態（預覽、立即繳納、原始回應）、自動繳納設定（含選擇題自動投票開關）、單次測試；傳說獎勵 `WalkrEpicRewardType/Money/Cubes` |
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

## 傳說（Epic）自動繳納（已實作並推上 GitHub，尚未在手機上實測）

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
6. 預覽會顯示飛行時間（`flightLines`，回傳多行，第二行起用全形空白縮排）：
   - `fleets/current` 回應中的 `last_consumed_at` 就是讀取的時間，代表伺服器在讀取當下已經結算好燃燒量，`consumed_energy` 是即時值。
   - 燃燒速度是 `required_energy / (path.time × 3600)` 每秒。剩餘時間 = `(required - consumed) / 速度`。
   - `fleet.energy` 不夠燒完剩餘需求時，顯示還能飛多久、還差多少能量。
   - event 狀態則顯示下一段需要飛行的時數。

### 選擇題（voting，2026-11-24 新增，欄位已用真實資料確認，腳本尚未實際投過票）

- 所有傳說的流程（16 個，含選擇題與 A／B 路線的資源比較）整理在 `docs/walkr-epic-routes.md`，來源是使用者提供的簡體截圖 `har-test/epic/傳說任務流程截圖/`，已轉成繁體中文。截圖文字可能與遊戲略有不同（例如截圖「攻打／救他」，遊戲「攻打他／救救他」）。
- `VOTING_CHOICES[傳說 id]` 每題為 `{ question, a, b, answer }`。**先**用 a、b 分別比對 `label_a`／`label_b`，都沒有命中才用題目比對 `event.name`／`event.description`（遊戲的大標題「要如何採取行動？」可能是各題共用的）。比對時忽略空白、標點與符號，其中一方包含另一方即可。
- `answer` 是 `"a"`／`"b"`，送出 `value_x:1`、`hitpoints:0`。11 題都已由使用者填好預設路線；留空的題目不會投票，只通知一次。
- `WalkrEpicVoteEnabled`（管理介面「選擇題自動投票」）關閉時不投票，只通知一次題目與選項；使用者會先關閉，抓到選擇題的資料後再開啟。
- 預覽與通知會顯示剩餘時間、截止時間（`started_at + VOTING_HOURS`）、已投人數與決定票數（`ceil(members_count / 2)`，2026-11-24 由 10 人 5 票就決定推得，原本是 `floor(n/2)+1`）。以截圖驗證：開始後 7 分鐘顯示「剩 23 小時 53 分」，跟 app 一致。
- 投票失敗時記錄 `{ failed: 訊息 }`，cron 仍會重試，但同一個錯誤只通知一次。預覽（status）不會發通知。
- 不管投票結果走哪條路線，之後的事件仍依 `fleets/current` 偵測需求繳納，不受影響。
- 每題只投一次，紀錄在 `WalkrEpicVotedEvents`（key `fleetId:eventId`，最多 50 筆）；`hitpoints.value_*` 大於 0 視為已在 app 手動投過（HAR 已確認是自己投的選項）。
- 投票後回應 `refresh:true`（立即決定）會接著繳能量；否則等過半數或時間到，下一次 cron 進入 `path` 再繳能量。
- **已確認（2026-11-24 HAR）**：選項在 `label_a/b`、票數在 `fleet.value_*`、自己投的選項在 `hitpoints.value_*`；截止時間推得是 `fleet.started_at + 24 小時`。詳見 `docs/walkr-epic-events.md` 的選擇題章節。
- **還沒觀察到**（使用者之後提供，收到再處理）：
  1. ~~路線決定後、飛行中（`path`）的「原始回應」~~：已取得（2026-11-24），`target_id` 不變（121）、`fleet_histories` 用 `value_*` 記最後票數，`started_at` 是目前步驟的開始時間；5/10 票就決定，預覽的決定票數已改成 `ceil(n/2)`（只有一筆樣本）。腳本在這個狀態只繳能量，判斷正確。詳見 `docs/walkr-epic-events.md`。
  2. 抵達分支第一關後的「原始回應」：確認分支事件的 `event_type`、名稱與需求量，核對 `docs/walkr-epic-routes.md`。截圖的 `A.`／`B.` 前綴是整理者加的分類，遊戲內名稱沒有，比對時要拿掉。
  3. 由腳本實際投出第一票（巨龍王下一題「兩條線索」，使用者會打開自動投票），確認伺服器接受、通知內容正確。
  4. 再核對一次截止時間是否為 `started_at + 24 小時`（目前只有一筆樣本）。
  5. 尚未看過投票前的回應，推測 `hitpoints.value_*` 全是 0（腳本依此判斷尚未投票）。
- 取得方式：管理介面「原始回應」按鈕（`/api/epic/raw`，完整 JSON 可複製，手機上已實際可用）；或開著模組抓 HAR，`fleets/current` 已不帶 `If-None-Match`，實測回 200。

### 參數

| key | 說明 | 預設 |
|---|---|---|
| `WalkrEpicAutoEnabled` | cron 是否執行 | true |
| `WalkrEpicVoteEnabled` | 選擇題是否自動投票 | true |
| `WalkrEpicMode` | `standard` / `unlimited` | standard |
| `WalkrEpicSharePercent` | 第一段每項自己最多繳需求量的 %（讓隊友有機會貢獻），能量不受限制 | 100 |
| `WalkrEpicTestItem` | 測試項目 a/b/c/energy，空白自動 | 空白 |
| `WalkrEpicTestAmount` | 測試數量，空白為剩餘量 | 空白 |
| `WalkrEpicTestHitpoints` | 測試請求的格數 | 1 |
| `WalkrEpicVotedEvents` | 選擇題已投票／已通知的紀錄（腳本自動寫入） | 空白 |

### 使用者手機測試清單（2026-11-24 起，使用者測試中）

1. 在 Surge 更新 Walkr 模組，開一次 Walkr，讓 capture 腳本存下 token 和網址。
2. 開 `https://walkr.mysurge.com/` 按「預覽」，確認讀得到階段和飛行時間；在系統分頁確認 token 已擷取。
3. 用「單次測試繳納」測：currency、virtual、能量各送 0 格或 1 格，再配上很大的數量，看伺服器接不接受、會不會截到剩餘量。
4. 實際抵達時間跟預覽的預估做比較。
5. 測試結果回填 `docs/walkr-epic-events.md`；如果 0 格可行，再請使用者把模式切成「無限」。

### 使用者提供各階段資料時，要拿到的東西

使用者會在新的階段擷取資料。每個階段最好拿到：

- **`fleets/current` 的完整回應**（不能是 304）：用來取得 `event`（`event_type`、`resource_a/b/c`、`label_*`）、`path`（`required_energy`、`time`）和 `hitpoints`。也可以直接看管理介面預覽的結果。
- **app 的繳納選項畫面截圖**：每種類型（金幣、食物、星球資源、`virtual-*`、能量）各一張，用來補齊標準模式的選項與格數。
- **繳納的 HAR**（關閉模組時抓）：用來確認新的 `event_type` 的 body 格式。

收到後的處理：
1. 補進 `docs/walkr-epic-events.md` 的傳說表格，以及 event_type 一覽。
2. 遇到沒見過的 `event_type`，確認 `parseState`（哪些 key 算需求）與 `planEventDonations`（是否消耗耐力）要不要調整。
3. 用 HAR 的 `fleets/current` 加進 mock 測試，再跑一次全部情境。

### 待確認

- **無限模式是否可行**：resources 送 0 格伺服器不擋，currency / virtual / 能量送 0 格、大數量是否接受還沒測。使用者會用單次測試確認，結果要回填到 `docs/walkr-epic-events.md`，必要時調整 `planEventDonations`、`planEnergyDonations`。
- 標準模式第一段只知道「3 格 = 需求量 1/2」，較小的選項不清楚（virtual-food 用 2 格繳 100/250）。
- `preparation` 類型（第一階段）沒有繳納紀錄，暫時當作 currency 處理。
- 測試方式：node mock `$persistentStore`、`$httpClient` 等，以 HAR 的 `fleets/current` 模擬伺服器（clamp、refresh、耐力），傳說 25 個情境，加上管理介面 API、艦橋、實驗室開關 13 個情境，共 38 個。測試程式放在 session 的 scratchpad，不在 repo 內，下次要重寫 harness（做法：用 vm 執行腳本，`$httpClient` 接到依 HAR `fleets/current` 模擬的假伺服器）。
- 實際飛行時間跟預估相差多少還沒驗證。伺服器在短時間內的燃燒量看起來有取整（3 秒內 `consumed_energy` 一直是 1）。
