import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

/**
 * Get the authentication token
 * @returns {Promise<any>}
 */
const getAuthToken = async () => {
    const response = await fetch(`${process.env.RESV_API_AUTH}`, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            "username": process.env.RESV_API_USERNAME,
            "password": process.env.RESV_API_PASSWORD,
            "sucursal": process.env.RESV_API_STORE
        })
    });
    return await response.json();
};

/**
 * Get the product details from the WooCommerce API
 * @param {string} id 
 * @param {any} credentials
 * @returns {Promise<any>}
 */
const getProductDetails = async (id: string, credentials: any) => {
    const response = await fetch(credentials.endpoint + '/products/' + id, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + btoa(credentials.key + ':' + credentials.secret)
        }
    });
    return await response.json();
};

/**
 * Get the product details from the WooCommerce API
 * @param {string} id 
 * @param {string} product_id
 * @param {any} credentials
 * @returns {Promise<any>}
 */
const getProductVariationDetails = async (product_id: string, id: string, credentials: any) => {
    const response = await fetch(credentials.endpoint + '/products/' + product_id + '/variations/' + id, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + btoa(credentials.key + ':' + credentials.secret)
        }
    });
    return await response.json();
};

/**
 * Set the reservation id to the order
 * @param {string} order_id 
 * @param {string} reservation_id 
 * @param {any} credentials
 * @returns {Promise<any>}
 */
const setReservationId = async (order_id: string, reservation_id: string, credentials: any) => {
    const response = await fetch(credentials.endpoint + '/orders/' + order_id, {
        method: 'PUT',
        body: JSON.stringify({
            meta_data: [{
                key: "_reservation_id",
                value: reservation_id
            }]
        }),
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + btoa(credentials.key + ':' + credentials.secret)
        }
    });
    return await response.json();
};

