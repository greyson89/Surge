// Walkr unlimited lab donate only script ver.
// 可重複無限制的捐贈給他人 目前只用腳本版
// https:\/\/production\.sw\.(fourdesireplay|fourdesire)\.(io|com)\/api\/v2\/comments.*(commentable_type=lab){1}.*
// 

let body = JSON.parse($response.body);


for (const person of body.comments) {
	if(person.comment == undefined){
		continue;
	}
	person.comment.donated_counter='';
}


$done({ body: JSON.stringify(body) });

function isNumeric(val) {
    return /^\d+$/.test(parseInt(val));
}
