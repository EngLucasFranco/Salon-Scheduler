const mongoose = require('mongoose');
const { hashPassword, verifyPassword } = require('../utils/password');

const userSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true, trim: true },
    login: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9]{6,}$/ },
    telefone: { type: String, trim: true },
    senha: { type: String, required: true, minlength: 6 },
    papel: {
      type: String,
      enum: ['cliente', 'gestor', 'colaborador'],
      default: 'cliente',
    },
    profissionalId: { type: String, default: '' },
    agendaFixa: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

userSchema.pre('save', async function protegerSenha() {
  if (!this.isModified('senha')) return;
  this.senha = await hashPassword(this.senha);
});

userSchema.methods.compararSenha = function compararSenha(senhaDigitada) {
  return verifyPassword(senhaDigitada, this.senha);
};

userSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    nome: this.nome,
    login: this.login,
    telefone: this.telefone,
    papel: this.papel,
    profissionalId: this.profissionalId || '',
    agendaFixa: this.agendaFixa || null,
  };
};

module.exports = mongoose.model('User', userSchema);
