const { getGeneralSettings, listAgendas, deleteAgenda } = require('../config/store');

function hojeNoBrasil() {
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts();
  const valor = (tipo) => partes.find((parte) => parte.type === tipo)?.value;
  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}

function adicionarDias(data, dias) {
  const [ano, mes, dia] = data.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

async function removerAgendasVencidas() {
  const { tratamentoAgendasPassadas, diasVencimentoAgendas } = await getGeneralSettings();
  if (tratamentoAgendasPassadas !== 'excluir') return 0;
  const hoje = hojeNoBrasil();
  const agendasVencidas = (await listAgendas()).filter((agenda) => agenda.data < hoje && hoje >= adicionarDias(agenda.data, diasVencimentoAgendas));
  await Promise.all(agendasVencidas.map((agenda) => deleteAgenda(agenda.data, agenda.profissionalId)));
  return agendasVencidas.length;
}

module.exports = { removerAgendasVencidas, hojeNoBrasil, adicionarDias };
