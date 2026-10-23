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

// دالة البحث العميق
async function pureSearch(query) {
    let results = { snippets: [], wiki: "", topSites: [] };
    
    // 1. البحث في DuckDuckGo
    try {
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kp=-2`;
        const { data } = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
        const $ = cheerio.load(data);
        
        $('.result__snippet').slice(0, 4).each((i, el) => { 
            results.snippets.push($(el).text().replace(/\s+/g, ' ').trim()); 
        });
        
        let links = [];
        $('.result__a').slice(0, 3).each((i, el) => {
            let href = $(el).attr('href');
            let title = $(el).text().trim();
            if (href && href.includes('uddg=')) {
                try { href = decodeURIComponent(href.split('uddg=')[1].split('&')[0]); } catch(e) {}
            }
            if (href && href.startsWith('http')) links.push({ title, url: href });
        });
        results.topSites = links;
    } catch (e) {}
    
    // 2. البحث في ويكيبيديا (مهم للأسئلة المعرفية)
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

    // 🚨 1. الذكاء البسيط (ردود الترحيب والكلام العادي)
    const greetings = ['ازيك', 'إزيك', 'ازايك', 'عامل ايه', 'اخبارك', 'صباح الخير', 'مساء الخير', 'مين انت', 'انت مين'];
    const promptLower = prompt.toLowerCase().trim();
    
    if (greetings.some(g => promptLower.includes(g))) {
        return res.json({ final: `### 🤖 M.E Search\n\nأهلاً بك يا محمد! أنا بخير الحمد لله. أنا **محرك البحث الخاص بك**. اكتب أي حاجة عايز تدور عليها وأنا هجبلك المعلومات واللينكات.` });
    }

    // 🚨 2. ذاكرة المحادثة (لو السؤال قصير، ندمجه مع اللي قبله)
    let finalQuery = prompt;
    if (prompt.length < 15 && history && history.length > 0) {
        const lastUserMsg = history.slice().reverse().find(m => m.role === 'user');
        if (lastUserMsg && !greetings.some(g => lastUserMsg.content.includes(g))) {
            // لو السؤال الجديد كلمة واحدة أو كلمتين، نضيفه للسؤال القديم
            finalQuery = `${lastUserMsg.content} ${prompt}`; 
        }
    }

    // 🚨 3. تنظيف البحث (شيل الكلمات الزيادة)
    const stopWords = /(ابحث لي عن|ابحث عن|عايز اعرف|قوليلي|هات لي|من فضلك|لو سمحت|ممكن)/gi;
    finalQuery = finalQuery.replace(stopWords, '').trim();

    // لو مفيش كلام بعد التنظيف، نرجع للسؤال الأصلي
    if (!finalQuery) finalQuery = prompt;

    // 4. البحث الفعلي
    const searchData = await pureSearch(finalQuery);
    
    // 5. تنسيق النتيجة
    let finalAnswer = `### 🌐 تقرير البحث عن: ${finalQuery}\n\n`;
    
    if (searchData.wiki) {
        finalAnswer += `**📖 من ويكيبيديا:**\n${searchData.wiki}\n\n`;
    }
    
    if (searchData.snippets.length > 0) {
        finalAnswer += `**📌 معلومات من الويب:**\n\n`;
        searchData.snippets.forEach((snip) => {
            finalAnswer += `- ${snip}\n\n`;
        });
    }
    
    if (searchData.topSites.length > 0) {
        finalAnswer += `**🔗 أهم المصادر:**\n\n`;
        searchData.topSites.forEach((site) => {
            finalAnswer += `- [${site.title}](${site.url})\n`;
        });
    }
    
    if (searchData.snippets.length === 0 && !searchData.wiki && searchData.topSites.length === 0) {
        finalAnswer = "معلش يا محمد، دورت في كل حتة بس مفيش نتايج واضحة للسؤال ده.";
    }
    
    res.json({ final: finalAnswer });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`✅ M.E Smart Search شغال على http://localhost:${PORT}`));
