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
const Professional = require('../models/Professional');

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
          profissional_id TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS agendas (
          id TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          profissional_id TEXT NOT NULL,
          profissional_nome TEXT,
          aberta INTEGER NOT NULL DEFAULT 1,
          intervalo INTEGER NOT NULL DEFAULT 0,
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
        CREATE TABLE IF NOT EXISTS professionals (
          id TEXT PRIMARY KEY,
          nome TEXT NOT NULL COLLATE NOCASE UNIQUE,
          especialidade TEXT,
          telefone TEXT,
          criado_por TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      const columns = await db.all('PRAGMA table_info(users)');
      if (!columns.some((column) => column.name === 'profissional_id')) await db.exec("ALTER TABLE users ADD COLUMN profissional_id TEXT NOT NULL DEFAULT ''");
      if (!columns.some((column) => column.name === 'login')) {
        await db.exec('ALTER TABLE users ADD COLUMN login TEXT');
        await db.exec("UPDATE users SET login = lower(substr(email, 1, instr(email || '@', '@') - 1)) WHERE login IS NULL");
        await db.exec('CREATE UNIQUE INDEX IF NOT EXISTS users_login_unique ON users(login)');
      }
      let agendaColumns = await db.all('PRAGMA table_info(agendas)');
      if (!agendaColumns.some((column) => column.name === 'profissional_id')) {
        await db.exec('ALTER TABLE agendas RENAME TO agendas_anteriores');
        await db.exec('CREATE TABLE agendas (id TEXT PRIMARY KEY, data TEXT NOT NULL, profissional_id TEXT NOT NULL, profissional_nome TEXT, aberta INTEGER NOT NULL DEFAULT 1, intervalo INTEGER NOT NULL DEFAULT 0, criado_por TEXT, slots TEXT NOT NULL DEFAULT \'[]\', UNIQUE(data, profissional_id))');
        await db.exec("INSERT INTO agendas (id, data, profissional_id, profissional_nome, aberta, intervalo, criado_por, slots) SELECT data, data, 'legado', 'Agenda anterior', aberta, intervalo, criado_por, slots FROM agendas_anteriores");
        await db.exec('DROP TABLE agendas_anteriores');
        agendaColumns = await db.all('PRAGMA table_info(agendas)');
      }
      if (!agendaColumns.some((column) => column.name === 'intervalo')) await db.exec('ALTER TABLE agendas ADD COLUMN intervalo INTEGER NOT NULL DEFAULT 0');
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
  return { id: String(user.id), nome: user.nome, login: user.login, telefone: user.telefone || '', papel: user.papel, profissionalId: user.profissionalId || user.profissional_id || '' };
}

function mapMongoUser(user) {
  if (!user) return null;
  return { id: String(user._id), nome: user.nome, login: user.login, telefone: user.telefone || '', papel: user.papel, profissionalId: user.profissionalId || '', senha: user.senha };
}

async function findUserByLogin(login) {
  if (usingMongo()) return mapMongoUser(await User.findOne({ login: login.toLowerCase() }));
  const db = await sqlite();
  return db.get('SELECT id, nome, login, telefone, senha, papel, profissional_id FROM users WHERE login = ?', login.toLowerCase());
}

async function findUserById(id) {
  if (usingMongo()) return mapMongoUser(await User.findById(id).select('+senha'));
  const db = await sqlite();
  return db.get('SELECT id, nome, login, telefone, senha, papel, profissional_id FROM users WHERE id = ?', id);
}

async function createUser({ nome, login, telefone, senha, papel, profissionalId }) {
  if (usingMongo()) return mapMongoUser(await User.create({ nome, login, telefone, senha, papel, profissionalId: profissionalId || '' }));
  const db = await sqlite();
  const result = await db.run(
    'INSERT INTO users (nome, login, telefone, senha, papel, profissional_id) VALUES (?, ?, ?, ?, ?, ?)',
    nome, login.toLowerCase(), telefone || '', await bcrypt.hash(senha, 10), papel, profissionalId || ''
  );
  return findUserById(result.lastID);
}

async function listUsers() {
  if (usingMongo()) return (await User.find().sort({ nome: 1 })).map(mapMongoUser);
  return (await (await sqlite()).all('SELECT id, nome, login, telefone, senha, papel, profissional_id FROM users ORDER BY nome COLLATE NOCASE ASC'));
}

async function updateUser(id, { nome, login, telefone, senha, papel, profissionalId }) {
  if (usingMongo()) {
    const user = await User.findById(id).select('+senha');
    if (!user) return null;
    user.nome = nome;
    user.login = login.toLowerCase();
    user.telefone = telefone || '';
    user.papel = papel;
    user.profissionalId = profissionalId || '';
    if (senha) user.senha = senha;
    await user.save();
    return mapMongoUser(user);
  }

  const db = await sqlite();
  const values = [nome, login.toLowerCase(), telefone || '', papel, profissionalId || ''];
  let sql = 'UPDATE users SET nome = ?, login = ?, telefone = ?, papel = ?, profissional_id = ?';
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

async function updateService(id, { nome, duracaoMinutos }) {
  if (usingMongo()) {
    return mapService(await Service.findByIdAndUpdate(id, { nome, duracaoMinutos }, { new: true, runValidators: true }));
  }
  const result = await (await sqlite()).run('UPDATE services SET nome = ?, duracao_minutos = ? WHERE id = ?', nome, duracaoMinutos, id);
  return result.changes ? { id: String(id), nome, duracaoMinutos } : null;
}

async function deleteService(id) {
  if (usingMongo()) return Boolean(await Service.findByIdAndDelete(id));
  const result = await (await sqlite()).run('DELETE FROM services WHERE id = ?', id);
  return result.changes > 0;
}

function mapProfessional(profissional) {
  if (!profissional) return null;
  return {
    id: String(profissional._id || profissional.id),
    nome: profissional.nome,
    especialidade: profissional.especialidade || '',
    telefone: profissional.telefone || '',
  };
}

async function listProfessionals() {
  if (usingMongo()) return (await Professional.find().sort({ nome: 1 })).map(mapProfessional);
  return (await (await sqlite()).all('SELECT id, nome, especialidade, telefone FROM professionals ORDER BY nome COLLATE NOCASE ASC')).map(mapProfessional);
}

async function createProfessional({ nome, especialidade, telefone, criadoPor }) {
  if (usingMongo()) return mapProfessional(await Professional.create({ nome, especialidade, telefone, criadoPor }));
  const id = randomUUID();
  await (await sqlite()).run(
    'INSERT INTO professionals (id, nome, especialidade, telefone, criado_por) VALUES (?, ?, ?, ?, ?)',
    id, nome, especialidade || '', telefone || '', criadoPor || null
  );
  return { id, nome, especialidade: especialidade || '', telefone: telefone || '' };
}

async function deleteAgenda(data, profissionalId) {
  if (usingMongo()) return Boolean(await Availability.findOneAndDelete({ data, profissionalId }));
  const result = await (await sqlite()).run('DELETE FROM agendas WHERE data = ? AND profissional_id = ?', data, profissionalId);
  return result.changes > 0;
}

function normalizeAgenda(agenda) {
  if (!agenda) return null;
  const raw = typeof agenda.toObject === 'function' ? agenda.toObject() : agenda;
  return {
    data: raw.data,
    profissionalId: raw.profissionalId || raw.profissional_id || '',
    profissionalNome: raw.profissionalNome || raw.profissional_nome || '',
    aberta: Boolean(raw.aberta),
    intervalo: Number(raw.intervalo || 0),
    criadoPor: raw.criadoPor ? String(raw.criadoPor) : null,
    slots: (raw.slots || []).map((slot) => ({
      _id: String(slot._id), horario: slot.horario, status: slot.status,
      servico: slot.servico || '', cliente: slot.cliente ? String(slot.cliente) : null,
      clienteNome: slot.clienteNome || '', observacao: slot.observacao || '',
      servicos: (slot.servicos || []).map((servico) => ({ id: String(servico.id), nome: servico.nome, duracaoMinutos: Number(servico.duracaoMinutos) })),
      duracaoMinutos: Number(slot.duracaoMinutos || 0), reservaId: slot.reservaId || '', reservaInicio: Boolean(slot.reservaInicio),
    })),
  };
}

function mapSqliteAgenda(row) {
  if (!row) return null;
  return normalizeAgenda({ ...row, aberta: row.aberta === 1, criadoPor: row.criado_por, slots: JSON.parse(row.slots) });
}

async function findAgenda(data, profissionalId) {
  if (usingMongo()) return normalizeAgenda(await Availability.findOne({ data, profissionalId }));
  return mapSqliteAgenda(await (await sqlite()).get('SELECT * FROM agendas WHERE data = ? AND profissional_id = ?', data, profissionalId));
}

async function listAgendas(inicio, fim, profissionalId) {
  if (usingMongo()) {
    const filter = { ...(profissionalId ? { profissionalId } : {}), ...(inicio && fim ? { data: { $gte: inicio, $lte: fim } } : {}) };
    return (await Availability.find(filter).sort({ data: 1 })).map(normalizeAgenda);
  }
  let sql = 'SELECT * FROM agendas';
  const params = [];
  const where = [];
  if (inicio && fim) { where.push('data >= ? AND data <= ?'); params.push(inicio, fim); }
  if (profissionalId) { where.push('profissional_id = ?'); params.push(profissionalId); }
  if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
  sql += ' ORDER BY data ASC';
  return (await (await sqlite()).all(sql, params)).map(mapSqliteAgenda);
}

async function saveAgenda(agenda) {
  if (usingMongo()) {
    const saved = await Availability.findOneAndUpdate(
      { data: agenda.data },
      { $set: { aberta: agenda.aberta, intervalo: agenda.intervalo || 0, profissionalNome: agenda.profissionalNome || '', criadoPor: agenda.criadoPor || undefined, slots: agenda.slots } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return normalizeAgenda(saved);
  }
  const db = await sqlite();
  await db.run(
    `INSERT INTO agendas (id, data, profissional_id, profissional_nome, aberta, intervalo, criado_por, slots) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(data, profissional_id) DO UPDATE SET aberta = excluded.aberta, intervalo = excluded.intervalo, profissional_nome = excluded.profissional_nome, criado_por = excluded.criado_por, slots = excluded.slots`,
    `${agenda.data}:${agenda.profissionalId}`, agenda.data, agenda.profissionalId, agenda.profissionalNome || '', agenda.aberta ? 1 : 0, agenda.intervalo || 0, agenda.criadoPor || null, JSON.stringify(agenda.slots)
  );
  return agenda;
}

function newSlot(horario) {
  return usingMongo() ? { horario, status: 'disponivel' } : { _id: randomUUID(), horario, status: 'disponivel' };
}

module.exports = { connectStore, usingMongo, safeUser, findUserByLogin, findUserById, createUser, listUsers, updateUser, deleteUser, listServices, createService, updateService, deleteService, listProfessionals, createProfessional, findAgenda, listAgendas, saveAgenda, deleteAgenda, newSlot };
