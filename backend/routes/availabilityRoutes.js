const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/availabilityController');

const router = express.Router();

router.use(protect); // todas as rotas de agenda exigem login

// Rotas específicas do cliente (precisam vir antes de "/:data" genérica)
router.get('/minhas-reservas', ctrl.minhasReservas);
router.delete('/minhas-reservas/:data/slots/:slotId', ctrl.excluirMinhaReserva);
router.patch('/minhas-reservas/:data/slots/:slotId/cancelar', ctrl.cancelarMinhaReserva);
router.get('/abertas', ctrl.listarAgendasAbertas);
router.post('/:data/slots/:slotId/reservar', ctrl.reservarSlot);

// Rotas do gestor
router.post('/', authorize('gestor', 'colaborador'), ctrl.abrirAgenda);
router.get('/', authorize('gestor', 'colaborador'), ctrl.listarAgendaCompleta);
router.get('/clientes', authorize('gestor', 'colaborador'), ctrl.listarClientes);
router.post('/:data/slots/:slotId/marcar', authorize('gestor', 'colaborador'), ctrl.marcarHorarioParaCliente);
router.patch('/:data/fechar', authorize('gestor', 'colaborador'), ctrl.fecharAgenda);
router.delete('/:data', authorize('gestor', 'colaborador'), ctrl.excluirAgenda);
router.delete('/:data/slots/:slotId', authorize('gestor', 'colaborador'), ctrl.removerSlot);
router.patch('/:data/slots/:slotId/bloquear', authorize('gestor', 'colaborador'), ctrl.bloquearSlot);
router.patch('/:data/slots/:slotId/cancelar', authorize('gestor', 'colaborador'), ctrl.cancelarReservaGestor);
router.patch('/:data/slots/:slotId/cancelar-servico/:serviceId', authorize('gestor', 'colaborador'), ctrl.cancelarServicoReservaGestor);

// Rota compartilhada (cliente vê versão resumida, gestor vê versão completa)
router.get('/:data', ctrl.listarPorData);

module.exports = router;
