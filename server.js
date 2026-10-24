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

// ═══════════════════════════════════════════
// 🔍 محركات البحث المتخصصة
// ═══════════════════════════════════════════

// 1. الطقس (wttr.in - مجاني بدون key)
async function getWeather(query) {
    try {
        let city = query.replace(/(الجو|الطقس|حالة|في|النهاردة|بكرة|ازاي|إيه|كيف)/gi, '').trim() || 'Cairo';
        const res = await axios.get(`https://wttr.in/${encodeURIComponent(city)}?format=j1&lang=ar`);
        const data = res.data;
        const current = data.current_condition[0];
        return `### 🌤️ حالة الطقس في ${city}\n\n` +
               `- **الحالة:** ${current.lang_ar?.[0]?.value || current.weatherDesc[0].value}\n` +
               `- **درجة الحرارة:** ${current.temp_C}°C (بتحس بـ ${current.FeelsLikeC}°C)\n` +
               `- **الرطوبة:** ${current.humidity}%\n` +
               `- **سرعة الرياح:** ${current.windspeedKmph} كم/س\n` +
               `- **الضغط:** ${current.pressure} hPa\n`;
    } catch(e) { return null; }
}

// 2. مواقيت الصلاة (AlAdhan - مجاني)
async function getPrayerTimes(query) {
    try {
        let city = query.replace(/(مواقيت|الصلاة|صلاة|في|النهاردة|بتوقيت)/gi, '').trim() || 'Cairo';
        const res = await axios.get(`https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(city)}&country=EG&method=5`);
        const timings = res.data.data.timings;
        const date = res.data.data.date.readable;
        return `### 🕌 مواقيت الصلاة في ${city} (${date})\n\n` +
               `- **الفجر:** ${timings.Fajr}\n` +
               `- **الشروق:** ${timings.Sunrise}\n` +
               `- **الظهر:** ${timings.Dhuhr}\n` +
               `- **العصر:** ${timings.Asr}\n` +
               `- **المغرب:** ${timings.Maghrib}\n` +
               `- **العشاء:** ${timings.Isha}\n`;
    } catch(e) { return null; }
}

// 3. البحث في القرآن الكريم (AlQuran Cloud)
async function searchQuran(query) {
    try {
        let cleanQ = query.replace(/(آية|ايه|سورة|قرآن|قران|عن|في|قولي|هات)/gi, '').trim();
        const res = await axios.get(`https://api.alquran.cloud/v1/search/${encodeURIComponent(cleanQ)}/all/ar`);
        if (res.data.data && res.data.data.count > 0) {
            const matches = res.data.data.matches.slice(0, 3);
            let answer = `### 📖 نتائج البحث في القرآن عن "${cleanQ}":\n\n`;
            matches.forEach(m => {
                answer += `**سورة ${m.surah.name} - آية ${m.numberInSurah}:**\n> ${m.text}\n\n`;
            });
            return answer;
        }
        return null;
    } catch(e) { return null; }
}

// 4. أسعار العملات الرقمية (CoinGecko - مجاني)
async function getCryptoPrices(query) {
    try {
        let coin = 'bitcoin';
        if (/ايثيريوم|ethereum|eth/i.test(query)) coin = 'ethereum';
        else if (/دوج|doge/i.test(query)) coin = 'dogecoin';
        else if (/ريبل|xrp/i.test(query)) coin = 'ripple';
        else if (/سولانا|solana/i.test(query)) coin = 'solana';
        
        const res = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=usd,egp&include_24hr_change=true`);
        const data = res.data[coin];
        const symbol = coin.toUpperCase();
        const change = data.usd_24h_change > 0 ? `📈 +${data.usd_24h_change.toFixed(2)}%` : `📉 ${data.usd_24h_change.toFixed(2)}%`;
        return `### 🪙 سعر ${symbol}\n\n` +
               `- **بالدولار:** $${data.usd.toLocaleString()}\n` +
               `- **بالجنيه المصري:** ${data.egp.toLocaleString()} ج.م\n` +
               `- **التغير في 24 ساعة:** ${change}\n`;
    } catch(e) { return null; }
}

// 5. البحث في يوتيوب
async function searchYouTube(query) {
    try {
        let cleanQ = query.replace(/(فيديو|فيديوهات|يوتيوب|عن|هات|جيب)/gi, '').trim();
        const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQ)}`;
        return `### 🎬 فيديوهات يوتيوب عن "${cleanQ}":\n\n- [اضغط هنا لمشاهدة الفيديوهات](${searchUrl})\n\n> دي صفحة البحث المباشرة، افتحها وشوف كل الفيديوهات.`;
    } catch(e) { return null; }
}

