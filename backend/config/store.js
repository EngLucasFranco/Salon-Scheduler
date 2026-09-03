const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const connectMongo = require('./db');
const User = require('../models/User');
const Availability = require('../models/Availability');
const Service = require('../models/Service');

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
          login TEXT NOT NULL UNIQUE,
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
        CREATE TABLE IF NOT EXISTS services (
          id TEXT PRIMARY KEY,
          nome TEXT NOT NULL COLLATE NOCASE UNIQUE,
          duracao_minutos INTEGER NOT NULL,
          criado_por TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      const columns = await db.all('PRAGMA table_info(users)');
      if (!columns.some((column) => column.name === 'login')) {
        await db.exec('ALTER TABLE users ADD COLUMN login TEXT');
        await db.exec("UPDATE users SET login = lower(substr(email, 1, instr(email || '@', '@') - 1)) WHERE login IS NULL");
        await db.exec('CREATE UNIQUE INDEX IF NOT EXISTS users_login_unique ON users(login)');
      }
      await ensureUserPasswordHashes(db);
      await seedDevelopmentUsers(db);
      return db;
    });
  }
  return sqlitePromise;
}

async function ensureUserPasswordHashes(db) {
  const users = await db.all('SELECT id, senha FROM users');
  for (const user of users) {
    if (!user.senha.startsWith('$2a$') && !user.senha.startsWith('$2b$') && !user.senha.startsWith('$2y$')) {
      await db.run('UPDATE users SET senha = ? WHERE id = ?', await bcrypt.hash(user.senha, 10), user.id);
    }
  }
}

async function connectStore() {
  if (usingMongo()) return connectMongo();
  return sqlite();
}

async function seedDevelopmentUsers(db) {
  const users = [
    { nome: 'Cliente de desenvolvimento', login: '010101', senha: '000001', papel: 'cliente' },
    { nome: 'Gestor de desenvolvimento', login: '020202', senha: '000002', papel: 'gestor' },
  ];
  for (const user of users) {
    const exists = await db.get('SELECT id FROM users WHERE login = ?', user.login);
    if (!exists) {
      await db.run('INSERT INTO users (nome, login, telefone, senha, papel) VALUES (?, ?, ?, ?, ?)', user.nome, user.login, '', await bcrypt.hash(user.senha, 10), user.papel);
    }
  }
}

function safeUser(user) {
  return { id: String(user.id), nome: user.nome, login: user.login, telefone: user.telefone || '', papel: user.papel };
}

function mapMongoUser(user) {
  if (!user) return null;
  return { id: String(user._id), nome: user.nome, login: user.login, telefone: user.telefone || '', papel: user.papel, senha: user.senha };
}

async function findUserByLogin(login) {
  if (usingMongo()) return mapMongoUser(await User.findOne({ login: login.toLowerCase() }));
  const db = await sqlite();
  return db.get('SELECT id, nome, login, telefone, senha, papel FROM users WHERE login = ?', login.toLowerCase());
}

async function findUserById(id) {
  if (usingMongo()) return mapMongoUser(await User.findById(id).select('+senha'));
  const db = await sqlite();
  return db.get('SELECT id, nome, login, telefone, senha, papel FROM users WHERE id = ?', id);
}

async function createUser({ nome, login, telefone, senha, papel }) {
  if (usingMongo()) return mapMongoUser(await User.create({ nome, login, telefone, senha, papel }));
  const db = await sqlite();
  const result = await db.run(
    'INSERT INTO users (nome, login, telefone, senha, papel) VALUES (?, ?, ?, ?, ?)',
    nome, login.toLowerCase(), telefone || '', await bcrypt.hash(senha, 10), papel
  );
  return findUserById(result.lastID);
}

async function listUsers() {
  if (usingMongo()) return (await User.find().sort({ nome: 1 })).map(mapMongoUser);
  return (await (await sqlite()).all('SELECT id, nome, login, telefone, senha, papel FROM users ORDER BY nome COLLATE NOCASE ASC'));
}

async function updateUser(id, { nome, login, telefone, senha, papel }) {
  if (usingMongo()) {
    const user = await User.findById(id).select('+senha');
    if (!user) return null;
    user.nome = nome;
    user.login = login.toLowerCase();
    user.telefone = telefone || '';
    user.papel = papel;
    if (senha) user.senha = senha;
    await user.save();
    return mapMongoUser(user);
  }

  const db = await sqlite();
  const values = [nome, login.toLowerCase(), telefone || '', papel];
  let sql = 'UPDATE users SET nome = ?, login = ?, telefone = ?, papel = ?';
  if (senha) {
    sql += ', senha = ?';
    values.push(await bcrypt.hash(senha, 10));
  }
  sql += ' WHERE id = ?';
  values.push(id);
  const result = await db.run(sql, values);
  return result.changes ? findUserById(id) : null;
}

async function deleteUser(id) {
  if (usingMongo()) return Boolean(await User.findByIdAndDelete(id));
  const result = await (await sqlite()).run('DELETE FROM users WHERE id = ?', id);
  return result.changes > 0;
}

function mapService(service) {
  if (!service) return null;
  return { id: String(service._id || service.id), nome: service.nome, duracaoMinutos: Number(service.duracaoMinutos ?? service.duracao_minutos) };
}

async function listServices() {
  if (usingMongo()) return (await Service.find().sort({ nome: 1 })).map(mapService);
  return (await (await sqlite()).all('SELECT id, nome, duracao_minutos FROM services ORDER BY nome COLLATE NOCASE ASC')).map(mapService);
}

async function createService({ nome, duracaoMinutos, criadoPor }) {
  if (usingMongo()) return mapService(await Service.create({ nome, duracaoMinutos, criadoPor }));
  const id = randomUUID();
  await (await sqlite()).run('INSERT INTO services (id, nome, duracao_minutos, criado_por) VALUES (?, ?, ?, ?)', id, nome, duracaoMinutos, criadoPor || null);
  return { id, nome, duracaoMinutos };
}

async function deleteAgenda(data) {
  if (usingMongo()) return Boolean(await Availability.findOneAndDelete({ data }));
  const result = await (await sqlite()).run('DELETE FROM agendas WHERE data = ?', data);
  return result.changes > 0;
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

module.exports = { connectStore, usingMongo, safeUser, findUserByLogin, findUserById, createUser, listUsers, updateUser, deleteUser, listServices, createService, findAgenda, listAgendas, saveAgenda, deleteAgenda, newSlot };
