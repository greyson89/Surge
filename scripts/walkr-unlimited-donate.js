// Walkr unlimited lab donate TEST

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
