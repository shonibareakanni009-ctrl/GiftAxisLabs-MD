
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
    name: "heal", alias: ["healup","hp"],
    async execute(sock, m, args, reply) {
        const db = await getDB(); const userId = m.key.participant || m.key.remoteJid;
        const user = getUser(db, userId);
        if (user.hp >= user.maxHp) return reply(`❤️ You're already at full HP! (${user.hp}/${user.maxHp})`);
        if (!user.inventory.includes("potion")) {
            const healCost = 100;
            if (user.balance < healCost) return reply(`❌ Not enough money to heal!\nCost: $${healCost} or buy a 🧪 Health Potion at .shop`);
            user.balance -= healCost;
            const healed = Math.min(30, user.maxHp - user.hp);
            user.hp = Math.min(user.maxHp, user.hp + healed);
            await saveDB(db);
            return reply(`💊 Healed *+${healed} HP* (cost $${healCost})\n❤️ HP: ${user.hp}/${user.maxHp}\n💳 Balance: $${user.balance}` + config.footer);
        }
        const idx = user.inventory.indexOf("potion");
        user.inventory.splice(idx, 1);
        const healed = Math.min(50, user.maxHp - user.hp);
        user.hp = Math.min(user.maxHp, user.hp + healed);
        await saveDB(db);
        reply(`🧪 Used Health Potion! *+${healed} HP*\n❤️ HP: ${user.hp}/${user.maxHp}` + config.footer);
    }
};
