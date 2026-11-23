// Walkr player data modify
// Walkr 修改玩家資訊,金幣,能量方塊
// modify when login account

// 警告： 需熟悉流程以及資料備份,需非常小心！
// 警告： 需熟悉流程以及資料備份,需非常小心！
// 警告： 需熟悉流程以及資料備份,需非常小心！

// 修改流程： 1.需先在管理介面（https://walkr.mysurge.com/#account）設定參數 2.重新登入帳號即可(刪除APP重新安裝或是用其他裝置重複登入踢掉後再登入)


let body = JSON.parse($response.body);

let WalkrIsExecuteMoneyModify = $persistentStore.read("WalkrIsExecuteMoneyModify");
if (WalkrIsExecuteMoneyModify === "true") {
    let howMuchMoneyYouWant = $persistentStore.read("WalkrMoney");
    if (isNumeric(howMuchMoneyYouWant)) {
        body.player.coins += parseInt(howMuchMoneyYouWant);
        $notification.post("🚀 Walkr", `金幣增加為${body.player.coins}`, "");
    } else {
        $notification.post("🚀 Walkr", `變更失敗 未正確填寫預期金額`, "");
    }
}


let WalkrIsExecuteCubeModify = $persistentStore.read("WalkrIsExecuteCubeModify");
if (WalkrIsExecuteCubeModify === "true") {
    let howManyCubesYouWant = $persistentStore.read("WalkrCube");
    if (isNumeric(howManyCubesYouWant)) {
        body.player.cubes += parseInt(howManyCubesYouWant);
        $notification.post("🚀 Walkr", `能量方塊增加為${body.player.cubes}`, "");
    } else {
        $notification.post("🚀 Walkr", `變更失敗 未正確填寫預期方塊`, "");
    }
}

$done({ body: JSON.stringify(body) });

function isNumeric(val) {
    return /^\d+$/.test(parseInt(val));
}
