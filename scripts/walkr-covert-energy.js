// Walkr walking energy covert modify for co-pilots
// Walkr 走路轉換能量修改 非個人使用 提供給其他共駕獲取
// 需先手動填寫與執行walkr-settings.js

let body = JSON.parse($request.body);

let convertBaseEnergy = $persistentStore.read('ConvertBaseEnergy');

if(isNumeric(convertBaseEnergy)){
	body.converted_energy=Math.floor(Math.random()*10000)+convertBaseEnergy;
	console.log(`🚀 走路能量修改轉換完成,轉換出${body.converted_energy}能量`);
}else{
	console.log(`🚀 走路能量修改轉換失敗,未正確填寫正確數值`);
	$notification.post('🚀 Walkr',`走路能量修改轉換失敗`,'未正確填寫正確數值');
}



// $notification.post('🚀 Walkr','修改轉換能量'+body.converted_energy,'');

$done({body:JSON.stringify(body)});

function isNumeric(val) {
    return /^\d+$/.test(val);
}
