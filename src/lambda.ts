import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

/**
 * Get the product details from the WooCommerce API
 * @param id 
 * @returns 
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
 * @param id 
 * @returns 
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

exports.handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
    const req = {
        body: event.body || '{}',
        headers: event.headers || '{}',
        queryStringParameters: event.queryStringParameters || {}
    };

    try {
        JSON.parse(req.body);
    } catch (error) {
        console.error(`Invalid payload: `, error);

        return {
            statusCode: 202,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: 'Invalid payload.' }),
        };
    }

    const site = req.queryStringParameters && req.queryStringParameters.hasOwnProperty("site") ? req.queryStringParameters.site : 'es';
    let order = JSON.parse(req.body);
    let resp: APIGatewayProxyResult = {
        statusCode: 201,
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: 'Skipped.' })
    };

    console.info('Data received: ', JSON.stringify(order));

    if (
        (order.hasOwnProperty("status") && order.status == 'cancelled') ||
        (order.hasOwnProperty("date_paid") && order.date_paid)
    ) {
        const items = order.line_items;

        await Promise.all(items.map(async (line_item: any, index: number) => {
            if (line_item.hasOwnProperty("product_id") && line_item.hasOwnProperty("sku") && line_item.sku == '') {
                const product_details = await getProductDetails(line_item.product_id, {
                    endpoint: site == 'es' ? process.env.WOOCOMMERCE_ENDPOINT_ES : process.env.WOOCOMMERCE_ENDPOINT_EN,
                    key: site == 'es' ? process.env.WOOCOMMERCE_API_KEY_ES : process.env.WOOCOMMERCE_API_KEY_EN,
                    secret: site == 'es' ? process.env.WOOCOMMERCE_API_SECRET_ES : process.env.WOOCOMMERCE_API_SECRET_EN
                });

                if (product_details.hasOwnProperty("variations") && product_details.variations.length > 0) {
                    let variation_id = product_details.variations[0];

                    order.line_items[index].variation_id = variation_id;

                    const variation_details = await getProductVariationDetails(line_item.product_id, variation_id, {
                        endpoint: site == 'es' ? process.env.WOOCOMMERCE_ENDPOINT_ES : process.env.WOOCOMMERCE_ENDPOINT_EN,
                        key: site == 'es' ? process.env.WOOCOMMERCE_API_KEY_ES : process.env.WOOCOMMERCE_API_KEY_EN,
                        secret: site == 'es' ? process.env.WOOCOMMERCE_API_SECRET_ES : process.env.WOOCOMMERCE_API_SECRET_EN
                    });

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
            const response = await fetch("https://apps.canopyriver.com/api/ReservasWEB", {
                method: 'POST',
                body: JSON.stringify(order),
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            const data: any = await response.json();

            if (!data.hasOwnProperty('exitoso') || !data.exitoso) {
                throw new Error(`La peticion a la reservacion no fue exitosa ${JSON.stringify(data)}`);
            }

            resp.statusCode = 200;

            if (data.returnId == 2) {
                resp.body = JSON.stringify({ message: 'Cancelled.' });
            } else {
                resp.body = JSON.stringify({ message: 'Scheduled.' });
            }
        } catch (error) {
            console.error(`Unable to schedule: `, error);

            resp.statusCode = 400;
            resp.body = JSON.stringify({ message: 'Unable to schedule.' });
        }
    }

    return resp;
};

