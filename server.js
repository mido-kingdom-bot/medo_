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

function decodeBingUrl(bingUrl) {
    try {
        if (bingUrl.includes('&u=a1')) {
            let b = bingUrl.split('&u=a1')[1].split('&')[0];
            while (b.length % 4 !== 0) b += '=';
            return Buffer.from(b, 'base64').toString('utf-8');
        }
    } catch(e) {}
    return bingUrl;
}

async function searchGeneral(query) {
    let results = { snippets: [], links: [] };
    
    // بننضف الكلام
    let cleanQuery = query.replace(/(هات|عايز|موقع|تطبيق|لي|عن|ابحث|قوليلي|ممكن)/gi, '').trim();
    if(!cleanQuery) cleanQuery = query;

    try {
        const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };
        const { data } = await axios.get(`https://www.bing.com/search?q=${encodeURIComponent(cleanQuery)}&adlt=off`, { headers, timeout: 5000 });
        const $ = cheerio.load(data);
        
        $('.b_algo').slice(0, 4).each((i, el) => {
            let s = $(el).find('.b_caption p').text().trim() || $(el).find('p').text().trim();
            
            // 🚨 فلتر عشان نمنع الكلام العشوائي (زي Achewood و Comic Sans) 🚨
            if (s && s.length > 20 && !s.includes('Comic Sans') && !s.includes('Achewood') && !s.includes('merchandise')) {
                results.snippets.push(s);
            }
            
            let linkEl = $(el).find('h2 a');
            let url = linkEl.attr('href');
            let title = linkEl.text().trim();
            if (url && url.startsWith('http') && title) {
                results.links.push({ title, url: decodeBingUrl(url) });
            }
        });
    } catch(e) {}
    return results;
}

async function synthesizeAnswer(query, data) {
    let context = `السؤال: ${query}\n\n`;
    
    if (data.snippets && data.snippets.length > 0) {
        context += `[معلومات من البحث]:\n`;
        data.snippets.forEach(s => context += `- ${s}\n`);
    }
    if (data.links && data.links.length > 0) {
        context += `\n[روابط]:\n`;
        data.links.forEach(l => context += `- [${l.title}](${l.url})\n`);
    }

    if (!data.snippets || data.snippets.length === 0) {
        return "معلش يا محمد، دورت في الويب بس مفيش نتايج مفيدة أو محرك البحث رفض يرجع حاجة. جرب تسأل عن حاجة تانية.";
    }

    let messages = [
        { role: "system", content: "أنت المساعد M.E. لخص المعلومات دي بالمصري. لو لقيت كلام إنجليزي ملوش لازمة أو ملوش علاقة بالسؤال، اتجاهله تماماً ومتكتبوش. اكتب بس المعلومات المفيدة." },
        { role: "user", content: context }
    ];

    try {
        const res = await axios.post("https://text.pollinations.ai/openai", { model: "mistral", messages, max_tokens: 1024 });
        return res.data.choices[0].message.content;
    } catch(e) {
        return "معلش يا محمد، حصل خطأ مؤقت. جرب تاني.";
    }
}

app.post('/ask', async (req, res) => {
    let { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "مفيش سؤال!" });

    const searchData = await searchGeneral(prompt);
    let finalAnswer = await synthesizeAnswer(prompt, searchData);

    res.json({ final: finalAnswer });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`✅ M.E Anti-Junk Search شغال على http://localhost:${PORT}`));
