
const fs = require("fs-extra");
const path = require("path");
const config = require("../../config");
const DB = path.join(__dirname, "../../data/economy.json");
async function getDB() { await fs.ensureFile(DB); return fs.readJson(DB).catch(() => ({})); }
async function saveDB(db) { await fs.writeJson(DB, db); }
function getUser(db, id) {
    if (!db[id]) db[id] = { balance: 0, bank: 0, hp: 100, maxHp: 100, inventory: [], xp: 0, lastFish: 0, lastHunt: 0, lastMine: 0 };
    if (!db[id].inventory) db[id].inventory = [];
    if (db[id].hp === undefined) db[id].hp = 100;
    if (!db[id].maxHp) db[id].maxHp = 100;
    if (!db[id].xp) db[id].xp = 0;
    return db[id];
}
module.exports = {
    name: "rate", alias: ["rateit","score"],
    async execute(sock, m, args, reply) {
        if (!args.length) return reply("Usage: .rate <thing>\nExample: .rate JavaScript");
        const thing = args.join(" ");
        const rating = (Math.random() * 10).toFixed(1);
        const stars = "⭐".repeat(Math.round(rating/2)) + "☆".repeat(5-Math.round(rating/2));
        const comments = [
            "Absolutely legendary!", "Pretty decent!", "Could be better.",
            "Meh, not impressed.", "Chef's kiss! 🤌", "Has potential!",
            "Top tier!", "Needs work.", "Surprisingly good!", "Classic!"
        ];
        const comment = comments[Math.floor(Math.random() * comments.length)];
        reply(`┌ ❏ ◆ ⌜⭐ 𝗥𝗔𝗧𝗜𝗡𝗚⌟ ◆\n│\n├◆ 📌 ${thing}\n├◆ ${stars}\n├◆ 📊 Score: ${rating}/10\n├◆ 💬 "${comment}"\n└ ❏` + config.footer);
    }
};
