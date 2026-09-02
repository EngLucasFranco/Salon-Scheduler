const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const connectMongo = require('./db');
const User = require('../models/User');
const Availability = require('../models/Availability');

let sqlitePromise;

function usingMongo() {
  return process.env.DB_PROVIDER === 'mongodb' || process.env.NODE_ENV === 'production';
}

async function sqlite() {
  if (!sqlitePromise) {
    const filename = process.env.SQLITE_PATH || path.resolve(__dirname, '../data/agenda.sqlite');
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    sqlitePromise = open({ filename, driver: sqlite3.Database }).then(async (db) => {
      await db.exec(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nome TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          telefone TEXT,
          senha TEXT NOT NULL,
          papel TEXT NOT NULL DEFAULT 'cliente',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS agendas (
          data TEXT PRIMARY KEY,
          aberta INTEGER NOT NULL DEFAULT 1,
          criado_por TEXT,
          slots TEXT NOT NULL DEFAULT '[]'
        );
      `);
      return db;
    });
  }
  return sqlitePromise;
}

async function connectStore() {
  if (usingMongo()) return connectMongo();
  return sqlite();
}

function safeUser(user) {
  return { id: String(user.id), nome: user.nome, email: user.email, telefone: user.telefone || '', papel: user.papel };
}

function mapMongoUser(user) {
  if (!user) return null;
  return { id: String(user._id), nome: user.nome, email: user.email, telefone: user.telefone || '', papel: user.papel, senha: user.senha };
}

async function findUserByEmail(email) {
  if (usingMongo()) return mapMongoUser(await User.findOne({ email: email.toLowerCase() }));
  const db = await sqlite();
  return db.get('SELECT id, nome, email, telefone, senha, papel FROM users WHERE email = ?', email.toLowerCase());
}

async function findUserById(id) {
  if (usingMongo()) return mapMongoUser(await User.findById(id).select('+senha'));
  const db = await sqlite();
  return db.get('SELECT id, nome, email, telefone, senha, papel FROM users WHERE id = ?', id);
}

async function createUser({ nome, email, telefone, senha, papel }) {
  if (usingMongo()) return mapMongoUser(await User.create({ nome, email, telefone, senha, papel }));
  const db = await sqlite();
  const result = await db.run(
    'INSERT INTO users (nome, email, telefone, senha, papel) VALUES (?, ?, ?, ?, ?)',
    nome, email.toLowerCase(), telefone || '', await bcrypt.hash(senha, 10), papel
  );
  return findUserById(result.lastID);
}

function normalizeAgenda(agenda) {
  if (!agenda) return null;
  const raw = typeof agenda.toObject === 'function' ? agenda.toObject() : agenda;
  return {
    data: raw.data,
    aberta: Boolean(raw.aberta),
    criadoPor: raw.criadoPor ? String(raw.criadoPor) : null,
    slots: (raw.slots || []).map((slot) => ({
      _id: String(slot._id), horario: slot.horario, status: slot.status,
      servico: slot.servico || '', cliente: slot.cliente ? String(slot.cliente) : null,
      clienteNome: slot.clienteNome || '', observacao: slot.observacao || '',
    })),
  };
}

function mapSqliteAgenda(row) {
  if (!row) return null;
  return normalizeAgenda({ ...row, aberta: row.aberta === 1, criadoPor: row.criado_por, slots: JSON.parse(row.slots) });
}

async function findAgenda(data) {
  if (usingMongo()) return normalizeAgenda(await Availability.findOne({ data }));
  return mapSqliteAgenda(await (await sqlite()).get('SELECT * FROM agendas WHERE data = ?', data));
}

async function listAgendas(inicio, fim) {
  if (usingMongo()) {
    const filter = inicio && fim ? { data: { $gte: inicio, $lte: fim } } : {};
    return (await Availability.find(filter).sort({ data: 1 })).map(normalizeAgenda);
  }
  let sql = 'SELECT * FROM agendas';
  const params = [];
  if (inicio && fim) { sql += ' WHERE data >= ? AND data <= ?'; params.push(inicio, fim); }
  sql += ' ORDER BY data ASC';
  return (await (await sqlite()).all(sql, params)).map(mapSqliteAgenda);
}

async function saveAgenda(agenda) {
  if (usingMongo()) {
    const saved = await Availability.findOneAndUpdate(
      { data: agenda.data },
      { $set: { aberta: agenda.aberta, criadoPor: agenda.criadoPor || undefined, slots: agenda.slots } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return normalizeAgenda(saved);
  }
  const db = await sqlite();
  await db.run(
    `INSERT INTO agendas (data, aberta, criado_por, slots) VALUES (?, ?, ?, ?)
     ON CONFLICT(data) DO UPDATE SET aberta = excluded.aberta, criado_por = excluded.criado_por, slots = excluded.slots`,
    agenda.data, agenda.aberta ? 1 : 0, agenda.criadoPor || null, JSON.stringify(agenda.slots)
  );
  return agenda;
}

function newSlot(horario) {
  return usingMongo() ? { horario, status: 'disponivel' } : { _id: randomUUID(), horario, status: 'disponivel' };
}

module.exports = { connectStore, usingMongo, safeUser, findUserByEmail, findUserById, createUser, findAgenda, listAgendas, saveAgenda, newSlot };
