const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true, trim: true, unique: true },
    tipo: { type: String, enum: ['produto', 'servico'], required: true, default: 'servico' },
    valor: { type: Number, required: true, min: 0 },
    duracaoMinutos: { type: Number, min: 5, max: 720, default: null },
    criadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Service', serviceSchema);
