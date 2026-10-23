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
    let results = { snippets: [], wiki: "", topSites: [] };
    try {
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kp=-2`;
        const { data } = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
        const $ = cheerio.load(data);
        
        $('.result__snippet').slice(0, 5).each((i, el) => { 
            results.snippets.push($(el).text().trim()); 
        });
        
        let links = [];
        $('.result__a').slice(0, 3).each((i, el) => {
            let href = $(el).attr('href');
            let title = $(el).text().trim();
            if (href && href.includes('uddg=')) href = decodeURIComponent(href.split('uddg=')[1].split('&')[0]);
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
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "مفيش سؤال!" });
    
    const searchData = await pureSearch(prompt);
    let finalAnswer = `### 🌐 نتائج البحث عن: "${prompt}"\n\n`;
    
    if (searchData.wiki) finalAnswer += `**📖 من ويكيبيديا:**\n${searchData.wiki}\n\n`;
    
    if (searchData.snippets.length > 0) {
        finalAnswer += `**📌 معلومات من الويب:**\n\n`;
        searchData.snippets.forEach((snip, index) => {
            finalAnswer += `[${index + 1}] ${snip}\n\n`;
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
app.listen(PORT, () => console.log(`✅ M.E Pure Search شغال على http://localhost:${PORT}`));
