import * as dotenv from 'dotenv';
import { Client as NotionClient } from '@notionhq/client';
import qrcode from 'qrcode-terminal';
import pkg from 'whatsapp-web.js';

dotenv.config();

const notion = new NotionClient({
    auth: process.env.NOTION_TOKEN
});

const chatIdDestino = '553195235384@c.us'; // Substitua pelo ID do chat

const { Client, LocalAuth } = pkg;

const whatsappClient = new Client({
    authStrategy: new LocalAuth(),
});

whatsappClient.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

whatsappClient.on('ready', () => {
    console.log('Bot do WhatsApp está pronto!');
    verificarTarefasHoje(); // Verifica provas no início do bot
});

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
