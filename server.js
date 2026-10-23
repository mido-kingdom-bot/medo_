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

// 1. دالة الذكاء الاصطناعي (مخصصة للتعديل والردود)
async function askAI(messages) {
    try {
        const response = await axios.post("https://text.pollinations.ai/openai", {
            model: "mistral",
            messages: messages,
            max_tokens: 2048,
            temperature: 0.3 // درجة حرارة منخفضة عشان يركز في التعديل
        });
        return response.data.choices[0].message.content;
    } catch (error) {
        return "ERROR_API";
    }
}

// 2. دالة البحث في الويب (لاستخراج الكود أو المعلومات)
async function pureSearch(query) {
    let results = { snippets: [], wiki: "", topSites: [] };
    try {
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kp=-2`;
        const { data } = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
        const $ = cheerio.load(data);
        $('.result__snippet').slice(0, 4).each((i, el) => { results.snippets.push($(el).text().trim()); });
        $('.result__a').slice(0, 3).each((i, el) => {
            let href = $(el).attr('href');
            let title = $(el).text().trim();
            if (href && href.includes('uddg=')) { try { href = decodeURIComponent(href.split('uddg=')[1].split('&')[0]); } catch(e) {} }
            if (href && href.startsWith('http')) results.topSites.push({ title, url: href });
        });
    } catch (e) {}
    try {
        const wikiUrl = `https://ar.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json`;
        const wikiRes = await axios.get(wikiUrl);
        if (wikiRes.data.query.search.length > 0) results.wiki = wikiRes.data.query.search[0].snippet.replace(/<[^>]+>/g, '');
    } catch(e) {}
    return results;
}

app.post('/ask', async (req, res) => {
    let { prompt, history } = req.body;
    if (!prompt) return res.status(400).json({ error: "مفيش سؤال!" });

    // 1. الإجابة الإجبارية عن المبرمج
    if (/مين مبرمجك|مين مطورك|مين اللي عملك|مين صانعك/i.test(prompt)) {
        return res.json({ final: "### 🤖 M.E Assistant\n\nأنا تطبيق **M.E Assistant**، ومبرمجي ومطوري هو العبقري **محمد**. 🚀" });
    }

    // 2. طلب صورة
    if (/ارسم|صورة|صور/i.test(prompt)) {
        let cleanQuery = prompt.replace(/(ارسم|صورة|صور|لي|عن)/g, '').trim();
        let imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanQuery + ', highly detailed, 4k')}?width=1024&height=1024&nologo=true`;
        return res.json({ final: `### 🎨 الصورة اللي طلبتها:\n\n![صورة](${imgUrl})\n\n[⬇️ تحميل الصورة](${imgUrl})` });
    }

    // تجهيز الذاكرة
    let messages = [{ role: "system", content: "أنت المساعد الخارق M.E. مطورك هو محمد. إنت قادر على تعديل الأكواد والنصوص بناءً على طلب المستخدم. لو طلب منك تشيل كلمة أو تضيف كلمة أو تعدل سطر، نفذ التعديل فوراً واعرض النتيجة النهائية فقط." }];
    
    if (history && history.length > 0) {
        messages = messages.concat(history.slice(-10));
    }
    messages.push({ role: "user", content: prompt });

    // 3. الذكاء الاصطناعي يرد أو يعدل
    let finalAnswer = await askAI(messages);

    // 4. لو الذكاء الاصطناعي فشل (سيرفر واقع)، نستخدم البحث كاحتياطي
    if (finalAnswer === "ERROR_API" || finalAnswer.includes("لا يمكنني") || finalAnswer.includes("أنا آسف")) {
        const searchData = await pureSearch(prompt);
        finalAnswer = `### 🌐 تقرير البحث عن: ${prompt}\n\n`;
        if (searchData.wiki) finalAnswer += `**📖 من ويكيبيديا:**\n${searchData.wiki}\n\n`;
        if (searchData.snippets.length > 0) {
            finalAnswer += `**📌 معلومات:**\n\n`;
            searchData.snippets.forEach(snip => finalAnswer += `- ${snip}\n\n`);
        }
        if (searchData.topSites.length > 0) {
            finalAnswer += `**🔗 مصادر:**\n\n`;
            searchData.topSites.forEach(site => finalAnswer += `- [${site.title}](${site.url})\n`);
        }
    }

    res.json({ final: finalAnswer });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`✅ M.E Smart Editor شغال على http://localhost:${PORT}`));
