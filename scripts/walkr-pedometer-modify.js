// Walkr pedometer modify
// Walkr 依照要轉換給共駕的能量反推步數，上傳對應的走路步數
// 需搭配 walkr-covert-energy.js，並先在管理介面（https://walkr.mysurge.com/#pilot）設定參數
// 流程：App 先上傳 activity(步數) 再上傳 pilots/convert(能量)
// 本腳本先決定這次要額外轉換的能量並存入 persistentStore，convert 腳本再讀取同一個值
// 額外能量 = WalkrCovertBaseEnergy + (0~9999)，額外步數 = 額外能量 / WalkrEnergyPerStep (無條件進位)
// 步數為當天累計值，當天的額外步數會持續累加，跨日後重新計算

const STATE_KEY = 'WalkrPedometerState';
const RANDOM_ENERGY_RANGE = 10000;

let body = JSON.parse($request.body);
let obj = body.updated_objects ?? body.created_objects;

let convertBaseEnergy = $persistentStore.read('WalkrCovertBaseEnergy');
let energyPerStep = parseFloat($persistentStore.read('WalkrEnergyPerStep'));

if (!obj || obj.length === 0) {
	console.log(`🚀 步數修改略過,沒有步數資料`);
} else if (!isNumeric(convertBaseEnergy) || !(energyPerStep > 0)) {
	console.log(`🚀 步數修改失敗,未正確填寫轉換能量或能量步數比例`);
	$notification.post('🚀 Walkr', `步數修改失敗`, '未正確填寫正確數值');
} else {
	let state = readState(obj[0].date);

	// 上一筆額外能量尚未被 convert 使用時不重複累加，避免步數與能量不一致
	if (state.pendingEnergy === 0) {
		state.pendingEnergy = Math.floor(Math.random() * RANDOM_ENERGY_RANGE) + parseInt(convertBaseEnergy);
		state.extraSteps += Math.ceil(state.pendingEnergy / energyPerStep);
	}

	// 步數為當天累計值，需加上當天所有已累加的額外步數，維持遞增
	obj[0].walking += state.extraSteps;
	$persistentStore.write(JSON.stringify(state), STATE_KEY);

	console.log(`🚀 步數修改完成 新步數為${obj[0].walking},當天額外步數${state.extraSteps},待轉換能量${state.pendingEnergy}`);
}

$done({ body: JSON.stringify(body) });

// 讀取當天狀態，日期不同時重新計算
function readState(date) {
	let saved = null;
	try {
		saved = JSON.parse($persistentStore.read(STATE_KEY));
	} catch (e) {
		console.log(`🚀 步數狀態讀取失敗,重新計算: ${e}`);
	}
	if (!saved || saved.date !== date) {
		return { date: date, extraSteps: 0, pendingEnergy: 0 };
	}
	return saved;
}

function isNumeric(val) {
	return /^\d+$/.test(parseInt(val));
}
