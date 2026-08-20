const fileServer = require("../../lib/fileServer");
const config = require("../../config");
module.exports = {
    name: "invoice", alias: ["bill","receipt2"],
    async execute(sock, m, args, reply) {
        const raw = args.join(" ");
        const parts = raw.split("|").map(s => s.trim());
        if (parts.length < 2) return reply("Usage: .invoice <client name> | <item1:price> | <item2:price>\nExample: .invoice John Doe | Web Design:50000 | Hosting:5000 | Logo:10000");
        const client = parts[0];
        const items = parts.slice(1).map(p => {
            const [name, price] = p.split(":").map(s => s.trim());
            return { name, price: parseFloat(price) || 0 };
        });
        const subtotal = items.reduce((s,i) => s + i.price, 0);
        const tax = subtotal * 0.075;
        const total = subtotal + tax;
        const invoiceNo = `INV-${Date.now().toString().slice(-6)}`;
        const date = new Date().toLocaleDateString("en-NG", { year:"numeric", month:"long", day:"numeric" });
        const rows = items.map(i => `├◆ ${i.name.padEnd(20)} ₦${i.price.toLocaleString()}`).join("\n");
        try {
            const invoiceData = {
                invoiceNo, date, client, from: "Gift Axis Labs™",
                items: items.map(i => ({ name: i.name, price: i.price, qty: 1 })),
                subtotal, tax: parseFloat(tax.toFixed(2)), total
            };
            const served = await fileServer.serveInvoicePage(invoiceData);
            await sock.sendMessage(m.key.remoteJid, {
                text: "┌ ❏ ◆ ⌜🧾 𝗜𝗡𝗩𝗢𝗜𝗖𝗘 𝗣𝗔𝗚𝗘⌟ ◆\n│\n├◆ 🔗 " + served.url + "\n├◆ 📥 Print or save as PDF\n└ ❏" + config.footer
            }, { quoted: m });
        } catch(e) {}
        reply(
            `┌ ❏ ◆ ⌜🧾 𝗜𝗡𝗩𝗢𝗜𝗖𝗘⌟ ◆\n│\n` +
            `├◆ 🆔 Invoice #: ${invoiceNo}\n` +
            `├◆ 📅 Date: ${date}\n` +
            `├◆ 👤 Bill To: ${client}\n│\n` +
            `├◆ 📋 ITEMS:\n${rows}\n│\n` +
            `├◆ 💰 Subtotal: ₦${subtotal.toLocaleString()}\n` +
            `├◆ 📊 VAT (7.5%): ₦${tax.toFixed(2)}\n` +
            `├◆ 💳 TOTAL: *₦${total.toLocaleString()}*\n│\n` +
            `├◆ ✅ Thank you for your business!\n└ ❏` + config.footer
        );
    }
};
