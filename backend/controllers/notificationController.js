const { createNotification, getNotificationSettings, listAgendas, listNotificationsForUser, markNotificationsAsRead, deleteNotificationForUser } = require('../config/store');

function inicioReserva(data, horario) { return new Date(`${data}T${horario}:00-03:00`).getTime(); }

async function gerarLembretesCliente(usuario) {
  if (usuario.papel !== 'cliente') return;
  const { horasAntecedenciaCliente, mensagemCliente } = await getNotificationSettings();
  const limite = Date.now() + horasAntecedenciaCliente * 60 * 60 * 1000;
  const agendas = await listAgendas();
  await Promise.all(agendas.flatMap((agenda) => agenda.slots
    .filter((slot) => slot.cliente && String(slot.cliente) === String(usuario.id) && (slot.reservaInicio || !slot.reservaId) && inicioReserva(agenda.data, slot.horario) > Date.now() && inicioReserva(agenda.data, slot.horario) <= limite)
    .map((slot) => createNotification({ tipo: 'lembrete-cliente', usuarioId: String(usuario.id), titulo: 'Lembrete de horário', mensagem: mensagemCliente, dataReserva: agenda.data, horarioReserva: slot.horario, chave: `lembrete:${usuario.id}:${agenda.data}:${slot._id}` }))));
}

async function listar(req, res) {
  try { await gerarLembretesCliente(req.usuario); return res.json(await listNotificationsForUser(req.usuario)); }
  catch (erro) { console.error(erro); return res.status(500).json({ mensagem: 'Erro ao carregar as notificações.' }); }
}

async function marcarComoLidas(req, res) {
  try { await markNotificationsAsRead(req.usuario, req.body.ids); return res.status(204).send(); }
  catch (erro) { console.error(erro); return res.status(500).json({ mensagem: 'Erro ao atualizar as notificações.' }); }
}

async function remover(req, res) {
  try { if (!(await deleteNotificationForUser(req.usuario, req.params.id))) return res.status(404).json({ mensagem: 'Notificação não encontrada.' }); return res.status(204).send(); }
  catch (erro) { console.error(erro); return res.status(500).json({ mensagem: 'Erro ao excluir a notificação.' }); }
}

module.exports = { listar, marcarComoLidas, remover };
