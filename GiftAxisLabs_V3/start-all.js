const { spawn } = require("child_process");
const path = require("path");

const bots = [1, 2, 3, 4, 5];

bots.forEach((index) => {
    const port = 2999 + index;
    console.log(`🚀 Starting Bot ${index} on port ${port}...`);

    const botProcess = spawn("node", ["index.js", index.toString()], {
        cwd: __dirname,
        env: { ...process.env, PORT: port.toString(), BOT_INDEX: index.toString() },
        stdio: "inherit"
    });

    botProcess.on("error", (err) => {
        console.error(`❌ Failed to start Bot ${index}:`, err.message);
    });

    botProcess.on("exit", (code) => {
        console.log(`⚠️ Bot ${index} exited with code ${code}. Restarting in 5s...`);
        setTimeout(() => {
            spawn("node", ["start-all.js"], { stdio: "inherit" });
        }, 5000);
    });
});
