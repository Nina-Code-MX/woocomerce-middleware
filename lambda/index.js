module.exports.handler = async (event, context) => {
    try {
        JSON.parse(event.body);
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

    const order = JSON.parse(event.body);
    const response = {
        statusCode: 201,
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: 'Skipped.' })
    };

    if (
        (order.hasOwnProperty("status") && order.status == 'cancelled') ||
        (order.hasOwnProperty("date_paid") && order.date_paid)
    ) {
        try {
            const response = await fetch("https://apps.canopyriver.com/api/ReservasWEB", {
                method: 'POST',
                body: JSON.stringify(order),
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            const data = await response.json();

            if (!data.exitoso) {
                throw new Error(`La peticion a la reservacion no fue exitosa ${JSON.stringify(data)}`);
            }

            console.log(`Scheduled`, data);

            response.statusCode = 200;
            response.body = JSON.stringify({ message: 'Scheduled.' });
        } catch (error) {
            console.error(`Unable to schedule: `, error);

            response.statusCode = 400;
            response.body = JSON.stringify({ message: 'Unable to schedule.' });
        }
    }

    return response;
};