const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  catalogoId: { type: String, default: '' },
  nome: { type: String, required: true },
  tipo: { type: String, enum: ['servico', 'produto'], required: true },
  quantidade: { type: Number, required: true, min: 1 },
  valorUnitario: { type: Number, required: true, min: 0 },
}, { _id: false });

const paymentSplitSchema = new mongoose.Schema({
  formaPagamentoId: { type: String, required: true },
  formaPagamentoNome: { type: String, required: true },
  valor: { type: Number, required: true, min: 0 },
}, { _id: false });

const chargeSchema = new mongoose.Schema({
  data: { type: String, required: true, index: true },
  agendaData: { type: String, default: '' },
  reservaId: { type: String, required: true, unique: true, index: true },
  clienteNome: { type: String, required: true },
  profissionalNome: { type: String, default: '' },
  formaPagamentoId: { type: String, default: '' },
  formaPagamentoNome: { type: String, default: '' },
  formasPagamento: { type: [paymentSplitSchema], default: [] },
  itens: { type: [itemSchema], default: [] },
  desconto: { type: Number, default: 0, min: 0 },
  acrescimo: { type: Number, default: 0, min: 0 },
  total: { type: Number, required: true, min: 0 },
  criadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Charge', chargeSchema);
