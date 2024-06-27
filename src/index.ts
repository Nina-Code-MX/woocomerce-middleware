import express from "express";
import dotenv from "dotenv";
import webhookRoutes from "./routes/webhookRoutes";
import SmeeClient from "smee-client";

dotenv.config();

const app = express();
const PORT = process.env.APP_PORT || 3000;

if (process.env.APP_ENV != "production") {
    const smee = new SmeeClient({
        source: "https://smee.io/ninacodemx",
        target: `http://localhost:${PORT}`,
    });

    smee.start();
}

app.use(express.json());
app.use('/', webhookRoutes);
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
