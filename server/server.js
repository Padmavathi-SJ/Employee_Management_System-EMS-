import express from 'express';
import cors from 'cors';
import { adminRouter } from './Routes/AdminRoute.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';



const app=express();


const __filename = fileURLToPath(import.meta.url); // This gets the current file's path
const __dirname = dirname(__filename);

const filePath = path.join(__dirname, './uploads', profilePicture);


app.use(cors({
    origin: ["http://localhost:5173"],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

app.use(express.json());


app.use('/auth', adminRouter);


app.listen(3000, () => {
    console.log("Server is running on Port");
})