const curl2Json = require('@bany/curl-to-json').default || require('@bany/curl-to-json');
const curl = `curl "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions" -H "Authorization: Bearer {{API_KEY}}"`;
console.log(curl2Json(curl).url);
