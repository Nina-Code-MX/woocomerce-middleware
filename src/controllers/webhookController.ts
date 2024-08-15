import { Request, Response } from 'express';

export const webhook = async (req: Request, res: Response) => {
    const order = req.body || {};

    let status = 200;
    let messages = "Webhook procesados satisfactoriamente";

    console.log('Data received: ', JSON.stringify(order));

    if (
        (order.hasOwnProperty("status") && order.status == 'cancelled') ||
        (order.hasOwnProperty("date_paid") && order.date_paid)
    ) {
        order.line_items.forEach((line_item: any, index: number) => {
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
                throw new Error(`La peticion a la reservacion falló ${JSON.stringify(data)}`);
            }

            status = 200;

            if (data.returnId == 2) {
                messages = 'Cancelled.';
            } else {
                messages = 'Scheduled.';
            }
        } catch (error) {
            console.error(error);
            status = 400;
            messages = "La peticion a la reservacion no fue exitosa";
        }
    } else {
        status = 202;
        messages = "No procesamos el Webhook";
    }

    res.status(status).json({ messages });
};