const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/availabilityController');

const router = express.Router();

router.use(protect); // todas as rotas de agenda exigem login

// Rotas específicas do cliente (precisam vir antes de "/:data" genérica)
router.get('/minhas-reservas', ctrl.minhasReservas);
router.post('/:data/slots/:slotId/reservar', ctrl.reservarSlot);
router.patch('/:data/slots/:slotId/cancelar-meu', ctrl.cancelarPropriaReserva);

// Rotas do gestor
router.post('/', authorize('gestor'), ctrl.abrirAgenda);
router.get('/', authorize('gestor'), ctrl.listarAgendaCompleta);
router.patch('/:data/fechar', authorize('gestor'), ctrl.fecharAgenda);
router.delete('/:data/slots/:slotId', authorize('gestor'), ctrl.removerSlot);
router.patch('/:data/slots/:slotId/bloquear', authorize('gestor'), ctrl.bloquearSlot);
router.patch('/:data/slots/:slotId/cancelar', authorize('gestor'), ctrl.cancelarReservaGestor);

// Rota compartilhada (cliente vê versão resumida, gestor vê versão completa)
router.get('/:data', ctrl.listarPorData);

module.exports = router;
