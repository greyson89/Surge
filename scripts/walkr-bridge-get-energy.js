// Walkr bridge get energy modify
// Walkr 取得艦橋能量時的數據修改 個人取得
// 數值由管理介面設定 WalkrBridgeClaimEnergy（實際領取值），未設定時為 80000

const DEFAULT_CLAIM_ENERGY = 80000;

let body = JSON.parse($response.body);
let claimValue = parseInt($persistentStore.read('WalkrBridgeClaimEnergy'));
let claimEnergy = String(claimValue > 0 ? claimValue : DEFAULT_CLAIM_ENERGY);

body.fetchable_content.value=claimEnergy;
for (const content of body.fetchable_contents) {
	content.value = claimEnergy;
}
console.log(`🚀 取得能量${body.fetchable_content.value}`);
//$notification.post('🚀 Walkr',`取得能量${body.fetchable_content.value}`,'');

$done({body:JSON.stringify(body)});


