// Walkr bridge co-pilots request no cache
// Walkr 讀取艦橋共駕資料時移除快取驗證標頭
// App 會帶 If-None-Match，資料未變時 Server 回 304 且沒有 body，
// 導致 walkr-bridge-energy.js 無法修改共駕能量，App 改用快取的原始數值
// 移除後 Server 會回 200 與完整 body，回應腳本才能修改

const CACHE_HEADERS = ['if-none-match', 'if-modified-since'];

let headers = {};
for (const name of Object.keys($request.headers)) {
	if (!CACHE_HEADERS.includes(name.toLowerCase())) {
		headers[name] = $request.headers[name];
	}
}

console.log(`🚀 移除共駕資料快取標頭完成`);

$done({ headers: headers });
