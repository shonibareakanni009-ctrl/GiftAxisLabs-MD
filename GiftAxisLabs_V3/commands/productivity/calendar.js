module.exports = {
    name: "calendar",
    async execute(sock, m, args, reply) {
        const d = new Date(); reply(`📅 Date: ${d.toDateString()}`);
    }
};
