const mongoose = require('mongoose');

const cashOutflowSchema = new mongoose.Schema({
  data: { type: String, required: true, index: true },
  valor: { type: Number, required: true, min: 0.01 },
  meioPagamento: {
    type: String,
    required: true,
    enum: ['Dinheiro', 'Cartão de Crédito', 'Cartão de Débito', 'PIX'],
  },
  criadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('CashOutflow', cashOutflowSchema);
