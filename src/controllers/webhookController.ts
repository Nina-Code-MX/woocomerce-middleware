import { Request, Response } from 'express';

export const webhook =async (req:Request,res:Response) => {

    console.log(`Soy Maximiliano ${JSON.stringify(req.body)}`);
    res.status(200).json({messages: `Bienvenido a mi api`});
    
    
};



