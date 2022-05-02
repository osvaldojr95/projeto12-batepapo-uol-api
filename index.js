import express, { json } from "express";
import cors from "cors";
import dotenv from "dotenv";
import Joi from "joi";
import { MongoClient } from "mongodb";
import dayjs from "dayjs";

dotenv.config();
const mongoClient = new MongoClient(process.env.MONGO_URI);

const app = express();
app.use(cors());
app.use(express.json())

app.post("/participantes", async (req, res) => {
    const schema = Joi.object({
        name: Joi.string()
            .alphanum()
            .min(1)
            .required()
    })

    try {
        await mongoClient.connect();
        const db = mongoClient.db("projeto12");
        const participantesCollection = db.collection("participantes");
        const mensagensCollection = db.collection("mensagens");
        
        const value = await schema.validateAsync({ name: req.body.name });
        if (await participantesCollection.findOne({ name: value.name })) throw new Error("name exist");
        
        const obj = { name: value.name, lastStatus: Date.now() };
        await participantesCollection.insertOne(obj);
        await mensagensCollection.insertOne({ from: obj.name, to: "Todos", text: "entra na sala...", type: "status", time: dayjs(obj.lastStatus).format("HH:mm:ss") });

        res.sendStatus(201);
        mongoClient.close();
    } catch (e) {
        switch (e.message) {
            default:
                res.sendStatus(500);
                break;
            case '"name" is not allowed to be empty':
                res.sendStatus(422);
                break;
            case 'name exist':
                res.sendStatus(409);
                break;
        }
        mongoClient.close();
    }
});

app.get("/participantes", async (req, res) => {
    try {
        await mongoClient.connect();
        const db = mongoClient.db("projeto12");
        const participantesCollection = db.collection("participantes");

        const participantes = await participantesCollection.find({}).toArray();
        res.status(200).send(participantes);
        mongoClient.close();
    } catch (e) {
        res.sendStatus(500);
        mongoClient.close();
    }
});

app.post("/messages", async (req, res) => {
    const { to, text, type } = req.body;
    const { user: from } = req.headers;
    try {
        await mongoClient.connect();
        const db = mongoClient.db("projeto12");
        const participantesCollection = db.collection("participantes");
        const mensagensCollection = db.collection("mensagens");
        
        let participantes = await participantesCollection.find({}).toArray();
        participantes = participantes.map((participante) => {
            return participante.name;
        });
        const schema = Joi.object({
            to: Joi.string()
                .alphanum()
                .min(1)
                .required(),
            text: Joi.string()
                .min(1)
                .required(),
            type: Joi.string()
                .valid("message", "private_message")
                .required(),
            from: Joi.string()
                .valid(...participantes)
                .required()
        });
        const value = await schema.validateAsync({ to, text, type, from });
        await mensagensCollection.insertOne({ from, to, text, type, time: dayjs(Date.now()).format("HH:mm:ss") });
        res.sendStatus(201);
        mongoClient.close();
    } catch (e) {
        res.sendStatus(e.message);
        mongoClient.close();
    }
});

app.listen(5000, () => {
    console.log("Servidor online");
});