const fs = require('fs');

console.log("🏭 جاري تشغيل مصنع الـ 100 ألف كود... (استنى دقيقة)");
let massiveData = [];

// دالة لإضافة كود
const addCode = (lang, category, title, code, desc) => {
    massiveData.push({
        id: massiveData.length + 1,
        lang: lang,
        category: category,
        title: title,
        keywords: `${lang} ${category} ${title} ${desc}`.toLowerCase(),
        code: code,
        desc: desc
    });
};

// 1. توليد أكواد بايثون (Python) للأمن والشبكات
for (let i = 1; i <= 25000; i++) {
    let port = 20 + (i % 1000);
    let host = `192.168.1.${i % 255}`;
    let code = `import socket\n\ndef check_port_${i}():\n    target = "${host}"\n    port = ${port}\n    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)\n    s.settimeout(1)\n    try:\n        s.connect((target, port))\n        print(f"[+] Port {port} on {target} is OPEN")\n    except:\n        print(f"[-] Port {port} is CLOSED")\n    finally:\n        s.close()\n\ncheck_port_${i}()`;
    addCode('python', 'security', `فحص بورت ${port}`, code, `سكريبت لفحص البورت رقم ${port} على السيرفر ${host}`);
}

// 2. توليد أكواد جافاسكريبت (JavaScript) لحماية الويب والتفاعل
for (let i = 1; i <= 25000; i++) {
    let length = 8 + (i % 20);
    let code = `function generateSecurePassword_${i}() {\n    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";\n    let password = "";\n    for (let i = 0; i < ${length}; i++) {\n        password += chars.charAt(Math.floor(Math.random() * chars.length));\n    }\n    return password;\n}\nconsole.log("Generated Password: ", generateSecurePassword_${i}());`;
    addCode('javascript', 'security', `مولد باسورد عشوائي طوله ${length}`, code, `دالة تقوم بتوليد باسورد قوي وطوله ${length} حرف.`);
}

// 3. توليد أكواد Bash (لينكس وتيرمكس)
for (let i = 1; i <= 25000; i++) {
    let file = `backup_${i}.tar.gz`;
    let code = `#!/bin/bash\n# سكريبت نسخ احتياطي رقم ${i}\nDATE=$(date +%Y%m%d)\nBACKUP_DIR="/sdcard/backup_${i}"\nmkdir -p $BACKUP_DIR\ntar -czvf "$BACKUP_DIR/data_$DATE_${i}.tar.gz" /data/data/com.termux/files/home\necho "Backup ${i} completed successfully!"`;
    addCode('bash', 'system', `سكريبت نسخ احتياطي ${i}`, code, `سكريبت لعمل نسخة احتياطية من ملفات التيرمكس.`);
}

// 4. توليد أكواد SQL (قواعد بيانات)
for (let i = 1; i <= 25000; i++) {
    let table = `users_${i}`;
    let code = `-- إنشاء جدول ${table} وحماية بياناته\nCREATE TABLE IF NOT EXISTS ${table} (\n    id INT AUTO_INCREMENT PRIMARY KEY,\n    username VARCHAR(50) NOT NULL UNIQUE,\n    password_hash VARCHAR(255) NOT NULL,\n    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n);\n\n-- إدخال مستخدم مع تشفير الباسورد\nINSERT INTO ${table} (username, password_hash) \nVALUES ('user_${i}', SHA2('SecretPass_${i}', 256));`;
    addCode('sql', 'database', `إنشاء جدول مستخدمين ${i}`, code, `أوامر SQL لإنشاء جدول ${table} وتأمين كلمات المرور.`);
}

// دمج المعلومات القديمة
try {
    const existing = JSON.parse(fs.readFileSync('./knowledge.json', 'utf8'));
    massiveData = massiveData.concat(existing);
} catch (e) {}

// حفظ الملف
fs.writeFileSync('./knowledge.json', JSON.stringify(massiveData, null, 2));
console.log(`✅ تم توليد ${massiveData.length} كود ومعلومة بنجاح في knowledge.json!`);
