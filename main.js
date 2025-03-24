import * as dotenv from 'dotenv';
import { Client as NotionClient } from '@notionhq/client';
import qrcode from 'qrcode-terminal';
import qrCodeData from 'qrcode';
import pkg from 'whatsapp-web.js';
import express from 'express';
import fs from 'fs';
import path from 'path';

dotenv.config();

const notion = new NotionClient({ auth: process.env.NOTION_TOKEN });
const chatIdDestino = '553195235384@c.us'; // Substitua pelo ID do chat
const { Client, LocalAuth } = pkg;

const whatsappClient = new Client({ authStrategy: new LocalAuth() });
const qrCodePath = path.join('/tmp', 'qrcode.png');
let qrCode = '';

whatsappClient.on('qr', async (qr) => {
    qrcode.generate(qr, { small: true });
    qrCode = qr;

    // Gerar QR Code como imagem
    const qrImage = await qrCodeData.toDataURL(qr);
    const base64Data = qrImage.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(qrCodePath, base64Data, 'base64');
});

whatsappClient.on('ready', () => {
    console.log('Bot do WhatsApp está pronto!');
    verificarTarefasHoje();
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use('/static', express.static('/tmp'));

app.get('/qrcode', (req, res) => {
    if (!fs.existsSync(qrCodePath)) {
        return res.send('<h2>Nenhum QR Code disponível no momento. Aguarde...</h2>');
    }
    res.send(`<h2>Escaneie o QR Code abaixo para conectar:</h2><img src="/static/qrcode.png" />`);
});

app.listen(PORT, () => console.log(`🔹 Acesse http://localhost:${PORT}/qrcode para escanear o QR Code.`));

async function getTasks() {
    const filter = { database_id: process.env.NOTION_DATABASE_ID };
    const results = await notion.databases.query(filter);

    return results.results.map((page) => ({
        id: page.id,
        title: page.properties.Name.title[0].text.content,
        status: page.properties.Status.status.name,
        data: converterData(page.properties.Data.date.start),
    }));
}

function converterData(dataAmericana) {
    const [ano, mes, dia] = dataAmericana.split("-");
    return `${dia}/${mes}/${ano}`;
}

function verificarDataHoje(data) {
    const dataAtual = new Date();
    const [ano, mes, dia] = dataAtual.toISOString().split('T')[0].split('-');
    return data === `${dia}/${mes}/${ano}`;
}

async function verificarTarefasHoje() {
    const tasks = await getTasks();
    const tarefasHoje = tasks.filter(task => verificarDataHoje(task.data));

    if (tarefasHoje.length > 0) {
        const mensagem = tarefasHoje.map(task =>
            `📌 *Prova:* ${task.title}\n📅 *Data:* ${task.data}`
        ).join('\n\n');

        console.log(mensagem);
        whatsappClient.sendMessage(chatIdDestino, `📢 *Provas de Hoje:*\n\n${mensagem}`);
    }
}

whatsappClient.on('message_create', async (message) => {
    if (message.body === '!ping') {
        await message.reply('pong');
    }
    if (message.body === '!tasks') {
        const tasks = await getTasks();
        const response = tasks.sort((a, b) => new Date(a.data) - new Date(b.data))
            .map(task => `📌 *Prova:* ${task.title}\n📅 *Data:* ${task.data}`)
            .join('\n\n');
        await message.reply(response || 'Nenhuma prova encontrada.');
    }
    if (message.body === '!chatid') {
        await message.reply(`O ID deste chat é: ${message.from}`);
    }
});

setInterval(verificarTarefasHoje, 24 * 60 * 60 * 1000);
whatsappClient.initialize();
