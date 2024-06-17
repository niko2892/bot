const fs = require('fs');
const idsFilePath = '/root/bot/ids.json'; //Linux
// const idsFilePath = './ids.json'; //Windows
const now = new Date();
require('dotenv').config({path: '/root/bot/.env'});

function containsTargetWords(str) {
    // Регулярное выражение для поиска целевых слов/фраз, игнорируя регистр 
    const regex = /московская обл|московская область|москва/i;

    // Метод test возвращает true, если строка содержит хотя бы одно из целевых слов/фраз 
    return regex.test(str);
}

async function getAuthToken(username, password) {
    const token = await fetch("https://dostavka.tstn.ru/api/login/authenticate2", {
        "headers": {
            "accept": "application/json, text/plain, */*",
            "authorization": "Bearer null",
            "content-type": "application/json",
            "priority": "u=1, i",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "Referrer-Policy": "strict-origin-when-cross-origin"
        },
        "body": `{\"username\":\"${username}\",\"password\":\"${password}\"}`,
        "method": "POST"
    });

    return await token.json();
}

async function getOrders(token) {
    const data = await fetch("https://dostavka.tstn.ru/api/orders?filter[loading_address]=моск&filter[base1c]=Europe&type=common", {
        "headers": {
            "accept": "application/json, text/plain, */*",
            "authorization": `Bearer ${token}`,
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "Referrer-Policy": "strict-origin-when-cross-origin"
        },
        "body": null,
        "method": "GET"
    });

    return await data.json();
}

async function getOrderParams(token, id) {
    const data = await fetch(`https://dostavka.tstn.ru/api/orders/${id}`, {
        "headers": {
            "accept": "application/json, text/plain, */*",
            "authorization": `Bearer ${token}`,
        },
        "body": null,
        "method": "GET"
    });

    return await data.json();
}

async function approveOrder(token, id) {
    //если заявка уже взята, то будет ошибка 500
    const data = await fetch(`https://dostavka.tstn.ru/api/orders/approve/${id}`, {
        "headers": {
            "accept": "application/json, text/plain, */*",
            "authorization": `Bearer ${token}`,
        },
        "body": null,
        "method": "GET"
    });

    return await data.json();
}

async function start() {
    // 1) получить токен для выполнения запросов
    const token = await getAuthToken(process.env.TSTN_LOGIN, process.env.TSTN_PASSWORD);
    // 2) получить свободные заказы

    if (token) {
        const orders = await getOrders(token);

        // 3) если заказы есть, то получить их id и сохранить в файл
        if (orders) {
            const ids = [];

            orders.forEach(order => {
                ids.push(order._id);
            });

            let oldIds;

            try {
                oldIds = JSON.parse(fs.readFileSync(idsFilePath, 'utf-8'));
            } catch (err) {
                console.log(err);
            }

            if (oldIds) {
                ids.forEach(id => {
                    if (oldIds.indexOf(id) != -1) {
                        console.log(`${now} : Заявка ${id} уже была раньше обработана. Возможно она была отменена вручную. Не беру её.`)
                    } else {
                        console.log(`${now} : Беру в работу заявку ${id} и записываю в список обработанных`);

                        // 4) по id получить вес и объем заказа
                        const suitableOffers = [];

                        async function useNewOrderFlow() {
                            const orderParams = await getOrderParams(token, id);

                            const item = {
                                id: orderParams._id,
                                code: orderParams.code,
                                loading_address: orderParams.loading_address,
                                unloading_address: orderParams.unloading_address,
                                weight: orderParams.all_requirements.weight, //у господ это ОБЪЕМ
                                volume: orderParams.all_requirements.volume, //у господ это МАКС. ВЫСОТА ПОДДОНА
                                width: orderParams.all_requirements.width, //у господ это ВЕС, судя по тому что они показывают у себя на сайте
                            };
                            // console.log(item)
                            // 5) подобрать подходящие по адресу, весу и объему заказы
                            if (item.width >= 1500 && // это ВЕС
                                item.width <= 8500 && // это ВЕС
                                item.weight < 50 && // это ОБЪЕМ
                                containsTargetWords(item.loading_address) &&
                                containsTargetWords(item.unloading_address)
                            ) {
                                // 6) если есть подходящие заказы, принять их
                                try {
                                    const isApproved = await approveOrder(token, item.id);
                                    console.log(`${now} : Заявка ${item.id} c кодом ${item.code} была взята в работу`);

                                    oldIds.push(id);

                                    fs.writeFile(idsFilePath, JSON.stringify(oldIds), err => {
                                        // fs.writeFile(idsFilePath, JSON.stringify([]), err => { //для тестирования
                                        if (err) {
                                            console.log(err);
                                        } else {
                                            console.log(`${now} : Обновляю список обработанных заявок. Новый список: ${JSON.stringify(oldIds)}`);
                                        }
                                    });

                                    return isApproved;
                                } catch (error) {
                                    console.error(`${now} : Ошибка при одобрении заказа ${item.id} c кодом ${item.code} :`, error);
                                    return false; // Или другой результат при ошибке
                                }
                            } else {
                                console.log(`${now} : Заявка ${id} не подошла по параметрам`);
                                // console.log(ordersWithParams);
                            }

                            oldIds.push(id);

                            fs.writeFile(idsFilePath, JSON.stringify(oldIds), err => {
                                // fs.writeFile(idsFilePath, JSON.stringify([]), err => { //для тестирования
                                if (err) {
                                    console.log(err);
                                } else {
                                    console.log(`${now} : Обновляю список обработанных заявок. Новый список: ${JSON.stringify(oldIds)}`);
                                }
                            });
                        }
                       
                        useNewOrderFlow();
                    }
                });
            } else {
                console.error('Не прочитан файл ids.json , что-то пошло не так');
            }
        }
    }
}

if(process.env.IS_BOT_ENABLED == "true") {
    start();
} else {
    console.log(`${now} : Бот сейчас выключен через телеграм`);
}
