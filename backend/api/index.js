require('dotenv').config();
const app = require('../app');

// Na Vercel, cada arquivo dentro de /api vira uma função serverless.
// Aqui exportamos o app do Express diretamente — a Vercel cuida do resto.
module.exports = app;
