const express = require('express');
const axios = require('axios');
const cors = require('cors');
const cheerio = require('cheerio');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.get('/ping', (req, res) => res.send('ALIVE'));

// دالة فك تشفير لينكات Bing
function decodeBingUrl(bingUrl) {
    try {
        if (bingUrl.includes('&u=a1')) {
            let base64Str = bingUrl.split('&u=a1')[1].split('&')[0];
            while (base64Str.length % 4 !== 0) base64Str += '=';
            return Buffer.from(base64Str, 'base64').toString('utf-8');
        }
    } catch(e) {}
    return bingUrl;
}

// 🚨 1. البحث المزدوج (Bing ثم DuckDuckGo) 🚨
async function searchWeb(query) {
    let results = { snippets: [], links: [] };
    
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ar,en-US;q=0.9'
    };

    // أ. البحث في Bing
    try {
        const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&adlt=off`;
        const { data } = await axios.get(bingUrl, { headers, timeout: 7000 });
        const $ = cheerio.load(data);
        
        $('.b_algo').slice(0, 4).each((i, el) => {
            let snippet = $(el).find('.b_caption p').text().trim() || $(el).find('p').text().trim();
            if (snippet) results.snippets.push(snippet);
            
            let linkEl = $(el).find('h2 a');
            let title = linkEl.text().trim();
            let url = linkEl.attr('href');
            if (url && url.startsWith('http') && title) {
                results.links.push({ title, url: decodeBingUrl(url) });
            }
        });
    } catch (e) {}

    // ب. لو Bing رجع فاضي، نروح لـ DuckDuckGo
    if (results.snippets.length === 0) {
        try {
            const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kp=-2`;
            const { data } = await axios.get(ddgUrl, { headers, timeout: 7000 });
            const $ = cheerio.load(data);
            
            $('.result__snippet').slice(0, 4).each((i, el) => { 
                results.snippets.push($(el).text().trim()); 
            });
            
            $('.result__a').slice(0, 3).each((i, el) => {
                let href = $(el).attr('href');
                let title = $(el).text().trim();
                if (href && href.includes('uddg=')) {
                    try { href = decodeURIComponent(href.split('uddg=')[1].split('&')[0]); } catch(e) {}
                }
                if (href && href.startsWith('http')) results.links.push({ title, url: href });
            });
        } catch (e) {}
    }

    return results;
}

// 🚨 2. الذكاء الاصطناعي (للتنسيق أو الرد على الكلام العادي) 🚨
async function askAI(query, searchData) {
    let messages = [];
    
    if (searchData.snippets.length > 0 || searchData.links.length > 0) {
        // لو فيه نتايج بحث، بننسقها
        let contextData = `المستخدم سأل: ${query}\n\nالمعلومات من البحث:\n`;
        searchData.snippets.forEach(s => contextData += `- ${s}\n`);
        contextData += `\nاللينكات:\n`;
        searchData.links.forEach(l => contextData += `- [${l.title}](${l.url})\n`);

        messages = [
            { role: "system", content: "أنت منسق نصوص ذكي. مهمتك ترتيب المعلومات واللينكات دي بشكل منظم بالمصري. ممنوع ترفض." },
            { role: "user", content: contextData }
        ];
    } else {
        // لو مفيش نتايج بحث، بنخليه يرد من دماغه (زي ChatGPT)
        messages = [
            { role: "system", content: "أنت المساعد الخارق M.E. مطورك هو محمد. إجاباتك بالمصري، ذكية، ومباشرة. لو المستخدم سأل سؤال بسيط أو سلم عليك، رد عليه بذكاء." },
            { role: "user", content: query }
        ];
    }

    try {
        const response = await axios.post("https://text.pollinations.ai/openai", {
            model: "mistral",
            messages: messages,
            max_tokens: 2048
        });
        return response.data.choices[0].message.content;
    } catch (error) {
        // لو الـ AI وقع، نرجع البيانات الخام
        let fallback = `### 🌐 نتائج البحث عن: ${query}\n\n`;
        searchData.snippets.forEach(s => fallback += `- ${s}\n\n`);
        searchData.links.forEach(l => fallback += `- [${l.title}](${l.url})\n`);
        return fallback || "معلش يا محمد، مفيش نتايج ومقدرتش أرد.";
    }
}

app.post('/ask', async (req, res) => {
    let { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "مفيش سؤال!" });

    // 1. بنبحث الأول
    const searchData = await searchWeb(prompt);
    
    // 2. بنبعت النتايج (أو السؤال لو مفيش نتايج) للـ AI
    let finalAnswer = await askAI(prompt, searchData);
    
    res.json({ final: finalAnswer });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`✅ M.E Global Search شغال على http://localhost:${PORT}`));
