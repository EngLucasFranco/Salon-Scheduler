const { randomUUID } = require('crypto');
const { findAgenda, listAgendas, listServices, listProfessionals, saveAgenda, deleteAgenda, newSlot } = require('../config/store');

async function profissionalDaRequisicao(req, res) {
  const profissionalId = req.usuario.papel === 'colaborador' ? req.usuario.profissionalId : (req.body.profissionalId || req.query.profissionalId);
  if (!profissionalId) { res.status(400).json({ mensagem: 'Selecione um profissional.' }); return null; }
  const profissional = (await listProfessionals()).find((item) => String(item.id) === String(profissionalId));
  if (!profissional) { res.status(404).json({ mensagem: 'Profissional não encontrado.' }); return null; }
  return profissional;
}

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
function limparReserva(slot) {
  slot.status = 'disponivel'; slot.cliente = null; slot.clienteNome = ''; slot.servico = ''; slot.observacao = '';
  slot.servicos = []; slot.duracaoMinutos = 0; slot.reservaId = ''; slot.reservaInicio = false;
}
function falha(res, erro, mensagem) { console.error(erro); return res.status(500).json({ mensagem }); }

function minutosHorario(horario) { const [hora, minuto] = horario.split(':').map(Number); return hora * 60 + minuto; }
function intervaloAgenda(agenda, indice) {
  if (Number(agenda.intervalo) >= 5) return Number(agenda.intervalo);
  const proximo = agenda.slots[indice + 1];
  const anterior = agenda.slots[indice - 1];
  if (proximo) return minutosHorario(proximo.horario) - minutosHorario(agenda.slots[indice].horario);
  if (anterior) return minutosHorario(agenda.slots[indice].horario) - minutosHorario(anterior.horario);
  return 0;
}
function slotsConsecutivosDisponiveis(agenda, indiceInicial, quantidade, intervalo) {
  const selecionados = agenda.slots.slice(indiceInicial, indiceInicial + quantidade);
  if (selecionados.length !== quantidade || selecionados.some((slot) => slot.status !== 'disponivel')) return null;
  if (selecionados.some((slot, indice) => indice > 0 && minutosHorario(slot.horario) - minutosHorario(selecionados[indice - 1].horario) !== intervalo)) return null;
  return selecionados;
}

async function abrirAgenda(req, res) {
  try {
    const { data, inicio, fim, intervalo } = req.body;
    const profissional = await profissionalDaRequisicao(req, res); if (!profissional) return;
    const horarios = gerarHorarios(inicio, fim, intervalo);
    if (!data || !Array.isArray(horarios) || horarios.length === 0) return res.status(400).json({ mensagem: 'Informe a data e ao menos um horário.' });
    let agenda = await findAgenda(data, profissional.id);
    if (agenda) return res.status(409).json({ mensagem: agenda.aberta ? 'Já existe uma agenda aberta para esta data.' : 'Já existe uma agenda fechada para esta data.' });
    agenda = { data, profissionalId: profissional.id, profissionalNome: profissional.nome, aberta: true, intervalo: Number(intervalo), criadoPor: req.usuario.id, slots: horarios.map(newSlot) };
    agenda.slots.sort((a, b) => a.horario.localeCompare(b.horario)); agenda.aberta = true;
    return res.status(201).json(await saveAgenda(agenda));
  } catch (erro) { return falha(res, erro, 'Erro ao abrir a agenda.'); }
}

async function fecharAgenda(req, res) {
  try { const profissional = await profissionalDaRequisicao(req, res); if (!profissional) return; const agenda = await findAgenda(req.params.data, profissional.id); if (!agenda) return res.status(404).json({ mensagem: 'Agenda não encontrada para esta data.' }); agenda.aberta = false; return res.json(await saveAgenda(agenda)); }
  catch (erro) { return falha(res, erro, 'Erro ao fechar a agenda.'); }
}

