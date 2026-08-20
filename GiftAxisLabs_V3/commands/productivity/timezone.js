module.exports = {
    name: "timezone",
    async execute(sock, m, args, reply) {
        const moment = require('moment-timezone'); reply('🌍 Current UTC Time: ' + moment().tz('UTC').format('LLLL'));
    }
};
