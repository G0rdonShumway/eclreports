require('dotenv').config();
const { Telegraf } = require('telegraf');
const fetch = require('node-fetch');
const cron = require('node-cron');
const express = require('express');
const axios = require('axios');
const mysql = require('mysql2/promise');

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const FETCH_URL = process.env.FETCH_URL;
const SELF_URL = process.env.SELF_URL; // Например, https://mybot.onrender.com

const dbConfig = {
    host: process.env.DB_HOST, 
    user: process.env.DB_USER, 
    password: process.env.DB_PASSWORD, 
    database: process.env.DB_NAME,
};

const bot = new Telegraf(BOT_TOKEN);
const app = express();

// Webhook для Telegram
app.use(bot.webhookCallback('/bot')); 
bot.telegram.setWebhook(`${SELF_URL}/bot`);

// Маршрут для проверки работы бота
app.get('/', (req, res) => {
    res.send('Бот работает!');
});

async function queryDatabase(sql, params = []) {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute(sql, params);
        return rows;
    } catch (error) {
        console.error('Ошибка MySQL:', error);
        return null;
    } finally {
        if (connection) await connection.end();
    }
}

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
        const response = await axios.post(FETCH_URL, {}, {
            headers: {
                'Content-Type': 'application/json',
            }
        });
        console.log(response.data);
        await bot.telegram.sendMessage(CHAT_ID, `${FETCH_URL}: отчет готов`);

        const reports = await queryDatabase(
            'SELECT Report, DateTime FROM `interval_reports` ORDER BY ID DESC LIMIT 1'
        );
    
        if (!reports || reports.length === 0) {
            return ctx.reply('Нет отчета.');
        }
    
        const { Report, DateTime } = reports[0]; // Получаем данные
    
        const message = `📅 ${DateTime}\n${Report}`; // Формируем сообщение
    
        ctx.reply(message); // Отправляем в Telegram
    } catch (error) {
        console.error(`Error fetching report:`, error.message);
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
