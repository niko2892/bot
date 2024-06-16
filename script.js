const fs = require('node:fs');

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
    const token = await getAuthToken('Matrenin', '1234567890');
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
                oldIds = JSON.parse(fs.readFileSync('./ids.json', 'utf-8'));
            } catch (err) {
                console.log(err);
            }
 
            if (oldIds) {
                ids.forEach(id => {
                    if (oldIds.indexOf(id) != -1) {
                        console.log(`Заявка ${id} уже была раньше обработана. Возможно она была отменена вручную. Не беру её.`)
                    } else {
                        console.log(`Беру заявку ${id} и записываю в список обработанных`);
                        
                        // 4) по id получить вес и объем каждого заказа
            const ordersWithParams = [];

            const promises = ids.map(async (id) => {
                const orderParams = await getOrderParams(token, id);

                const item = {
                    id: orderParams._id,
                    code: orderParams.code,
                    loading_address: orderParams.loading_address,
                    unloading_address: orderParams.unloading_address,
                    weight: orderParams.all_requirements.weight,
                    volume: orderParams.all_requirements.volume,
                };

                return item;
            });

            // 5) подобрать подходящие по весу и объему заказы
            const suitableOffers = [];

            Promise.all(promises)
                .then(async (results) => {
                    ordersWithParams.push(...results);

                    ordersWithParams.forEach(order => {

                        if (order.weight >= 1.5 &&
                            order.weight <= 8.5 &&
                            order.volume < 50 &&
                            containsTargetWords(order.loading_address) &&
                            containsTargetWords(order.unloading_address)
                        ) {
                            suitableOffers.push(order);
                        }
                    });

                    // 6) если есть подходящие заказы, принять их
                    if (suitableOffers.length > 0) {
                        console.log(suitableOffers)
                        const promises = suitableOffers.map(async (order) => {
                            try {
                                const isApproved = await approveOrder(token, order.id);
                                console.log(`Заказ ${ order.id } c кодом ${order.code} был ${await isApproved }`);
                                return isApproved;
                            } catch (error) {
                                console.error(`Ошибка при одобрении заказа ${ order.id } c кодом ${order.code} :`, error);
                                return false; // Или другой результат при ошибке
                            }
                        });

                        for (const promise of promises) {
                            try {
                                const isApproved = await promise;
                                // Дополнительные действия с результатом isApproved
                            } catch (error) {
                                console.error('Ошибка при ожидании выполнения промиса:', error);
                            }
                        }
                    } else {
                        console.log('сейчас нет подходящих заказов');
                        console.log(ordersWithParams);
                    }
                })
                .catch(error => {
                    console.error('Error fetching order params:', error);
                });

                        oldIds.push(id);
                    }
                });
    
            }

            fs.writeFile('./ids.json', JSON.stringify(oldIds), err => {
                if (err) {
                    console.log(err);
                }
            });
        }
    }
}

start();