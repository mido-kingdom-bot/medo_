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

// 1. دالة البحث عن كود في الويب
async function huntForCode(query) {
    let extractedCodes = [];
    let enhancedQuery = query + " code example github";
    try {
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(enhancedQuery)}&kp=-2`;
        const { data } = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(data);
        
        let links = [];
        $('.result__a').slice(0, 5).each((i, el) => {
            let href = $(el).attr('href');
            if (href && href.includes('uddg=')) {
                try { href = decodeURIComponent(href.split('uddg=')[1].split('&')[0]); } catch(e) {}
            }
            if (href && href.startsWith('http')) links.push(href);
        });

        for (let link of links) {
            try {
                const siteData = await axios.get(link, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 });
                const site$ = cheerio.load(siteData.data);
                
                site$('pre, code').each((i, el) => {
                    let codeText = site$(el).text().trim();
                    if (codeText.length > 30 && (codeText.includes('(') || codeText.includes('=') || codeText.includes('{'))) {
                        if (!extractedCodes.includes(codeText)) {
                            extractedCodes.push(codeText);
                        }
                    }
                });
                if (extractedCodes.length >= 2) break;
            } catch(e) {}
        }
    } catch (e) {}
    return extractedCodes;
}

// 2. دالة البحث العامة
async function pureSearch(query) {
    let results = { snippets: [], wiki: "", topSites: [] };
    try {
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kp=-2`;
        const { data } = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(data);
        $('.result__snippet').slice(0, 4).each((i, el) => { results.snippets.push($(el).text().trim()); });
        $('.result__a').slice(0, 3).each((i, el) => {
            let href = $(el).attr('href');
            let title = $(el).text().trim();
            if (href && href.includes('uddg=')) { try { href = decodeURIComponent(href.split('uddg=')[1].split('&')[0]); } catch(e) {} }
            if (href && href.startsWith('http')) results.topSites.push({ title, url: href });
        });
    } catch (e) {}
    return results;
}

app.post('/ask', async (req, res) => {
    let { prompt, history } = req.body;
    if (!prompt) return res.status(400).json({ error: "مفيش سؤال!" });

    // 🚨 1. التعديل المباشر (بدون أي ذكاء اصطناعي) 🚨
    // بيدور على أوامر زي: شيل كلمة X وحط Y
    const editMatch = prompt.match(/شيل\s+(.*?)\s+(?:وحط|وحطلي|وحط\s+مكانه|وضع)\s+(.*)/i) || 
                      prompt.match(/غير\s+(.*?)\s+(?:ل|إلى)\s+(.*)/i) ||
                      prompt.match(/استبدل\s+(.*?)\s+(?:بـ|ب)\s+(.*)/i);
    
    if (editMatch && history && history.length > 0) {
        const wordToRemove = editMatch[1].trim();
        const wordToAdd = editMatch[2].trim();
        
        // بندور على آخر رسالة فيها كود
        const lastAiMsg = history.slice().reverse().find(m => m.role === 'assistant' && m.content.includes('```'));
        
        if (lastAiMsg) {
            const codeMatch = lastAiMsg.content.match(/```(?:[a-z]+)?\n?([\s\S]*?)```/);
            if (codeMatch) {
                let originalCode = codeMatch[1];
                // التعديل المباشر (String Replace)
                let modifiedCode = originalCode.split(wordToRemove).join(wordToAdd);
                
                let finalAnswer = `### 💻 تم تعديل الكود (بدون ذكاء اصطناعي):\n\n`;
                finalAnswer += `> تم استبدال **"${wordToRemove}"** بـ **"${wordToAdd}"**.\n\n`;
                finalAnswer += `\`\`\`\n${modifiedCode}\n\`\`\`\n`;
                
                return res.json({ final: finalAnswer });
            }
        }
    }

    // 2. الإجابة الإجبارية عن المبرمج
    if (/مين مبرمجك|مين مطورك|مين اللي عملك|مين صانعك/i.test(prompt)) {
        return res.json({ final: "### 🤖 M.E Assistant\n\nأنا تطبيق **M.E Assistant**، ومبرمجي ومطوري هو العبقري **محمد**. 🚀" });
    }

    // 3. طلب صورة
    if (/ارسم|صورة|صور/i.test(prompt)) {
        let cleanQuery = prompt.replace(/(ارسم|صورة|صور|لي|عن)/g, '').trim();
        let imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanQuery + ', highly detailed, 4k')}?width=1024&height=1024&nologo=true`;
        return res.json({ final: `### 🎨 الصورة اللي طلبتها:\n\n![صورة](${imgUrl})\n\n[⬇️ تحميل الصورة](${imgUrl})` });
    }

    // 4. طلب كود جديد
    const isCodeRequest = /كود|سكريبت|برمجة|python|javascript|html|c\+\+|java/i.test(prompt);
    
    if (isCodeRequest) {
        const codes = await huntForCode(prompt);
        if (codes.length > 0) {
            let codeAnswer = `### 💻 الكود اللي طلبته:\n\n`;
            codes.forEach((code) => {
                codeAnswer += `\`\`\`\n${code}\n\`\`\`\n\n`;
            });
            return res.json({ final: codeAnswer });
        } else {
             return res.json({ final: "معلش يا محمد، دورت في المواقع بس ملقيتش كود واضح." });
        }
    }

    // 5. بحث عام
    const searchData = await pureSearch(prompt);
    let finalAnswer = `### 🌐 تقرير البحث عن: ${prompt}\n\n`;
    if (searchData.snippets.length > 0) {
        finalAnswer += `**📌 معلومات:**\n\n`;
        searchData.snippets.forEach(snip => finalAnswer += `- ${snip}\n\n`);
    }
    if (searchData.topSites.length > 0) {
        finalAnswer += `**🔗 مصادر:**\n\n`;
        searchData.topSites.forEach(site => finalAnswer += `- [${site.title}](${site.url})\n`);
    }

    if (searchData.snippets.length === 0 && searchData.topSites.length === 0) {
         finalAnswer = "معلش يا محمد، مفيش نتايج.";
    }

    res.json({ final: finalAnswer });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`✅ M.E Pure Code Editor شغال على http://localhost:${PORT}`));
