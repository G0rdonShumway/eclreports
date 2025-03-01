const fetch = require('node-fetch');
const { bot } = require('./index'); // Импортируем бота из `index.js`

const pendingRequests = new Map();

async function handleNewRequest(userId, username, email, adminId) {
    try {
        const message = `🔔 Новая заявка!\n👤 Имя: ${username}\n📧 Email: ${email}\n\n✅ /approve_${userId} ❌ /reject_${userId}`;
        const sentMessage = await bot.telegram.sendMessage(adminId, message);
        
        pendingRequests.set(userId, sentMessage.message_id);
        return true;
    } catch (error) {
        console.error('Ошибка при отправке заявки:', error);
        return false;
    }
}

async function approveRequest(userId, siteUrl) {
    try {
        const response = await fetch(`${siteUrl}/approve.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, status: 'approved' })
        });

        const data = await response.json();

        if (response.ok) {
            console.log(`✅ Заявка ${userId} подтверждена.`);
            pendingRequests.delete(userId);
        } else {
            console.error(`❌ Ошибка при подтверждении заявки:`, data.error);
        }
    } catch (error) {
        console.error('❌ Ошибка сети при подтверждении:', error);
    }
}

async function rejectRequest(userId, siteUrl) {
    try {
        const response = await fetch(`${siteUrl}/approve.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, status: 'rejected' })
        });

        const data = await response.json();

        if (response.ok) {
            console.log(`❌ Заявка ${userId} отклонена.`);
            pendingRequests.delete(userId);
        } else {
            console.error(`⚠ Ошибка при отклонении заявки:`, data.error);
        }
    } catch (error) {
        console.error('❌ Ошибка сети при отклонении:', error);
    }
}


module.exports = { handleNewRequest, approveRequest, rejectRequest };
