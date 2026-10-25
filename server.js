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

// 🧠 تحميل العقل والفهرس
let index = new FlexSearch.Document({ document: { id: "id", index: ["title", "keywords", "content"] } });
let knowledgeBase = [];
function loadBrain() {
    try {
        knowledgeBase = JSON.parse(fs.readFileSync('./knowledge.json', 'utf8'));
        knowledgeBase.forEach((item, i) => { item.id = i; index.add(item); });
        console.log(`✅ تم تحميل ${knowledgeBase.length} معلومة.`);
    } catch(e) {}
}
loadBrain();

// 🚨 دالة التعلم الذاتي (بتبحث في النت وتحفظ)
async function autoLearn(topic) {
    try {
        let query = encodeURIComponent(topic + " cybersecurity programming tutorial");
        const { data } = await axios.get(`https://html.duckduckgo.com/html/?q=${query}`, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 });
        const $ = cheerio.load(data);
        
        let learnedSnippets = [];
        $('.result__snippet').slice(0, 3).each((i, el) => {
            let text = $(el).text().trim();
            if(text.length > 50) learnedSnippets.push(text);
        });

        if (learnedSnippets.length > 0) {
            let newEntry = {
                title: `معلومات متعلمة عن: ${topic}`,
                keywords: `${topic} security hacking learn`,
                content: learnedSnippets.join('\n\n')
            };
            // بنضيف المعلومة للملف
            knowledgeBase.push(newEntry);
            fs.writeFileSync('./knowledge.json', JSON.stringify(knowledgeBase, null, 2));
            loadBrain(); // بنعيد بناء الفهرس
            return true;
        }
        return false;
    } catch(e) { return false; }
}

// دالة تنفيذ الأوامر
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

    // 🚨 1. ميزة التعلم الذاتي
    if (pLower.startsWith('اتعلم عن') || pLower.startsWith('درب نفسك على')) {
        let topic = p.replace(/(اتعلم عن|درب نفسك على)/i, '').trim();
        if(!topic) return res.json({ final: "اكتب الموضوع اللي عايز أتعلمه. (مثال: اتعلم عن SQL Injection)" });
        
        let success = await autoLearn(topic);
        if (success) return res.json({ final: `🧠 **تم التعلم بنجاح يا ${user}!**\nأنا روحت النت، بحثت عن "${topic}"، ولقطت أهم المعلومات وحفظتها في ذاكرتي الدائمة.` });
        else return res.json({ final: `❌ مقدرتش أتعلم عن "${topic}". جرب موضوع تاني أو تأكد من النت.` });
    }

    // 🚨 2. محرك البحث الشامل
    if (tool === 'search_engine') {
        try {
            let q = encodeURIComponent(p);
            const { data } = await axios.get(`https://html.duckduckgo.com/html/?q=${q}`, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 });
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

    // 🚨 3. العقل الذكي (البحث المحلي)
    if (tool === 'ai_brain' || !tool) {
        let searchResults = index.search(p, { limit: 3, enrich: true });
        if (searchResults && searchResults.length > 0) {
            let bestMatch = knowledgeBase[searchResults[0].result[0]];
            return res.json({ final: `بناءً على طلبك يا ${user}، لقيت دي في ذاكرتي:\n\n**📌 ${bestMatch.title}**\n${bestMatch.content.substring(0, 1000)}...` });
        }
        
        // لو ملقاش، يدور في النت
        try {
            const { data } = await axios.get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(p)}`, { timeout: 8000 });
            const $ = cheerio.load(data);
            let webSnippets = [];
            $('.result__snippet').slice(0, 2).each((i, el) => webSnippets.push($(el).text().trim()));
            if (webSnippets.length > 0) return res.json({ final: `ملقيتش في ذاكرتي، بس بحثت في النت ولقيت:\n\n🌐\n${webSnippets.join('\n\n')}` });
        } catch(e) {}

        return res.json({ final: `يا ${user}، مش لاقي إجابة. جرب تسأل بطريقة تانية أو اكتب "اتعلم عن [موضوع]" عشان أضيفه لدماغي.` });
    }

    // 🚨 4. تنفيذ الأدوات
    if (pLower.includes('nmap') || pLower.includes('namp')) {
        let targetMatch = p.match(/((?:\d{1,3}\.){3}\d{1,3})|([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (!targetMatch) return res.json({ final: `اكتب IP أو دومين.` });
        return res.json({ final: `⏳ جاري فحص: **${targetMatch[0]}**...\n\n` + await runTool(`nmap -F ${targetMatch[0]}`) });
    }

    res.json({ final: `أهلاً يا ${user}. اختار أداة من القائمة، أو اكتب "اتعلم عن [موضوع]" عشان أطور نفسي.` });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`✅ M.E Self-Learning Server شغال!`));
