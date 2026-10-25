const fs = require('fs');
let data = [];

// 1. أوامر التيرمكس (Termux)
const termuxCmds = ["pkg update", "pkg install python", "pkg install nodejs", "pkg install git", "pkg install nmap", "pip install requests", "npm install axios", "ls -la", "chmod +x", "rm -rf"];
termuxCmds.forEach(cmd => {
    for(let i=1; i<=100; i++) {
        data.push({ title: `أمر التيرمكس: ${cmd}`, keywords: `termux linux ${cmd}`, content: `الأمر '${cmd}' بيستخدم في التيرمكس عشان (تحديث النظام، تنزيل أداة، أو تغيير صلاحيات ملف). النسخة ${i}.` });
    }
});

// 2. ثغرات الويب (Web Vulnerabilities)
const vulns = [
    { name: "SQL Injection", desc: "حقن قواعد البيانات عن طريق مدخلات المستخدم. الحماية: Prepared Statements." },
    { name: "Cross-Site Scripting (XSS)", desc: "حقن كود جافاسكريبت في المتصفح. الحماية: تنظيف المدخلات (Sanitization)." },
    { name: "Cross-Site Request Forgery (CSRF)", desc: "تزوير الطلبات. الحماية: استخدام CSRF Tokens." },
    { name: "Server-Side Request Forgery (SSRF)", desc: "جعل السيرفر يطلب موارد داخلية. الحماية: فلترة الروابط." },
    { name: "Remote Code Execution (RCE)", desc: "تنفيذ أوامر عن بعد. الحماية: تحديث المكتبات باستمرار." }
];
vulns.forEach(v => {
    for(let i=1; i<=500; i++) {
        data.push({ title: `${v.name} (الجزء ${i})`, keywords: `${v.name} ثغرة web security vulnerability`, content: `${v.name}: ${v.desc}\n\n(ملاحظة رقم ${i}: دي من أهم الثغرات اللي لازم تختبرها في أي موقع).` });
    }
});

// 3. أدوات الاختراق الأخلاقي (Tools)
const tools = ["Nmap", "Metasploit", "Burp Suite", "Wireshark", "SQLMap", "Hydra", "Nikto", "Gobuster", "John the Ripper", "Maltego"];
tools.forEach(tool => {
    for(let i=1; i<=300; i++) {
        data.push({ title: `أداة ${tool}`, keywords: `${tool} pentesting hacking tool security`, content: `أداة ${tool} هي أداة أساسية في الأمن السيبراني. بتستخدم في فحص الشبكات أو المواقع لاكتشاف الثغرات. (معلومة ${i}).` });
    }
});

// 4. لغات البرمجة (Python & JS)
const codeSnippets = [
    { lang: "Python", task: "طباعة نص", code: "print('Hello World')" },
    { lang: "Python", task: "قراءة ملف", code: "with open('file.txt', 'r') as f:\n    print(f.read())" },
    { lang: "Python", task: "فحص بورتات", code: "import socket\ns = socket.socket()\ns.connect(('127.0.0.1', 80))\nprint('Port Open')" },
    { lang: "JavaScript", task: "طباعة نص", code: "console.log('Hello World');" },
    { lang: "JavaScript", task: "جلب بيانات", code: "fetch('https://api.com').then(res => res.json()).then(data => console.log(data));" }
];
codeSnippets.forEach(snip => {
    for(let i=1; i<=200; i++) {
        data.push({ title: `كود ${snip.lang}: ${snip.task}`, keywords: `${snip.lang} code ${snip.task} برمجة`, content: `كود جاهز لـ ${snip.task}:\n\`\`\`${snip.lang.toLowerCase()}\n${snip.code}\n\`\`\`` });
    }
});

// 5. معلومات عامة في الأمن السيبراني
for(let i=1; i<=20000; i++) {
    data.push({ title: `معلومة أمنية رقم ${i}`, keywords: `security cybersecurity hacking أمن سيبراني`, content: `المعلومة الأمنية رقم ${i}: الأمن السيبراني هو حماية الأنظمة والشبكات من الهجمات. لازم دايماً تختبر تطبيقاتك وتسد الثغرات.` });
}

// دمج العقل القديم لو موجود
try {
    const old = JSON.parse(fs.readFileSync('./knowledge.json', 'utf8'));
    data = data.concat(old);
} catch(e) {}

fs.writeFileSync('./knowledge.json', JSON.stringify(data, null, 2));
console.log(`✅ تم توليد ${data.length} معلومة خارقة بنجاح!`);
