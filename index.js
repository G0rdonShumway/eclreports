require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');
const cron = require('node-cron');
const express = require('express');
const mysql = require('mysql2/promise');

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const FETCH_URL = process.env.FETCH_URL;
const SELF_URL = process.env.SELF_URL;
const PORT = process.env.PORT || 3000;

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

// Функция для запроса к MySQL
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

// Тестовая команда
bot.command('test', (ctx) => {
    ctx.reply('Бот может отправлять сообщения!');
});

// Получение Chat ID
bot.command('id', (ctx) => {
    console.log(`Chat ID: ${ctx.chat.id}`);
    ctx.reply(`Ваш Chat ID: ${ctx.chat.id}`);
});

async function fetchReport(url) {
	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			}
		});

		if (!response.ok) {
			throw new Error('Network response was not ok');
		}

		const data = await response.json();
		console.log(data);
	} catch (error) {
		console.error(`Ошибка запроса:`, error);
	}
}

cron.schedule('* * * * *', () => {
  console.log('running a task every minute');
});

// Запрос к API и БД каждую первую минуту нечетного часа
// cron.schedule('1 1-23/2 * * *', async () => {
//     try {
//         // 1. Запрос к API
//         fetchReport(FETCH_URL);

//         // 2. Запрос к БД
//         const reports = await queryDatabase(
//             'SELECT Report, DateTime FROM `interval_reports` ORDER BY ID DESC LIMIT 1'
//         );

//         if (!reports || reports.length === 0) {
//             return bot.telegram.sendMessage(CHAT_ID, 'Нет отчета.');
//         }

//         // 3. Формирование и отправка сообщения
//         const { Report, DateTime } = reports[0];
//         const message = `📅 ${DateTime}\n${Report}\nhttps://eclservice.org/reports}`;
        
//         bot.telegram.sendMessage(CHAT_ID, message);
//     } catch (error) {
//         console.error(`Ошибка при получении отчёта:`, error.message);
//     }
// });

// Пингует бота каждые 10 минут, чтобы Render не засыпал
setInterval(async () => {
    try {
        await bot.telegram.sendMessage(CHAT_ID, 'Пинг 🟢');
        console.log(`Пинг отправлен`);
    } catch (error) {
        console.error('Ошибка пинга:', error);
    }
}, 600000);

// Запуск Express сервера
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
