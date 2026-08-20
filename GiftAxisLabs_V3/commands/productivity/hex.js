module.exports = {
    name: "hex",
    async execute(sock, m, args, reply) {
        reply('🎨 Color Hex: #'+Math.floor(Math.random()*16777215).toString(16));
    }
};
