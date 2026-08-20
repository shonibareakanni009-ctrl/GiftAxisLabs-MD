
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
const ITEMS = [{"id":"rod","name":"Fishing Rod","price":500},{"id":"rifle","name":"Hunting Rifle","price":800},{"id":"pickaxe","name":"Pickaxe","price":600},{"id":"shield","name":"Shield","price":400},{"id":"potion","name":"Health Potion","price":200},{"id":"sword","name":"Sword","price":1000},{"id":"laptop","name":"Laptop","price":2000},{"id":"compass","name":"Compass","price":700},{"id":"bait","name":"Bait","price":100},{"id":"armor","name":"Body Armor","price":1500}];
const EMOJIS = { rod:"🎣", rifle:"🔫", pickaxe:"⛏️", shield:"🛡️", potion:"🧪", sword:"⚔️", laptop:"💻", compass:"🧭", bait:"🪱", armor:"🦺" };
module.exports = {
    name: "buy",
    async execute(sock, m, args, reply) {
        if (!args.length) return reply("Usage: .buy <item name>\nSee items: .shop");
        const query = args.join(" ").toLowerCase();
        const item = ITEMS.find(i => i.name.toLowerCase().includes(query) || i.id === query);
        if (!item) return reply(`❌ Item not found. Use .shop to see items.`);
        const db = await getDB(); const userId = m.key.participant || m.key.remoteJid;
        const user = getUser(db, userId);
        if (user.balance < item.price) return reply(`❌ Not enough money!\n💲 Need: $${item.price}\n💳 You have: $${user.balance}`);
        user.balance -= item.price;
        user.inventory.push(item.id);
        if (item.id === "shield") user.maxHp = Math.min(200, user.maxHp + 50);
        await saveDB(db);
        reply(`✅ Bought ${EMOJIS[item.id]} *${item.name}* for $${item.price}!\n💳 Balance: $${user.balance}` + config.footer);
    }
};
