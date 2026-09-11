const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  tipo: { type: String, enum: ['reserva-profissional', 'lembrete-cliente', 'agenda-fixa-indisponivel'], required: true },
  usuarioId: { type: String, default: '' },
  profissionalId: { type: String, default: '' },
  titulo: { type: String, required: true },
  mensagem: { type: String, required: true },
  dataReserva: { type: String, default: '' },
  horarioReserva: { type: String, default: '' },
  chave: { type: String, required: true, unique: true },
  lidaPor: { type: [String], default: [] },
}, { timestamps: true });

notificationSchema.index({ usuarioId: 1, createdAt: -1 });
notificationSchema.index({ profissionalId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
