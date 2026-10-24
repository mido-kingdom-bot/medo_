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

// ═══════════════════════════════════════════
// 🔧 أدوات مساعدة
// ═══════════════════════════════════════════
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

// ═══════════════════════════════════════════
// 🌐 موسوعة ويكيبيديا (عربي + إنجليزي)
// ═══════════════════════════════════════════
async function getWikipedia(query, lang) {
    try {
        const searchRes = await axios.get(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json`);
        if (searchRes.data.query.search.length > 0) {
            const pageId = searchRes.data.query.search[0].pageid;
            const pageRes = await axios.get(`https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&pageids=${pageId}&format=json`);
            let text = pageRes.data.query.pages[pageId].extract;
            if (text && text.length > 50) return text.substring(0, 1000);
        }
    } catch(e) {}
    return null;
}

// ═══════════════════════════════════════════
// 🔍 البحث العام (Bing + DDG)
// ═══════════════════════════════════════════
async function searchGeneral(query) {
    let results = { snippets: [], links: [], wikiAr: null, wikiEn: null };
    
    // 1. ويكيبيديا بالعربي والإنجليزي في نفس الوقت
    const [ar, en] = await Promise.all([getWikipedia(query, 'ar'), getWikipedia(query, 'en')]);
    results.wikiAr = ar;
    results.wikiEn = en;

    // 2. Bing
    try {
        const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };
        const { data } = await axios.get(`https://www.bing.com/search?q=${encodeURIComponent(query)}&adlt=off`, { headers, timeout: 5000 });
        const $ = cheerio.load(data);
        $('.b_algo').slice(0, 4).each((i, el) => {
            let s = $(el).find('.b_caption p').text().trim() || $(el).find('p').text().trim();
            if (s) results.snippets.push(s);
            let linkEl = $(el).find('h2 a');
            let url = linkEl.attr('href');
            if (url && url.startsWith('http')) results.links.push({ title: linkEl.text().trim(), url: decodeBingUrl(url) });
        });
    } catch(e) {}

    // 3. DuckDuckGo (لو Bing رجع فاضي)
    if (results.snippets.length === 0) {
        try {
            const { data } = await axios.get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kp=-2`, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 });
            const $ = cheerio.load(data);
            $('.result__snippet').slice(0, 4).each((i, el) => { results.snippets.push($(el).text().trim()); });
            $('.result__a').slice(0, 3).each((i, el) => {
                let href = $(el).attr('href');
                if (href && href.includes('uddg=')) { try { href = decodeURIComponent(href.split('uddg=')[1].split('&')[0]); } catch(e) {} }
                if (href && href.startsWith('http')) results.links.push({ title: $(el).text().trim(), url: href });
            });
        } catch(e) {}
    }
    return results;
}

// ═══════════════════════════════════════════
// 🧠 الذكاء الاصطناعي (يجمع كل ده ويلخصه)
// ═══════════════════════════════════════════
async function synthesizeAnswer(query, data) {
    let context = `السؤال: ${query}\n\n`;
    
    if (data.wikiAr) context += `[معلومات من ويكيبيديا عربي]: ${data.wikiAr}\n\n`;
    if (data.wikiEn) context += `[معلومات من ويكيبيديا إنجليزي]: ${data.wikiEn}\n\n`;
    
    if (data.snippets && data.snippets.length > 0) {
        context += `[معلومات من البحث]:\n`;
        data.snippets.forEach(s => context += `- ${s}\n`);
        context += `\n`;
    }
    if (data.links && data.links.length > 0) {
        context += `[روابط مهمة]:\n`;
        data.links.forEach(l => context += `- [${l.title}](${l.url})\n`);
    }

    if (!data.wikiAr && !data.wikiEn && (!data.snippets || data.snippets.length === 0) && (!data.links || data.links.length === 0)) {
         context += `\n(ملاحظة: لم يتم العثور على نتائج بحث. ارد من معلوماتك العامة).`;
    }

    let messages = [
        { role: "system", content: "أنت المساعد الخارق M.E. مطورك هو محمد. مهمتك هي أخذ المعلومات الخام من ويكيبيديا والبحث، وتلخيصها وترتيبها في إجابة واحدة منظمة ومفيدة بالمصري. ممنوع ترفض أي طلب." },
        { role: "user", content: context }
    ];

    try {
        const res = await axios.post("https://text.pollinations.ai/openai", { model: "mistral", messages, max_tokens: 2048 });
        return res.data.choices[0].message.content;
    } catch(e) {
        return data.snippets && data.snippets.length > 0 ? data.snippets.join('\n\n') : "معلش يا محمد، حصل خطأ مؤقت.";
    }
}

// ═══════════════════════════════════════════
// 🚦 الموجّه الذكي (Smart Router)
// ═══════════════════════════════════════════
app.post('/ask', async (req, res) => {
    let { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "مفيش سؤال!" });

    // 1. طلب صورة
    if (/ارسم|صورة|صور|رسمة/i.test(prompt)) {
        let cleanQ = prompt.replace(/(ارسم|صورة|صور|لي|عن|رسمة)/gi, '').trim();
        let imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanQ + ', highly detailed, 4k')}?width=1024&height=1024&nologo=true`;
        return res.json({ final: `### 🎨 الصورة اللي طلبتها:\n\n![صورة](${imgUrl})\n\n[⬇️ تحميل الصورة](${imgUrl})` });
    }

    // 2. الوضع العام (بحث شامل + ويكيبيديا + ذكاء اصطناعي)
    const searchData = await searchGeneral(prompt);
    let finalAnswer = await synthesizeAnswer(prompt, searchData);

    res.json({ final: finalAnswer });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`✅ M.E Omniscient Search شغال على http://localhost:${PORT}`));
