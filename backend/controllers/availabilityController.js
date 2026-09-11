const { randomUUID } = require('crypto');
const { findAgenda, listAgendas, listServices, listProfessionals, listUsers, getGeneralSettings, createNotification, saveAgenda, deleteAgenda, newSlot } = require('../config/store');

async function profissionalDaRequisicao(req, res) {
  const profissionalId = req.usuario.papel === 'colaborador' ? req.usuario.profissionalId : (req.body.profissionalId || req.query.profissionalId);
  if (!profissionalId) { res.status(400).json({ mensagem: 'Selecione um profissional.' }); return null; }
  const profissional = (await listProfessionals()).find((item) => String(item.id) === String(profissionalId));
  if (!profissional) { res.status(404).json({ mensagem: 'Profissional não encontrado.' }); return null; }
  return profissional;
}

async function agendaDaRequisicao(req, res) {
  const profissional = await profissionalDaRequisicao(req, res);
  if (!profissional) return null;
  const agenda = await findAgenda(req.params.data, profissional.id);
  if (!agenda) {
    res.status(404).json({ mensagem: 'Agenda não encontrada.' });
    return null;
  }
  return agenda;
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

function datasDoPeriodo(data, periodo) {
  const [ano, mes, dia] = (data || '').split('-').map(Number);
  if (!Number.isInteger(ano) || !Number.isInteger(mes) || !Number.isInteger(dia)) return [];
  const inicio = periodo === 'mes' ? new Date(Date.UTC(ano, mes - 1, 1)) : new Date(Date.UTC(ano, mes - 1, dia));
  const quantidade = periodo === 'mes' ? new Date(Date.UTC(ano, mes, 0)).getUTCDate() : 7;
  return Array.from({ length: quantidade }, (_, indice) => new Date(inicio.getTime() + indice * 86400000).toISOString().slice(0, 10));
}

function slotById(agenda, id) { return agenda.slots.find((slot) => String(slot._id) === String(id)); }
function limparReserva(slot) {
  slot.status = 'disponivel'; slot.cliente = null; slot.clienteNome = ''; slot.servico = ''; slot.observacao = '';
  slot.servicos = []; slot.duracaoMinutos = 0; slot.reservaId = ''; slot.reservaInicio = false;
}
function falha(res, erro, mensagem) { console.error(erro); return res.status(500).json({ mensagem }); }

function minutosHorario(horario) { const [hora, minuto] = horario.split(':').map(Number); return hora * 60 + minuto; }
function hojeNoBrasil() {
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts();
  const valor = (tipo) => partes.find((parte) => parte.type === tipo)?.value;
  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}
function adicionarDias(data, dias) {
  const [ano, mes, dia] = data.split('-').map(Number);
  const resultado = new Date(Date.UTC(ano, mes - 1, dia + dias));
  return resultado.toISOString().slice(0, 10);
}
function intervaloDoHorario(horario, intervalos) {
  const minutos = minutosHorario(horario);
  return (intervalos || []).find((intervalo) => minutos >= minutosHorario(intervalo.inicio) && minutos < minutosHorario(intervalo.fim));
}
function slotParaHorario(horario, intervalos) {
  const intervalo = intervaloDoHorario(horario, intervalos);
  return {
    ...newSlot(horario),
    status: intervalo ? 'bloqueado' : 'disponivel',
    descricaoIntervalo: intervalo?.descricao?.trim() || '',
  };
}
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

async function servicosDaReserva(idsServicos) {
  const ids = Array.isArray(idsServicos) ? idsServicos.map(String) : [];
  if (!ids.length || new Set(ids).size !== ids.length) return null;
  const catalogo = await listServices();
  const servicos = ids.map((id) => catalogo.find((servico) => String(servico.id) === id));
  return servicos.some((servico) => !servico || servico.tipo === 'produto') ? null : servicos;
}

function aplicarReserva(agenda, slot, servicos, cliente) {
  const indiceInicial = agenda.slots.findIndex((item) => String(item._id) === String(slot._id));
  const intervalo = intervaloAgenda(agenda, indiceInicial);
  const duracaoMinutos = servicos.reduce((total, servico) => total + Number(servico.duracaoMinutos), 0);
  const quantidade = Math.ceil(duracaoMinutos / intervalo);
  const slots = slotsConsecutivosDisponiveis(agenda, indiceInicial, quantidade, intervalo);
  if (!slots) return null;
  const reservaId = randomUUID();
  const resumo = servicos.map((servico) => servico.nome).join(', ');
  slots.forEach((item, indice) => {
    item.status = 'reservado'; item.cliente = cliente.id ? String(cliente.id) : null; item.clienteNome = cliente.nome;
    item.servico = resumo; item.servicos = servicos; item.duracaoMinutos = duracaoMinutos;
    item.reservaId = reservaId; item.reservaInicio = indice === 0; item.observacao = '';
  });
  return slots;
}

async function notificarProfissionalSobreReserva(agenda, slot) {
  await createNotification({ tipo: 'reserva-profissional', profissionalId: String(agenda.profissionalId), titulo: 'Nova reserva na agenda', mensagem: `${slot.clienteNome} marcou ${slot.servico} para ${agenda.data.split('-').reverse().join('/')} às ${slot.horario}.`, dataReserva: agenda.data, horarioReserva: slot.horario, chave: `reserva-profissional:${agenda.data}:${agenda.profissionalId}:${slot.reservaId || slot._id}` });
}

function agendaFixaValeNaData(configuracao, data) {
  const dataUtc = new Date(`${data}T00:00:00Z`);
  const diaSemana = dataUtc.getUTCDay();
  if (configuracao.frequencia === 'diario') return true;
  if (configuracao.frequencia === 'mensal') return Number(configuracao.diaMes) === dataUtc.getUTCDate();
  if (Number(configuracao.diaSemana) !== diaSemana) return false;
  if (configuracao.frequencia === 'semanal') return true;
  if (configuracao.frequencia !== 'quinzenal') return false;
  const inicio = configuracao.inicioEm ? new Date(`${configuracao.inicioEm}T00:00:00Z`) : dataUtc;
  return Math.abs(Math.floor((dataUtc - inicio) / 86400000)) % 14 < 7;
}

async function aplicarAgendasFixas(agenda) {
  const [usuarios, catalogo] = await Promise.all([listUsers(), listServices()]);
  for (const cliente of usuarios.filter((usuario) => usuario.papel === 'cliente' && usuario.agendaFixa?.ativa && String(usuario.agendaFixa.profissionalId) === String(agenda.profissionalId))) {
    const configuracao = cliente.agendaFixa;
    if (!agendaFixaValeNaData(configuracao, agenda.data)) continue;
    const servico = catalogo.find((item) => String(item.id) === String(configuracao.servicoId) && item.tipo !== 'produto');
    const slot = agenda.slots.find((item) => item.horario === configuracao.horario && item.status === 'disponivel');
    if (!servico || !slot) continue;
    const slots = aplicarReserva(agenda, slot, [servico], cliente);
    if (slots) await notificarProfissionalSobreReserva(agenda, slot);
  }
  return saveAgenda(agenda);
}

async function notificarAgendaFixaMensalIndisponivel(profissional, dataReferencia) {
  const [ano, mes] = dataReferencia.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const clientes = (await listUsers()).filter((usuario) => usuario.papel === 'cliente' && usuario.agendaFixa?.ativa && usuario.agendaFixa.frequencia === 'mensal' && String(usuario.agendaFixa.profissionalId) === String(profissional.id));
  await Promise.all(clientes.map(async (cliente) => {
    const dia = Number(cliente.agendaFixa.diaMes);
    if (!Number.isInteger(dia) || dia < 1 || dia > ultimoDia) return;
    const data = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    const diaSemana = new Date(`${data}T00:00:00Z`).getUTCDay();
    if ((profissional.diasAtendimento || []).includes(diaSemana)) return;
    await createNotification({ tipo: 'agenda-fixa-indisponivel', usuarioId: String(cliente.id), titulo: 'Agenda fixa indisponível', mensagem: `Você deverá reagendar o serviço com a profissional ${profissional.nome} devido à indisponibilidade de agenda no dia ${data.split('-').reverse().join('/')}.`, dataReserva: data, horarioReserva: cliente.agendaFixa.horario || '', chave: `agenda-fixa-indisponivel:${cliente.id}:${profissional.id}:${data}` });
  }));
}

async function abrirAgenda(req, res) {
  try {
    const { data, inicio, fim, intervalo, periodo = 'dia' } = req.body;
    const profissional = await profissionalDaRequisicao(req, res); if (!profissional) return;
    const horarios = gerarHorarios(inicio, fim, intervalo);
    if (periodo !== 'dia') {
      const diasAtendimento = profissional.diasAtendimento || [1, 2, 3, 4, 5, 6, 0];
      const datas = datasDoPeriodo(data, periodo).filter((item) => diasAtendimento.includes(new Date(`${item}T00:00:00Z`).getUTCDay()));
      if (!['semana', 'mes'].includes(periodo) || !datas.length || !horarios.length) return res.status(400).json({ mensagem: 'Informe dados válidos para abrir a agenda.' });
      if (periodo === 'mes') await notificarAgendaFixaMensalIndisponivel(profissional, data);
      const existentes = await Promise.all(datas.map((item) => findAgenda(item, profissional.id)));
      const indiceExistente = existentes.findIndex(Boolean);
      if (indiceExistente >= 0) return res.status(409).json({ mensagem: `Já existe uma agenda para ${datas[indiceExistente]}.` });
      const agendas = await Promise.all(datas.map((item) => aplicarAgendasFixas({ data: item, profissionalId: profissional.id, profissionalNome: profissional.nome, aberta: true, intervalo: Number(intervalo), criadoPor: req.usuario.id, slots: horarios.map((horario) => slotParaHorario(horario, profissional.intervalos)) })));
      return res.status(201).json({ mensagem: `${agendas.length} agenda(s) aberta(s) com sucesso.`, agendas });
    }
    if (!data || !Array.isArray(horarios) || horarios.length === 0) return res.status(400).json({ mensagem: 'Informe a data e ao menos um horário.' });
    let agenda = await findAgenda(data, profissional.id);
    if (agenda) return res.status(409).json({ mensagem: agenda.aberta ? 'Já existe uma agenda aberta para esta data.' : 'Já existe uma agenda fechada para esta data.' });
    agenda = { data, profissionalId: profissional.id, profissionalNome: profissional.nome, aberta: true, intervalo: Number(intervalo), criadoPor: req.usuario.id, slots: horarios.map((horario) => slotParaHorario(horario, profissional.intervalos)) };
    agenda.slots.sort((a, b) => a.horario.localeCompare(b.horario)); agenda.aberta = true;
    return res.status(201).json(await aplicarAgendasFixas(agenda));
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
    const agenda = await agendaDaRequisicao(req, res); if (!agenda) return;
    const slot = slotById(agenda, req.params.slotId); if (!slot) return res.status(404).json({ mensagem: 'Horário não encontrado.' });
    if (slot.status === 'reservado') return res.status(400).json({ mensagem: 'Não é possível remover um horário já reservado. Cancele a reserva primeiro.' });
    agenda.slots = agenda.slots.filter((item) => String(item._id) !== String(slot._id)); return res.json(await saveAgenda(agenda));
  } catch (erro) { return falha(res, erro, 'Erro ao remover horário.'); }
}

async function bloquearSlot(req, res) {
  try {
    const agenda = await agendaDaRequisicao(req, res); if (!agenda) return;
    const slot = slotById(agenda, req.params.slotId); if (!slot) return res.status(404).json({ mensagem: 'Horário não encontrado.' });
    if (slot.status === 'reservado') return res.status(400).json({ mensagem: 'Este horário já está reservado por um cliente.' });
    if (slot.status === 'bloqueado') {
      slot.status = 'disponivel';
      slot.descricaoIntervalo = '';
    } else {
      slot.status = 'bloqueado';
    }
    return res.json(await saveAgenda(agenda));
  } catch (erro) { return falha(res, erro, 'Erro ao bloquear horário.'); }
}

async function cancelarReservaGestor(req, res) {
  try {
    const agenda = await agendaDaRequisicao(req, res); if (!agenda) return;
    const slot = slotById(agenda, req.params.slotId); if (!slot || slot.status !== 'reservado') return res.status(404).json({ mensagem: 'Reserva não encontrada.' });
    if (!slot.reservaId) limparReserva(slot);
    else agenda.slots.filter((item) => item.reservaId === slot.reservaId).forEach(limparReserva);
    return res.json(await saveAgenda(agenda));
  }
  catch (erro) { return falha(res, erro, 'Erro ao cancelar reserva.'); }
}

async function cancelarServicoReservaGestor(req, res) {
  try {
    const agenda = await agendaDaRequisicao(req, res); if (!agenda) return;
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
    const hoje = hojeNoBrasil();
    const { antecedenciaDias } = await getGeneralSettings();
    const limite = adicionarDias(hoje, antecedenciaDias);
    return res.json(agendas.filter((agenda) => agenda.aberta && agenda.data >= hoje && agenda.data <= limite).map((agenda) => ({ data: agenda.data, profissionalId: agenda.profissionalId, profissionalNome: agenda.profissionalNome })));
  } catch (erro) { return falha(res, erro, 'Erro ao listar os dias com agenda aberta.'); }
}

async function listarClientes(req, res) {
  try {
    const clientes = (await listUsers())
      .filter((usuario) => usuario.papel === 'cliente')
      .map((usuario) => ({ id: String(usuario.id), nome: usuario.nome, telefone: usuario.telefone || '' }));
    return res.json(clientes);
  } catch (erro) { return falha(res, erro, 'Erro ao listar as clientes.'); }
}

async function listarPorData(req, res) {
  try {
    const profissional = await profissionalDaRequisicao(req, res); if (!profissional) return;
    const agenda = await findAgenda(req.params.data, profissional.id); if (!agenda) return res.json({ data: req.params.data, aberta: false, slots: [] });
    if (req.usuario.papel !== 'cliente') return res.json(agenda);
    const slots = agenda.slots
      .filter((slot) => !slot.descricaoIntervalo)
      .map((slot) => ({ _id: slot._id, horario: slot.horario, status: slot.status === 'bloqueado' ? 'indisponivel' : slot.status, minhaReserva: slot.cliente && String(slot.cliente) === String(req.usuario.id) }));
    return res.json({ data: agenda.data, aberta: agenda.aberta, slots });
  } catch (erro) { return falha(res, erro, 'Erro ao buscar horários.'); }
}

async function reservarSlot(req, res) {
  try {
    const profissional = await profissionalDaRequisicao(req, res); if (!profissional) return;
    const { antecedenciaDias } = await getGeneralSettings();
    if (req.params.data < hojeNoBrasil() || req.params.data > adicionarDias(hojeNoBrasil(), antecedenciaDias)) return res.status(400).json({ mensagem: 'Esta data está fora do período disponível para agendamento.' });
    const agenda = await findAgenda(req.params.data, profissional.id); if (!agenda || !agenda.aberta) return res.status(400).json({ mensagem: 'A agenda deste dia não está disponível.' });
    const slot = slotById(agenda, req.params.slotId); if (!slot) return res.status(404).json({ mensagem: 'Horário não encontrado.' });
    const servicos = await servicosDaReserva(req.body.servicos);
    if (!servicos) return res.status(400).json({ mensagem: 'Selecione ao menos um serviço disponível.' });
    const slots = aplicarReserva(agenda, slot, servicos, { id: req.usuario.id, nome: req.usuario.nome });
    if (slots) await notificarProfissionalSobreReserva(agenda, slot);
    if (!slots) return res.status(409).json({ mensagem: 'Indisponibilidade de horário.' });
    const saved = await saveAgenda(agenda); return res.json({ mensagem: 'Horário reservado com sucesso!', slot: slotById(saved, slot._id) || slot });
  } catch (erro) { return falha(res, erro, 'Erro ao reservar horário.'); }
}

async function marcarHorarioParaCliente(req, res) {
  try {
    const profissional = await profissionalDaRequisicao(req, res); if (!profissional) return;
    const agenda = await findAgenda(req.params.data, profissional.id);
    if (!agenda || !agenda.aberta) return res.status(400).json({ mensagem: 'A agenda deste dia não está disponível.' });
    const slot = slotById(agenda, req.params.slotId); if (!slot) return res.status(404).json({ mensagem: 'Horário não encontrado.' });
    const servicos = await servicosDaReserva(req.body.servicos);
    if (!servicos) return res.status(400).json({ mensagem: 'Selecione ao menos um serviço disponível.' });

    let cliente;
    if (req.body.clienteId) {
      cliente = (await listUsers()).find((usuario) => usuario.papel === 'cliente' && String(usuario.id) === String(req.body.clienteId));
      if (!cliente) return res.status(404).json({ mensagem: 'Cliente não encontrada.' });
    } else {
      const nome = req.body.clienteNome?.trim();
      if (!nome) return res.status(400).json({ mensagem: 'Informe o nome da cliente.' });
      cliente = { id: null, nome };
    }

    const slots = aplicarReserva(agenda, slot, servicos, cliente);
    if (slots) await notificarProfissionalSobreReserva(agenda, slot);
    if (!slots) return res.status(409).json({ mensagem: 'Indisponibilidade de horário.' });
    const saved = await saveAgenda(agenda);
    return res.status(201).json({ mensagem: 'Horário marcado com sucesso!', slot: slotById(saved, slot._id) || slot });
  } catch (erro) { return falha(res, erro, 'Erro ao marcar horário para a cliente.'); }
}

async function minhasReservas(req, res) {
  try {
    const agendas = await listAgendas();
    const reservas = agendas.flatMap((agenda) => agenda.slots
      .filter((slot) => slot.cliente && String(slot.cliente) === String(req.usuario.id) && (slot.reservaInicio || !slot.reservaId))
      .map((slot) => ({ data: agenda.data, slotId: slot._id, horario: slot.horario, profissionalNome: agenda.profissionalNome || '', servico: slot.servico, servicos: slot.servicos || [], duracaoMinutos: slot.duracaoMinutos || 0, observacao: slot.observacao, status: slot.status })))
      .sort((a, b) => `${b.data}T${b.horario}`.localeCompare(`${a.data}T${a.horario}`));
    return res.json(reservas);
  } catch (erro) { return falha(res, erro, 'Erro ao buscar suas reservas.'); }
}

async function excluirMinhaReserva(req, res) {
  try {
    if (req.params.data >= hojeNoBrasil()) return res.status(400).json({ mensagem: 'Apenas reservas de datas passadas podem ser excluídas da lista.' });
    const agenda = (await listAgendas()).find((item) => item.data === req.params.data && slotById(item, req.params.slotId));
    const slot = agenda && slotById(agenda, req.params.slotId);
    if (!slot || !slot.cliente || String(slot.cliente) !== String(req.usuario.id)) return res.status(404).json({ mensagem: 'Reserva não encontrada.' });

    if (slot.reservaId) agenda.slots.filter((item) => item.reservaId === slot.reservaId).forEach(limparReserva);
    else limparReserva(slot);
    await saveAgenda(agenda);
    return res.json({ mensagem: 'Reserva excluída da lista.' });
  } catch (erro) { return falha(res, erro, 'Erro ao excluir a reserva da lista.'); }
}

async function cancelarMinhaReserva(req, res) {
  try {
    const agenda = (await listAgendas()).find((item) => item.data === req.params.data && slotById(item, req.params.slotId));
    const slot = agenda && slotById(agenda, req.params.slotId);
    if (!slot || !slot.cliente || String(slot.cliente) !== String(req.usuario.id)) return res.status(404).json({ mensagem: 'Reserva não encontrada.' });
    const inicioReserva = new Date(`${agenda.data}T${slot.horario}:00-03:00`);
    const { limiteCancelamentoHoras } = await getGeneralSettings();
    if (limiteCancelamentoHoras === null) return res.status(400).json({ mensagem: 'O cancelamento de reservas não está disponível.' });
    if (inicioReserva.getTime() <= Date.now() || inicioReserva.getTime() - Date.now() < limiteCancelamentoHoras * 60 * 60 * 1000) return res.status(400).json({ mensagem: `O cancelamento é permitido até ${limiteCancelamentoHoras} hora(s) antes do horário reservado.` });
    if (slot.reservaId) agenda.slots.filter((item) => item.reservaId === slot.reservaId).forEach(limparReserva);
    else limparReserva(slot);
    await saveAgenda(agenda);
    return res.json({ mensagem: 'Reserva cancelada com sucesso.' });
  } catch (erro) { return falha(res, erro, 'Erro ao cancelar a reserva.'); }
}

module.exports = { abrirAgenda, fecharAgenda, excluirAgenda, removerSlot, bloquearSlot, cancelarReservaGestor, cancelarServicoReservaGestor, listarAgendaCompleta, listarAgendasAbertas, listarClientes, listarPorData, reservarSlot, marcarHorarioParaCliente, minhasReservas, excluirMinhaReserva, cancelarMinhaReserva };
