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

        // 3) если заказы есть, то получить их id
        if (orders) {
            const ids = [];

            orders.forEach(order => {
                ids.push(order._id);
            });


            // 4) по id получить вес и объем каждого заказа
            const ordersWithParams = [];

            const promises = ids.map(async (id) => {
                const orderParams = await getOrderParams(token, id);

                const item = {
                    id: orderParams._id,
                    weight: orderParams.all_requirements.weight,
                    volume: orderParams.all_requirements.volume,
                };
                return item;
            });

            // 5) подобрать подходящие по весу и объему заказы
            const suitableOffers = [];

            Promise.all(promises)
                .then(async(results) => {
                    ordersWithParams.push(...results);

                    ordersWithParams.forEach(order => {

                        if (order.weight >= 1.5 && order.weight <= 8.5 && order.volume < 50) {
                            suitableOffers.push(order);
                        }
                    });

                    // 6) если есть подходящие заказы, принять их
                    if (suitableOffers.length > 0) {

                        const promises = suitableOffers.map(async (order) => {
                            try {
                                const isApproved = await approveOrder(token, order.id);
                                console.log(`Заказ ${ order.id } был ${await isApproved }`);
                                return isApproved;
                            } catch (error) {
                                console.error(`Ошибка при одобрении заказа ${ order.id }:`, error);
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
                        console.log('сейчас нет подходящих заказов')
                    }
                })
                .catch(error => {
                    console.error('Error fetching order params:', error);
                });
        }
    }
}

start();



// вес от 1500 до 8500 кг
// объем до 50 кубов