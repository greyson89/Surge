// Walkr settings
// Walkr 參數設定 手動修改數值後 點選執行一次

// 設定轉換給共駕的能量的基礎值
// 腳本會預設提供給1-10000的隨機值,建議填入不超過150000的數值
// 例如： 這邊填入80000,則每次轉換時會提供80000+(1~10000)給共駕
let WalkrCovertBaseEnergy = '80000';


// 修改提供給Server的金錢數據 true/false
// 預設關閉修改功能,如要啟動請改為 true
let WalkrIsExecuteMoneyModify = 'false';

// 修改提供給Server的金錢數據,會以現有的加上填入值送上去
// 不確定安全值範圍,建議低於20億
let WalkrMoney = '100000000';

// 修改提供給Server的能量方塊數據 true/false
// 預設關閉修改功能,如要啟動請改為 true
// 危險操作請注意
let WalkrIsExecuteCubeModify = 'false';

// 修改提供給Server的能量方塊數據,會以現有的加上填入值送上去
// 不確定安全值範圍
let WalkrCube = '280000';



$persistentStore.write(WalkrCovertBaseEnergy, "WalkrCovertBaseEnergy");
$persistentStore.write(WalkrIsExecuteMoneyModify, "WalkrIsExecuteMoneyModify");
$persistentStore.write(WalkrMoney, "WalkrMoney");
$persistentStore.write(WalkrIsExecuteCubeModify, "WalkrIsExecuteCubeModify");
$persistentStore.write(WalkrCube, "WalkrCube");



$notification.post("🚀 Walkr", `參數設定完成`, "");
$done();
