const { findAgenda, listAgendas, saveAgenda, deleteAgenda, newSlot } = require('../config/store');

function gerarHorarios(inicio, fim, intervalo) {
  if (!/^\d{2}:\d{2}$/.test(inicio || '') || !/^\d{2}:\d{2}$/.test(fim || '')) return [];
  const [horaInicio, minutoInicio] = inicio.split(':').map(Number);
  const [horaFim, minutoFim] = fim.split(':').map(Number);
  const passo = Number(intervalo);
  const atualInicial = horaInicio * 60 + minutoInicio;
  const limite = horaFim * 60 + minutoFim;
  if (horaInicio > 23 || horaFim > 23 || minutoInicio > 59 || minutoFim > 59 || !Number.isInteger(passo) || passo < 5 || atualInicial > limite) return [];

  const horarios = [];
  for (let atual = atualInicial; atual <= limite; atual += passo) {
    horarios.push(`${String(Math.floor(atual / 60)).padStart(2, '0')}:${String(atual % 60).padStart(2, '0')}`);
  }
  return horarios;
}

function slotById(agenda, id) { return agenda.slots.find((slot) => String(slot._id) === String(id)); }
function limparReserva(slot) { slot.status = 'disponivel'; slot.cliente = null; slot.clienteNome = ''; slot.servico = ''; slot.observacao = ''; }
function falha(res, erro, mensagem) { console.error(erro); return res.status(500).json({ mensagem }); }

async function abrirAgenda(req, res) {
  try {
    const { data, inicio, fim, intervalo } = req.body;
    const horarios = gerarHorarios(inicio, fim, intervalo);
    if (!data || !Array.isArray(horarios) || horarios.length === 0) return res.status(400).json({ mensagem: 'Informe a data e ao menos um horário.' });
    let agenda = await findAgenda(data);
    if (agenda) return res.status(409).json({ mensagem: agenda.aberta ? 'Já existe uma agenda aberta para esta data.' : 'Já existe uma agenda fechada para esta data.' });
    agenda = { data, aberta: true, criadoPor: req.usuario.id, slots: horarios.map(newSlot) };
    agenda.slots.sort((a, b) => a.horario.localeCompare(b.horario)); agenda.aberta = true;
    return res.status(201).json(await saveAgenda(agenda));
  } catch (erro) { return falha(res, erro, 'Erro ao abrir a agenda.'); }
}

async function fecharAgenda(req, res) {
  try { const agenda = await findAgenda(req.params.data); if (!agenda) return res.status(404).json({ mensagem: 'Agenda não encontrada para esta data.' }); agenda.aberta = false; return res.json(await saveAgenda(agenda)); }
  catch (erro) { return falha(res, erro, 'Erro ao fechar a agenda.'); }
}

async function excluirAgenda(req, res) {
  try {
    if (!(await deleteAgenda(req.params.data))) return res.status(404).json({ mensagem: 'Agenda não encontrada para esta data.' });
    return res.status(204).send();
  } catch (erro) { return falha(res, erro, 'Erro ao excluir a agenda.'); }
}

async function removerSlot(req, res) {
  try {
    const agenda = await findAgenda(req.params.data); if (!agenda) return res.status(404).json({ mensagem: 'Agenda não encontrada.' });
    const slot = slotById(agenda, req.params.slotId); if (!slot) return res.status(404).json({ mensagem: 'Horário não encontrado.' });
    if (slot.status === 'reservado') return res.status(400).json({ mensagem: 'Não é possível remover um horário já reservado. Cancele a reserva primeiro.' });
    agenda.slots = agenda.slots.filter((item) => String(item._id) !== String(slot._id)); return res.json(await saveAgenda(agenda));
  } catch (erro) { return falha(res, erro, 'Erro ao remover horário.'); }
}

async function bloquearSlot(req, res) {
  try {
    const agenda = await findAgenda(req.params.data); if (!agenda) return res.status(404).json({ mensagem: 'Agenda não encontrada.' });
    const slot = slotById(agenda, req.params.slotId); if (!slot) return res.status(404).json({ mensagem: 'Horário não encontrado.' });
    if (slot.status === 'reservado') return res.status(400).json({ mensagem: 'Este horário já está reservado por um cliente.' });
    slot.status = slot.status === 'bloqueado' ? 'disponivel' : 'bloqueado'; return res.json(await saveAgenda(agenda));
  } catch (erro) { return falha(res, erro, 'Erro ao bloquear horário.'); }
}

