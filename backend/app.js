const express = require('express');
const cors = require('cors');
const { connectStore } = require('./config/store');
const authRoutes = require('./routes/authRoutes');
const availabilityRoutes = require('./routes/availabilityRoutes');
const userRoutes = require('./routes/userRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const professionalRoutes = require('./routes/professionalRoutes');

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
app.use(express.json());

// Garante conexão com o banco antes de processar qualquer rota
// (importante no ambiente serverless da Vercel, onde não há um "boot" fixo)
app.use(async (req, res, next) => {
  try {
    await connectStore();
    next();
  } catch (erro) {
    console.error('Falha ao conectar ao MongoDB:', erro.message);
    res.status(500).json({ mensagem: 'Erro de conexão com o banco de dados.' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', ambiente: process.env.NODE_ENV || 'development' });
});

app.use('/api/auth', authRoutes);
app.use('/api/agenda', availabilityRoutes);
app.use('/api/usuarios', userRoutes);
app.use('/api/servicos', serviceRoutes);
app.use('/api/profissionais', professionalRoutes);

// Handler genérico de erros
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ mensagem: 'Erro interno do servidor.' });
});

module.exports = app;
