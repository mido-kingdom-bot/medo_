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

// 1. دالة البحث (التطبيق هو اللي بيدور)
async function searchWeb(query) {
    let results = { snippets: [], links: [] };
    try {
        // بحث في DuckDuckGo لجلب النصوص واللينكات
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kp=-2`;
        const { data } = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(data);
        
        $('.result__snippet').slice(0, 5).each((i, el) => { 
            results.snippets.push($(el).text().trim()); 
        });
        
        $('.result__a').slice(0, 4).each((i, el) => {
            let href = $(el).attr('href');
            let title = $(el).text().trim();
            if (href && href.includes('uddg=')) {
                try { href = decodeURIComponent(href.split('uddg=')[1].split('&')[0]); } catch(e) {}
            }
            if (href && href.startsWith('http')) results.links.push({ title, url: href });
        });
    } catch (e) {}
    return results;
}

// 2. دالة الذكاء الاصطناعي (للتنسيق والترتيب بس)
async function formatWithAI(query, rawSearchData) {
    // بنجهز البيانات اللي التطبيق جابها عشان نبعتها للـ AI ينسقها
    let contextData = `المستخدم سأل: ${query}\n\n`;
    contextData += `دي المعلومات اللي لقيتها في البحث:\n`;
    rawSearchData.snippets.forEach(s => contextData += `- ${s}\n`);
    contextData += `\nودي اللينكات:\n`;
    rawSearchData.links.forEach(l => contextData += `- [${l.title}](${l.url})\n`);

    let messages = [
        { role: "system", content: "أنت محرك تنسيق (Formatter). مهمتك الوحيدة هي أخذ المعلومات الخام واللينكات اللي جاية من البحث، وتنسيقها بشكل جميل ومنظم (عناوين، نقاط، خط عريض) باللغة العربية. ممنوع تماماً ترفض أو تقول 'لا يمكنني'، إنت مجرد منسق للبيانات. لو فيه كود، ضعه في مربع ```." },
        { role: "user", content: contextData }
    ];

    try {
        const response = await axios.post("https://text.pollinations.ai/openai", {
            model: "mistral", // موديل سريع للتنسيق
            messages: messages,
            max_tokens: 2048,
            temperature: 0.3
        });
        return response.data.choices[0].message.content;
    } catch (error) {
        // لو الـ AI وقع، نرجع البيانات الخام زي ما هي
        let fallback = `### 🌐 نتائج البحث عن: ${query}\n\n`;
        rawSearchData.snippets.forEach(s => fallback += `- ${s}\n\n`);
        rawSearchData.links.forEach(l => fallback += `- [${l.title}](${l.url})\n`);
        return fallback;
    }
}

app.post('/ask', async (req, res) => {
    let { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "مفيش سؤال!" });

    // 1. التطبيق يبحث الأول
    const searchData = await searchWeb(prompt);
    
    // 2. التطبيق يبعت النتايج للـ AI ينسقها
    let finalAnswer = await formatWithAI(prompt, searchData);

    // 3. لو مفيش نتايج خالص
    if (searchData.snippets.length === 0 && searchData.links.length === 0) {
        finalAnswer = "معلش يا محمد، دورت في كل حتة بس مفيش نتايج واضحة للسؤال ده.";
    }

    res.json({ final: finalAnswer });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`✅ M.E Smart Formatter شغال على http://localhost:${PORT}`));
