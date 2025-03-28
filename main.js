import * as dotenv from 'dotenv';
import { Client as NotionClient } from '@notionhq/client';
import qrcode from 'qrcode-terminal';
import qrCodeData from 'qrcode';
import pkg from 'whatsapp-web.js';
import express from 'express';

dotenv.config();

const notion = new NotionClient({
    auth: process.env.NOTION_TOKEN
});

const chatIdDestino = '553195235384@c.us'; // Substitua pelo ID do chat

const { Client, LocalAuth } = pkg;

const whatsappClient = new Client({
    authStrategy: new LocalAuth(),
});

let qrCode = '';

whatsappClient.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    qrCode = qr;
});

whatsappClient.on('ready', () => {
    console.log('Bot do WhatsApp está pronto!');
    verificarTarefasHoje(); // Verifica provas no início do bot
});

const app = express();

app.get('/qrcode', async (req, res) => {
    if (!qrCode) {
        return res.send('<h2>Nenhum QR Code disponível no momento. Aguarde...</h2>');
    }

    const qrImage = await qrCodeData.toDataURL(qrCode);
    res.send(`<h2>Escaneie o QR Code abaixo para conectar:</h2><img src="${qrImage}" />`);
});

// Rota de ping para manter a aplicação ativa
app.get('/ping', (req, res) => {
    res.send('pong');
});

app.listen(3000, () => console.log(`🔹 Acesse https://integracaonotion.onrender.com/qrcode para escanear o QR Code.`));

// Função para fazer ping periódico
const pingSelf = () => {
    const url = `https://integracaonotion.onrender.com/qrcode`;
    axios.get(url)
        .then(() => console.log('Ping realizado com sucesso.'))
        .catch(err => console.error('Erro ao realizar o ping:', err));
};

// Configura um intervalo para realizar o ping a cada 14 minutos
setInterval(pingSelf, 14 * 60 * 1000);

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

    const dataFormatada = `${dia}/${mes}/${ano}`;

    return data === dataFormatada;
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
        const response = tasks
            .sort((a, b) => new Date(a.data) - new Date(b.data)) // Ordena por data crescente
            .map(task => `📌 *Prova:* ${task.title}\n📅 *Data:* ${task.data}`)
            .join('\n\n');

        await message.reply(response || 'Nenhuma prova encontrada.');
    }

    if (message.body === '!chatid') {
        await message.reply(`O ID deste chat é: ${message.from}`);
    }
});

// Verifica as provas diariamente
setInterval(verificarTarefasHoje, 24 * 60 * 60 * 1000); // Executa a cada 24 horas

whatsappClient.initialize();
