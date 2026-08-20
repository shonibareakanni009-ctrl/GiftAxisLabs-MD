module.exports = {
    name: "ip",
    async execute(sock, m, args, reply) {
        const axios = require('axios'); const res = await axios.get('https://api.ipify.org?format=json'); reply('🌐 Server IP: ' + res.data.ip);
    }
};
