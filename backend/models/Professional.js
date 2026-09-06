const mongoose = require('mongoose');

const intervalSchema = new mongoose.Schema({
  descricao: { type: String, trim: true, default: '' },
  inicio: { type: String, required: true },
  fim: { type: String, required: true },
}, { _id: false });

const professionalSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true, trim: true, unique: true },
    especialidade: { type: String, trim: true, default: '' },
    telefone: { type: String, trim: true, default: '' },
    intervalos: { type: [intervalSchema], default: [] },
    criadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Professional', professionalSchema);
