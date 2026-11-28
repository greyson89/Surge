// Walkr walking energy covert modify for co-pilots
// Walkr 走路轉換能量修改 非個人使用 提供給其他共駕獲取
// 需先在管理介面（https://walkr.mysurge.com/#pilot）設定參數
// 優先使用 walkr-pedometer-modify.js 已依步數決定的能量，讓步數與能量一致

const STATE_KEY = 'WalkrPedometerState';
// walkr-pilot-convert.js 手動送出時寫入的標記，相符就原樣放行
const MANUAL_MARK_KEY = 'WalkrPilotManualConvert';
const MANUAL_MARK_TTL_MS = 60 * 1000;

let body = JSON.parse($request.body);

if(isManualConvert(body)){
	console.log(`🚀 手動送出能量${body.converted_energy}，不修改`);
	$done({});
}else{
	modifyConvert(body);
}

function modifyConvert(body){
	let convertBaseEnergy = $persistentStore.read('WalkrCovertBaseEnergy');
	let state = readState();

	if(state && state.pendingEnergy > 0){
		// 實際步數的能量加上額外步數對應的能量
		body.converted_energy += state.pendingEnergy;
		state.pendingEnergy = 0;
		$persistentStore.write(JSON.stringify(state), STATE_KEY);
		console.log(`🚀 走路能量依步數轉換完成,轉換出${body.converted_energy}能量`);
	}else if(isNumeric(convertBaseEnergy)){
		body.converted_energy=Math.floor(Math.random()*10000)+parseInt(convertBaseEnergy);
		console.log(`🚀 走路能量修改轉換完成,轉換出${body.converted_energy}能量`);
	}else{
		console.log(`🚀 走路能量修改轉換失敗,未正確填寫正確數值`);
		$notification.post('🚀 Walkr',`走路能量修改轉換失敗`,'未正確填寫正確數值');
	}



	// $notification.post('🚀 Walkr','修改轉換能量'+body.converted_energy,'');

	$done({body:JSON.stringify(body)});
}

function isManualConvert(body) {
	try {
		let mark = JSON.parse($persistentStore.read(MANUAL_MARK_KEY));
		return mark != null && mark.energy === body.converted_energy && Date.now() - mark.time < MANUAL_MARK_TTL_MS;
	} catch (e) {
		return false;
	}
}

function isNumeric(val) {
    return /^\d+$/.test(parseInt(val));
}

function readState() {
	try {
		return JSON.parse($persistentStore.read(STATE_KEY));
	} catch (e) {
		console.log(`🚀 步數狀態讀取失敗: ${e}`);
		return null;
	}
}
