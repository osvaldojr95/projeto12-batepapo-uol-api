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
        //Conexão
        await mongoClient.connect();
        const db = mongoClient.db("projeto12");
        const participantesCollection = db.collection("participantes");
        const mensagensCollection = db.collection("mensagens");
        //Validação
        const value = await schema.validateAsync({ name: req.body.name });
        //Erros
        if (await participantesCollection.findOne({ name: value.name })) throw new Error("name exist");
        //Inserção
        const obj = { name: value.name, lastStatus: Date.now() };
        await participantesCollection.insertOne(obj);
        await mensagensCollection.insertOne({ from: obj.name, to: "Todos", text: "entra na sala...", type: "status", time: dayjs(obj.lastStatus).format("HH:mm:ss") });
        //Resposta

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
        //Conexão
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

app.listen(5000, () => {
    console.log("Servidor online");
});