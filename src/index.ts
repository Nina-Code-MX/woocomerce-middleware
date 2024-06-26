import express from "express";
import  dotenv  from "dotenv";
import webhookRoutes from "./routes/webhookRoutes";
import SmeeClient from "smee-client";

const app = express();
const PORT = 9950;
const smee = new SmeeClient({
    source: "https://smee.io/ninacodemx",
    target:  `Http://localhost:${PORT}`,

});

smee.start();

app.use(express.json());

app.use('/',webhookRoutes);

app.listen(PORT, () => {});

