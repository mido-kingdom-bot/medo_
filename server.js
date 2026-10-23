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
    let results = { snippets: [], wiki: "", topSites: [], images: [], videos: [] };
    
    // لو المستخدم طلب صورة
    if (query.includes('ارسم') || query.includes('صورة') || query.includes('صور')) {
        let cleanQuery = query.replace(/(ارسم|صورة|صور|لي|عن)/g, '').trim();
        results.images.push(`https://image.pollinations.ai/prompt/${encodeURIComponent(cleanQuery + ', highly detailed, 4k')}?width=1024&height=1024&nologo=true`);
        return results; // لو طلب صورة بنرجع على طول
    }

    // لو المستخدم طلب فيديو
    if (query.includes('فيديو') || query.includes('يوتيوب')) {
        let cleanQuery = query.replace(/(فيديو|يوتيوب|لي|عن|جيب)/g, '').trim();
        results.videos.push(`https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQuery)}`);
    }

    try {
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kp=-2`;
        const { data } = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
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
        const wikiRes = await axios.get(wikiUrl);
        if (wikiRes.data.query.search.length > 0) results.wiki = wikiRes.data.query.search[0].snippet.replace(/<[^>]+>/g, '');
    } catch(e) {}
    
    return results;
}

app.post('/ask', async (req, res) => {
    let { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "مفيش سؤال!" });

    const searchData = await pureSearch(prompt);
    let finalAnswer = "";

    // لو رجع صور
    if (searchData.images.length > 0) {
        finalAnswer = `### 🎨 الصورة اللي طلبتها:\n\n![صورة](${searchData.images[0]})\n\n[⬇️ تحميل الصورة](${searchData.images[0]})`;
        return res.json({ final: finalAnswer, isImage: true });
    }

    finalAnswer = `### 🌐 نتائج البحث عن: ${prompt}\n\n`;
    
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
