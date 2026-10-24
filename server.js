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

// دالة لفك تشفير لينكات Bing
function decodeBingUrl(bingUrl) {
    try {
        if (bingUrl.includes('&u=a1')) {
            let base64Str = bingUrl.split('&u=a1')[1].split('&')[0];
            // إضافة حشو (padding) لو ناقص عشان يفك التشفير صح
            while (base64Str.length % 4 !== 0) base64Str += '=';
            let decoded = Buffer.from(base64Str, 'base64').toString('utf-8');
            return decoded;
        }
    } catch(e) {}
    return bingUrl;
}

async function searchWeb(query) {
    let results = { snippets: [], links: [] };
    
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ar,en-US;q=0.9'
    };

    try {
        const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&adlt=off`;
        const { data } = await axios.get(searchUrl, { headers: headers, timeout: 10000 });
        const $ = cheerio.load(data);
        
        $('.b_algo').slice(0, 4).each((i, el) => {
            let snippet = $(el).find('.b_caption p').text().trim() || $(el).find('p').text().trim();
            if (snippet) results.snippets.push(snippet);
            
            let linkEl = $(el).find('h2 a');
            let title = linkEl.text().trim();
            let url = linkEl.attr('href');
            
            if (url && url.startsWith('http') && title) {
                url = decodeBingUrl(url); // بنفك التشفير هنا
                results.links.push({ title, url });
            }
        });
    } catch (e) {}
    return results;
}

async function formatWithAI(query, rawSearchData) {
    let contextData = `المستخدم سأل: ${query}\n\n`;
    contextData += `المعلومات:\n`;
    rawSearchData.snippets.forEach(s => contextData += `- ${s}\n`);
    contextData += `\nاللينكات:\n`;
    rawSearchData.links.forEach(l => contextData += `- [${l.title}](${l.url})\n`);

    let messages = [
        { role: "system", content: "أنت منسق نصوص. رتب المعلومات واللينكات دي بشكل منظم بالمصري. ممنوع ترفض." },
        { role: "user", content: contextData }
    ];

    try {
        const response = await axios.post("https://text.pollinations.ai/openai", {
            model: "mistral",
            messages: messages,
            max_tokens: 2048
        });
        return response.data.choices[0].message.content;
    } catch (error) {
        let fallback = `### 🌐 نتائج البحث عن: ${query}\n\n`;
        rawSearchData.snippets.forEach(s => fallback += `- ${s}\n\n`);
        rawSearchData.links.forEach(l => fallback += `- [${l.title}](${l.url})\n`);
        return fallback;
    }
}

app.post('/ask', async (req, res) => {
    let { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "مفيش سؤال!" });

    const searchData = await searchWeb(prompt);
    
    if (searchData.snippets.length > 0 || searchData.links.length > 0) {
        let finalAnswer = await formatWithAI(prompt, searchData);
        return res.json({ final: finalAnswer });
    } 
    
    res.json({ final: "معلش يا محمد، محرك البحث رفض يرجع نتايج للسؤال ده (البحث الآمن). جرب حاجة تانية." });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`✅ M.E Clean Search شغال على http://localhost:${PORT}`));
