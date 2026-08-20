
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
const DESC   = { rod:"Needed to fish", rifle:"Needed to hunt", pickaxe:"Needed to mine", shield:"+50 max HP", potion:"Restores 50 HP", sword:"+20% work earnings", laptop:"+40% work earnings", compass:"+30% adventure rewards", bait:"Better fish catches x5", armor:"50% dodge rob" };
module.exports = {
    name: "shop", alias: ["store","market"],
    async execute(sock, m, args, reply) {
        const rows = ITEMS.map((item,i) =>
            `├◆ ${i+1}. ${EMOJIS[item.id]} ${item.name}\n├◆    💲$${item.price} — ${DESC[item.id]}`
        ).join("\n│\n");
        reply(`┌ ❏ ◆ ⌜🏪 𝗚𝗜𝗙𝗧 𝗦𝗛𝗢𝗣⌟ ◆\n│\n${rows}\n│\n├◆ 🛒 Buy: .buy <name>\n└ ❏` + config.footer);
    }
};
