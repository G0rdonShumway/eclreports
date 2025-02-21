require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');
const cron = require('node-cron');
const express = require('express');
const mysql = require('mysql2/promise');
const { DateTime } = require('luxon'); // Добавляем библиотеку Luxon

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

const FETCH_URL_1 = process.env.FETCH_URL_1;
const FETCH_URL_2 = process.env.FETCH_URL_2;
const FETCH_URL_3 = process.env.FETCH_URL_3;

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

bot.command('link', (ctx) => {
    ctx.reply('🔗 <a href="https://eclservice.org/reports">Полный отчет</a><br><br>')
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

// Запрос к API и БД каждую первую минуту нечетного часа
cron.schedule('1 10 1,3,5,7,9,11,13,15,17,19,21,23 * * *', async () => {
    try {
        await fetchReport(FETCH_URL_1);
        await fetchReport(FETCH_URL_2);
        await fetchReport(FETCH_URL_3);

        setTimeout(async () => {
            // Используем Luxon для работы с часовым поясом
            let now = DateTime.now().setZone("Asia/Tbilisi");
            let reportDate = now;

            if (now.hour === 1) {
                // Если запрос в 01:00, берём вчерашнюю дату
                reportDate = now.minus({ days: 1 });
            }

            // 3. Запрос к БД
            const reports_1 = await queryDatabase('SELECT Report, DateTime FROM `interval_reports` ORDER BY ID DESC LIMIT 1');
            const reports_2 = await queryDatabase('SELECT Report, DateTime FROM `moyo_ke_interval_reports` ORDER BY ID DESC LIMIT 1');
            const reports_3 = await queryDatabase('SELECT Report, DateTime FROM `moyo_com_interval_reports` ORDER BY ID DESC LIMIT 1');

            if (!reports_1 || reports_1.length === 0) {
                return bot.telegram.sendMessage(CHAT_ID, 'Нет отчета.');
            }

            // 4. Форматирование даты
		const { Report: Report_1 } = reports_1[0];
		const { Report: Report_2 } = reports_2[0] || { Report: "Нет данных" };
		const { Report: Report_3 } = reports_3[0] || { Report: "Нет данных" };

            const formattedDate = reportDate.toFormat("dd-MM-yy HH:00");

            // 5. Отправка сообщения
const message = `
📅 ${formattedDate}

${Report_1}
🔗 [Полный отчет](https://eclservice.org/reports)

🔹 moyobet.ke: 
${Report_2}

🔹 moyobet.com: 
${Report_3}`;
            
            bot.telegram.sendMessage(CHAT_ID, message);
        }, 5000);
    } catch (error) {
        console.error(`Ошибка при получении отчёта:`, error.message);
    }
}, {
    scheduled: true,
    timezone: "Asia/Tbilisi"
});


cron.schedule('*/5 * * * *', async () => {
    try {
        await fetch(SELF_URL);
        // await bot.telegram.sendMessage(CHAT_ID, 'Пинг 🟢');
        console.log(`Пинг отправлен`);
    } catch (error) {
        console.error('Ошибка пинга:', error);
    }
}, {
   scheduled: true,
   timezone: "Asia/Tbilisi"
});

// Пингует бота каждые 10 минут, чтобы Render не засыпал
// setInterval(async () => {
//     try {
//         await bot.telegram.sendMessage(CHAT_ID, 'Пинг 🟢');
//         console.log(`Пинг отправлен`);
//     } catch (error) {
//         console.error('Ошибка пинга:', error);
//     }
// }, 600000);

// Запуск Express сервера
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
