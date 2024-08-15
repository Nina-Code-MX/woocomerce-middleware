import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

/**
 * Get the product details from the WooCommerce API
 * @param id 
 * @returns 
 */
const getProductDetails = async (id: string) => {
    const response = await fetch(process.env.WOOCOMMERCE_ENDPOINT + '/products/' + id, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + btoa(process.env.WOOCOMMERCE_API_KEY + ':' + process.env.WOOCOMMERCE_API_SECRET)
        }
    });
    return await response.json();
};

/**
 * Get the product details from the WooCommerce API
 * @param id 
 * @returns 
 */
const getProductVariationDetails = async (product_id: string, id: string) => {
    const response = await fetch(process.env.WOOCOMMERCE_ENDPOINT + '/products/' + product_id + '/variations/' + id, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + btoa(process.env.WOOCOMMERCE_API_KEY + ':' + process.env.WOOCOMMERCE_API_SECRET)
        }
    });
    return await response.json();
};

exports.handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
    const req = {
        body: event.body || '{}',
        headers: event.headers || '{}'
    };

    try {
        JSON.parse(req.body);
    } catch (error) {
        console.error(`Invalid payload: `, error);

        return {
            statusCode: 400,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: 'Invalid payload.' }),
        };
    }

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
                const product_details = await getProductDetails(line_item.product_id);

                if (product_details.hasOwnProperty("variations") && product_details.variations.length > 0) {
                    let variation_id = product_details.variations[0];

                    order.line_items[index].variation_id = variation_id;

                    const variation_details = await getProductVariationDetails(line_item.product_id, variation_id);

                    if (variation_details.hasOwnProperty("sku")) {
                        order.line_items[index].sku = variation_details.sku;
                    }
                }
            }

            if (line_item.hasOwnProperty("meta_data")) {
                line_item.meta_data.forEach((meta: any, index2: number) => {
                    if (meta.display_key == 'Fecha de la actividad' || meta.display_key == 'Activity Date') {
                        let activity_date = order.line_items[index].meta_data[index2].value;

                        try {
                            let result_date = new Date(Date.parse(activity_date.split("/").reverse().join("-").toString())).toISOString().split('T')[0];

                            order.line_items[index].meta_data.push({
                                "key": "_tour_date",
                                "value": result_date,
                                "display_key": "_tour_date",
                                "display_value": result_date
                            });
                        } catch (error) {
                            if (error instanceof RangeError) {
                                console.error(`Invalid date for activity_date <${activity_date}>.`);
                            } else {
                                console.error(`An error ocurred: `, error);
                            }
                        }
                    }

                    if (meta.display_key == 'Horario de la actividad' || meta.display_key == 'Pick Up Schedule') {
                        let activity_time = '1999-01-01 ' + order.line_items[index].meta_data[index2].value + ' UTC';

                        try {
                            let result_time = new Date(Date.parse(activity_time.split("/").reverse().join("-").toString())).toISOString().split('T')[1].split(':');

                            order.line_items[index].meta_data.push({
                                "key": "_tour_schedule",
                                "value": result_time[0] + ':' + result_time[1],
                                "display_key": "_tour_schedule",
                                "display_value": result_time[0] + ':' + result_time[1]
                            });
                        } catch (error) {
                            if (error instanceof RangeError) {
                                console.error(`Invalid date for activity_date <${activity_time}>.`);
                            } else {
                                console.error(`An error ocurred: `, error);
                            }
                        }
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

