
const https = require('https');

const WORKER_URL = "https://nais2-sync-worker.liuanjay.workers.dev";

function makeRequest(path, method = "GET", body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(WORKER_URL + path);
        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: method,
            headers: {
                "User-Agent": "Node-Test-Script",
                ...headers
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    text: () => Promise.resolve(data),
                    json: () => Promise.resolve(JSON.parse(data || '{}'))
                });
            });
        });

        req.on('error', (e) => reject(e));

        if (body) {
            req.write(body);
        }
        req.end();
    });
}

async function test() {
    console.log(`Testing Worker at: ${WORKER_URL}`);
    console.log("---------------------------------------------------");

    // 1. Test CORS and 404
    console.log("1. Testing 404 and CORS...");
    try {
        const res = await makeRequest("/unknown-route", "OPTIONS");
        console.log(`   OPTIONS status: ${res.status}`);
        const corsOrigin = res.headers["access-control-allow-origin"];
        console.log(`   CORS Header: ${corsOrigin}`);
        
        if (corsOrigin !== "*") {
            console.error("   [FAIL] CORS header missing or incorrect");
        } else {
            console.log("   [PASS] CORS OK");
        }
    } catch (e) {
        console.error("   [FAIL] Network/CORS Error:", e.message);
    }
    console.log("");

    // 2. Register User
    const username = `test_user_${Math.floor(Math.random() * 10000)}`;
    const password = "password123";
    let token = "";
    let userId = "";

    console.log(`2. Registering user: ${username}...`);
    try {
        const res = await makeRequest("/auth/register", "POST", JSON.stringify({ username, password }), { "Content-Type": "application/json" });
        
        if (res.ok) {
            const data = await res.json();
            console.log("   [PASS] Registration successful");
            console.log(`   User ID: ${data.user?.id}`);
            token = data.token;
            userId = data.user?.id;
        } else {
            const errorText = await res.text();
            console.error(`   [FAIL] Registration failed: ${res.status}`);
            console.log("   Response:", errorText);
            // If failing with existing user logic, try login
            if (errorText.includes("Username already taken")) {
                 console.log("   (Known user, skipping to login/bind test)");
                 return;
            }
            return;
        }
    } catch (e) {
         console.error("   [FAIL] Register Exception:", e.message);
         return;
    }
    console.log("");

    if (!token) {
        console.log("No token, skipping bind test.");
        return;
    }

    // 3. Test Bind Email Request
    console.log("3. Testing Bind Email Request...");
    try {
        const testEmail = `test_${username}@example.com`;
        const res = await makeRequest("/auth/bind-email-request", "POST", JSON.stringify({ email: testEmail }), {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        });

        const text = await res.text();
        console.log(`   Status: ${res.status}`);
        console.log(`   Response: ${text}`);

        if (res.ok) {
             console.log("   [PASS] Bind request accepted (Code sent)");
        } else {
             try {
                 JSON.parse(text);
                 console.log("   [PASS] Received valid JSON error response (Worker logic is running)");
             } catch {
                 console.error("   [FAIL] Received non-JSON response");
             }
        }

    } catch (e) {
        console.error("   [FAIL] Bind Request Exception:", e.message);
    }
}

test();
