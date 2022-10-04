// Walkr money modify (need to delete the app, then reinstall and login)
// Walkr 修改傳送給伺服器金錢 未修改其他資料如能量方塊以防萬一 

// 警告： 需熟悉流程以及資料備份,需非常小心！
// 警告： 需熟悉流程以及資料備份,需非常小心！
// 警告： 需熟悉流程以及資料備份,需非常小心！

// 修改流程： 1.需先手動填寫與執行walkr-settings.js 2.觸發儲存 3.看到訊息與金額增加後 3.刪除app並重新安裝與登入即可 
// 儲存觸發條件：手動去設定同步 or 建造東西

let body = JSON.parse($request.body);

let processWalkrMoney = $persistentStore.read("ProcessWalkrMoney");

if(processWalkrMoney==false){
	$done();
}

let howMuchMoneyYouWant = $persistentStore.read('WalkerMoney');
if(isNumeric(howMuchMoneyYouWant)){
	body.player.coins+=howMuchMoneyYouWant;
	$notification.post('🚀 Walkr',`修改伺服器金錢${body.player.coins}`,'請刪除APP並重新安裝與登入');
}else{
	$notification.post('🚀 Walkr',`未正確填寫預期金額`,'');
}

$done({body:JSON.stringify(body)});

function isNumeric(val) {
    return /^\d+$/.test(parseInt(val));
}
