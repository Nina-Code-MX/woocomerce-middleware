import { Request, Response } from 'express';

export const webhook = async (req: Request, res: Response) => {
    const order = req.body || {};

    let status = 200;
    let messages = "Webhook procesados satisfactoriamente";

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