// 6. الأخبار (Google News RSS)
async function getNews(query) {
    try {
        let cleanQ = query.replace(/(أخبار|اخبار|النهاردة|عن|هات|جيب)/gi, '').trim() || 'مصر';
        const res = await axios.get(`https://news.google.com/rss/search?q=${encodeURIComponent(cleanQ)}&hl=ar&gl=EG&ceid=EG:ar`);
        const $ = cheerio.load(res.data, { xmlMode: true });
        let items = [];
        $('item').slice(0, 5).each((i, el) => {
            items.push({
                title: $(el).find('title').text(),
                link: $(el).find('link').text(),
                date: $(el).find('pubDate').text()
            });
        });
        if (items.length === 0) return null;
        let answer = `### 📰 آخر الأخبار عن "${cleanQ}":\n\n`;
        items.forEach((it, i) => {
            answer += `${i+1}. [${it.title}](${it.link})\n`;
        });
        return answer;
    } catch(e) { return null; }
}

// 7. البحث في جيت هاب (GitHub API - مجاني)
async function searchGitHub(query) {
    try {
        let cleanQ = query.replace(/(مشروع|ريبو|repo|جيت هاب|github|مكتبة|هات|جيب|عن)/gi, '').trim();
        const res = await axios.get(`https://api.github.com/search/repositories?q=${encodeURIComponent(cleanQ)}&sort=stars&per_page=5`, {
            headers: { 'Accept': 'application/vnd.github+json' }
        });
        if (res.data.items.length === 0) return null;
        let answer = `### 💻 أفضل مشاريع "${cleanQ}" على GitHub:\n\n`;
        res.data.items.forEach((repo, i) => {
            answer += `**${i+1}. [${repo.full_name}](${repo.html_url})**\n`;
            answer += `- ⭐ ${repo.stargazers_count} نجمة | 🍴 ${repo.forks_count} Fork\n`;
            answer += `- ${repo.description || 'مفيش وصف'}\n\n`;
        });
        return answer;
    } catch(e) { return null; }
}

// 8. الوقت في المدن (WorldTimeAPI)
async function getTime(query) {
    try {
        let city = query.replace(/(الساعة|الوقت|كام|في|دلوقتي|الآن)/gi, '').trim();
        const timezones = { 'لندن': 'Europe/London', 'باريس': 'Europe/Paris', 'نيويورك': 'America/New_York', 'دبي': 'Asia/Dubai', 'الرياض': 'Asia/Riyadh', 'طوكيو': 'Asia/Tokyo', 'القاهرة': 'Africa/Cairo' };
        let tz = timezones[city] || 'Africa/Cairo';
        const res = await axios.get(`https://worldtimeapi.org/api/timezone/${tz}`);
        const dt = new Date(res.data.datetime);
        return `### 🌍 الوقت في ${city}\n\n- **الساعة:** ${dt.toLocaleTimeString('ar-EG')}\n- **التاريخ:** ${dt.toLocaleDateString('ar-EG')}\n`;
    } catch(e) { return null; }
}

// ═══════════════════════════════════════════
// 🔍 البحث العام (Bing + DDG)
// ═══════════════════════════════════════════
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

