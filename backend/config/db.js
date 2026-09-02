const mongoose = require('mongoose');

// Em ambiente serverless (Vercel), reutilizamos a conexão entre invocações
// para não abrir uma conexão nova a cada requisição.
let cached = global._mongooseConn;

if (!cached) {
  cached = global._mongooseConn = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI não definida nas variáveis de ambiente.');
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, {
        // opções padrão do mongoose 8+ já são adequadas
      })
      .then((mongooseInstance) => mongooseInstance);
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    // Permite uma nova tentativa após uma falha transitória de rede/Atlas.
    cached.promise = null;
    throw error;
  }
  console.log('MongoDB conectado');
  return cached.conn;
}

module.exports = connectDB;
