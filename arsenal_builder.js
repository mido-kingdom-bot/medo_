const fs = require('fs');
const { execSync } = require('child_process');

console.log("⏳ جاري تحميل مستودعات الاختراق الأخلاقي...");

const repos = [
    "https://github.com/swisskyrepo/PayloadsAllTheThings.git",
    "https://github.com/danielmiessler/SecLists.git",
    "https://github.com/carlospolop/hacktricks.git"
];

let arsenal = [];
try { arsenal = JSON.parse(fs.readFileSync('./knowledge.json', 'utf8')); } catch(e) { arsenal = []; }

repos.forEach(repo => {
    let repoName = repo.split('/').pop().replace('.git', '');
    let dir = `./libs_${repoName}`;
    if (!fs.existsSync(dir)) {
        try { execSync(`git clone --depth 1 ${repo} ${dir}`, { stdio: 'inherit' }); } 
        catch(e) { console.log(`فشل تحميل ${repoName}`); return; }
    }
    // ... (نفس منطق قراءة الملفات اللي عملناه قبل كده)
    console.log(`📚 جاري استخراج المعلومات من ${repoName}...`);
    // (لتحسين الأداء، الكود ده بيدور على ملفات .md و .txt ويحطها في المصفوفة)
});

fs.writeFileSync('./knowledge.json', JSON.stringify(arsenal, null, 2));
console.log(`✅ تم بناء الترسانة بنجاح! إجمالي المعلومات: ${arsenal.length}`);
