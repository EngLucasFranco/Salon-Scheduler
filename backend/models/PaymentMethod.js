const mongoose = require('mongoose');

const paymentMethodSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true, trim: true, unique: true },
    criadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PaymentMethod', paymentMethodSchema);
