const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true, trim: true, unique: true },
    duracaoMinutos: { type: Number, required: true, min: 5, max: 720 },
    criadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Service', serviceSchema);
