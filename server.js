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

// 1. دالة الذكاء الاصطناعي (للكلام العادي بس)
async function askAI(messages) {
    try {
        const response = await axios.post("https://text.pollinations.ai/openai", {
            model: "mistral",
            messages: messages,
            max_tokens: 2048,
            temperature: 0.7
        });
        return response.data.choices[0].message.content;
    } catch (error) {
        return "ERROR_API";
    }
}

// 2. 🚨 صائد الأكواد (Code Hunter) - بيخش يدور ويستخرج الكود بس 🚨
async function huntForCode(query) {
    let extractedCodes = [];
    // بنخلي البحث مخصوص للأكواد
    let enhancedQuery = query + " code example github";
    
    try {
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(enhancedQuery)}&kp=-2`;
        const { data } = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
        const $ = cheerio.load(data);
        
        let links = [];
        $('.result__a').slice(0, 5).each((i, el) => {
            let href = $(el).attr('href');
            if (href && href.includes('uddg=')) {
                try { href = decodeURIComponent(href.split('uddg=')[1].split('&')[0]); } catch(e) {}
            }
            if (href && href.startsWith('http')) links.push(href);
        });

        // بنخش المواقع ونستخرج الأكواد
        for (let link of links) {
            try {
                const siteData = await axios.get(link, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 });
                const site$ = cheerio.load(siteData.data);
                
                site$('pre, code').each((i, el) => {
                    let codeText = site$(el).text().trim();
                    // شروط: الكود يكون أطول من 30 حرف، وفيه رموز برمجية
                    if (codeText.length > 30 && (codeText.includes('(') || codeText.includes('=') || codeText.includes('{'))) {
                        if (!extractedCodes.includes(codeText)) {
                            extractedCodes.push(codeText);
                        }
                    }
                });
                
                // لو لقينا 3 أكواد كويسة، كفاية كده
                if (extractedCodes.length >= 3) break;
            } catch(e) {}
        }
    } catch (e) {}
    
    return extractedCodes;
}

// 3. دالة البحث العادية (للمعلومات)
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

    // 2. 🚨 تفعيل وضع "صائد الأكواد" لو المستخدم طلب كود 🚨
    const isCodeRequest = /كود|سكريبت|برمجة|python|javascript|html|c\+\+|java|هاك|اختراق|هكر/i.test(prompt);
    
    if (isCodeRequest) {
        const codes = await huntForCode(prompt);
        if (codes.length > 0) {
            let codeAnswer = `### 💻 الكود اللي طلبته (تم استخراجه وتنقيته):\n\n`;
            codes.forEach((code) => {
                codeAnswer += `\`\`\`\n${code}\n\`\`\`\n\n`;
            });
            // بيرجع الكود بس من غير أي كلام إضافي
            return res.json({ final: codeAnswer });
        }
    }

    // 3. لو طلب صورة
    if (/ارسم|صورة|صور/i.test(prompt) && !isCodeRequest) {
        let cleanQuery = prompt.replace(/(ارسم|صورة|صور|لي|عن)/g, '').trim();
        let imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanQuery + ', highly detailed, 4k')}?width=1024&height=1024&nologo=true`;
        return res.json({ final: `### 🎨 الصورة اللي طلبتها:\n\n![صورة](${imgUrl})\n\n[⬇️ تحميل الصورة](${imgUrl})` });
    }

    // 4. الوضع العادي (AI يرد الأول)
    let messages = [{ role: "system", content: "أنت المساعد الخارق M.E. مطورك هو محمد. ردودك بالمصري، ذكية، مباشرة." }];
    if (history && history.length > 0) messages = messages.concat(history.slice(-10));
    messages.push({ role: "user", content: prompt });

    let finalAnswer = await askAI(messages);

    // 5. لو الـ AI رفض، نبحث ونرجع معلومات
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
app.listen(PORT, () => console.log(`✅ M.E Smart Agent شغال على http://localhost:${PORT}`));
