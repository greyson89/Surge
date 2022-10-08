// Walkr money modify (need to delete the app, then reinstall and login)
// Walkr 修改傳送給伺服器金錢 修改能量方塊測試中 請謹慎使用

// 警告： 需熟悉流程以及資料備份,需非常小心！
// 警告： 需熟悉流程以及資料備份,需非常小心！
// 警告： 需熟悉流程以及資料備份,需非常小心！

// 修改流程： 1.需先手動填寫與執行walkr-settings.js 2.觸發儲存 3.看到訊息與金額增加後 3.刪除app並重新安裝與登入即可
// 儲存觸發條件：手動去設定同步 or 建造東西

let body = JSON.parse($request.body);

let WalkrIsExecuteMoneyModify = $persistentStore.read("WalkrIsExecuteMoneyModify");
if (WalkrIsExecuteMoneyModify === "true") {
    let howMuchMoneyYouWant = $persistentStore.read("WalkrMoney");
    if (isNumeric(howMuchMoneyYouWant)) {
        body.player.coins += parseInt(howMuchMoneyYouWant);
        $notification.post("🚀 Walkr", `修改伺服器金錢${body.player.coins}`, "請刪除APP並重新安裝與登入");
    } else {
        $notification.post("🚀 Walkr", `未正確填寫預期金額`, "");
    }
}


let WalkrIsExecuteCubeModify = $persistentStore.read("WalkrIsExecuteCubeModify");
if (WalkrIsExecuteCubeModify === "true") {
    let howManyCubesYouWant = $persistentStore.read("WalkrCube");
    if (isNumeric(howManyCubesYouWant)) {
        body.player.cubes += parseInt(howManyCubesYouWant);
        $notification.post("🚀 Walkr", `修改伺服器方塊${body.player.cubes}`, "請刪除APP並重新安裝與登入");
    } else {
        $notification.post("🚀 Walkr", `未正確填寫預期方塊`, "");
    }
}

$done({ body: JSON.stringify(body) });

function isNumeric(val) {
    return /^\d+$/.test(parseInt(val));
}
