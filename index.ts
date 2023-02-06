import { PrismaClient } from '@prisma/client'
import tmi from 'tmi.js'
import express from 'express'
import cors from 'cors'
import axios from 'axios'
import * as WebSocket from 'ws';
import * as http from 'http';
import bodyParser from 'body-parser'

const prisma = new PrismaClient()
const app = express()

app.use(cors())
app.use(bodyParser.json())

app.post('/records', async (req: any, res: any) => {

    let {chessUser, twitchUser} = req.body;
    let currentTime = new Date()
    let month = currentTime.getMonth() + 1
    let smonth = ''
    let year = currentTime.getFullYear()
    
    if (month < 10) {
        smonth = month.toLocaleString('en-US', {
            minimumIntegerDigits: 2,
            useGrouping: false
          })
    }

   const {data: {games}} = await axios.get(`https://api.chess.com/pub/player/gandalf868/games/${year}/${smonth}`)

    const record = await prisma.records.create({
        data: {
            chessUser,
            twitchUser,
            data: JSON.stringify(games[games.length - 1])
        },
    })

    console.log(games[games.length - 1])
   res.status(201).json(record)

})

app.get('/games', async (req: any, res: any) => {
    const games = await prisma.games.findMany()
    res.json(games)
})

app.get('/records', async (req: any, res: any) => {
    const records = await prisma.records.findMany()
    res.json(records)
})

app.delete('/games/:id', async (req: any, res: any) => {
    const {id} = req.params;
    await prisma.games.delete({
        where: {id: parseInt(id)}
    })
    res.status(204)
})

app.put('/games/:id', async (req: any, res: any) => {
    const {id} = req.params;
    const updated = await prisma.games.update({
        where: {id: parseInt(id)},
        data: {status: 'progress'}
    })
    res.status(200).json(updated)
})

const server = http.createServer(app);

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws: WebSocket) => {
    console.log(`Recieved a new connection.`);
    ws.send('Hi there, I am a WebSocket server');
});

const client = new tmi.Client({
    options: { debug: true, messagesLogLevel: "info" },
    connection: {
        reconnect: true,
        secure: true
    },
    identity: {
        username: `${process.env.TWITCH_USERNAME}`,
        password: `oauth:${process.env.TWITCH_OAUTH}`
    },
    channels: [`${process.env.TWITCH_CHANNEL}`]
});

client.connect().catch(console.error);

// We shall pass the parameters which shall be required
client.on('message', async (channel, tags, message, self) => {
    // Lack of this statement or it's inverse (!self) will make it in active
    if (self) return;
    
    const parsed = message.split(' ')
    if (parsed[0] === '!challenge') {
        
        let chessUser = parsed[1] || ''
        let twitchUser = tags.username || ''

        const game = await prisma.games.create({
            data: {
                chessUser,
                twitchUser,
                status: 'waiting'
            },
        })

        wss.clients.forEach((client) => {
            client.send('Update Client!')
        })

    }
});


server.listen(8000, () => {
    console.log('Starting server')
})
