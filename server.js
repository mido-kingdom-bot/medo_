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

// 1. محرك البحث الخام
async function searchWeb(query) {
    let results = { snippets: [], links: [] };
    try {
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kp=-2`;
        const { data } = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 });
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
            if (href && href.startsWith('http') && title) results.links.push({ title, url: href });
        });
    } catch (e) {}
    
    // لو مفيش نتايج، نجرب Bing
    if (results.snippets.length === 0) {
        try {
            const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&adlt=off`;
            const { data } = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 });
            const $ = cheerio.load(data);
            $('.b_algo').slice(0, 4).each((i, el) => {
                let s = $(el).find('.b_caption p').text().trim() || $(el).find('p').text().trim();
                if (s && s.length > 20) results.snippets.push(s);
                let linkEl = $(el).find('h2 a');
                let url = linkEl.attr('href');
                let title = linkEl.text().trim();
                if (url && url.startsWith('http') && title) results.links.push({ title, url });
            });
        } catch (e) {}
    }
    return results;
}

// 2. نظام الفهم البرمجي (Rule-Based System)
app.post('/ask', async (req, res) => {
    let { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "مفيش سؤال!" });

    let finalAnswer = "";
    let cleanQuery = prompt.replace(/(هات|عايز|موقع|تطبيق|لي|عن|ابحث|قوليلي|ممكن|جيب|وريني)/gi, '').trim();
    if (!cleanQuery) cleanQuery = prompt;

    // 🚨 القاعدة 1: لو طلب صورة
    if (/ارسم|صورة|صور|رسمة/i.test(prompt)) {
        let imgQuery = prompt.replace(/(ارسم|صورة|صور|لي|عن|رسمة)/gi, '').trim();
        let imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(imgQuery + ', highly detailed, 4k')}?width=1024&height=1024&nologo=true`;
        return res.json({ final: `### 🎨 الصورة اللي طلبتها:\n\n![صورة](${imgUrl})\n\n[⬇️ تحميل الصورة](${imgUrl})` });
    }

    // 🚨 القاعدة 2: لو طلب كود
    if (/كود|سكريبت|برمجة|python|javascript|html|c\+\+|java/i.test(prompt)) {
        let codeSearch = `code example ${cleanQuery}`;
        let searchData = await searchWeb(codeSearch);
        
        finalAnswer = `### 💻 أكواد جاهزة عن: "${cleanQuery}"\n\n`;
        if (searchData.snippets.length > 0) {
            searchData.snippets.forEach(s => finalAnswer += `- ${s}\n\n`);
        }
        if (searchData.links.length > 0) {
            finalAnswer += `**🔗 مصادر الأكواد:**\n`;
            searchData.links.forEach(l => finalAnswer += `- [${l.title}](${l.url})\n`);
        }
        if (searchData.snippets.length === 0 && searchData.links.length === 0) {
            finalAnswer = "معلش يا محمد، دورت على أكواد بس مفيش نتايج.";
        }
        return res.json({ final: finalAnswer });
    }

    // 🚨 القاعدة 3: الكلام العادي (ترحيب أو كلام بسيط)
    const greetings = ['ازيك', 'إزيك', 'هاي', 'اهلا', 'أهلا', 'hello', 'hi', 'صباح الخير', 'مساء الخير', 'اخبارك', 'عامل'];
    if (greetings.some(g => prompt.includes(g)) && prompt.length < 20) {
        return res.json({ final: `### 🤖 M.E Assistant\n\nأهلاً بك يا محمد! أنا مساعدك الذكي. أنا مكنة بحث بتفهمك من غير قيود. عايز تبحث عن إيه النهاردة؟` });
    }

    // 🚨 القاعدة 4: البحث العادي (لو مفيش قاعدة تانية اشتغلت)
    let searchData = await searchWeb(cleanQuery);
    
    finalAnswer = `### 🌐 نتائج البحث عن: "${cleanQuery}"\n\n`;
    if (searchData.snippets.length > 0) {
        finalAnswer += `**📌 المعلومات:**\n\n`;
        searchData.snippets.forEach((snip, index) => finalAnswer += `[${index + 1}] ${snip}\n\n`);
    }
    if (searchData.links.length > 0) {
        finalAnswer += `**🔗 المواقع:**\n\n`;
        searchData.links.forEach((site) => finalAnswer += `- [${site.title}](${site.url})\n`);
    }
    if (searchData.snippets.length === 0 && searchData.links.length === 0) {
        finalAnswer = "معلش يا محمد، محرك البحث رجع صفحة فاضية (مفيش نتايج). جرب تسأل بكلمة تانية.";
    }

    res.json({ final: finalAnswer });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`✅ M.E Smart Rule-Based Search شغال على http://localhost:${PORT}`));
