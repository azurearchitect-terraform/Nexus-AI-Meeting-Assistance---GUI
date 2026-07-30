const curl2Json = require('@bany/curl-to-json').default || require('@bany/curl-to-json');
const curl = `curl https://api.groq.com/openai/v1/chat/completions -H "Content-Type: application/json" -H "Authorization: Bearer {{API_KEY}}" -d '{"model": "llama-3.3-70b-versatile", "messages": []}'`;
console.log(JSON.stringify(curl2Json(curl), null, 2));
