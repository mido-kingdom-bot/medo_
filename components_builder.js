const fs = require('fs');
let comps = { python: {}, javascript: {} };

// إضافة قطع غيار بايثون
comps.python["imports"] = "import socket\nimport requests\nimport hashlib\nimport os\n";
comps.python["port_scanner_logic"] = "def scan(target, port):\n    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)\n    s.settimeout(1)\n    try:\n        s.connect((target, port))\n        print(f'[+] Port {port} is OPEN')\n    except:\n        pass\n    finally:\n        s.close()\n";
comps.python["hash_logic"] = "def hash_password(pass_str):\n    return hashlib.sha256(pass_str.encode()).hexdigest()\n";
comps.python["fetch_url"] = "def fetch_data(url):\n    res = requests.get(url)\n    return res.text\n";
comps.python["main_scan"] = "if __name__ == '__main__':\n    target = input('Enter Target IP: ')\n    scan(target, 80)\n";

// إضافة قطع غيار جافاسكريبت
comps.javascript["imports"] = "const net = require('net');\nconst crypto = require('crypto');\nconst fs = require('fs');\n";
comps.javascript["port_scanner_logic"] = "function scan(target, port) {\n    const socket = new net.Socket();\n    socket.setTimeout(1000);\n    socket.on('connect', () => { console.log(`[+] Port ${port} is OPEN`); socket.destroy(); });\n    socket.on('timeout', () => { socket.destroy(); });\n    socket.on('error', () => {});\n    socket.connect(port, target);\n}\n";
comps.javascript["hash_logic"] = "function hashPassword(pass) {\n    return crypto.createHash('sha256').update(pass).digest('hex');\n}\n";
comps.javascript["main_scan"] = "const target = '127.0.0.1';\n[21, 22, 80, 443].forEach(port => scan(target, port));\n";

fs.writeFileSync('./components.json', JSON.stringify(comps, null, 2));
console.log(`🛠️ تم بناء مخزن الأكواد (Components) بنجاح!`);