async function cancelarReservaGestor(req, res) {
  try { const agenda = await findAgenda(req.params.data); if (!agenda) return res.status(404).json({ mensagem: 'Agenda não encontrada.' }); const slot = slotById(agenda, req.params.slotId); if (!slot) return res.status(404).json({ mensagem: 'Horário não encontrado.' }); limparReserva(slot); return res.json(await saveAgenda(agenda)); }
  catch (erro) { return falha(res, erro, 'Erro ao cancelar reserva.'); }
}

async function listarAgendaCompleta(req, res) { try { return res.json(await listAgendas(req.query.inicio, req.query.fim)); } catch (erro) { return falha(res, erro, 'Erro ao listar a agenda.'); } }

async function listarAgendasAbertas(req, res) {
  try {
    const agendas = await listAgendas(req.query.inicio, req.query.fim);
    // Clientes só precisam conhecer os dias que ainda aceitam reservas.
    return res.json(agendas.filter((agenda) => agenda.aberta).map((agenda) => ({ data: agenda.data })));
  } catch (erro) { return falha(res, erro, 'Erro ao listar os dias com agenda aberta.'); }
}

async function listarPorData(req, res) {
  try {
    const agenda = await findAgenda(req.params.data); if (!agenda) return res.json({ data: req.params.data, aberta: false, slots: [] });
    if (req.usuario.papel === 'gestor') return res.json(agenda);
    const slots = agenda.slots.map((slot) => ({ _id: slot._id, horario: slot.horario, status: slot.status === 'bloqueado' ? 'indisponivel' : slot.status, minhaReserva: slot.cliente && String(slot.cliente) === String(req.usuario.id) }));
    return res.json({ data: agenda.data, aberta: agenda.aberta, slots });
  } catch (erro) { return falha(res, erro, 'Erro ao buscar horários.'); }
}

async function reservarSlot(req, res) {
  try {
    const agenda = await findAgenda(req.params.data); if (!agenda || !agenda.aberta) return res.status(400).json({ mensagem: 'A agenda deste dia não está disponível.' });
    const slot = slotById(agenda, req.params.slotId); if (!slot) return res.status(404).json({ mensagem: 'Horário não encontrado.' });
    if (slot.status !== 'disponivel') return res.status(409).json({ mensagem: 'Este horário acabou de ser reservado. Escolha outro.' });
    slot.status = 'reservado'; slot.cliente = req.usuario.id; slot.clienteNome = req.usuario.nome; slot.servico = req.body.servico || ''; slot.observacao = req.body.observacao || '';
    const saved = await saveAgenda(agenda); return res.json({ mensagem: 'Horário reservado com sucesso!', slot: slotById(saved, slot._id) || slot });
  } catch (erro) { return falha(res, erro, 'Erro ao reservar horário.'); }
}

async function cancelarPropriaReserva(req, res) {
  try {
    const agenda = await findAgenda(req.params.data); if (!agenda) return res.status(404).json({ mensagem: 'Agenda não encontrada.' });
    const slot = slotById(agenda, req.params.slotId); if (!slot) return res.status(404).json({ mensagem: 'Horário não encontrado.' });
    if (!slot.cliente || String(slot.cliente) !== String(req.usuario.id)) return res.status(403).json({ mensagem: 'Esta reserva não pertence a você.' });
    limparReserva(slot); await saveAgenda(agenda); return res.json({ mensagem: 'Reserva cancelada.' });
  } catch (erro) { return falha(res, erro, 'Erro ao cancelar reserva.'); }
}

async function minhasReservas(req, res) {
  try {
    const agendas = await listAgendas();
    const reservas = agendas.flatMap((agenda) => agenda.slots.filter((slot) => slot.cliente && String(slot.cliente) === String(req.usuario.id)).map((slot) => ({ data: agenda.data, slotId: slot._id, horario: slot.horario, servico: slot.servico, observacao: slot.observacao, status: slot.status })));
    return res.json(reservas);
  } catch (erro) { return falha(res, erro, 'Erro ao buscar suas reservas.'); }
}

module.exports = { abrirAgenda, fecharAgenda, excluirAgenda, removerSlot, bloquearSlot, cancelarReservaGestor, listarAgendaCompleta, listarAgendasAbertas, listarPorData, reservarSlot, cancelarPropriaReserva, minhasReservas };
