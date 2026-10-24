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

async function pureSearch(query) {
    let results = { snippets: [], wiki: "", topSites: [], images: [], videos: [] };
    
    // لو المستخدم طلب صورة
    if (query.includes('ارسم') || query.includes('صورة') || query.includes('صور')) {
        let cleanQuery = query.replace(/(ارسم|صورة|صور|لي|عن)/g, '').trim();
        results.images.push(`https://image.pollinations.ai/prompt/${encodeURIComponent(cleanQuery + ', highly detailed, 4k')}?width=1024&height=1024&nologo=true`);
        return results; 
    }

    // لو المستخدم طلب فيديو
    if (query.includes('فيديو') || query.includes('يوتيوب')) {
        let cleanQuery = query.replace(/(فيديو|يوتيوب|لي|عن|جيب)/g, '').trim();
        results.videos.push(`https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQuery)}`);
    }

    try {
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kp=-2`;
        const { data } = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, timeout: 5000 });
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
    
    try {
        const wikiUrl = `https://ar.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json`;
        const wikiRes = await axios.get(wikiUrl, { timeout: 4000 });
        if (wikiRes.data.query.search.length > 0) results.wiki = wikiRes.data.query.search[0].snippet.replace(/<[^>]+>/g, '');
    } catch(e) {}
    
    return results;
}

app.post('/ask', async (req, res) => {
    let { prompt, history } = req.body;
    if (!prompt) return res.status(400).json({ error: "مفيش سؤال!" });

    // الترحيب الذكي
    const greetings = ['ازيك', 'إزيك', 'ازايك', 'عامل ايه', 'اخبارك', 'صباح الخير', 'مساء الخير', 'مين انت', 'انت مين'];
    const promptLower = prompt.toLowerCase().trim();
    if (greetings.some(g => promptLower.includes(g))) {
        return res.json({ final: `### 🤖 M.E Search\n\nأهلاً بك يا محمد! أنا بخير الحمد لله. أنا **محرك البحث الخاص بك**. اكتب أي حاجة عايز تدور عليها وأنا هجبلك المعلومات واللينكات.` });
    }

    // ذاكرة المحادثة
    let finalQuery = prompt;
    if (prompt.length < 15 && history && history.length > 0) {
        const lastUserMsg = history.slice().reverse().find(m => m.role === 'user');
        if (lastUserMsg && !greetings.some(g => lastUserMsg.content.includes(g))) {
            finalQuery = `${lastUserMsg.content} ${prompt}`; 
        }
    }

    // تنظيف البحث
    const stopWords = /(ابحث لي عن|ابحث عن|عايز اعرف|قوليلي|هات لي|من فضلك|لو سمحت|ممكن|هات|جيب|عايز|موقع|تطبيق)/gi;
    finalQuery = finalQuery.replace(stopWords, '').trim();
    if (!finalQuery) finalQuery = prompt;

    // البحث الفعلي
    const searchData = await pureSearch(finalQuery);
    let finalAnswer = "";

    if (searchData.images.length > 0) {
        finalAnswer = `### 🎨 الصورة اللي طلبتها:\n\n![صورة](${searchData.images[0]})\n\n[⬇️ تحميل الصورة](${searchData.images[0]})`;
        return res.json({ final: finalAnswer, isImage: true });
    }

    finalAnswer = `### 🌐 نتائج البحث عن: ${finalQuery}\n\n`;
    
    if (searchData.wiki) finalAnswer += `**📖 من ويكيبيديا:**\n${searchData.wiki}\n\n`;
    
    if (searchData.snippets.length > 0) {
        finalAnswer += `**📌 معلومات:**\n\n`;
        searchData.snippets.forEach((snip) => finalAnswer += `- ${snip}\n\n`);
    }
    
    if (searchData.topSites.length > 0) {
        finalAnswer += `**🔗 أهم المصادر:**\n\n`;
        searchData.topSites.forEach((site) => finalAnswer += `- [${site.title}](${site.url})\n`);
    }

    if (searchData.videos.length > 0) {
        finalAnswer += `\n**🎬 فيديوهات:**\n\n- [اضغط هنا لمشاهدة الفيديوهات](${searchData.videos[0]})\n`;
    }
    
    if (searchData.snippets.length === 0 && !searchData.wiki && searchData.topSites.length === 0) {
        finalAnswer = "معلش يا محمد، دورت في كل حتة بس مفيش نتايج واضحة.";
    }
    
    res.json({ final: finalAnswer });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`✅ M.E Ultimate Search شغال على http://localhost:${PORT}`));
