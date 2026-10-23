const express = require('express');
const axios = require('axios');
const cors = require('cors');
const cheerio = require('cheerio');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

async function pureSearch(query) {
    let results = { snippets: [], wiki: "", topSites: [] };
    try {
        // 🚨 التعديل السحري هنا: &kp=-2 بيلغي البحث الآمن
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kp=-2`;
        
        const { data } = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
        const $ = cheerio.load(data);
        
        $('.result__snippet').slice(0, 6).each((i, el) => { results.snippets.push($(el).text().trim()); });
        
        let links = [];
        $('.result__a').slice(0, 3).each((i, el) => {
            let href = $(el).attr('href');
            if (href && href.includes('uddg=')) href = decodeURIComponent(href.split('uddg=')[1].split('&')[0]);
            if (href && href.startsWith('http')) links.push(href);
        });
        
        for (let link of links) {
            try {
                const siteData = await axios.get(link, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 4000 });
                const site$ = cheerio.load(siteData.data);
                site$('script, style, nav, footer, header, aside').remove();
                let text = site$('body').text().replace(/\s+/g, ' ').trim();
                if(text.length > 100) results.topSites.push({ url: link, text: text.substring(0, 700) + '...' });
            } catch(e) {}
        }
    } catch (e) {}
    
    try {
        const wikiUrl = `https://ar.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json`;
        const wikiRes = await axios.get(wikiUrl);
        if (wikiRes.data.query.search.length > 0) results.wiki = wikiRes.data.query.search[0].snippet.replace(/<[^>]+>/g, '');
    } catch(e) {}
    
    return results;
}

app.post('/ask', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "مفيش سؤال!" });
    
    const searchData = await pureSearch(prompt);
    let finalAnswer = `### 🌐 تقرير البحث المباشر عن: "${prompt}"\n\n`;
    
    if (searchData.wiki) finalAnswer += `**📖 من ويكيبيديا:**\n${searchData.wiki}\n\n`;
    
    if (searchData.snippets.length > 0) {
        finalAnswer += `**📌 ملخصات سريعة من الويب:**\n`;
        searchData.snippets.forEach((snip) => finalAnswer += `- ${snip}\n`);
        finalAnswer += `\n`;
    }
    
    if (searchData.topSites.length > 0) {
        finalAnswer += `**🔗 تفاصيل من أهم المصادر:**\n`;
        searchData.topSites.forEach((site, i) => finalAnswer += `*مصدر ${i+1}*\n${site.text}\n\n`);
    }
    
    if (searchData.snippets.length === 0 && !searchData.wiki && searchData.topSites.length === 0) {
        finalAnswer = "معلش يا محمد، دورت في كل حتة بس مفيش نتايج واضحة للسؤال ده.";
    }
    
    res.json({ final: finalAnswer });
});

const PORT = 3000;
app.get('/ping', (req, res) => res.send('ALIVE'));
app.listen(PORT, () => console.log(`✅ M.E Pure Search شغال على http://localhost:${PORT}`));
