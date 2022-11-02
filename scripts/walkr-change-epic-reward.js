// Walkr change the cube to replicator and increase coins  UAT
// Walkr 更改取得的能量方塊為設計圖 金幣提高
// execute when login account

let body = JSON.parse($response.body);


body.fetchable_contents[0].key="replicator";
body.fetchable_contents[0].value="map";

let vSplit = body.fetchable_contents[1].value.split(".");
let newValue =  Number(vSplit[0])+20000000;
body.fetchable_contents[1].value =`${newValue}.${vSplit[1]}.${vSplit[2]}`;

console.log(`🚀 獎勵調整成功 能量方塊變更為DFR設計圖\n金幣增加為${newValue}`);
$notification.post('🚀 Walkr',`獎勵調整成功 能量方塊變更為DFR設計圖\n金幣增加為${newValue}`,'');

$done({ body: JSON.stringify(body) });
