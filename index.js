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

const deleteParticipante = async (participantes) => {
    try {
        participantes.forEach(async element => {
            console.log(element.name);
            await mongoClient.connect();
            const db = mongoClient.db("projeto12");
            const participantesCollection = db.collection("participantes");
            await participantesCollection.deleteOne({ name: element.name });

            const mensagensCollection = db.collection("mensagens");
            await mensagensCollection.insertOne({ from: element.name, to: "Todos", text: "sai da sala...", type: "status", time: dayjs(Date.now()).format("HH:mm:ss") });
            mongoClient.close();
        });

    } catch (e) {
        console.log(`Erro ${e}`);
    }
}

const remocaoAutomatica = async () => {
    try {
        await mongoClient.connect();
        const db = mongoClient.db("projeto12");
        const participantesCollection = db.collection("participantes");
        let remover = await participantesCollection.find({}).toArray();
        mongoClient.close();

        remover = remover.filter((part) => { return (part.lastStatus < Date.now() - 10000 ? true : false) });
        deleteParticipante(remover);

    } catch (e) {
        console.log(e.message);
    }
};

app.post("/participants", async (req, res) => {
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

app.get("/participants", async (req, res) => {
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

app.get("/messages", async (req, res) => {
    const limit = parseInt(req.query.limit);
    const { user } = req.headers;
    try {
        await mongoClient.connect();
        const db = mongoClient.db("projeto12");
        const messagesCollection = db.collection("mensagens");

        let messages = await messagesCollection.find({}).toArray();
        messages = messages.filter((msg) => {
            if (msg.to === "Todos" || msg.to === user || msg.from === user) {
                return true;
            }
            return false;
        });
        if (limit) { messages = messages.slice(Math.max(messages.length - limit,0)) }
        res.status(200).send(messages);
        mongoClient.close();
    } catch (e) {
        res.status(500).send(e.message);
        mongoClient.close();
    }
});

app.post("/status", async (req, res) => {
    const { user } = req.headers;
    try {
        await mongoClient.connect();
        const db = mongoClient.db("projeto12");
        const participantesCollection = db.collection("participantes");

        const participanteExistente = await participantesCollection.findOne({ name: user });
        if (!participanteExistente) {
            res.sendStatus(404);
            mongoClient.close();
            return;
        }

        await participantesCollection.updateOne({ name: user }, { $set: { lastStatus: Date.now() } });
        res.sendStatus(200);
        mongoClient.close();
    } catch (e) {
        res.sendStatus(500);
        console.log(e.message);
        mongoClient.close();
    }
});

app.listen(5000, () => {
    console.log("Servidor online");
    setInterval(remocaoAutomatica, 10000);
});