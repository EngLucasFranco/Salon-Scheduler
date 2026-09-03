import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Registrar() {
  const { registrar } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ nome: '', login: '', telefone: '', senha: '' });
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  function atualizar(campo, valor) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await registrar(form);
      navigate('/');
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Não foi possível cadastrar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="tela-auth">
      <form className="card-auth" onSubmit={handleSubmit}>
        <h1>Criar conta</h1>
        <p className="subtitulo">Cadastre-se para marcar seu horário</p>

        {erro && <div className="alerta-erro">{erro}</div>}

        <label>
          Nome completo
          <input value={form.nome} onChange={(e) => atualizar('nome', e.target.value)} required />
        </label>

        <label>
          Usuário
          <input value={form.login} onChange={(e) => atualizar('login', e.target.value)} minLength={6} pattern="[A-Za-z0-9]+" autoComplete="username" required />
        </label>

        <label>
          Telefone
          <input value={form.telefone} onChange={(e) => atualizar('telefone', e.target.value)} placeholder="(00) 00000-0000" />
        </label>

        <label>
          Senha
          <input type="password" value={form.senha} onChange={(e) => atualizar('senha', e.target.value)} minLength={6} required />
        </label>

        <button type="submit" disabled={enviando}>
          {enviando ? 'Cadastrando...' : 'Cadastrar'}
        </button>

        <p className="link-secundario">
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </form>
    </div>
  );
}
