const fs = require('fs');

console.log("🏭 جاري تشغيل مصنع الأكواد... (استنى شوية)");
let data = [];
let idCounter = 1;

const addEntry = (title, keywords, content) => {
    data.push({ id: idCounter++, title, keywords, content });
};

// 1. توليد أكواد البايثون (Python) للأمن السيبراني
const pyTasks = [
    { name: "فحص بورتات بسيط", code: "import socket\n\ndef scan_port(host, port):\n    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)\n    s.settimeout(1)\n    try:\n        s.connect((host, port))\n        print(f'Port {port} is OPEN')\n    except:\n        pass\n    finally:\n        s.close()\n\nscan_port('127.0.0.1', 80)" },
    { name: "تشفير كلمة مرور باستخدام Hashlib", code: "import hashlib\n\ndef hash_password(password):\n    salt = 'my_secure_salt'\n    return hashlib.sha256((password + salt).encode()).hexdigest()\n\nprint(hash_password('mypassword123'))" },
    { name: "فحص الروابط (URL) من الفيروسات", code: "import requests\n\ndef check_url(url):\n    # استخدام واجهة VirusTotal المجانية\n    api_key = 'YOUR_API_KEY'\n    params = {'apikey': api_key, 'resource': url}\n    response = requests.get('https://www.virustotal.com/vtapi/v2/url/report', params=params)\n    return response.json()\n\nprint('Checking URL...')" },
    { name: "سحب معلومات الدومين WHOIS", code: "import whois\n\ndef get_domain_info(domain):\n    w = whois.whois(domain)\n    print(f'Domain: {w.domain_name}')\n    print(f'Creation Date: {w.creation_date}')\n\nget_domain_info('google.com')" }
];

pyTasks.forEach(task => {
    for(let i=1; i<=500; i++) {
        addEntry(`كود بايثون: ${task.name} (نسخة ${i})`, `بايثون python code ${task.name} security`, `هذا كود بايثون لـ (${task.name}):\n\`\`\`python\n${task.code}\n\`\`\`\n*(ملاحظة: الكود قابل للتعديل حسب احتياجك).*`);
    }
});

// 2. توليد أكواد الجافاسكريبت (Node.js/JS) لحماية الويب
const jsTasks = [
    { name: "حماية من XSS (تنظيف المدخلات)", code: "function sanitizeInput(str) {\n    return str.replace(/[&<>'\"\/]/g, function(match) {\n        const escape = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', \"'\": '&#x27;', '/': '&#x2F;' };\n        return escape[match];\n    });\n}\nconsole.log(sanitizeInput('<script>alert(1)</script>'));" },
    { name: "إنشاء Rate Limiter لمنع DDoS", code: "const rateLimit = require('express-rate-limit');\n\nconst limiter = rateLimit({\n  windowMs: 15 * 60 * 1000, // 15 minutes\n  max: 100 // limit each IP to 100 requests per windowMs\n});\n\n// app.use(limiter);" },
    { name: "التحقق من صحة البريد الإلكتروني", code: "function isValidEmail(email) {\n    const re = /^(([^<>()[\\]\\\\.,;:\\s@\"]+(\\.[^<>()[\\]\\\\.,;:\\s@\"]+)*)|(\".+\"))@((\\[[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\])|(([a-zA-Z\\-0-9]+\\.)+[a-zA-Z]{2,}))$/;\n    return re.test(String(email).toLowerCase());\n}" }
];

jsTasks.forEach(task => {
    for(let i=1; i<=500; i++) {
        addEntry(`كود جافاسكريبت: ${task.name} (نسخة ${i})`, `جافاسكريبت javascript js code ${task.name} web security`, `هذا كود جافاسكريبت لـ (${task.name}):\n\`\`\`javascript\n${task.code}\n\`\`\``);
    }
});

// 3. توليد أكواد SQL (لقواعد البيانات)
const sqlTasks = [
    { name: "منع SQL Injection باستخدام Prepared Statements", code: "-- بدل ما تكتب كده (خطأ):\n-- SELECT * FROM users WHERE username = '$user'\n\n-- اكتب كده (صح):\nPREPARE stmt FROM 'SELECT * FROM users WHERE username = ?';\nSET @user = 'admin';\nEXECUTE stmt USING @user;\nDEALLOCATE PREPARE stmt;" },
    { name: "تشفير البيانات في قاعدة البيانات", code: "INSERT INTO users (username, password) \nVALUES ('mido', SHA2('my_password', 256));\n\nSELECT * FROM users WHERE password = SHA2('my_password', 256);" }
];

sqlTasks.forEach(task => {
    for(let i=1; i<=500; i++) {
        addEntry(`كود SQL: ${task.name} (نسخة ${i})`, `sql database code ${task.name} قواعد بيانات`, `هذا كود SQL لـ (${task.name}):\n\`\`\`sql\n${task.code}\n\`\`\``);
    }
});

// 4. توليد أكواد Bash (لأوامر لينكس والتيرمكس)
const bashTasks = [
    { name: "فحص الشبكة بـ Nmap", code: "#!/bin/bash\n# فحص سريع لأول 100 بورت\ntarget=$1\nif [ -z \"$target\" ]; then\n  echo \"Usage: ./scan.sh <IP>\"\n  exit 1\nfi\nnmap -F $target" },
    { name: "البحث في ملفات السيرفر عن كلمة معينة", code: "#!/bin/bash\n# البحث عن كلمة في كل ملفات المجلد\nword=$1\ndirectory=$2\ngrep -rnw \"$directory\" -e \"$word\"" },
    { name: "مراقبة حالة السيرفر", code: "#!/bin/bash\n# عرض الذاكرة والمساحة\nfree -h\ndf -h" }
];

bashTasks.forEach(task => {
    for(let i=1; i<=500; i++) {
        addEntry(`كود Bash: ${task.name} (نسخة ${i})`, `bash linux termux code ${task.name} شبكات`, `هذا كود Bash لـ (${task.name}):\n\`\`\`bash\n${task.code}\n\`\`\``);
    }
});

// 5. إضافة معلومات عامة وأمنية ضخمة (لتكبير الحجم)
const generalTopics = ["التشفير المتماثل", "التشفير غير المتماثل", "جدار الحماية", "VPN", "بروتوكول HTTPS", "المصادقة الثنائية", "شبكات WPA3", "هندسةsocial", "أمن التطبيقات", "أمن الشبكات", "الاختراق الأخلاقي", "القرصنة"];
generalTopics.forEach(topic => {
    for(let i=1; i<=1000; i++) {
        addEntry(`معلومات عن ${topic} - جزء ${i}`, `${topic} security cybersecurity معلومات حماية اختراق`, `معلومات أمنية حول (${topic}) الجزء رقم ${i}: يعتبر هذا المجال من أهم ركائز الأمن السيبراني لحماية البيانات والأنظمة من التهديدات الإلكترونية.`);
    }
});

// دمج المعلومات القديمة (لو موجودة)
try {
    const existing = JSON.parse(fs.readFileSync('./knowledge.json', 'utf8'));
    data = data.concat(existing);
} catch (e) {}

// حفظ الملف
fs.writeFileSync('./knowledge.json', JSON.stringify(data, null, 2));
console.log(`✅ تم توليد ${data.length} كود ومعلومة وحفظها في knowledge.json بنجاح!`);
