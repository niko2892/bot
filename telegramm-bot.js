const TelegramBot = require('node-telegram-bot-api');
const dotenv = require('dotenv');
const fs = require('fs');
const now = new Date();
const dotenvFilePath = '/root/bot/.env';

dotenv.config({path: dotenvFilePath});

let isEnabled = 0;

const bot = new TelegramBot(process.env.API_KEY_BOT, {
    polling: {
        interval: 300,
        autoStart: true
    }
});

//bot.on("polling_error", err => console.log(err.data.error.message));

const commands = [
    {
        command: "start",
        description: "Запуск бота"
    },
    {
        command: "status",
        description: "Узнать включен ли бот"
    },
    {
        command: "stop",
        description: "Выключить бота"
    },
]

bot.setMyCommands(commands);

bot.on('text', async msg => {
    try {
        if (msg.text == '/start') {
            isEnabled = 1;
            // Изменяем значение переменной
            const newEnvContent = fs.readFileSync(dotenvFilePath, 'utf-8')
                .replace('IS_BOT_ENABLED=false', 'IS_BOT_ENABLED=true');
            // Записываем изменения в файл .env
            fs.writeFileSync(dotenvFilePath, newEnvContent);
            // Перезагружаем переменные из .env
            dotenv.config({ path: dotenvFilePath }); // Перезагружаем dotenv
            await bot.sendMessage(msg.chat.id, `Вы запустили бота!`);
            console.log(`${now} : Бот включен. Значение переменной IS_BOT_ENABLED изменено на 1`);
        } else if (msg.text == '/status') {
            if (isEnabled == 1) {
                await bot.sendMessage(msg.chat.id, `Сейчас бот работает`);
            } else {
                await bot.sendMessage(msg.chat.id, `Сейчас бот выключен`);
            }
        } else if (msg.text == '/stop') {
            isEnabled = 0;
            const newEnvContent = fs.readFileSync(dotenvFilePath, 'utf-8')
                .replace('IS_BOT_ENABLED=true', 'IS_BOT_ENABLED=false');
            fs.writeFileSync(dotenvFilePath, newEnvContent);
            dotenv.config({ path: dotenvFilePath }); // Перезагружаем dotenv
            await bot.sendMessage(msg.chat.id, `Вы выключили бота!`);
            console.log(`${now} : Бот выключен. Значение переменной IS_BOT_ENABLED изменено на 0`);
        } else {
            await bot.sendMessage(msg.chat.id, "Не знаю такую команду");
        }
    }
    catch (error) {
        console.log(error);
    }
});
