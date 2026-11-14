# Walkr 走路步數與共駕能量轉換

說明 `[Walkr]修改走路步數` 與 `[Walkr]修改轉換給共駕之能量` 兩支腳本如何讓上傳的步數與能量互相對應。

相關檔案：

- `scripts/walkr-pedometer-modify.js`：修改上傳的走路步數
- `scripts/walkr-covert-energy.js`：修改轉換給共駕的能量
- `scripts/walkr-settings.js`：參數設定，修改後需手動執行一次
- `modules/walkr.sgmodule`：模組規則

## App 原始行為（未啟用腳本，2026-11-14 HAR 分析）

開啟 Walkr 時，App 會依序送出兩筆請求：

| 順序 | 請求 | 內容 |
|---|---|---|
| 1 | `POST /api/v2/warehouse/u/activity` | `updated_objects[0].walking`：當天累計步數 |
| 2 | `POST /api/v2/pilots/convert` | `converted_energy`：距離上次轉換後新增的能量 |

共駕玩家依 `converted_energy` 取得最多 50% 的能量。

兩次開啟的實測數據：

| 時間 | walking（累計） | converted_energy（增量） |
|---|---|---|
| 21:17 | 334 | 154 |
| 23:38 | 501 | 217 |

兩次之間增加 167 步，轉換出 217 能量，約 **1.3 能量／步**，即 `WalkrEnergyPerStep` 的預設值。這只是單一組差值，跑步（`running`）的比例尚未量測，腳本不修改跑步數。

## 參數

| 參數 | 預設值 | 說明 |
|---|---|---|
| `WalkrCovertBaseEnergy` | `20000` | 每次額外提供的基礎能量 |
| `WalkrEnergyPerStep` | `1.3` | 每一步可轉換的能量，用來由能量反推步數 |

- 隨機值：每次另外加上 0～9999，讓每次數值不同
- 額外能量 = `WalkrCovertBaseEnergy` + 隨機值，Base 20000 時每次落在 20000～29999
- 額外步數 = 額外能量 ÷ `WalkrEnergyPerStep`，無條件進位，Base 20000 時每次落在 15385～23077 步
- 實際走路的步數與能量都會保留，額外的部分是加上去，不是取代

Base 越大，步數越不合理，建議不超過 30000。

## 腳本流程

1. **activity 請求**（`walkr-pedometer-modify.js`）
   1. 產生額外能量，算出額外步數
   2. 額外步數累加到當天的累計值，並加到 `walking` 上送出
   3. 額外能量存入 persistentStore（`WalkrPedometerState.pendingEnergy`）
2. **convert 請求**（`walkr-covert-energy.js`）
   1. 讀取存好的額外能量，加到 App 原本的 `converted_energy` 上送出
   2. 送出後將存的額外能量清為 0，避免重複使用

`WalkrPedometerState` 存放 `{ date, extraSteps, pendingEnergy }`：

- `date`：日期不同時，`extraSteps` 與 `pendingEnergy` 重新計算
- `extraSteps`：當天已累加的額外步數。步數是當天累計值，要一直保留才不會倒退
- `pendingEnergy`：尚未被 convert 使用的額外能量。不為 0 時，重複上傳 activity 不會再產生新的額外步數

## 範例

以下假設 Base 為 20000，App 換算能量約 1.3／步。

### 當天第一次開啟，實際走 200 步，隨機值 5000

| 請求 | App 原始值 | 計算 | 送出值 |
|---|---|---|---|
| activity | `walking: 200` | 額外能量 20000 + 5000 = 25000；額外步數 = 25000 ÷ 1.3，進位為 19231 | `walking: 19431` |
| convert | `converted_energy: ≈260` | 260 + 25000 | `converted_energy: 25260` |

19431 × 1.3 ≈ 25260，步數與能量對應。共駕最多可取得約 12630。

### 同一天第二次開啟，又走 200 步，隨機值 1234

| 請求 | App 原始值 | 計算 | 送出值 |
|---|---|---|---|
| activity | `walking: 400` | 額外能量 21234；額外步數 = 21234 ÷ 1.3，進位為 16334；當天累計額外步數 19231 + 16334 = 35565 | `walking: 35965` |
| convert | `converted_energy: ≈260` | 260 + 21234 | `converted_energy: 21494` |

隔天日期改變，累計的額外步數歸零。

## 例外情況

- **參數未設定或格式錯誤**：步數腳本跳出失敗通知，步數照原值送出
- **沒有待轉換的額外能量**（例如 App 未先上傳 activity）：convert 腳本改用舊方式，直接以 Base + 隨機值取代 `converted_energy`，這次步數不會對應
- **App 自行換算的能量**（範例中的 260）由 App 決定，腳本只在上面加，1.3 只是推估值

## 使用方式

1. 模組從 GitHub `master` 讀取腳本，修改需 push 後才會生效
2. 修改 `walkr-settings.js` 後，在 Surge 手動執行一次 `[Walkr]Settings`，參數才會寫入 persistentStore
3. 確認是否生效：開啟腳本後開一次 Walkr，請共駕朋友到艦橋查看你的能量是否增加
