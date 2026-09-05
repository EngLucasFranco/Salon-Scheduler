const mongoose = require('mongoose');

const professionalSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true, trim: true, unique: true },
    especialidade: { type: String, trim: true, default: '' },
    telefone: { type: String, trim: true, default: '' },
    criadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Professional', professionalSchema);
