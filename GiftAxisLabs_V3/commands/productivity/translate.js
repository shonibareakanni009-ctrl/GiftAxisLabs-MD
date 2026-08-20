const config = require("../../config");
const axios = require("axios");
const LANGS = { en:"English", fr:"French", es:"Spanish", de:"German", ar:"Arabic", yo:"Yoruba", ha:"Hausa", ig:"Igbo", pt:"Portuguese", zh:"Chinese", ja:"Japanese", ru:"Russian", it:"Italian", ko:"Korean", sw:"Swahili" };
module.exports = {
    name: "translate", alias: ["tr","trans"],
    async execute(sock, m, args, reply) {
        if (args.length < 2) return reply("Usage: .translate <lang> <text>\nExample: .translate fr Hello how are you\n\nCodes: en fr es de ar yo ha ig pt zh ja");
        const [lang, ...textParts] = args;
        const text = textParts.join(" ");
        const targetLang = lang.toLowerCase();
        try {
            const res = await axios.get(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLang}`, { timeout: 10000 });
            const translated = res.data?.responseData?.translatedText;
            if (!translated || translated.toLowerCase().includes("invalid")) return reply("❌ Translation failed. Check language code.");
            reply(
                `┌ ❏ ◆ ⌜🌍 𝗧𝗥𝗔𝗡𝗦𝗟𝗔𝗧𝗘⌟ ◆\n│\n` +
                `├◆ 📝 Original: ${text}\n` +
                `├◆ 🌍 ${LANGS[targetLang] || targetLang}: ${translated}\n└ ❏` + config.footer
            );
        } catch(e) { reply("❌ " + e.message); }
    }
};
