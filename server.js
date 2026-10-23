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
    let results = { snippets: [], wiki: "", topSites: [], codes: [] };
    
    // هل المستخدم بيدور على كود؟
    const isCodeSearch = /كود|سكريبت|برمجة|python|javascript|html|c\+\+|java|سيبراني|امن/i.test(query);

    try {
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kp=-2`;
        const { data } = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
        const $ = cheerio.load(data);
        
        $('.result__snippet').slice(0, 3).each((i, el) => { 
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

        // بنخش المواقع عشان نستخرج حاجة
        for (let link of links) {
            try {
                const siteData = await axios.get(link.url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 4000 });
                const site$ = cheerio.load(siteData.data);
                
                if (isCodeSearch) {
                    // لو بيدور على كود، بنستخرج الأكواد بس من الـ <pre>
                    let foundCode = [];
                    site$('pre').each((i, el) => {
                        let txt = site$(el).text().trim();
                        if (txt.length > 20) foundCode.push(txt);
                    });
                    if (foundCode.length > 0) {
                        results.codes.push({ title: link.title, code: foundCode.join('\n\n// --- \n\n') });
                        continue; // كفاية كده
                    }
                }
                
                site$('script, style, nav, footer, header, aside').remove();
                let text = site$('body').text().replace(/\s+/g, ' ').trim();
                if(text.length > 100) results.topSites.push({ url: link.url, title: link.title, text: text.substring(0, 400) + '...' });
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
    let { prompt, history } = req.body;
    if (!prompt) return res.status(400).json({ error: "مفيش سؤال!" });

    const greetings = ['ازيك', 'إزيك', 'عامل ايه', 'اخبارك', 'صباح الخير', 'مساء الخير', 'مين انت', 'انت مين'];
    if (greetings.some(g => prompt.toLowerCase().includes(g))) {
        return res.json({ final: `### 🤖 M.E Search\n\nأهلاً بك يا محمد! أنا بخير الحمد لله. أنا **محرك البحث الخاص بك**. اكتب أي حاجة عايز تدور عليها.` });
    }

    let finalQuery = prompt;
    if (prompt.length < 15 && history && history.length > 0) {
        const lastUserMsg = history.slice().reverse().find(m => m.role === 'user');
        if (lastUserMsg && !greetings.some(g => lastUserMsg.content.includes(g))) {
            finalQuery = `${lastUserMsg.content} ${prompt}`; 
        }
    }
    finalQuery = finalQuery.replace(/(ابحث لي عن|ابحث عن|عايز اعرف|قوليلي|هات لي|من فضلك|لو سمحت|ممكن)/gi, '').trim();

    const searchData = await pureSearch(finalQuery);
    let finalAnswer = `### 🌐 نتائج البحث عن: ${finalQuery}\n\n`;

    // لو لقينا أكواد
    if (searchData.codes.length > 0) {
        finalAnswer += `**💻 أكواد تم العثور عليها:**\n\n`;
        searchData.codes.forEach(c => {
            finalAnswer += `*من: ${c.title}*\n`;
            finalAnswer += `\`\`\`\n${c.code}\n\`\`\`\n\n`;
        });
    } 
    // لو معلومات عادية
    else {
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
    
    if (searchData.codes.length === 0 && searchData.snippets.length === 0 && !searchData.wiki) {
        finalAnswer = "معلش يا محمد، دورت في كل حتة بس مفيش نتايج واضحة.";
    }
    
    res.json({ final: finalAnswer });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`✅ M.E Smart Code Search شغال على http://localhost:${PORT}`));
