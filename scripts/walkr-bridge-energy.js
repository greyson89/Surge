// Walkr bridge co-pilots supply energy data modify
// Walkr 修改每次進入時艦橋共駕提供的能量數據 需搭配另一腳本才能正確取得

let body = JSON.parse($response.body);

body.pilots[0].energy=160000;
body.pilots[1].energy=160000;
body.pilots[2].energy=160000;
body.pilots[3].energy=160000;
//body.pilots[4].energy=160000; // 如有的五位共駕再開啟

console.log(`🚀 修改共駕能量數據完成`);
//$notification.post('🚀 Walkr','修改共駕能量數據','');

$done({body:JSON.stringify(body)});
