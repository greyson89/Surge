// Walkr bridge get energy modify
// Walkr 取得艦橋能量時的數據修改 個人取得

let body = JSON.parse($response.body);

body.fetchable_content.value='80000';
body.fetchable_contents.value='80000';
console.log(`🚀 取得能量${body.fetchable_content.value}`);
//$notification.post('🚀 Walkr',`取得能量${body.fetchable_content.value}`,'');

$done({body:JSON.stringify(body)});


