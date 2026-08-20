
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
const EMOJIS = { rod:"🎣", rifle:"🔫", pickaxe:"⛏️", shield:"🛡️", potion:"🧪", sword:"⚔️", laptop:"💻", compass:"🧭", bait:"🪱", armor:"🦺" };
const NAMES = { rod:"Fishing Rod", rifle:"Hunting Rifle", pickaxe:"Pickaxe", shield:"Shield", potion:"Health Potion", sword:"Sword", laptop:"Laptop", compass:"Compass", bait:"Bait", armor:"Body Armor" };
module.exports = {
    name: "inventory", alias: ["inv","bag"],
    async execute(sock, m, args, reply) {
        const db = await getDB(); const userId = m.key.participant || m.key.remoteJid;
        const user = getUser(db, userId);
        if (!user.inventory.length) return reply("🎒 Your inventory is empty!\nVisit .shop to buy items.");
        const counts = {};
        user.inventory.forEach(id => counts[id] = (counts[id]||0)+1);
        const rows = Object.entries(counts).map(([id,c]) => `├◆ ${EMOJIS[id]||"📦"} ${NAMES[id]||id} x${c}`).join("\n");
        reply(`┌ ❏ ◆ ⌜🎒 𝗜𝗡𝗩𝗘𝗡𝗧𝗢𝗥𝗬⌟ ◆\n│\n${rows}\n│\n├◆ ❤️ HP: ${user.hp}/${user.maxHp}\n└ ❏` + config.footer);
    }
};
