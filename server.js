const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // для раздачи HTML файла

// Конфигурация VK API
const VK_CONFIG = {
    GROUP_ID: process.env.GROUP_ID || '-236570950',
    ACCESS_TOKEN: process.env.VK_ACCESS_TOKEN, // Токен сообщества
    API_VERSION: '5.131'
};

// Эндпоинт для отправки сообщения в группу
app.post('/api/send-message', async (req, res) => {
    try {
        const { message, user_id } = req.body;
        
        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Сообщение не может быть пустым' });
        }

        if (!VK_CONFIG.ACCESS_TOKEN) {
            return res.status(500).json({ 
                error: 'Токен доступа не настроен',
                instruction: 'Добавьте VK_ACCESS_TOKEN в .env файл'
            });
        }

        // Отправляем сообщение через VK API
        const response = await axios.get('https://api.vk.com/method/messages.send', {
            params: {
                access_token: VK_CONFIG.ACCESS_TOKEN,
                v: VK_CONFIG.API_VERSION,
                peer_id: 2000000000 + Math.abs(parseInt(VK_CONFIG.GROUP_ID)), // ID для группового чата
                message: message,
                random_id: Math.floor(Math.random() * 1000000)
            }
        });

        if (response.data.error) {
            console.error('VK API Error:', response.data.error);
            
            // Пробуем отправить на стену если в ЛС не получилось
            if (response.data.error.error_code === 901) {
                // Пробуем wall.post
                const wallResponse = await axios.get('https://api.vk.com/method/wall.post', {
                    params: {
                        access_token: VK_CONFIG.ACCESS_TOKEN,
                        v: VK_CONFIG.API_VERSION,
                        owner_id: VK_CONFIG.GROUP_ID,
                        message: message,
                        from_group: 1
                    }
                });
                
                if (wallResponse.data.error) {
                    return res.status(400).json({ 
                        error: 'Ошибка отправки сообщения',
                        details: wallResponse.data.error
                    });
                }
                
                return res.json({ 
                    success: true, 
                    method: 'wall',
                    message: 'Сообщение отправлено на стену группы'
                });
            }
            
            return res.status(400).json({ 
                error: 'Ошибка VK API',
                details: response.data.error
            });
        }

        res.json({ 
            success: true, 
            method: 'message',
            message_id: response.data.response,
            text: 'Сообщение успешно отправлено в чат группы'
        });

    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).json({ 
            error: 'Внутренняя ошибка сервера',
            details: error.message
        });
    }
});

// Эндпоинт для проверки статуса
app.get('/api/status', (req, res) => {
    res.json({
        status: 'running',
        group_id: VK_CONFIG.GROUP_ID,
        has_token: !!VK_CONFIG.ACCESS_TOKEN,
        bot_ready: true
    });
});

// Эндпоинт для отправки callback запроса
app.post('/api/callback', (req, res) => {
    const { type, object } = req.body;
    
    // Подтверждение callback API
    if (type === 'confirmation') {
        return res.send(process.env.CONFIRMATION_CODE || '');
    }
    
    // Обработка входящих сообщений
    if (type === 'message_new') {
        const message = object.message;
        console.log('Получено сообщение:', message.text);
        
        // Здесь можно добавить логику обработки сообщений
        // Например, автоответчик
    }
    
    res.send('ok');
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    console.log(`Группа: ${VK_CONFIG.GROUP_ID}`);
    console.log(`Токен: ${VK_CONFIG.ACCESS_TOKEN ? 'настроен' : 'НЕ НАСТРОЕН'}`);
});
