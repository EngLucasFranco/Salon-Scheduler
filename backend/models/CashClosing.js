const mongoose = require('mongoose');

// A snapshot is deliberately kept independent from the active charges. This
// allows a new business day to start with an empty cash flow.
const cashClosingSchema = new mongoose.Schema({
  data: { type: String, required: true, unique: true, index: true },
  cobrancas: { type: [mongoose.Schema.Types.Mixed], default: [] },
  total: { type: Number, required: true, default: 0 },
  quantidadePagamentos: { type: Number, required: true, default: 0 },
  fechadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  expiraEm: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

module.exports = mongoose.model('CashClosing', cashClosingSchema);
