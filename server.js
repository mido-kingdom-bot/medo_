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

// 1. البحث في DuckDuckGo
async function searchDDG(query) {
    let results = { snippets: [], links: [] };
    try {
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kp=-2`;
        const { data } = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, timeout: 5000 });
        const $ = cheerio.load(data);
        
        $('.result__snippet').slice(0, 5).each((i, el) => { 
            results.snippets.push($(el).text().trim()); 
        });
        
        $('.result__a').slice(0, 4).each((i, el) => {
            let href = $(el).attr('href');
            let title = $(el).text().trim();
            if (href && href.includes('uddg=')) {
                try { href = decodeURIComponent(href.split('uddg=')[1].split('&')[0]); } catch(e) {}
            }
            if (href && href.startsWith('http')) results.links.push({ title, url: href });
        });
    } catch (e) {}
    return results;
}

// 2. البحث في Bing (احتياطي)
async function searchBing(query) {
    let results = { snippets: [], links: [] };
    try {
        const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&adlt=off`;
        const { data } = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, timeout: 5000 });
        const $ = cheerio.load(data);
        
        $('.b_algo').slice(0, 4).each((i, el) => {
            let s = $(el).find('.b_caption p').text().trim() || $(el).find('p').text().trim();
            if (s && !s.includes('Comic Sans') && !s.includes('Achewood') && s.length > 20) {
                results.snippets.push(s);
            }
            let linkEl = $(el).find('h2 a');
            let url = linkEl.attr('href');
            let title = linkEl.text().trim();
            if (url && url.startsWith('http')) results.links.push({ title, url });
        });
    } catch (e) {}
    return results;
}

// 3. البحث في ويكيبيديا
async function getWikipedia(query) {
    try {
        const wikiUrl = `https://ar.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json`;
        const wikiRes = await axios.get(wikiUrl, { timeout: 4000 });
        if (wikiRes.data.query.search.length > 0) {
            return wikiRes.data.query.search[0].snippet.replace(/<[^>]+>/g, '');
        }
    } catch(e) {}
    return null;
}

app.post('/ask', async (req, res) => {
    let { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "مفيش سؤال!" });

    // 1. طلب صورة
    if (/ارسم|صورة|صور|رسمة/i.test(prompt)) {
        let cleanQ = prompt.replace(/(ارسم|صورة|صور|لي|عن|رسمة)/gi, '').trim();
        let imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanQ + ', highly detailed, 4k')}?width=1024&height=1024&nologo=true`;
        return res.json({ final: `### 🎨 الصورة اللي طلبتها:\n\n![صورة](${imgUrl})\n\n[⬇️ تحميل الصورة](${imgUrl})` });
    }

    // 2. تنظيف الكلام للبحث
    let cleanQuery = prompt.replace(/(هات|عايز|موقع|تطبيق|لي|عن|ابحث|قوليلي|ممكن|جيب|وريني|ازاي|إزاي)/gi, '').trim();
    if (!cleanQuery || cleanQuery.length < 2) cleanQuery = prompt;

    // 3. البحث (دك دك جو -> بينج -> ويكيبيديا)
    let searchData = await searchDDG(cleanQuery);
    let wikiData = await getWikipedia(cleanQuery);

    if (searchData.snippets.length === 0) {
        searchData = await searchBing(cleanQuery);
    }

    // 4. تنسيق النتيجة
    let finalAnswer = `### 🌐 نتائج البحث عن: "${cleanQuery}"\n\n`;

    if (wikiData) {
        finalAnswer += `**📖 من ويكيبيديا:**\n${wikiData}\n\n`;
    }

    if (searchData.snippets.length > 0) {
        finalAnswer += `**📌 معلومات من الويب:**\n\n`;
        searchData.snippets.forEach((snip, index) => {
            finalAnswer += `[${index + 1}] ${snip}\n\n`;
        });
    }

    if (searchData.links.length > 0) {
        finalAnswer += `**🔗 أهم المصادر:**\n\n`;
        searchData.links.forEach((site) => {
            finalAnswer += `- [${site.title}](${site.url})\n`;
        });
    }

    // 5. لو مفيش أي نتايج
    if (!wikiData && searchData.snippets.length === 0 && searchData.links.length === 0) {
        finalAnswer = "معلش يا محمد، محرك البحث رجع صفحة فاضية (مفيش نتايج). جرب تسأل بطريقة تانية أو بكلمة أوضح.";
    }

    res.json({ final: finalAnswer });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`✅ M.E Pure Machine Search شغال على http://localhost:${PORT}`));
