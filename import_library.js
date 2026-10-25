const fs = require('fs');
const { execSync } = require('child_process');

console.log("📚 جاري تحميل مكتبة الأمن السيبراني الضخمة (PayloadsAllTheThings)...");

// 1. تنزيل المكتبة من GitHub (لو مش موجودة)
const libPath = './library_data';
if (!fs.existsSync(libPath)) {
    try {
        execSync('git clone --depth 1 https://github.com/swisskyrepo/PayloadsAllTheThings.git library_data', { stdio: 'inherit' });
    } catch (e) {
        console.log("❌ فشل تحميل المكتبة. تأكد من وجود النت وأداة git.");
        process.exit(1);
    }
} else {
    console.log("✅ المكتبة موجودة بالفعل.");
}

// 2. قراءة محتوى المكتبة وتحويلها لبيانات البوت
let knowledge = [];
try {
    knowledge = JSON.parse(fs.readFileSync('./knowledge.json', 'utf8'));
} catch (e) { knowledge = []; }

const folders = fs.readdirSync(libPath);
let addedCount = 0;

folders.forEach(folder => {
    const folderPath = `${libPath}/${folder}`;
    // بنتأكد إنه فولدر
    if (fs.statSync(folderPath).isDirectory()) {
        const files = fs.readdirSync(folderPath);
        files.forEach(file => {
            // بنقرا ملفات الـ README بس
            if (file.toLowerCase() === 'readme.md') {
                let content = fs.readFileSync(`${folderPath}/${file}`, 'utf8');
                
                // بنشيل الصور والروابط الطويلة عشان نخلي الملف خفيف
                content = content.replace(/!\[.*?\]\(.*?\)/g, ''); 
                content = content.replace(/\[(.*?)\]\(.*?\)/g, '$1');

                // لو المحتوى كبير، بناخد أول 3000 حرف عشان ميهنجش
                if (content.length > 3000) content = content.substring(0, 3000) + "...\n(الباقي في المكتبة)";

                let title = `مكتبة ${folder} - ${file.replace('.md', '')}`;
                let keywords = `${folder} ${file} payloads exploit hacking security`;

                // نتأكد إننا مضفناهوش قبل كده
                if (!knowledge.find(item => item.title === title)) {
                    knowledge.push({ title, keywords, content });
                    addedCount++;
                }
            }
        });
    }
});

// 3. حفظ العقل الجديد
fs.writeFileSync('./knowledge.json', JSON.stringify(knowledge, null, 2));
console.log(`✅ تم استيراد ${addedCount} معلومة/كود جديد من المكتبة!`);
console.log(`🧠 إجمالي معلومات البوت الآن: ${knowledge.length} معلومة.`);
