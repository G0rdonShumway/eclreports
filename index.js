require('dotenv').config();
const { Telegraf } = require('telegraf');
const fetch = require('node-fetch');
const cron = require('node-cron');
const express = require('express');

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const FETCH_URL = process.env.FETCH_URL;
const SELF_URL = process.env.SELF_URL; // Например, https://mybot.onrender.com

const bot = new Telegraf(BOT_TOKEN);
const app = express();

// Webhook для Telegram
app.use(bot.webhookCallback('/bot')); 
bot.telegram.setWebhook(`${SELF_URL}/bot`);

// Маршрут для проверки работы бота
app.get('/', (req, res) => {
    res.send('Бот работает!');
});

bot.command('test', async (ctx) => {
    ctx.reply('Бот может отправлять сообщения!');
});

bot.command('id', async (ctx) => {
    console.log(`Chat ID: ${ctx.chat.id}`);
    ctx.reply(`Ваш Chat ID: ${ctx.chat.id}`);
});

// Запрос к API каждую первую минуту нечетного часа
cron.schedule('1 1-23/2 * * *', async () => {
    try {
        const response = await fetch(FETCH_URL);
        const data = await response.text();
        await bot.telegram.sendMessage(CHAT_ID, `Данные с сервера:\n${data.substring(0, 4000)}`);
    } catch (error) {
        console.error('Ошибка запроса:', error);
    }
});

// Пингует сам себя каждые 10 минут
setInterval(async () => {
    try {
        await fetch(SELF_URL);
        console.log(`Пинг отправлен: ${SELF_URL}`);
        await bot.telegram.sendMessage(CHAT_ID, `Пинг отправлен`);
    } catch (error) {
        console.error('Ошибка пинга:', error);
    }
}, 60000);

// Запускаем Express сервер
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
