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

// 1. دالة البحث في جوجل
async function searchGoogle(query) {
    let results = { snippets: [], links: [] };
    try {
        const headers = { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'ar,en-US;q=0.9'
        };
        const { data } = await axios.get(`https://www.google.com/search?q=${encodeURIComponent(query)}&hl=ar&num=5`, { headers, timeout: 6000 });
        const $ = cheerio.load(data);
        
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

// 2. دالة البحث في Bing
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

// 3. الذكاء الاصطناعي (موديل OpenAI للترجمة والتنسيق)
async function askAI(messages) {
    try {
        const res = await axios.post("https://text.pollinations.ai/openai", { 
            model: "openai", // موديل أقوى في الترجمة والتنسيق
            messages: messages, 
            max_tokens: 2048 
        });
        return res.data.choices[0].message.content;
    } catch(e) {
        return null; 
    }
}

app.post('/ask', async (req, res) => {
    let { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "مفيش سؤال!" });

    // الردود السريعة
    const greetings = /^(ازيك|إزيك|هاي|اهلا|أهلا|hello|hi|صباح الخير|مساء الخير|اخبارك|عامل ايه|لا|نعم|تمام|ماشي)$/i;
    if (greetings.test(prompt.trim())) {
        return res.json({ final: `### 🤖 M.E Assistant\n\nأهلاً بك يا محمد! أنا بخير الحمد لله. أنا مساعدك الذكي، ممكن أبحثلك عن أي حاجة في الويب أو أجيبلك أكواد. عايز تعمل إيه النهاردة؟` });
    }

    // طلب صورة
    if (/ارسم|صورة|صور|رسمة/i.test(prompt)) {
        let cleanQ = prompt.replace(/(ارسم|صورة|صور|لي|عن|رسمة)/gi, '').trim();
        let imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanQ + ', highly detailed, 4k')}?width=1024&height=1024&nologo=true`;
        return res.json({ final: `### 🎨 الصورة اللي طلبتها:\n\n![صورة](${imgUrl})\n\n[⬇️ تحميل الصورة](${imgUrl})` });
    }

    // 🚨 تنظيف الكلام عشان البحث يطلع صح 🚨
    let cleanQuery = prompt.replace(/(هات|عايز|موقع|تطبيق|لي|عن|ابحث|قوليلي|ممكن|جيب|وريني|ازاي|إزاي)/gi, '').trim();
    if (!cleanQuery || cleanQuery.length < 2) cleanQuery = prompt; // لو الكلام كله اتشال، نرجع للأصل

    // البحث (جوجل الأول، ولو فشل بنجرب Bing)
    let searchData = await searchGoogle(cleanQuery);
    if (searchData.snippets.length === 0) {
        searchData = await searchBing(cleanQuery);
    }

    // لو مفيش نتايج خالص
    if (searchData.snippets.length === 0 && searchData.links.length === 0) {
        return res.json({ final: `معلش يا محمد، دورت على "${cleanQuery}" في الويب بس محرك البحث رفض يرجع نتايج واضحة. جرب تسأل بطريقة أوضح أو عن حاجة تانية.` });
    }

    // تنسيق النتايج
    let context = `السؤال الأصلي: ${prompt}\nكلمة البحث: ${cleanQuery}\n\nالمعلومات من البحث:\n`;
    searchData.snippets.forEach(s => context += `- ${s}\n`);
    if (searchData.links.length > 0) {
        context += `\nالروابط:\n`;
        searchData.links.forEach(l => context += `- [${l.title}](${l.url})\n`);
    }

    let finalAnswer = await askAI([
        { role: "system", content: "أنت المساعد M.E. لخص المعلومات دي بالمصري بشكل منظم ومفيد جداً. ممنوع تماماً تكتب أي حرف إنجليزي في الرد. ترجم كل حاجة للعربية. لو فيه معلومة ملوش لازمة أو إعلانات، تجاهلها." },
        { role: "user", content: context }
    ]);

    // 🚨 لو الذكاء الاصطناعي فشل، منعرضش الإنجليزي 🚨
    if (!finalAnswer) {
        finalAnswer = `معلش يا محمد، محرك البحث رجع نتايج إنجليزية ملخبطة ومقدرتش أترجمها. جرب تسأل بطريقة تانية.`;
    }

    res.json({ final: finalAnswer });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`✅ M.E Clean Search شغال على http://localhost:${PORT}`));
