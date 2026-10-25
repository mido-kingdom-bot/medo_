const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const { exec } = require('child_process');
const FlexSearch = require('flexsearch');
const { parsePhoneNumberFromString } = require('libphonenumber-js');
require('dotenv').config();

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));
app.use((req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

// 🧠 بناء محرك البحث المحلي
let index = new FlexSearch.Document({ document: { id: "id", index: ["title", "keywords", "content"] } });
let knowledgeBase = [];
try {
    knowledgeBase = JSON.parse(fs.readFileSync('./knowledge.json', 'utf8'));
    knowledgeBase.forEach((item, i) => { item.id = i; index.add(item); });
    console.log(`✅ تم فهرسة ${knowledgeBase.length} معلومة.`);
} catch(e) {}

function runTool(command) {
    return new Promise((resolve) => {
        exec(command, { timeout: 60000 }, (error, stdout, stderr) => {
            if (error) return resolve(`❌ خطأ:\n${stderr || error.message}`);
            resolve(`✅ **النتيجة:**\n\n\`\`\`text\n${stdout.substring(0, 2000)}\n\`\`\``);
        });
    });
}

app.post('/ask', async (req, res) => {
    let { prompt, user, tool, history } = req.body; 
    if (!user) user = "صديقي";
    let p = prompt ? prompt.trim() : "";
    let pLower = p.toLowerCase();

    // ==========================================
    // 🌐 1. محرك البحث (Search Engine)
    // ==========================================
    if (tool === 'search_engine') {
        try {
            let q = encodeURIComponent(p);
            const { data } = await axios.get(`https://html.duckduckgo.com/html/?q=${q}`, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 });
            const $ = cheerio.load(data);
            let results = [];
            
            $('.result__body').slice(0, 5).each((i, el) => {
                let title = $(el).find('.result__title').text().trim().replace(/\s+/g, ' ');
                let snippet = $(el).find('.result__snippet').text().trim().replace(/https?:\/\/[^\s]+/g, '').replace(/\s+/g, ' ');
                let link = $(el).find('.result__url').attr('href');
                
                if (link && link.includes('uddg=')) {
                    try { link = decodeURIComponent(link.split('uddg=')[1].split('&')[0]); } catch(e) {}
                }

                if (snippet.length > 20) {
                    results.push(`**[${i+1}] ${title}**\n${snippet.substring(0, 200)}...\n🔗 [رابط المصدر](${link})`);
                }
            });

            if (results.length > 0) return res.json({ final: `### 🌐 نتائج البحث عن: "${p}"\n\n${results.join('\n\n---\n\n')}` });
            else return res.json({ final: `معلش يا ${user}، مفيش نتايج واضحة.` });
        } catch (e) {
            return res.json({ final: `❌ حصل خطأ في الاتصال بمحرك البحث.` });
        }
    }

    // ==========================================
    // ⚡ 2. تنفيذ الأدوات (Nmap, إلخ)
    // ==========================================
    if (pLower.includes('nmap') || pLower.includes('namp')) {
        let targetMatch = p.match(/((?:\d{1,3}\.){3}\d{1,3})|([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (!targetMatch) return res.json({ final: `اكتب IP أو دومين. (مثال: نفذ nmap على 8.8.8.8)` });
        return res.json({ final: `⏳ جاري فحص: **${targetMatch[0]}**...\n\n` + await runTool(`nmap -F ${targetMatch[0]}`) });
    }

    // ==========================================
    // 🧠 3. العقل الذكي (Local AI Search)
    // ==========================================
    if (tool === 'ai_brain') {
        let searchQuery = p;
        if (history && history.length > 0) searchQuery += " " + history[history.length - 1];

        let searchResults = index.search(searchQuery, { limit: 3, enrich: true });
        
        if (searchResults && searchResults.length > 0) {
            let bestMatch = knowledgeBase[searchResults[0].result[0]];
            let aiResponse = `بناءً على اللي إنت طلبته، لقيت دي في المكتبة:\n\n**📌 ${bestMatch.title}**\n${bestMatch.content.substring(0, 1000)}...\n\n*(جرب تسألني عن تفاصيل أكتر).*`;
            return res.json({ final: aiResponse });
        }
        
        // لو ملقاش، يدور في النت
        try {
            const { data } = await axios.get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(p)}`, { timeout: 8000 });
            const $ = cheerio.load(data);
            let webSnippets = [];
            $('.result__snippet').slice(0, 2).each((i, el) => webSnippets.push($(el).text().trim()));
            if (webSnippets.length > 0) return res.json({ final: `ملقيتش في مكتبتي، بس لقيت في النت:\n\n🌐\n${webSnippets.join('\n\n')}` });
        } catch(e) {}

        return res.json({ final: `يا ${user}، مش لاقي إجابة. جرب تسأل بطريقة تانية.` });
    }

    res.json({ final: `أهلاً يا ${user}. اختار أداة من القائمة عشان أقدر أساعدك.` });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`✅ M.E Complete Server شغال!`));
