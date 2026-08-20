const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require("../../config");
module.exports = {
    name: "ai",
    alias: ["chat"],
    async execute(sock, m, args, reply) {
        if (!config.geminiKey) return reply("❌ API Key missing in config.js");
        if (!args[0]) return reply("📝 *Usage:* .ai [your question]\n\n_Example: .ai What is quantum computing?_");
        reply(config.msg.wait);
        try {
            const genAI = new GoogleGenerativeAI(config.geminiKey);
            const model = genAI.getGenerativeModel({ model: config.geminiModel || "gemini-2.0-flash" });
            const result = await model.generateContent(args.join(" "));
            const text = result.response.text();
            if (!text) return reply("❌ No response from AI. Try again.");
            reply(`🤖 *GIFT AI*:\n\n${text}`);
        } catch (e) {
            console.error("AI Error:", e.message);
            reply(`❌ AI Error: ${e.message || "Unknown error occurred."}`);
        }
    }
};
