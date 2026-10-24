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

function decodeBingUrl(bingUrl) {
    try {
        if (bingUrl.includes('&u=a1')) {
            let b = bingUrl.split('&u=a1')[1].split('&')[0];
            while (b.length % 4 !== 0) b += '=';
            return Buffer.from(b, 'base64').toString('utf-8');
        }
    } catch(e) {}
    return bingUrl;
}

async function getWikipedia(query, lang) {
    try {
        const searchRes = await axios.get(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json`);
        if (searchRes.data.query.search.length > 0) {
            const pageId = searchRes.data.query.search[0].pageid;
            const pageRes = await axios.get(`https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&pageids=${pageId}&format=json`);
            let text = pageRes.data.query.pages[pageId].extract;
            if (text && text.length > 50) return text.substring(0, 600);
        }
    } catch(e) {}
    return null;
}

async function searchGeneral(query) {
    let results = { snippets: [], links: [], wikiAr: null };
    
    // تنظيف الكلام عشان ندور على الكلمة الأساسية بس
    let cleanQuery = query.replace(/(هات|عايز|موقع|تطبيق|لي|عن|ابحث|قوليلي|ممكن)/gi, '').trim();
    if(!cleanQuery) cleanQuery = query;

    // البحث في ويكيبيديا (مهم للمعلومات)
    results.wikiAr = await getWikipedia(cleanQuery, 'ar');

    // البحث في Bing
    try {
        const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };
        // لو بيدور على تطبيق، نضيف كلمة Google Play عشان نجيب الموقع الصح
        let searchTerm = cleanQuery;
        if (/تطبيق|موقع|app|site/i.test(query)) {
            searchTerm += ' official website OR google play';
        }
        
        const { data } = await axios.get(`https://www.bing.com/search?q=${encodeURIComponent(searchTerm)}&adlt=off`, { headers, timeout: 5000 });
        const $ = cheerio.load(data);
        
        $('.b_algo').slice(0, 4).each((i, el) => {
            let s = $(el).find('.b_caption p').text().trim() || $(el).find('p').text().trim();
            // فلترة النتايج الغبية (اللي فيها كلام قواميس أو آسيا)
            if (s && !s.includes('كأس آسيا') && !s.includes('translation') && s.length > 20) {
                results.snippets.push(s);
            }
            let linkEl = $(el).find('h2 a');
            let url = linkEl.attr('href');
            let title = linkEl.text().trim();
            if (url && url.startsWith('http') && title) {
                results.links.push({ title, url: decodeBingUrl(url) });
            }
        });
    } catch(e) {}

    return results;
}

async function synthesizeAnswer(query, data) {
    let context = `السؤال: ${query}\n\n`;
    if (data.wikiAr) context += `[ويكيبيديا]: ${data.wikiAr}\n\n`;
    
    if (data.snippets && data.snippets.length > 0) {
        context += `[معلومات من البحث]:\n`;
        data.snippets.forEach(s => context += `- ${s}\n`);
        context += `\n`;
    }
    if (data.links && data.links.length > 0) {
        context += `[روابط مهمة]:\n`;
        data.links.forEach(l => context += `- [${l.title}](${l.url})\n`);
    }

    // لو مفيش نتايج واضحة
    if (!data.wikiAr && (!data.snippets || data.snippets.length === 0) && (!data.links || data.links.length === 0)) {
        return "معلش يا محمد، دورت في الويب بس مفيش نتايج واضحة أو محرك البحث رفض يرجع حاجة. جرب تكتب اسم الحاجة بدقة أكتر (مثلاً: تطبيق أهل جوجل بلاي).";
    }

    let messages = [
        { role: "system", content: "أنت المساعد الخارق M.E. مهمتك تلخص المعلومات دي بالمصري في نقاط منظمة ومفيدة. لو طلب منك موقع أو تطبيق، اديله اللينك المباشر. ممنوع ترد بأي كلام إنجليزي أو معلومات ملوش لازمة." },
        { role: "user", content: context }
    ];

    try {
        const res = await axios.post("https://text.pollinations.ai/openai", { model: "mistral", messages, max_tokens: 2048 });
        return res.data.choices[0].message.content;
    } catch(e) {
        return "معلش يا محمد، حصل خطأ مؤقت في تلخيص المعلومات. جرب تاني.";
    }
}

app.post('/ask', async (req, res) => {
    let { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "مفيش سؤال!" });

    if (/ارسم|صورة|صور|رسمة/i.test(prompt)) {
        let cleanQ = prompt.replace(/(ارسم|صورة|صور|لي|عن|رسمة)/gi, '').trim();
        let imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanQ + ', highly detailed, 4k')}?width=1024&height=1024&nologo=true`;
        return res.json({ final: `### 🎨 الصورة اللي طلبتها:\n\n![صورة](${imgUrl})\n\n[⬇️ تحميل الصورة](${imgUrl})` });
    }

    const searchData = await searchGeneral(prompt);
    let finalAnswer = await synthesizeAnswer(prompt, finalAnswer, searchData);

    res.json({ final: finalAnswer });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`✅ M.E Filter Search شغال على http://localhost:${PORT}`));