async function searchWeb(query) {
    let results = { snippets: [], links: [] };
    const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };
    try {
        const { data } = await axios.get(`https://www.bing.com/search?q=${encodeURIComponent(query)}&adlt=off`, { headers, timeout: 7000 });
        const $ = cheerio.load(data);
        $('.b_algo').slice(0, 4).each((i, el) => {
            let s = $(el).find('.b_caption p').text().trim() || $(el).find('p').text().trim();
            if (s) results.snippets.push(s);
            let linkEl = $(el).find('h2 a');
            let url = linkEl.attr('href');
            if (url && url.startsWith('http')) results.links.push({ title: linkEl.text().trim(), url: decodeBingUrl(url) });
        });
    } catch(e) {}
    
    if (results.snippets.length === 0) {
        try {
            const { data } = await axios.get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kp=-2`, { headers, timeout: 7000 });
            const $ = cheerio.load(data);
            $('.result__snippet').slice(0, 4).each((i, el) => { results.snippets.push($(el).text().trim()); });
            $('.result__a').slice(0, 3).each((i, el) => {
                let href = $(el).attr('href');
                if (href && href.includes('uddg=')) { try { href = decodeURIComponent(href.split('uddg=')[1].split('&')[0]); } catch(e) {} }
                if (href && href.startsWith('http')) results.links.push({ title: $(el).text().trim(), url: href });
            });
        } catch(e) {}
    }
    return results;
}

// ═══════════════════════════════════════════
// 🧠 الذكاء الاصطناعي (للتنسيق أو الرد العادي)
// ═══════════════════════════════════════════
async function askAI(query, searchData) {
    let messages;
    if (searchData && (searchData.snippets.length > 0 || searchData.links.length > 0)) {
        let ctx = `المستخدم سأل: ${query}\n\nالمعلومات:\n`;
        searchData.snippets.forEach(s => ctx += `- ${s}\n`);
        ctx += `\nاللينكات:\n`;
        searchData.links.forEach(l => ctx += `- [${l.title}](${l.url})\n`);
        messages = [
            { role: "system", content: "أنت منسق نصوص ذكي. رتب المعلومات واللينكات دي بشكل منظم بالمصري. ممنوع ترفض." },
            { role: "user", content: ctx }
        ];
    } else {
        messages = [
            { role: "system", content: "أنت المساعد الخارق M.E. مطورك محمد. ردودك بالمصري، ذكية، مباشرة. لو سلم عليك حد، رد بلطف. لو سألك عن معلومة عامة، رد بذكاء." },
            { role: "user", content: query }
        ];
    }
    try {
        const res = await axios.post("https://text.pollinations.ai/openai", { model: "mistral", messages, max_tokens: 2048 });
        return res.data.choices[0].message.content;
    } catch(e) {
        return searchData && searchData.snippets.length > 0 ? searchData.snippets.join('\n\n') : "معلش يا محمد، حصل خطأ مؤقت.";
    }
}

// ═══════════════════════════════════════════
// 🚦 الموجّه الذكي (Smart Router) - بيختار المصدر الصح
// ═══════════════════════════════════════════
app.post('/ask', async (req, res) => {
    let { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "مفيش سؤال!" });

    let answer = null;

    // 1. طلب صورة
    if (/ارسم|صورة|صور|رسمة/i.test(prompt)) {
        let cleanQ = prompt.replace(/(ارسم|صورة|صور|لي|عن|رسمة)/gi, '').trim();
        let imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanQ + ', highly detailed, 4k')}?width=1024&height=1024&nologo=true`;
        return res.json({ final: `### 🎨 الصورة اللي طلبتها:\n\n![صورة](${imgUrl})\n\n[⬇️ تحميل الصورة](${imgUrl})` });
    }

    // 2. الطقس
    if (/الجو|الطقس|حالة الجو|weather/i.test(prompt)) {
        answer = await getWeather(prompt);
    }
    // 3. مواقيت الصلاة
    else if (/مواقيت|الصلاة|صلاة/i.test(prompt) && !/بحث|كود/i.test(prompt)) {
        answer = await getPrayerTimes(prompt);
    }
    // 4. القرآن
    else if (/آية|ايه عن|سورة|قرآن|قران/i.test(prompt) && !/بحث|كود/i.test(prompt)) {
        answer = await searchQuran(prompt);
    }
    // 5. العملات الرقمية
    else if (/بيتكوين|bitcoin|ايثيريوم|ethereum|دوج|doge|سولانا|crypto|عملة رقمية/i.test(prompt)) {
        answer = await getCryptoPrices(prompt);
    }
    // 6. فيديوهات يوتيوب
    else if (/فيديو|فيديوهات|يوتيوب|youtube/i.test(prompt)) {
        answer = await searchYouTube(prompt);
    }
    // 7. الأخبار
    else if (/أخبار|اخبار|news/i.test(prompt)) {
        answer = await getNews(prompt);
    }
    // 8. جيت هاب
    else if (/جيت هاب|github|مشروع|ريبو|repo/i.test(prompt) && /جيت|github|ريبو|repo/i.test(prompt)) {
        answer = await searchGitHub(prompt);
    }
    // 9. الوقت
    else if (/الساعة كام|الوقت في|وقت/i.test(prompt) && /لندن|باريس|نيويورك|دبي|الرياض|طوكيو|القاهرة/i.test(prompt)) {
        answer = await getTime(prompt);
    }

    // لو مفيش مصدر متخصص رجع نتيجة، نستخدم البحث العام + AI
    if (!answer) {
        const searchData = await searchWeb(prompt);
        answer = await askAI(prompt, searchData);
    }

    res.json({ final: answer });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`✅ M.E Super Assistant شغال على http://localhost:${PORT}`));
