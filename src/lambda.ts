import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

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

    console.log('Data received: ', JSON.stringify(order));

    if (
        (order.hasOwnProperty("status") && order.status == 'cancelled') ||
        (order.hasOwnProperty("date_paid") && order.date_paid)
    ) {
        order.line_items.forEach((line_item: any, index: number) => {
            if (line_item.hasOwnProperty("meta_data")) {
                line_item.meta_data.forEach((meta: any, index2: number) => {
                    if (meta.display_key == 'Fecha de la actividad' || meta.display_key == 'Activity Date') {
                        try {
                            let activity_date = order.line_items[index].meta_data[index2].value;
                            let result_date = result_date = new Date(Date.parse(activity_date.split("/").reverse().join("-").toString())).toISOString().split('T')[0];

                            order.line_items[index].meta_data.push({
                                "key": "_tour_date",
                                "value": result_date,
                                "display_key": "_tour_date",
                                "display_value": result_date
                            });
                        } catch (error is instanceof RangeError) {
                            console.error(`Invalid date for activity_date <${activity_date}>.`);
                        } catch (error) {
                            console.error(`An error ocurred: `, error);
                        }
                    }

                    if (meta.display_key == 'Horario de la actividad' || meta.display_key == 'Pick Up Schedule') {
                        try {
                            let activity_time = '1999-01-01 ' + order.line_items[index].meta_data[index2].value + ' UTC';
                            let result_time = new Date(Date.parse(activity_time.split("/").reverse().join("-").toString())).toISOString().split('T')[1].split(':');

                            order.line_items[index].meta_data.push({
                                "key": "_tour_schedule",
                                "value": result_time[0] + ':' + result_time[1],
                                "display_key": "_tour_schedule",
                                "display_value": result_time[0] + ':' + result_time[1]
                            });
                        } catch (error is instanceof RangeError) {
                            console.error(`Invalid date for activity_date <${activity_date}>.`);
                        } catch (error) {
                            console.error(`An error ocurred: `, error);
                        }
                    }
                });
            }
        });

        console.log('Data to sent: ', JSON.stringify(order));

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
            console.log(`Scheduled`, data);

            if (!data.exitoso) {
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

