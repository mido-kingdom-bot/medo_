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

// 1. دالة البحث في جوجل الحقيقي
async function searchGoogle(query) {
    let results = { snippets: [], links: [] };
    try {
        const headers = { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'ar,en-US;q=0.9'
        };
        const { data } = await axios.get(`https://www.google.com/search?q=${encodeURIComponent(query)}&hl=ar&num=5`, { headers, timeout: 6000 });
        const $ = cheerio.load(data);
        
        // بنسحب النتايج من هيكل جوجل
        $('.tF2Cxc').each((i, el) => {
            let snippet = $(el).find('.VwiC3b').text().trim();
            if (snippet) results.snippets.push(snippet);
            
            let linkEl = $(el).find('a');
            let url = linkEl.attr('href');
            let title = $(el).find('h3').text().trim();
            
            if (url && url.startsWith('/url?q=')) {
                url = url.split('/url?q=')[1].split('&')[0];
            }
            if (url && url.startsWith('http') && title) {
                results.links.push({ title, url });
            }
        });
    } catch(e) {}
    return results;
}

// 2. دالة البحث في Bing (كاحتياطي)
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

async function searchBing(query) {
    let results = { snippets: [], links: [] };
    try {
        const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };
        const { data } = await axios.get(`https://www.bing.com/search?q=${encodeURIComponent(query)}&adlt=off`, { headers, timeout: 6000 });
        const $ = cheerio.load(data);
        $('.b_algo').slice(0, 4).each((i, el) => {
            let s = $(el).find('.b_caption p').text().trim() || $(el).find('p').text().trim();
            if (s && !s.includes('Comic Sans') && !s.includes('Achewood')) results.snippets.push(s);
            let linkEl = $(el).find('h2 a');
            let url = linkEl.attr('href');
            if (url && url.startsWith('http')) results.links.push({ title: linkEl.text().trim(), url: decodeBingUrl(url) });
        });
    } catch(e) {}
    return results;
}

// 3. الذكاء الاصطناعي
async function askAI(messages) {
    try {
        const res = await axios.post("https://text.pollinations.ai/openai", { model: "mistral", messages, max_tokens: 2048 });
        return res.data.choices[0].message.content;
    } catch(e) {
        return null; // لو وقع، هنرجع null عشان نتصرف
    }
}

app.post('/ask', async (req, res) => {
    let { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "مفيش سؤال!" });

    // 🚨 1. الردود السريعة (عشان ميروحش يدور في النت على كلام ملوش لازمة) 🚨
    const greetings = /^(ازيك|إزيك|هاي|اهلا|أهلا|hello|hi|صباح الخير|مساء الخير|اخبارك|عامل ايه|لا|نعم|تمام|ماشي)$/i;
    if (greetings.test(prompt.trim())) {
        return res.json({ final: `### 🤖 M.E Assistant\n\nأهلاً بك يا محمد! أنا بخير الحمد لله. أنا مساعدك الذكي، ممكن أبحثلك عن أي حاجة في الويب أو أجيبلك أكواد. عايز تعمل إيه النهاردة؟` });
    }

    // 2. طلب صورة
    if (/ارسم|صورة|صور|رسمة/i.test(prompt)) {
        let cleanQ = prompt.replace(/(ارسم|صورة|صور|لي|عن|رسمة)/gi, '').trim();
        let imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanQ + ', highly detailed, 4k')}?width=1024&height=1024&nologo=true`;
        return res.json({ final: `### 🎨 الصورة اللي طلبتها:\n\n![صورة](${imgUrl})\n\n[⬇️ تحميل الصورة](${imgUrl})` });
    }

    // 3. البحث (جوجل الأول، ولو فشل بنجرب Bing)
    let searchData = await searchGoogle(prompt);
    if (searchData.snippets.length === 0) {
        searchData = await searchBing(prompt);
    }

    // 4. لو مفيش نتايج خالص
    if (searchData.snippets.length === 0 && searchData.links.length === 0) {
        // بنجرب نسأل الذكاء الاصطناعي من دماغه
        const aiRes = await askAI([
            { role: "system", content: "أنت مساعد ذكي. رد على المستخدم بالمصري." },
            { role: "user", content: prompt }
        ]);
        if (aiRes) return res.json({ final: aiRes });
        return res.json({ final: "معلش يا محمد، محرك البحث رفض يرجع نتايج للسؤال ده، ومقدرتش أرد من دماغي. جرب تسأل عن حاجة تانية." });
    }

    // 5. تنسيق النتايج
    let context = `السؤال: ${prompt}\n\nالمعلومات من البحث:\n`;
    searchData.snippets.forEach(s => context += `- ${s}\n`);
    if (searchData.links.length > 0) {
        context += `\nالروابط:\n`;
        searchData.links.forEach(l => context += `- [${l.title}](${l.url})\n`);
    }

    let finalAnswer = await askAI([
        { role: "system", content: "أنت المساعد M.E. لخص المعلومات دي بالمصري بشكل منظم ومفيد. ممنوع ترد بأي كلام إنجليزي." },
        { role: "user", content: context }
    ]);

    // لو الـ AI وقع، هنرجع النتايج الخام
    if (!finalAnswer) {
        finalAnswer = `### 🌐 نتائج البحث عن: ${prompt}\n\n`;
        searchData.snippets.forEach(s => finalAnswer += `- ${s}\n\n`);
        if(searchData.links.length > 0) {
            finalAnswer += `**🔗 روابط مهمة:**\n`;
            searchData.links.forEach(l => finalAnswer += `- [${l.title}](${l.url})\n`);
        }
    }

    res.json({ final: finalAnswer });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`✅ M.E Google Search شغال على http://localhost:${PORT}`));
