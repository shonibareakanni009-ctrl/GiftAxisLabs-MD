const config = require("../../config");
const axios = require("axios");
module.exports = {
    name: "currency", alias: ["convert","exchange"],
    async execute(sock, m, args, reply) {
        if (args.length < 3) return reply("Usage: .currency <amount> <from> <to>\nExample: .currency 100 USD NGN");
        const [amount, from, to] = args;
        const amt = parseFloat(amount);
        if (isNaN(amt)) return reply("❌ Invalid amount.");
        try {
            const res = await axios.get(`https://open.er-api.com/v6/latest/${from.toUpperCase()}`, { timeout: 8000 });
            if (res.data.result !== "success") return reply("❌ Invalid currency code.");
            const rate = res.data.rates[to.toUpperCase()];
            if (!rate) return reply(`❌ Currency "${to.toUpperCase()}" not found.`);
            const converted = (amt * rate).toFixed(2);
            const updateDate = new Date(res.data.time_last_update_utc).toLocaleDateString();
            reply(
                `┌ ❏ ◆ ⌜💱 𝗖𝗨𝗥𝗥𝗘𝗡𝗖𝗬 𝗖𝗢𝗡𝗩𝗘𝗥𝗧𝗘𝗥⌟ ◆\n│\n` +
                `├◆ 💵 ${amt} ${from.toUpperCase()} = *${converted} ${to.toUpperCase()}*\n` +
                `├◆ 📊 Rate: 1 ${from.toUpperCase()} = ${rate.toFixed(4)} ${to.toUpperCase()}\n` +
                `├◆ 📅 Updated: ${updateDate}\n└ ❏` + config.footer
            );
        } catch(e) { reply("❌ Exchange rate fetch failed: " + e.message); }
    }
};
