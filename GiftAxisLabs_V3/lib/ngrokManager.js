

let ngrok;
let _publicUrl  = null;
let _isRunning  = false;

function loadNgrok() {
    if (ngrok) return true;
    try {
        ngrok = require("ngrok");
        return true;
    } catch {
        console.warn("⚠️  [Ngrok] Package not installed. Run: npm install ngrok");
        return false;
    }
}


async function startTunnel(port, authToken) {
    if (!loadNgrok()) return null;
    if (_isRunning) return _publicUrl;

    try {
        if (authToken) {
            await ngrok.authtoken(authToken);
        }

        _publicUrl = await ngrok.connect({
            addr:     port,
            proto:    "http",
            region:   "us",  // change to "eu", "ap", "au", "sa", "jp", "in" if needed
        });

        _isRunning = true;

        console.log(`🌍 [Ngrok] Tunnel started: ${_publicUrl}`);
        console.log(`🌍 [Ngrok] Dashboard: ${_publicUrl}/dashboard`);
        console.log(`🌍 [Ngrok] Pair URL:   ${_publicUrl}/pair`);

        ngrok.on("disconnect", async (url) => {
            console.warn(`⚠️ [Ngrok] Disconnected (${url}). Reconnecting in 10s...`);
            _isRunning = false;
            setTimeout(() => startTunnel(port, authToken), 10000);
        });

        ngrok.on("error", (err) => {
            console.error("❌ [Ngrok] Error:", err.message);
        });

        return _publicUrl;

    } catch (e) {
        console.error("❌ [Ngrok] Failed to start tunnel:", e.message);
        if (e.message.includes("authtoken")) {
            console.error("💡 [Ngrok] Add your authtoken to config.js: ngrokAuthToken: 'your_token'");
            console.error("💡 [Ngrok] Get free token: https://dashboard.ngrok.com/get-started/your-authtoken");
        }
        return null;
    }
}


function getUrl() {
    return _publicUrl;
}


function isRunning() {
    return _isRunning;
}


async function stopTunnel() {
    if (!ngrok || !_isRunning) return;
    try {
        await ngrok.disconnect();
        await ngrok.kill();
        _isRunning = false;
        _publicUrl = null;
        console.log("🛑 [Ngrok] Tunnel stopped.");
    } catch (e) {
        console.error("❌ [Ngrok] Stop error:", e.message);
    }
}


function getStatus() {
    if (!_isRunning || !_publicUrl) {
        return "🔴 Ngrok: Not running\n💡 Add ngrokAuthToken to config.js";
    }
    return `🟢 Ngrok: Active\n🌍 URL: ${_publicUrl}\n📊 Dashboard: ${_publicUrl}\n🔗 Pair: ${_publicUrl}/pair`;
}

module.exports = { startTunnel, stopTunnel, getUrl, isRunning, getStatus };
