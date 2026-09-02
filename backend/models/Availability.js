const mongoose = require('mongoose');

// Cada horário do dia é um "slot". O gestor cria os slots ao abrir a agenda
// do dia; o cliente reserva um slot disponível.
const slotSchema = new mongoose.Schema(
  {
    horario: { type: String, required: true }, // ex: "09:00"
    status: {
      type: String,
      enum: ['disponivel', 'reservado', 'bloqueado'],
      default: 'disponivel',
    },
    servico: { type: String, default: '' },
    cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    clienteNome: { type: String, default: '' },
    observacao: { type: String, default: '' },
  },
  { _id: true }
);

const availabilitySchema = new mongoose.Schema(
  {
    // Data no formato YYYY-MM-DD (string) para facilitar consultas/índice único
    data: { type: String, required: true, unique: true, index: true },
    aberta: { type: Boolean, default: true },
    slots: [slotSchema],
    criadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Availability', availabilitySchema);
