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

// دالة البحث في DuckDuckGo
async function searchDDG(query) {
    let results = { snippets: [], links: [] };
    try {
        const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };
        const { data } = await axios.get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kp=-2`, { headers, timeout: 5000 });
        const $ = cheerio.load(data);
        
        $('.result__snippet').slice(0, 4).each((i, el) => { 
            results.snippets.push($(el).text().trim()); 
        });
        
        $('.result__a').slice(0, 3).each((i, el) => {
            let href = $(el).attr('href');
            if (href && href.includes('uddg=')) { 
                try { href = decodeURIComponent(href.split('uddg=')[1].split('&')[0]); } catch(e) {} 
            }
            if (href && href.startsWith('http')) results.links.push({ title: $(el).text().trim(), url: href });
        });
    } catch(e) {}
    return results;
}

// دالة البحث في Bing (كاحتياطي)
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
        const { data } = await axios.get(`https://www.bing.com/search?q=${encodeURIComponent(query)}&adlt=off`, { headers, timeout: 5000 });
        const $ = cheerio.load(data);
        $('.b_algo').slice(0, 4).each((i, el) => {
            let s = $(el).find('.b_caption p').text().trim() || $(el).find('p').text().trim();
            // فلتر الكلام الإنجليزي العشوائي
            if (s && !s.includes('Comic Sans') && !s.includes('Achewood') && s.length > 20) {
                results.snippets.push(s);
            }
            let linkEl = $(el).find('h2 a');
            let url = linkEl.attr('href');
            if (url && url.startsWith('http')) results.links.push({ title: linkEl.text().trim(), url: decodeBingUrl(url) });
        });
    } catch(e) {}
    return results;
}

// الذكاء الاصطناعي للتنسيق
async function askAI(messages) {
    try {
        const res = await axios.post("https://text.pollinations.ai/openai", { model: "mistral", messages, max_tokens: 2048 }, { timeout: 8000 });
        return res.data.choices[0].message.content;
    } catch(e) {
        return null; 
    }
}

app.post('/ask', async (req, res) => {
    let { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "مفيش سؤال!" });

    // 1. الترحيب الذكي
    const greetings = ['ازيك', 'إزيك', 'هاي', 'اهلا', 'أهلا', 'hello', 'hi', 'صباح الخير', 'مساء الخير', 'اخبارك', 'عامل'];
    if (greetings.some(g => prompt.includes(g)) && prompt.length < 25) {
        return res.json({ final: `### 🤖 M.E Assistant\n\nأهلاً بك يا محمد! أنا بخير الحمد لله. أنا مساعدك الذكي، ممكن أبحثلك عن أي حاجة في الويب أو أجيبلك أكواد. عايز تعمل إيه النهاردة؟` });
    }

    // 2. الطلبات الممنوعة (عشان ميعملش "جاري البحث" ويتعلق)
    if (/سكس|اباحي|عاري|xxx|porn|نيك/i.test(prompt)) {
        return res.json({ final: `معلش يا محمد، محرك البحث والذكاء الاصطناعي بيرفضوا يرجعوا نتايج للمواضيع دي بسبب سياسات الأمان. جرب تسأل عن أي حاجة تانية مفيدة.` });
    }

    // 3. طلب صورة
    if (/ارسم|صورة|صور|رسمة/i.test(prompt)) {
        let cleanQ = prompt.replace(/(ارسم|صورة|صور|لي|عن|رسمة)/gi, '').trim();
        let imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanQ + ', highly detailed, 4k')}?width=1024&height=1024&nologo=true`;
        return res.json({ final: `### 🎨 الصورة اللي طلبتها:\n\n![صورة](${imgUrl})\n\n[⬇️ تحميل الصورة](${imgUrl})` });
    }

    // 4. تنظيف الكلام والبحث
    let cleanQuery = prompt.replace(/(هات|عايز|موقع|تطبيق|لي|عن|ابحث|قوليلي|ممكن|جيب|وريني|ازاي|إزاي)/gi, '').trim();
    if (!cleanQuery || cleanQuery.length < 2) cleanQuery = prompt;

    // بنجرب DuckDuckGo الأول
    let searchData = await searchDDG(cleanQuery);
    // لو مفيش نتايج، بنجرب Bing
    if (searchData.snippets.length === 0) {
        searchData = await searchBing(cleanQuery);
    }

    // لو مفيش نتايج خالص
    if (searchData.snippets.length === 0 && searchData.links.length === 0) {
        return res.json({ final: `معلش يا محمد، دورت على "${cleanQuery}" في الويب بس مفيش نتايج واضحة. جرب تكتب سؤالك بطريقة تانية.` });
    }

    // 5. تنسيق النتايج بالذكاء الاصطناعي
    let context = `السؤال: ${prompt}\nالمعلومات:\n`;
    searchData.snippets.forEach(s => context += `- ${s}\n`);
    if (searchData.links.length > 0) {
        context += `\nالروابط:\n`;
        searchData.links.forEach(l => context += `- [${l.title}](${l.url})\n`);
    }

    let finalAnswer = await askAI([
        { role: "system", content: "أنت المساعد M.E. لخص المعلومات دي بالمصري في نقاط منظمة. ممنوع تماماً تكتب أي كلام إنجليزي في الرد." },
        { role: "user", content: context }
    ]);

    // 6. لو الـ AI فشل أو رفض، نعرض النتايج الخام بالمصري
    if (!finalAnswer) {
        finalAnswer = `### 🌐 نتائج البحث عن: ${cleanQuery}\n\n`;
        searchData.snippets.forEach(s => finalAnswer += `- ${s}\n\n`);
        if(searchData.links.length > 0) {
            finalAnswer += `**🔗 روابط مهمة:**\n`;
            searchData.links.forEach(l => finalAnswer += `- [${l.title}](${l.url})\n`);
        }
    }

    res.json({ final: finalAnswer });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`✅ M.E Stable Search شغال على http://localhost:${PORT}`));
