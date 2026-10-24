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

// 1. محرك بحث جوجل
async function searchGoogle(query) {
    let results = { snippets: [], links: [] };
    try {
        const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };
        const { data } = await axios.get(`https://www.google.com/search?q=${encodeURIComponent(query)}&hl=ar&num=5`, { headers, timeout: 4000 });
        const $ = cheerio.load(data);
        $('.tF2Cxc').each((i, el) => {
            let snippet = $(el).find('.VwiC3b').text().trim();
            if (snippet) results.snippets.push(snippet);
            let linkEl = $(el).find('a');
            let url = linkEl.attr('href');
            let title = $(el).find('h3').text().trim();
            if (url && url.startsWith('/url?q=')) url = url.split('/url?q=')[1].split('&')[0];
            if (url && url.startsWith('http') && title) results.links.push({ title, url });
        });
    } catch(e) {}
    return results;
}

// 2. محرك بحث بينج (مع فك التشفير وفلتر الكلام الغبي)
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

async function searchBing(query) {
    let results = { snippets: [], links: [] };
    try {
        const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };
        const { data } = await axios.get(`https://www.bing.com/search?q=${encodeURIComponent(query)}&adlt=off`, { headers, timeout: 4000 });
        const $ = cheerio.load(data);
        $('.b_algo').slice(0, 4).each((i, el) => {
            let s = $(el).find('.b_caption p').text().trim() || $(el).find('p').text().trim();
            if (s && !s.includes('Comic Sans') && !s.includes('Achewood') && s.length > 20) results.snippets.push(s);
            let linkEl = $(el).find('h2 a');
            let url = linkEl.attr('href');
            if (url && url.startsWith('http')) results.links.push({ title: linkEl.text().trim(), url: decodeBingUrl(url) });
        });
    } catch(e) {}
    return results;
}

// 3. محرك بحث دك دك جو
async function searchDDG(query) {
    let results = { snippets: [], links: [] };
    try {
        const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };
        const { data } = await axios.get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kp=-2`, { headers, timeout: 4000 });
        const $ = cheerio.load(data);
        $('.result__snippet').slice(0, 4).each((i, el) => { results.snippets.push($(el).text().trim()); });
        $('.result__a').slice(0, 3).each((i, el) => {
            let href = $(el).attr('href');
            if (href && href.includes('uddg=')) { try { href = decodeURIComponent(href.split('uddg=')[1].split('&')[0]); } catch(e) {} }
            if (href && href.startsWith('http')) results.links.push({ title: $(el).text().trim(), url: href });
        });
    } catch(e) {}
    return results;
}

// 4. الذكاء الاصطناعي (كاحتياطي أخير)
async function askAI(messages) {
    try {
        const res = await axios.post("https://text.pollinations.ai/openai", { model: "mistral", messages, max_tokens: 1500 }, { timeout: 6000 });
        return res.data.choices[0].message.content;
    } catch(e) { return null; }
}

app.post('/ask', async (req, res) => {
    let { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "مفيش سؤال!" });

    // الترحيب
    const greetings = ['ازيك', 'إزيك', 'هاي', 'اهلا', 'أهلا', 'hello', 'hi', 'صباح الخير', 'مساء الخير', 'اخبارك', 'عامل'];
    if (greetings.some(g => prompt.includes(g)) && prompt.length < 25) {
        return res.json({ final: `### 🤖 M.E Assistant\n\nأهلاً بك يا محمد! أنا بخير الحمد لله. عايز تبحث عن إيه النهاردة؟` });
    }

    // الطلبات الممنوعة (عشان ميعملش "جاري البحث" ويتعلق)
    if (/سكس|اباحي|عاري|xxx|porn|نيك/i.test(prompt)) {
        return res.json({ final: `معلش يا محمد، محرك البحث والذكاء الاصطناعي بيرفضوا يرجعوا نتايج للمواضيع دي بسبب سياسات الأمان. جرب تسأل عن أي حاجة تانية مفيدة.` });
    }

    // طلب صورة
    if (/ارسم|صورة|صور|رسمة/i.test(prompt)) {
        let cleanQ = prompt.replace(/(ارسم|صورة|صور|لي|عن|رسمة)/gi, '').trim();
        let imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanQ + ', highly detailed, 4k')}?width=1024&height=1024&nologo=true`;
        return res.json({ final: `### 🎨 الصورة اللي طلبتها:\n\n![صورة](${imgUrl})\n\n[⬇️ تحميل الصورة](${imgUrl})` });
    }

    // تنظيف الكلام
    let cleanQuery = prompt.replace(/(هات|عايز|موقع|تطبيق|لي|عن|ابحث|قوليلي|ممكن|جيب|وريني|ازاي|إزاي)/gi, '').trim();
    if (!cleanQuery || cleanQuery.length < 2) cleanQuery = prompt;

    // 🚨 نظام النسخ الاحتياطية (Fallback) 🚨
    let searchData = { snippets: [], links: [] };
    let source = "";

    // 1. جوجل
    searchData = await searchGoogle(cleanQuery);
    if (searchData.snippets.length > 0) source = "Google";
    
    // 2. بينج
    if (searchData.snippets.length === 0) {
        searchData = await searchBing(cleanQuery);
        if (searchData.snippets.length > 0) source = "Bing";
    }

    // 3. دك دك جو
    if (searchData.snippets.length === 0) {
        searchData = await searchDDG(cleanQuery);
        if (searchData.snippets.length > 0) source = "DuckDuckGo";
    }

    // 4. لو كل محركات البحث رفضت، نستخدم الذكاء الاصطناعي
    if (searchData.snippets.length === 0 && searchData.links.length === 0) {
        const aiRes = await askAI([
            { role: "system", content: "أنت مساعد ذكي. رد على المستخدم بالمصري." },
            { role: "user", content: prompt }
        ]);
        if (aiRes) return res.json({ final: aiRes });
        return res.json({ final: `معلش يا محمد، محركات البحث رفضت ترجع نتايج، ومقدرتش أرد من دماغي. جرب تسأل عن حاجة تانية.` });
    }

    // 5. تنسيق النتايج
    let context = `السؤال: ${prompt}\nالمصدر: ${source}\nالمعلومات:\n`;
    searchData.snippets.forEach(s => context += `- ${s}\n`);
    if (searchData.links.length > 0) {
        context += `\nالروابط:\n`;
        searchData.links.forEach(l => context += `- [${l.title}](${l.url})\n`);
    }

    let finalAnswer = await askAI([
        { role: "system", content: "أنت المساعد M.E. لخص المعلومات دي بالمصري في نقاط منظمة. ممنوع تماماً تكتب أي كلام إنجليزي في الرد. لو فيه معلومة ملوش لازمة أو إعلانات، تجاهلها." },
        { role: "user", content: context }
    ]);

    // 6. لو الذكاء الاصطناعي فشل، نعرض النتايج الخام
    if (!finalAnswer) {
        finalAnswer = `### 🌐 نتائج البحث (من ${source}) عن: ${cleanQuery}\n\n`;
        searchData.snippets.forEach(s => finalAnswer += `- ${s}\n\n`);
        if(searchData.links.length > 0) {
            finalAnswer += `**🔗 روابط مهمة:**\n`;
            searchData.links.forEach(l => finalAnswer += `- [${l.title}](${l.url})\n`);
        }
    }

    res.json({ final: finalAnswer });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`✅ M.E Multi-Fallback Search شغال على http://localhost:${PORT}`));
