const express = require('express');
const cors = require('cors');
const { connectStore } = require('./config/store');
const authRoutes = require('./routes/authRoutes');
const availabilityRoutes = require('./routes/availabilityRoutes');
const userRoutes = require('./routes/userRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const professionalRoutes = require('./routes/professionalRoutes');
const paymentMethodRoutes = require('./routes/paymentMethodRoutes');
const chargeRoutes = require('./routes/chargeRoutes');
const settingRoutes = require('./routes/settingRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const maintenanceRoutes = require('./routes/maintenanceRoutes');
const { removerAgendasVencidas } = require('./utils/agendasVencidas');
const { requireNexusOnline } = require('./middleware/nexusAccess');
const { validateNexusAccess } = require('./utils/nexusValidation');

const app = express();
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    // O cliente usa o JWT no cabeçalho Authorization, não cookies. Assim,
    // quando CORS_ORIGIN não for configurado a API continua utilizável em
    // desenvolvimento, sem combinar "*" com credenciais.
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Origem não permitida por CORS.'));
    },
  })
);
// A logomarca é enviada como data URL (base64); o limite padrão de 100 KB
// do Express rejeita PNGs comuns antes de a rota de configurações processá-los.
app.use(express.json({ limit: '500kb' }));

// A rota de manutenção executa somente um ping no MongoDB. Ela fica antes do
// middleware global para não disparar limpezas de agenda nem depender do Nexus.
app.use('/api/maintenance', maintenanceRoutes);

// Garante conexão com o banco antes de processar qualquer rota
// (importante no ambiente serverless da Vercel, onde não há um "boot" fixo)
app.use(async (req, res, next) => {
  try {
    await connectStore();
    await removerAgendasVencidas();
    next();
  } catch (erro) {
    console.error('Falha ao conectar ao MongoDB:', erro.message);
    res.status(500).json({ mensagem: 'Erro de conexão com o banco de dados.' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', ambiente: process.env.NODE_ENV || 'development' });
});

// Consulta segura usada apenas pela tela de bloqueio. Não expõe chaves,
// token, permissões ou outros dados retornados pelo NexusControl.
app.get('/api/licenca/status', async (req, res) => {
  try {
    const validation = await validateNexusAccess();
    return res.status(validation.online === true ? 200 : 403).json({
      online: validation.online === true,
      ...(validation.licenseStatus ? { licenseStatus: validation.licenseStatus } : {}),
    });
  } catch (error) {
    console.error('Falha ao consultar o estado da licença:', error.message);
    return res.status(503).json({ online: false });
  }
});

// A tela de autenticação precisa permanecer acessível para que o gestor
// consiga corrigir/trocar as credenciais. Todas as operações do programa,
// inclusive login e cadastro, dependem de online === true no NexusControl.
app.use('/api', (req, res, next) => {
  if (req.path === '/configuracoes/autenticacao') return next();
  return requireNexusOnline(req, res, next);
});

app.use('/api/auth', authRoutes);
app.use('/api/agenda', availabilityRoutes);
app.use('/api/usuarios', userRoutes);
app.use('/api/servicos', serviceRoutes);
app.use('/api/profissionais', professionalRoutes);
app.use('/api/formas-pagamento', paymentMethodRoutes);
app.use('/api/cobrancas', chargeRoutes);
app.use('/api/configuracoes', settingRoutes);
app.use('/api/notificacoes', notificationRoutes);

// Handler genérico de erros
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ mensagem: 'Erro interno do servidor.' });
});

module.exports = app;
