require('dotenv').config();
const { Telegraf } = require('telegraf');
const { Markup } = require("telegraf");
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

const ADD_PLAYER = process.env.ADD_PLAYER;

const SELF_URL = process.env.SELF_URL;
const BASE_URL = process.env.BASE_URL;
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

const allowedChats = [1023702517, -4685830501]; // ID пользователей и групп

bot.use((ctx, next) => {
    if (!allowedChats.includes(ctx.chat.id)) {
        return ctx.reply("⛔ Access Denied! Contact @G0rdonShumway for permission.");
    }
    return next();
});

bot.start((ctx) => {
    ctx.reply(
        Markup.keyboard([
            ["Re-do report", "Manage sport players"],
            ["Chat ID"]
        ]).resize()
    );
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

bot.hears("Manage sport players", (ctx) => {
    ctx.reply(
        "Выберите действие:",
        Markup.inlineKeyboard([
            [Markup.button.callback("Добавить игрока", "add_sport_player")],
            [Markup.button.callback("Удалить игрока", "delete_sport_player")],
            [Markup.button.callback("Просмотреть добавленных", "lookup_sport_player")]
        ])
    );
});

bot.action("add_sport_player", async (ctx) => {
    ctx.reply("Добавить спортсмена:");
    bot.on("text", async (ctx) => {
        const username = ctx.message.text.trim();
        await fetch(`${BASE_URL}reports/api/manage_sport_player.php?add&user=${username}`);
        ctx.reply(`✅ Спортсмен ${username} добавлен!`);
    });
});

bot.action("delete_sport_player", async (ctx) => {
    ctx.reply("Удалить спортсмена:");
    bot.on("text", async (ctx) => {
        const username = ctx.message.text.trim();
        await fetch(`${BASE_URL}reports/api/manage_sport_player.php?delete&user=${username}`);
        ctx.reply(`✅ Спортсмен ${username} удален!`);
    });
});

bot.action("lookup_sport_player", async (ctx) => {
    await ctx.answerCbQuery();

    try {
        const response = await fetch(`${BASE_URL}reports/api/manage_sport_player.php?lookup`);
        const data = await response.json();

        if (data.players && data.players.length > 0) {
            await ctx.reply(`📋 Список спортсменов:\n` + data.players.map(user => `- ${user}`).join("\n"));
        } else {
            await ctx.reply("⚠️ В списке пока нет спортсменов.");
        }
    } catch (error) {
        console.error("Ошибка при запросе списка игроков:", error);
        await ctx.reply("❌ Ошибка при получении данных. Попробуйте позже.");
    }
});


bot.hears("Chat ID", (ctx) => {
    ctx.reply(`Ваш Chat ID: ${ctx.chat.id}`);
});

bot.hears("Re-do report", (ctx) => {
    ctx.reply(
        "Выберите платформу:",
        Markup.inlineKeyboard([
            [Markup.button.callback("eclipsebet.com", "redo_eclipse")],
            [Markup.button.callback("moyobet.ke", "redo_moyo_ke")],
            [Markup.button.callback("moyobet.com", "redo_moyo_com")],
            [Markup.button.callback("All reports", "redo_all_reports")],
            [Markup.button.callback("re-send report", "resend_report")]
        ])
    );
});

bot.action("redo_eclipse", async (ctx) => {
    await ctx.answerCbQuery();
    await fetch(FETCH_URL_1);
    ctx.reply("✅ Отчет для eclipsebet.com обновлен!");
});

bot.action("redo_moyo_ke", async (ctx) => {
    await ctx.answerCbQuery();
    await fetch(FETCH_URL_2);
    ctx.reply("✅ Отчет для moyobet.ke обновлен!");
});

bot.action("redo_moyo_com", async (ctx) => {
    await ctx.answerCbQuery();
    await fetch(FETCH_URL_3);
    ctx.reply("✅ Отчет для moyobet.com обновлен!");
});

bot.action("redo_all_reports", async (ctx) => {
    await ctx.answerCbQuery();
    await fetchAllReports();
    ctx.reply("✅ Все отчеты обновлены!");
});

bot.action('resend_report', async (ctx) => {
    await fetchAndSendReport();
    ctx.reply("✅ Отчет отправлен!");
});

async function setSettingsBeforeFetch(projectId) {
    try {
        const response = await fetch(`${BASE_URL}endpoints/setSettings.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project: projectId })
        });

        if (!response.ok) {
            throw new Error(`Ошибка setSettings: ${response.statusText}`);
        }

        console.log(`✅ Успешный запрос, проект:  ${projectId}`);
    } catch (error) {
        console.error(`Ошибка при setSettings для projectId ${projectId}:`, error.message);
    }
}

async function fetchAllReports() {
    const urls = [
        { url: FETCH_URL_1, projectId: 1868048 },
        { url: FETCH_URL_2, projectId: 18757058 },
        { url: FETCH_URL_3, projectId: 18754737 }
    ];
    const failedRequests = [];

    for (const { url, projectId } of urls) {
        let attempts = 0;
        let success = false;

        try {
            await setSettingsBeforeFetch(projectId); // Запрос перед основным

            while (attempts < 3 && !success) {
                try {
                    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } });

                    if (!response.ok) {
                        throw new Error(`Ошибка запроса: ${response.statusText}`);
                    }

                    console.log(`✅ Успешный запрос: ${url}`);
                    success = true;
                } catch (error) {
                    console.error(`❌ Попытка ${attempts + 1} не удалась для ${url}:`, error.message);
                    attempts++;
                    if (attempts === 3) {
                        failedRequests.push(url);
                    }
                }
            }
        } catch (error) {
            console.error(`Ошибка при подготовке перед запросом ${url}:`, error.message);
        }
    }

    if (failedRequests.length > 0) {
        const errorMessage = `❌ Не удалось выполнить запросы:\n${failedRequests.join('\n')}`;
        bot.telegram.sendMessage(1023702517, errorMessage);
    } else {
        setTimeout(fetchAndSendReport, 5000);
    }
}

cron.schedule('0 0 1,3,5,7,9,11,13,15,17,19,21,23 * * *', async () => {
    setTimeout(fetchAllReports, 30000);
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
