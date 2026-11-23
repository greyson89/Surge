// Walkr settings
// Walkr 參數設定 手動修改數值後 點選執行一次

// 設定轉換給共駕的額外能量的基礎值
// 腳本會再加上0~9999的隨機值,並加在實際走路轉換的能量上
// 例如： 這邊填入20000,則每次轉換時會額外提供20000+(0~9999)給共駕
// 上傳的步數會依下方比例同步增加,數值越大步數越不合理,建議不超過30000
let WalkrCovertBaseEnergy = '20000';

// 每一步走路可轉換的能量，用來由能量反推上傳的步數(無條件進位)
// 實測約 1.3 (167步轉換出217能量)
// 例如： 額外能量20000時,步數會額外增加 20000/1.3 = 15385步
let WalkrEnergyPerStep = '1.3';


// 修改提供給Server的金錢數據 true/false
// 預設關閉修改功能,如要啟動請改為 true
let WalkrIsExecuteMoneyModify = 'false';
// 修改提供給Server的金錢數據,會以現有的加上填入值送上去
// 不確定安全值範圍,建議低於30億
let WalkrMoney = '30000000000';


// 修改提供給Server的能量方塊數據 true/false
// 預設關閉修改功能,如要啟動請改為 true
// 危險操作請注意
let WalkrIsExecuteCubeModify = 'false';
// 修改提供給Server的能量方塊數據,會以現有的加上填入值送上去
// 不確定安全值範圍
let WalkrCube = '150000';


// DEPRECATED LAB donate 獎勵類型 預設為coins,可能可以有cubes無效, energy
// let WalkrIsExecuteDonateModify = 'false';
// let WalkrDonateRewardType = 'cubes';
// let WalkrDonateRewardValue = '500';

// epic reward type 傳說獎勵類型切換 map or cubes
let WalkrEpicRewardType = "cubes";
let WalkrEpicRewardMoney = 20_000_000_000;
let WalkrEpicRewardCubes = 1_200_000;


$persistentStore.write(WalkrCovertBaseEnergy, "WalkrCovertBaseEnergy");
$persistentStore.write(WalkrEnergyPerStep, "WalkrEnergyPerStep");
$persistentStore.write(WalkrIsExecuteMoneyModify, "WalkrIsExecuteMoneyModify");
$persistentStore.write(WalkrMoney, "WalkrMoney");
$persistentStore.write(WalkrIsExecuteCubeModify, "WalkrIsExecuteCubeModify");
$persistentStore.write(WalkrCube, "WalkrCube");
// $persistentStore.write(WalkrIsExecuteDonateModify, "WalkrIsExecuteDonateModify");
// $persistentStore.write(WalkrDonateRewardType, "WalkrDonateRewardType");
// $persistentStore.write(WalkrDonateRewardValue, "WalkrDonateRewardValue");
$persistentStore.write(WalkrEpicRewardType, "WalkrEpicRewardType");
$persistentStore.write(WalkrEpicRewardMoney, "WalkrEpicRewardMoney");
$persistentStore.write(WalkrEpicRewardCubes, "WalkrEpicRewardCubes");


$notification.post("🚀 Walkr", `參數設定完成`, "");
$done();
