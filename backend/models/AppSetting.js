const mongoose = require('mongoose');

const appSettingSchema = new mongoose.Schema({
  chave: { type: String, required: true, unique: true },
  valor: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('AppSetting', appSettingSchema);
