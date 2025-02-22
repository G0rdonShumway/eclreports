require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');
const cron = require('node-cron');
const express = require('express');
const mysql = require('mysql2/promise');
const { DateTime } = require('luxon');

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

const FETCH_URL_1 = process.env.FETCH_URL_1;
const FETCH_URL_2 = process.env.FETCH_URL_2;
const FETCH_URL_3 = process.env.FETCH_URL_3;
const REPORT_LINK = process.env.REPORT_LINK;

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

app.use(bot.webhookCallback('/bot'));
bot.telegram.setWebhook(`${SELF_URL}/bot`);

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

async function fetchReport(url) {
	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: {'Content-Type': 'application/json',}
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

async function fetchAndSendReport() {
    try {
        let now = DateTime.now().setZone("Asia/Tbilisi");
        let reportDate = now;

        if (now.hour === 1) {
            reportDate = now.minus({ days: 1 });
        }

        const reports_1 = await queryDatabase('SELECT Report FROM `interval_reports` ORDER BY ID DESC LIMIT 1');
        const reports_2 = await queryDatabase('SELECT Report FROM `moyo_ke_interval_reports` ORDER BY ID DESC LIMIT 1');
        const reports_3 = await queryDatabase('SELECT Report FROM `moyo_com_interval_reports` ORDER BY ID DESC LIMIT 1');

        if (!reports_1 || reports_1.length === 0) {
            return bot.telegram.sendMessage(CHAT_ID, 'Нет отчета.');
        }

        const { Report: Report_1 } = reports_1[0];
        const { Report: Report_2 } = reports_2[0] || { Report: "Нет данных" };
        const { Report: Report_3 } = reports_3[0] || { Report: "Нет данных" };

        const formattedDate = reportDate.toFormat("dd-MM-yy HH:00");

	function formatNumbers(report) {
	    return report.replace(/\b\d+(\.\d+)?\b/g, (match) => 
		Math.round(Number(match)).toLocaleString("en-US").replace(/,/g, " ")
	    );
	}

        const formattedReport_1 = formatNumbers(Report_1);
        const formattedReport_2 = formatNumbers(Report_2);
        const formattedReport_3 = formatNumbers(Report_3);

        const message = `
📅 ${formattedDate}

🔹<b>eclipsebet com:</b> 
${formattedReport_1}
🔹<b>moyobet ke:</b> 
${formattedReport_2}
🔹<b>moyobet com:</b> 
${formattedReport_3}
<a href="${REPORT_LINK}">🔗Смотреть полный отчет</a>`;

        bot.telegram.sendMessage(CHAT_ID, message, { parse_mode: "HTML" });
    } catch (error) {
        console.error(`Ошибка при получении отчёта:`, error.message);
    }
}

bot.command('test', (ctx) => ctx.reply('Бот может отправлять сообщения!'));
bot.command('id', (ctx) => ctx.reply(`Ваш Chat ID: ${ctx.chat.id}`));
bot.command('report', async (ctx) => {
    await fetchAndSendReport();
});

cron.schedule('1 0 1,3,5,7,9,11,13,15,17,19,21,23 * * *', async () => {
    await fetchReport(FETCH_URL_1);
    await fetchReport(FETCH_URL_2);
    await fetchReport(FETCH_URL_3);
    setTimeout(fetchAndSendReport, 5000);
}, { scheduled: true, timezone: "Asia/Tbilisi" });

cron.schedule('*/5 * * * *', async () => {
    try {
        await axios.get(SELF_URL);
        console.log(`Пинг отправлен`);
    } catch (error) {
        console.error('Ошибка пинга:', error);
    }
}, { scheduled: true, timezone: "Asia/Tbilisi" });

app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
