const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require("../../config");
module.exports = {
    name: "ask",
    async execute(sock, m, args, reply) {
        if(!config.geminiKey) return reply("❌ API Key missing in config.js");
        if(!args[0]) return reply("📝 Please provide a query.");
        reply(config.msg.wait);
        try {
            const genAI = new GoogleGenerativeAI(config.geminiKey);
            const model = genAI.getGenerativeModel({ model: config.geminiModel || "gemini-2.0-flash" });
            const result = await model.generateContent(args.join(" "));
            reply(`🤖 *GIFT AI*:\n\n${result.response.text()}`);
        } catch (e) { console.error("AI Error:", e.message); reply("❌ AI Error: " + (e.message || "Unknown error")); }
    }
};