async function excluirAgenda(req, res) {
  try {
    const profissional = await profissionalDaRequisicao(req, res); if (!profissional) return;
    if (!(await deleteAgenda(req.params.data, profissional.id))) return res.status(404).json({ mensagem: 'Agenda não encontrada para esta data.' });
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
  try {
    const agenda = await findAgenda(req.params.data); if (!agenda) return res.status(404).json({ mensagem: 'Agenda não encontrada.' });
    const slot = slotById(agenda, req.params.slotId); if (!slot || slot.status !== 'reservado') return res.status(404).json({ mensagem: 'Reserva não encontrada.' });
    if (!slot.reservaId) limparReserva(slot);
    else agenda.slots.filter((item) => item.reservaId === slot.reservaId).forEach(limparReserva);
    return res.json(await saveAgenda(agenda));
  }
  catch (erro) { return falha(res, erro, 'Erro ao cancelar reserva.'); }
}

async function cancelarServicoReservaGestor(req, res) {
  try {
    const agenda = await findAgenda(req.params.data); if (!agenda) return res.status(404).json({ mensagem: 'Agenda não encontrada.' });
    const slot = slotById(agenda, req.params.slotId);
    if (!slot || !slot.reservaId || slot.status !== 'reservado') return res.status(404).json({ mensagem: 'Reserva não encontrada.' });
    const slotsReserva = agenda.slots.filter((item) => item.reservaId === slot.reservaId);
    const servicosRestantes = (slot.servicos || []).filter((servico) => String(servico.id) !== String(req.params.serviceId));
    if (servicosRestantes.length === (slot.servicos || []).length) return res.status(404).json({ mensagem: 'Serviço não encontrado nesta reserva.' });
    if (!servicosRestantes.length) slotsReserva.forEach(limparReserva);
    else {
      const indiceInicial = agenda.slots.findIndex((item) => String(item._id) === String(slotsReserva[0]._id));
      const intervalo = intervaloAgenda(agenda, indiceInicial);
      const duracaoMinutos = servicosRestantes.reduce((total, servico) => total + Number(servico.duracaoMinutos), 0);
      const quantidade = Math.ceil(duracaoMinutos / intervalo);
      slotsReserva.forEach((item, indice) => {
        if (indice < quantidade) {
          item.servicos = servicosRestantes; item.duracaoMinutos = duracaoMinutos;
          item.servico = servicosRestantes.map((servico) => servico.nome).join(', '); item.reservaInicio = indice === 0;
        } else limparReserva(item);
      });
    }
    return res.json(await saveAgenda(agenda));
  } catch (erro) { return falha(res, erro, 'Erro ao cancelar serviço da reserva.'); }
}

async function listarAgendaCompleta(req, res) { try { return res.json(await listAgendas(req.query.inicio, req.query.fim, req.usuario.papel === 'colaborador' ? req.usuario.profissionalId : req.query.profissionalId)); } catch (erro) { return falha(res, erro, 'Erro ao listar a agenda.'); } }

async function listarAgendasAbertas(req, res) {
  try {
    const agendas = await listAgendas(req.query.inicio, req.query.fim, req.query.profissionalId);
    // Clientes só precisam conhecer os dias que ainda aceitam reservas.
    return res.json(agendas.filter((agenda) => agenda.aberta).map((agenda) => ({ data: agenda.data })));
  } catch (erro) { return falha(res, erro, 'Erro ao listar os dias com agenda aberta.'); }
}

async function listarPorData(req, res) {
  try {
    const profissional = await profissionalDaRequisicao(req, res); if (!profissional) return;
    const agenda = await findAgenda(req.params.data, profissional.id); if (!agenda) return res.json({ data: req.params.data, aberta: false, slots: [] });
    if (req.usuario.papel === 'gestor') return res.json(agenda);
    const slots = agenda.slots.map((slot) => ({ _id: slot._id, horario: slot.horario, status: slot.status === 'bloqueado' ? 'indisponivel' : slot.status, minhaReserva: slot.cliente && String(slot.cliente) === String(req.usuario.id) }));
    return res.json({ data: agenda.data, aberta: agenda.aberta, slots });
  } catch (erro) { return falha(res, erro, 'Erro ao buscar horários.'); }
}

async function reservarSlot(req, res) {
  try {
    const profissional = await profissionalDaRequisicao(req, res); if (!profissional) return;
    const agenda = await findAgenda(req.params.data, profissional.id); if (!agenda || !agenda.aberta) return res.status(400).json({ mensagem: 'A agenda deste dia não está disponível.' });
    const slot = slotById(agenda, req.params.slotId); if (!slot) return res.status(404).json({ mensagem: 'Horário não encontrado.' });
    const idsServicos = Array.isArray(req.body.servicos) ? req.body.servicos.map(String) : [];
    if (!idsServicos.length || new Set(idsServicos).size !== idsServicos.length) return res.status(400).json({ mensagem: 'Selecione ao menos um serviço.' });
    const catalogo = await listServices();
    const servicos = idsServicos.map((id) => catalogo.find((servico) => String(servico.id) === id));
    if (servicos.some((servico) => !servico)) return res.status(400).json({ mensagem: 'Um ou mais serviços selecionados não estão disponíveis.' });
    const indiceInicial = agenda.slots.findIndex((item) => String(item._id) === String(slot._id));
    const intervalo = intervaloAgenda(agenda, indiceInicial);
    const duracaoMinutos = servicos.reduce((total, servico) => total + Number(servico.duracaoMinutos), 0);
    const quantidade = Math.ceil(duracaoMinutos / intervalo);
    const slots = slotsConsecutivosDisponiveis(agenda, indiceInicial, quantidade, intervalo);
    if (!slots) return res.status(409).json({ mensagem: 'Indisponibilidade de horário.' });
    const reservaId = randomUUID();
    const resumo = servicos.map((servico) => servico.nome).join(', ');
    slots.forEach((item, indice) => {
      item.status = 'reservado'; item.cliente = req.usuario.id; item.clienteNome = req.usuario.nome;
      item.servico = resumo; item.servicos = servicos; item.duracaoMinutos = duracaoMinutos;
      item.reservaId = reservaId; item.reservaInicio = indice === 0; item.observacao = '';
    });
    const saved = await saveAgenda(agenda); return res.json({ mensagem: 'Horário reservado com sucesso!', slot: slotById(saved, slot._id) || slot });
  } catch (erro) { return falha(res, erro, 'Erro ao reservar horário.'); }
}

async function minhasReservas(req, res) {
  try {
    const agendas = await listAgendas();
    const reservas = agendas.flatMap((agenda) => agenda.slots
      .filter((slot) => slot.cliente && String(slot.cliente) === String(req.usuario.id) && (slot.reservaInicio || !slot.reservaId))
      .map((slot) => ({ data: agenda.data, slotId: slot._id, horario: slot.horario, servico: slot.servico, servicos: slot.servicos || [], duracaoMinutos: slot.duracaoMinutos || 0, observacao: slot.observacao, status: slot.status })));
    return res.json(reservas);
  } catch (erro) { return falha(res, erro, 'Erro ao buscar suas reservas.'); }
}

module.exports = { abrirAgenda, fecharAgenda, excluirAgenda, removerSlot, bloquearSlot, cancelarReservaGestor, cancelarServicoReservaGestor, listarAgendaCompleta, listarAgendasAbertas, listarPorData, reservarSlot, minhasReservas };
