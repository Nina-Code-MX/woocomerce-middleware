import { Request, Response } from 'express';

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

export const webhook = async (req: Request, res: Response) => {
    const order = req.body || {};
    const site = req.query && req.query.hasOwnProperty("site") ? req.query.site : 'es';
    const site_credentials = {
        endpoint: site == 'es' ? process.env.WOOCOMMERCE_ENDPOINT_ES : process.env.WOOCOMMERCE_ENDPOINT_EN,
        key: site == 'es' ? process.env.WOOCOMMERCE_API_KEY_ES : process.env.WOOCOMMERCE_API_KEY_EN,
        secret: site == 'es' ? process.env.WOOCOMMERCE_API_SECRET_ES : process.env.WOOCOMMERCE_API_SECRET_EN
    };

    let status = 200;
    let messages = "Webhook procesados satisfactoriamente";
    let resp_data = {};

    console.log('Data received: ', JSON.stringify(order));

    const order_id = order?.id || null;
    const order_status = order?.status || 'processing';
    const order_meta_data = order?.meta_data || null;

    if (!order_id || !order_meta_data) {
        console.info('Invalid Order Information.');
        return res.status(200).json({
            messages: 'Invalid Order Information.',
            status: 422,
            data: {order, site}
        });
    }

    const reservation_id = order.meta_data.findLast((data: any) => data.key == '_reservation_id')?.value || null;
    const items = order.line_items || [];

    if (order_status != 'cancelled' && reservation_id) {
        console.info('Order already processed.');
        return res.status(200).json({
            messages: 'Order already processed.',
            status: 201,
            data: {
                order_id: order_id,
                order_status: order_status,
                reservation_id: reservation_id
            }
        });
    }

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
            throw new Error(`La peticion a la reservacion falló ${JSON.stringify(data)}`);
        }

        status = 200;

        if (data.returnId == 2) {
            messages = 'Cancelled.';
            resp_data = data;
        } else {
            messages = 'Scheduled.';
            resp_data = data;

            await setReservationId(order.id, data.confirmacion, site_credentials);
        }
    } catch (error) {
        console.error(error);
        status = 400;
        messages = "La peticion a la reservacion no fue exitosa";
    }

    console.info('Response: ', JSON.stringify({ messages: messages, status: status, data: resp_data }));

    return res.status(200).json({ messages: messages, status: status, data: resp_data });
};