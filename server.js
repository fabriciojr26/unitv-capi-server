// Importa os módulos necessários
import express from 'express';
import axios from 'axios';
import crypto from 'crypto';
import cors from 'cors';
import 'dotenv/config'; // Carrega as variáveis de ambiente (do .env local ou da Koyeb)

// --- Variáveis de Ambiente ---
// A Koyeb vai injetar estas variáveis a partir do seu painel de controle
const { META_PIXEL_ID, META_ACCESS_TOKEN, META_TEST_CODE, PORT } = process.env;

// Inicializa o app Express
const app = express();
const appPort = PORT || 8080; // Koyeb define a porta, ou usamos 8080

// --- Middlewares ---
// Habilita CORS para que seu index.html (em outro domínio) possa chamar este servidor
app.use(cors());
// Habilita o parse de JSON no body das requisições
app.use(express.json());

// --- Endpoint da CAPI ---
// O index.html vai chamar este endpoint
app.post('/api/trigger-capi', async (req, res) => {
  console.log('Recebida requisição CAPI...');

  // 1. Validação das Variáveis de Ambiente
  if (!META_PIXEL_ID || !META_ACCESS_TOKEN) {
    console.error("Variáveis de ambiente (META_PIXEL_ID, META_ACCESS_TOKEN) não estão configuradas no servidor.");
    return res.status(500).json({ success: false, error: 'Server configuration error.' });
  }

  // 2. Parse do body enviado pelo index.html
  const { eventName, eventUrl } = req.body;

  if (!eventName || !eventUrl) {
    console.warn('Requisição faltando eventName ou eventUrl');
    return res.status(400).json({ success: false, error: 'Missing eventName or eventUrl' });
  }

  // 3. Coleta de dados do usuário (IP e User Agent)
  // Koyeb (e outros) colocam o IP real em 'x-forwarded-for'
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const clientUserAgent = req.headers['user-agent'];

  if (!clientIp || !clientUserAgent) {
    console.warn('Não foi possível extrair IP ou User Agent');
    // Não paramos, mas avisamos
  }

  // 4. Montagem do payload da CAPI da Meta
  const current_timestamp = Math.floor(Date.now() / 1000);
  const event_id = `evt_${crypto.randomBytes(12).toString('hex')}`; // ID único para desduplicação

  const payload = {
    data: [
      {
        event_name: eventName, // 'Lead'
        event_time: current_timestamp,
        event_source_url: eventUrl,
        event_id: event_id,
        action_source: 'website',
        user_data: {
          client_ip_address: clientIp,
          client_user_agent: clientUserAgent,
        },
      },
    ],
  };

  // Adiciona o código de teste se ele estiver configurado
  if (META_TEST_CODE) {
    payload.test_event_code = META_TEST_CODE;
  }

  // 5. Envio do evento para a API da Meta usando Axios
  const metaApiUrl = `https://graph.facebook.com/v19.0/${META_PIXEL_ID}/events?access_token=${META_ACCESS_TOKEN}`;

  try {
    const metaResponse = await axios.post(metaApiUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
    });

    console.log('Evento CAPI enviado com sucesso:', metaResponse.data);
    res.status(200).json({ success: true, meta_response: metaResponse.data });

  } catch (error) {
    console.error('Erro ao enviar evento CAPI:', error.response ? error.response.data : error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- Rota de Teste (Opcional) ---
app.get('/', (req, res) => {
  res.send('Servidor CAPI da UniTV está rodando!');
});

// --- Inicia o Servidor ---
app.listen(appPort, () => {
  console.log(`Servidor CAPI rodando na porta ${appPort}`);
});
