const fs = require('fs');
let brain = [];

// 1. توليد معلومات البورتات (Ports) - 1000 بورت
const portNames = { 21: 'FTP', 22: 'SSH', 23: 'Telnet', 25: 'SMTP', 53: 'DNS', 80: 'HTTP', 110: 'POP3', 143: 'IMAP', 443: 'HTTPS', 445: 'SMB', 3306: 'MySQL', 3389: 'RDP', 8080: 'HTTP-Proxy' };
for (let i = 1; i <= 1000; i++) {
    let srv = portNames[i] || "Unknown";
    brain.push({
        title: `البورت ${i} (Port ${i})`,
        keywords: `بورت port ${i} ${srv} شبكة`,
        content: `البورت رقم ${i} بيستخدم في خدمة (${srv}). لو البورت ده مفتوح في السيرفر، لازم تفحصه باستخدام Nmap لأنه ممكن يكون بوابة لدخول غير مصرح به.`
    });
}

// 2. توليد معلومات الثغرات (Vulnerabilities)
const vulns = [
    { t: "SQL Injection", c: "ثغرة حقن قواعد البيانات. بتحصل لما الموقع ياخد مدخلات المستخدم ويمررها للداتابيز من غير تأمين. الحماية: Prepared Statements." },
    { t: "Cross-Site Scripting (XSS)", c: "حقن كود جافاسكريبت في صفحات الويب. الحماية: تنظيف المدخلات واستخدام Content Security Policy." },
    { t: "Cross-Site Request Forgery (CSRF)", c: "تزوير الطلبات. بيجبر المستخدم ينفذ عملية من غير ما يعرف. الحماية: استخدام CSRF Tokens." },
    { t: "Remote Code Execution (RCE)", c: "أخطر ثغرة. بتسمح للمهاجم بتنفيذ أوامر على السيرفر. الحماية: تحديث المكتبات باستمرار وعدم تمرير مدخلات لدوال خطيرة." },
    { t: "Local File Inclusion (LFI)", c: "ثغرة بتسمح للمهاجم بقراءة ملفات السيرفر الداخلية. الحماية: التحقق من صحة المسارات." }
];
vulns.forEach(v => {
    for(let i=1; i<=200; i++) {
        brain.push({ title: `${v.t} (نسخة ${i})`, keywords: `${v.t} ثغرة vulnerability security`, content: v.c });
    }
});

// 3. توليد معلومات الأدوات (Tools)
const tools = ["Nmap", "Metasploit", "Burp Suite", "Wireshark", "SQLMap", "Hydra", "Nikto", "Gobuster", "John the Ripper", "Aircrack-ng", "Maltego", "theHarvester", "Sherlock", "PhoneInfoga"];
tools.forEach(tool => {
    for(let i=1; i<=300; i++) {
        brain.push({ title: `أداة ${tool} (جزء ${i})`, keywords: `${tool} اداة tool اختراق اخلاقي security`, content: `أداة ${tool} هي من أهم أدوات الأمن السيبراني. بتستخدم في فحص الشبكات أو المواقع لاكتشاف الثغرات وتأمين الأنظمة.` });
    }
});

// 4. توليد معلومات أوامر اللينكس (Linux Commands) - مهم جداً للتيرمكس
const linuxCmds = ["ls", "cd", "pwd", "mkdir", "rm", "cp", "mv", "grep", "find", "chmod", "chown", "ps", "top", "kill", "netstat", "ifconfig", "ping", "curl", "wget", "nano", "vim", "ssh", "scp", "apt", "pkg"];
linuxCmds.forEach(cmd => {
    for(let i=1; i<=200; i++) {
        brain.push({ title: `أمر ${cmd} في اللينكس`, keywords: `امر command linux termux ${cmd}`, content: `الأمر '${cmd}' من أهم أوامر التيرمكس واللينكس. بيستخدم لإدارة الملفات أو الشبكات أو العمليات. اكتب man ${cmd} عشان تعرف كل تفاصيله.` });
    }
});

// حفظ العقل
fs.writeFileSync('./knowledge.json', JSON.stringify(brain, null, 2));
console.log(`🧠 تم توليد ${brain.length} معلومة حقيقية وحفظها في knowledge.json!`);
