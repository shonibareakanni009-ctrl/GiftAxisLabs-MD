const config = require("../../config");
const { GoogleGenerativeAI } = require("@google/generative-ai");
module.exports = {
    name: "solve", alias: ["problem","think"],
    async execute(sock, m, args, reply) {
        if (!args.length) return reply("Usage: .solve <problem or question>\nExample: .solve What is the time complexity of binary search?");
        const problem = args.join(" ");
        try {
            reply("🧠 Thinking...");
            const genAI = new GoogleGenerativeAI(config.geminiKey);
            const model = genAI.getGenerativeModel({ model: config.geminiModel || "gemini-2.0-flash" });
            const result = await model.generateContent(`Solve this problem step by step. Be clear and concise:\n\n${problem}`);
            const solution = result.response.text().trim().slice(0, 3000);
            reply(`🧩 *Solution:*\n\n${solution}` + config.footer);
        } catch(e) { reply("❌ " + e.message); }
    }
};
