require('dotenv').config();
const { Telegraf } = require('telegraf');
const fetch = require('node-fetch');
const cron = require('node-cron');

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID; // ID чата или пользователя
const FETCH_URL = process.env.FETCH_URL; // URL для запроса
const SELF_URL = process.env.SELF_URL; // URL развернутого бота

const bot = new Telegraf(BOT_TOKEN);

async function fetchData() {
    try {
        const response = await fetch(FETCH_URL);
        const data = await response.text(); // или response.json() если API возвращает JSON
        await bot.telegram.sendMessage(CHAT_ID, `Данные с сервера:\n${data.substring(0, 4000)}`);
    } catch (error) {
        console.error('Ошибка запроса:', error);
    }
}

// Запускаем задачу каждую первую минуту нечетного часа
cron.schedule('1 1-23/2 * * *', fetchData);

// Команда для ручного запроса
bot.command('fetch', async (ctx) => {
    await fetchData();
    ctx.reply('Данные обновлены.');
});

// Пингует сам себя каждые 10 минут, чтобы Render не заснул
setInterval(async () => {
    try {
        await fetch(SELF_URL);
        console.log('Пинг отправлен');
    } catch (error) {
        console.error('Ошибка пинга:', error);
    }
}, 10 * 60 * 1000); // 10 минут в миллисекундах

bot.launch();
console.log('Бот запущен.');
