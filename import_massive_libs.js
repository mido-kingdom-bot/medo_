const fs = require('fs');
const { execSync } = require('child_process');

console.log("📚 جاري تحميل مكتبات الهاكرز الحقيقية (قد ياخد دقيقة)...");

const repos = [
    "https://github.com/danielmiessler/SecLists.git",
    "https://github.com/swisskyrepo/PayloadsAllTheThings.git"
];

let knowledge = [];
try { knowledge = JSON.parse(fs.readFileSync('./knowledge.json', 'utf8')); } catch(e) {}

repos.forEach(repo => {
    let repoName = repo.split('/').pop().replace('.git', '');
    let dir = `./libs_${repoName}`;
    
    if (!fs.existsSync(dir)) {
        try {
            console.log(`📥 تحميل ${repoName}...`);
            execSync(`git clone --depth 1 ${repo} ${dir}`, { stdio: 'inherit' });
        } catch(e) { console.log(`فشل تحميل ${repoName}`); return; }
    }

    // قراءة الملفات النصية
    const walkSync = (dir, filelist = []) => {
        fs.readdirSync(dir).forEach(file => {
            const dirFile = `${dir}/${file}`;
            try {
                if (fs.statSync(dirFile).isDirectory()) { filelist = walkSync(dirFile, filelist); }
                else if (dirFile.endsWith('.md') || dirFile.endsWith('.txt')) { filelist.push(dirFile); }
            } catch(e) {}
        });
        return filelist;
    };

    const files = walkSync(dir);
    console.log(`📄 جاري استخراج المعلومات من ${files.length} ملف في ${repoName}...`);

    files.forEach(file => {
        try {
            let content = fs.readFileSync(file, 'utf8');
            if (content.length < 50) return; // تخطي الملفات الفاضية
            
            // تنظيف النص
            content = content.replace(/!\[.*?\]\(.*?\)/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1');
            
            let title = `مكتبة ${repoName}: ${file.split('/').pop()}`;
            let keywords = `${repoName} ${file.split('/').pop()} hacking payload security`;
            
            // خد أول 1000 حرف عشان ميهنجش
            if (!knowledge.find(k => k.title === title)) {
                knowledge.push({ title, keywords, content: content.substring(0, 1000) + "..." });
            }
        } catch(e) {}
    });
});

fs.writeFileSync('./knowledge.json', JSON.stringify(knowledge, null, 2));
console.log(`✅ تم استيراد إجمالي ${knowledge.length} معلومة/مكتبة في دماغ البوت!`);