exports.handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
    const req = {
        body: event.body || '{}',
        headers: event.headers || '{}'
    };
    const site = event.queryStringParameters && event.queryStringParameters.hasOwnProperty("site") ? event.queryStringParameters.site : 'es';
    const site_credentials = {
        endpoint: site == 'es' ? process.env.WOOCOMMERCE_ENDPOINT_ES : process.env.WOOCOMMERCE_ENDPOINT_EN,
        key: site == 'es' ? process.env.WOOCOMMERCE_API_KEY_ES : process.env.WOOCOMMERCE_API_KEY_EN,
        secret: site == 'es' ? process.env.WOOCOMMERCE_API_SECRET_ES : process.env.WOOCOMMERCE_API_SECRET_EN
    };

    try {
        JSON.parse(req.body);
    } catch (error) {
        console.error(`Invalid payload: `, error);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: 'Invalid payload.', status: 400, data: {} }),
        };
    }

    let order = JSON.parse(req.body);
    let resp: APIGatewayProxyResult = {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: 'Skipped.', status: 200, data: {} }),
    };

    console.info('Data received: ', JSON.stringify(order));

    const order_id = order?.id || null;
    const order_status = order?.status || 'processing';
    const order_meta_data = order?.meta_data || null;

    if (!order_id || !order_meta_data) {
        console.info('Invalid Order Information.');

        resp.body = JSON.stringify({ message: 'Invalid Order Information.', status: 422, data: {} });

        return resp;
    }

    const reservation_id = order.meta_data.findLast((data: any) => data.key == '_reservation_id')?.value || null;
    const items = order.line_items || [];

    if (order_status != 'cancelled' && reservation_id) {
        console.info('Order already processed.');

        resp.body = JSON.stringify({ message: 'Order already processed.', status: 201, data: { order_id: order_id, order_status: order_status, reservation_id: reservation_id } });

        return resp;
    }

    await Promise.all(items.map(async (line_item: any, index: number) => {
        if (line_item.hasOwnProperty("product_id") && line_item.hasOwnProperty("sku") && line_item.sku == '') {
            const product_details = await getProductDetails(line_item.product_id, site_credentials);

            if (product_details.hasOwnProperty("variations") && product_details.variations.length > 0) {
                let variation_id = product_details.variations[0];

                order.line_items[index].variation_id = variation_id;

                const variation_details = await getProductVariationDetails(line_item.product_id, variation_id, site_credentials);

                if (variation_details.hasOwnProperty("sku")) {
                    order.line_items[index].sku = variation_details.sku;
                }
            }
        }

        if (line_item.hasOwnProperty("meta_data")) {
            line_item.meta_data.forEach((meta: any, index2: number) => {
                if (meta.display_key == 'SKU') {
                    order.line_items[index].meta_data.push({
                        "key": "_sku",
                        "value": order.line_items[index].meta_data[index2].value,
                        "display_key": "_sku",
                        "display_value": order.line_items[index].meta_data[index2].value
                    });
                }

                if (['Adults', 'Adultos'].includes(meta.display_key)) {
                    order.line_items[index].meta_data.push({
                        "key": "_adults",
                        "value": order.line_items[index].meta_data[index2].value,
                        "display_key": "_adults",
                        "display_value": order.line_items[index].meta_data[index2].value
                    });
                }

                if (['Children', 'Niños'].includes(meta.display_key)) {
                    order.line_items[index].meta_data.push({
                        "key": "_kids",
                        "value": order.line_items[index].meta_data[index2].value,
                        "display_key": "_kids",
                        "display_value": order.line_items[index].meta_data[index2].value
                    });
                }

                if (['Description', 'Descripción'].includes(meta.display_key)) {
                    order.line_items[index].meta_data.push({
                        "key": "_combo_description",
                        "value": order.line_items[index].meta_data[index2].value,
                        "display_key": "_combo_description",
                        "display_value": order.line_items[index].meta_data[index2].value
                    });
                }

                if (['Quantity', 'Cantidad'].includes(meta.display_key)) {
                    order.line_items[index].meta_data.push({
                        "key": "_combo_quantity",
                        "value": order.line_items[index].meta_data[index2].value,
                        "display_key": "_combo_quantity",
                        "display_value": order.line_items[index].meta_data[index2].value
                    });
                }

                if (['Pick-up Place', 'Lugar de Reunión'].includes(meta.display_key)) {
                    order.line_items[index].meta_data.push({
                        "key": "_need_transportation",
                        "value": order.line_items[index].meta_data[index2].value,
                        "display_key": "_need_transportation",
                        "display_value": order.line_items[index].meta_data[index2].value
                    });
                }

                if (['Pick-up Schedule', 'Hora de Salida'].includes(meta.display_key)) {
                    let time = '1999-01-01 ' + order.line_items[index].meta_data[index2].value + ' UTC';

                    try {
                        let result_time = new Date(Date.parse(time.split("/").reverse().join("-").toString())).toISOString().split('T')[1].split(':');

                        order.line_items[index].meta_data.push({
                            "key": "_transportation_schedules",
                            "value": result_time[0] + ':' + result_time[1],
                            "display_key": "_transportation_schedules",
                            "display_value": result_time[0] + ':' + result_time[1]
                        });
                    } catch (error) {
                        if (error instanceof RangeError) {
                            console.error(`Invalid date for activity_date <${time}>.`);
                        } else {
                            console.error(`An error ocurred: `, error);
                        }
                    }
                }

                if (['Tour Date', 'Fecha de la Actividad'].includes(meta.display_key)) {
                    let date = order.line_items[index].meta_data[index2].value;

                    try {
                        let result_date = new Date(Date.parse(date.split("/").reverse().join("-").toString())).toISOString().split('T')[0];

                        order.line_items[index].meta_data.push({
                            "key": "_tour_date",
                            "value": result_date,
                            "display_key": "_tour_date",
                            "display_value": result_date
                        });
                    } catch (error) {
                        if (error instanceof RangeError) {
                            console.error(`Invalid date for _tour_date <${date}>.`);
                        } else {
                            console.error(`An error ocurred: `, error);
                        }
                    }
                }

                if (['Tour Schedule', 'Horario de la Actividad'].includes(meta.display_key)) {
                    let time = '1999-01-01 ' + order.line_items[index].meta_data[index2].value + ' UTC';

                    try {
                        let result_time = new Date(Date.parse(time.split("/").reverse().join("-").toString())).toISOString().split('T')[1].split(':');

                        order.line_items[index].meta_data.push({
                            "key": "_tour_schedule",
                            "value": result_time[0] + ':' + result_time[1],
                            "display_key": "_tour_schedule",
                            "display_value": result_time[0] + ':' + result_time[1]
                        });
                    } catch (error) {
                        if (error instanceof RangeError) {
                            console.error(`Invalid date for activity_date <${time}>.`);
                        } else {
                            console.error(`An error ocurred: `, error);
                        }
                    }
                }

                if (['Pick-up Address', 'Domicilio'].includes(meta.display_key)) {
                    order.line_items[index].meta_data.push({
                        "key": "_address",
                        "value": order.line_items[index].meta_data[index2].value,
                        "display_key": "_address",
                        "display_value": order.line_items[index].meta_data[index2].value
                    });
                }

                if (['Pick-up Location', 'Ubicación'].includes(meta.display_key)) {
                    order.line_items[index].meta_data.push({
                        "key": "_location",
                        "value": order.line_items[index].meta_data[index2].value,
                        "display_key": "_location",
                        "display_value": order.line_items[index].meta_data[index2].value
                    });
                }
            });
        }

        Promise.resolve();
    }));

    console.info('Data to sent: ', JSON.stringify(order));

    try {
        const auth = await getAuthToken();

        if (!auth || !auth.hasOwnProperty('token')) {
            throw new Error(`No fue posible obtener el token de autenticacion ${JSON.stringify(auth)}`);
        }

        const response = await fetch(`${process.env.RESV_API_ENDPOINT}`, {
            method: 'POST',
            body: JSON.stringify(order),
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + auth.token
            }
        });
        const data: any = await response.json();

        if (!data.hasOwnProperty('exitoso') || !data.exitoso) {
            throw new Error(`La peticion a la reservacion no fue exitosa ${JSON.stringify(data)}`);
        }

        resp.statusCode = 200;

        if (data.returnId == 2) {
            resp.body = JSON.stringify({ message: 'Cancelled.', status: 200, data: data });
        } else {
            resp.body = JSON.stringify({ message: 'Scheduled.', status: 200, data: data });

            await setReservationId(order.id, data.confirmacion, site_credentials);
        }
    } catch (error) {
        let error_message = '';

        if (error instanceof Error) {
            error_message = error.message || '';
        }

        console.error(`Unable to schedule: `, error);

        resp.statusCode = 200;
        resp.body = JSON.stringify({ message: `Unable to schedule. ${error_message}`, status: 422, data: {} });
    }

    console.log('Response: ', JSON.stringify(resp));

    return resp;
};
