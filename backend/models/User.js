const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    telefone: { type: String, trim: true },
    senha: { type: String, required: true, minlength: 6 },
    papel: {
      type: String,
      enum: ['cliente', 'gestor'],
      default: 'cliente',
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('senha')) return next();
  const salt = await bcrypt.genSalt(10);
  this.senha = await bcrypt.hash(this.senha, salt);
  next();
});

userSchema.methods.compararSenha = function compararSenha(senhaDigitada) {
  return bcrypt.compare(senhaDigitada, this.senha);
};

userSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    nome: this.nome,
    email: this.email,
    telefone: this.telefone,
    papel: this.papel,
  };
};

module.exports = mongoose.model('User', userSchema);
