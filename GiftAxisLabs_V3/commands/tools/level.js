
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
function getLevelFromXP(xp) {
    const lvl = Math.floor(Math.sqrt(xp / 50));
    const nextLvl = ((lvl+1)*(lvl+1)*50);
    return { level: lvl, xpNeeded: nextLvl, current: xp };
}
const RANKS = ["🥉 Newbie","🥈 Apprentice","🥇 Skilled","💎 Expert","🔮 Master","👑 Legend"];
module.exports = {
    name: "level", alias: ["lvl","exp","xp"],
    async execute(sock, m, args, reply) {
        const db = await getDB(); const userId = m.key.participant || m.key.remoteJid;
        const user = getUser(db, userId);
        const { level, xpNeeded, current } = getLevelFromXP(user.xp || 0);
        const rank = RANKS[Math.min(Math.floor(level/5), RANKS.length-1)];
        const bar = "█".repeat(Math.min(10, Math.floor((current/xpNeeded)*10))) + "░".repeat(Math.max(0,10-Math.floor((current/xpNeeded)*10)));
        reply(
            `┌ ❏ ◆ ⌜⭐ 𝗟𝗘𝗩𝗘𝗟 𝗦𝗧𝗔𝗧𝗦⌟ ◆\n│\n` +
            `├◆ 🎭 Rank: ${rank}\n` +
            `├◆ ⭐ Level: ${level}\n` +
            `├◆ ✨ XP: ${current}/${xpNeeded}\n` +
            `├◆ 📊 [${bar}]\n` +
            `├◆ ❤️ HP: ${user.hp}/${user.maxHp}\n` +
            `├◆ 💳 Balance: $${user.balance}\n└ ❏` + config.footer
        );
    }
};
