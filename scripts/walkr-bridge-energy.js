// Walkr bridge co-pilots supply energy data modify
// Walkr 修改每次進入時艦橋共駕提供的能量數據 需搭配另一腳本才能正確取得
// 數值由管理介面設定 WalkrBridgeDisplayEnergy（畫面顯示值），未設定時為 160000

const DEFAULT_DISPLAY_ENERGY = 160000;


if($response.body == undefined){
	$done({});
}else{

	let body = JSON.parse($response.body);
	
	for (const pilot of body.pilots) {
		pilot.energy = readEnergy();
	}
	
	console.log(`🚀 修改共駕能量數據完成`);
	//$notification.post('🚀 Walkr','修改共駕能量數據','');
	
	$done({body:JSON.stringify(body)});
}

function readEnergy() {
	let value = parseInt($persistentStore.read('WalkrBridgeDisplayEnergy'));
	return value > 0 ? value : DEFAULT_DISPLAY_ENERGY;
}

