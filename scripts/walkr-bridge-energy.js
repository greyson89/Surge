// Walkr bridge co-pilots supply energy data modify
// Walkr 修改每次進入時艦橋共駕提供的能量數據 需搭配另一腳本才能正確取得
// 20231025


if($response.body == undefined){
	$done({});
}else{

	let body = JSON.parse($response.body);
	
	for (const pilot of body.pilots) {
		pilot.energy =160000;
	}
	
	console.log(`🚀 修改共駕能量數據完成`);
	//$notification.post('🚀 Walkr','修改共駕能量數據','');
	
	$done({body:JSON.stringify(body)});
}

