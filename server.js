const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const session = require('express-session');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static(__dirname));
app.use(session({ secret: 'm-e-secret', resave: false, saveUninitialized: true }));

// 🚨 كلمة السر بتاعتك للتحكم في البوت (غيرها لأي حاجة إنت عايزها)
const ADMIN_SECRET = "M_E_BOSS_2026"; 

let knowledgeBase = [];
try { knowledgeBase = JSON.parse(fs.readFileSync('./knowledge.json', 'utf8')); } catch(e) {}
let components = {};
try { components = JSON.parse(fs.readFileSync('./components.json', 'utf8')); } catch(e) {}

console.log(`🧠 تم تحميل ${knowledgeBase.length} معلومة.`);

// دالة التعلم الذاتي
async function learnFromInternet(topic) {
    try {
        let query = encodeURIComponent(topic + " cybersecurity tutorial coding");
        const { data } = await axios.get(`https://html.duckduckgo.com/html/?q=${query}`, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 });
        const $ = cheerio.load(data);
        let learned = [];
        $('.result__snippet').slice(0, 2).each((i, el) => { let text = $(el).text().trim(); if (text.length > 40) learned.push(text); });
        
        if (learned.length > 0) {
            knowledgeBase.push({ title: `متعلم ذاتياً: ${topic}`, keywords: `${topic} security coding`, content: learned.join('\n\n') });
            fs.writeFileSync('./knowledge.json', JSON.stringify(knowledgeBase, null, 2));
            return true;
        }
        return false;
    } catch (e) { return false; }
}

// مسارات التسجيل
const usersFile = './users.json';
app.post('/register', (req, res) => { 
    let users = fs.existsSync(usersFile) ? JSON.parse(fs.readFileSync(usersFile)) : [];
    users.push({ username: req.body.username, password: req.body.password }); 
    fs.writeFileSync(usersFile, JSON.stringify(users));
    req.session.user = req.body.username; res.json({ success: true });
});
app.post('/login', (req, res) => { 
    let users = fs.existsSync(usersFile) ? JSON.parse(fs.readFileSync(usersFile)) : [];
    let user = users.find(u => u.username === req.body.username && u.password === req.body.password);
    if(user) { req.session.user = user.username; res.json({ success: true }); } else res.json({ success: false });
});

// 🚨 الشات وغرفة التحكم
app.post('/ask', async (req, res) => {
    let { prompt } = req.body;
    if (!req.session.user) return res.status(401).json({ final: "سجل دخول الأول." });

    // ==========================================
    // 👑 غرفة التحكم (God Mode) - للمدير بس
    // ==========================================
    if (prompt.startsWith('#admin')) {
        let args = prompt.split(' ');
        let providedSecret = args[1];

        // لو كلمة السر غلط
        if (providedSecret !== ADMIN_SECRET) {
            return res.json({ final: "❌ كلمة السر غلط! إنت مش المدير." });
        }

        let command = args[2]; // learn أو addcode

        // أمر التعلم الذاتي المباشر
        if (command === 'learn') {
            let topic = args.slice(3).join(' ');
            if (!topic) return res.json({ final: "اكتب الموضوع بعد الأمر. مثال: #admin M_E_BOSS_2026 learn SQL Injection" });
            
            let success = await learnFromInternet(topic);
            if (success) return res.json({ final: `👑 **يا مدير!** أنا اتعلمت معلومات جديدة عن "${topic}" وحفظتها في دماغي.` });
            else return res.json({ final: `❌ يا مدير، مش لاقي معلومات عن "${topic}".` });
        }

        // أمر إضافة كود جديد للمخزن
        if (command === 'addcode') {
            let lang = args[3];
            let name = args[4];
            // الكود هيبقى كل الكلام اللي بعد اسم الكود
            let codeString = prompt.split(args[4])[1].trim(); 

            if (!lang || !name || !codeString) return res.json({ final: "الاستخدام: #admin [SECRET] addcode [python/js] [اسم الكود] [الكود نفسه]" });

            if (!components[lang]) components[lang] = {};
            components[lang][name] = codeString;
            fs.writeFileSync('./components.json', JSON.stringify(components, null, 2));
            
            return res.json({ final: `👑 **يا مدير!** أضفت كود "${name}" للغة ${lang} في مخزن قطع الغيار بتاعي.` });
        }

        return res.json({ final: "👑 أوامر المدير المتاحة: learn أو addcode" });
    }

    // ==========================================
    // الأوامر العادية (للمستخدمين)
    // ==========================================
    let p = prompt.toLowerCase();

    // التعلم الذاتي العادي
    if (p.includes('درب نفسك')) {
        let topics = ["Python socket programming", "XSS prevention", "Linux security", "SQL injection"];
        let count = 0;
        for (let t of topics) { if (await learnFromInternet(t)) count++; await new Promise(r => setTimeout(r, 1000)); }
        return res.json({ final: `🧠 تم التدريب! جمعت معلومات عن ${count} مواضيع جديدة من النت.` });
    }

    // البحث في العقل
    let match = knowledgeBase.find(item => item.keywords.toLowerCase().includes(p) || item.title.toLowerCase().includes(p));
    if (match) return res.json({ final: `🧠 **${match.title}**\n${match.content}` });

    res.json({ final: "مش لاقي المعلومة دي. اطلب من المدير يدربني أو يضيفلي أكواد!" });
});

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`✅ M.E God Mode Server شغال!`));
