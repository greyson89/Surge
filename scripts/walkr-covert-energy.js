// Walkr walking energy covert modify for co-pilots
// Walkr 走路轉換能量修改 非個人使用 提供給其他共駕獲取
// 需先手動填寫與執行walkr-settings.js

let body = JSON.parse($request.body);

let convertBaseEnergy = $persistentStore.read('ConvertBaseEnergy');

if(isNumeric(howMuchMoneyYouWant)){
	body.player.coins+=howMuchMoneyYouWant;
	$notification.post('🚀 Walkr',`修改伺服器金錢${body.player.coins}`,'請刪除APP並重新安裝與登入');
}else{
	$notification.post('🚀 Walkr',`未正確填寫預期金額`,'');
}


body.converted_energy=Math.floor(Math.random()*10000)+90000;

console.log(`走路能量修改轉換完成,轉換出${body.converted_energy}能量`);
// $notification.post('🚀 Walkr','修改轉換能量'+body.converted_energy,'');

$done({body:JSON.stringify(body)});

function isNumeric(val) {
    return /^\d+$/.test(val);
}
