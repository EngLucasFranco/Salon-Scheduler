import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AlertaTemporario from '../components/AlertaTemporario';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loginUsuario, setLoginUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await login(loginUsuario, senha);
      navigate('/');
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Não foi possível entrar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="tela-auth">
      <form className="card-auth" onSubmit={handleSubmit}>
        <h1>💇 Agenda Salão</h1>
        <p className="subtitulo">Entre para ver ou marcar seu horário</p>

        <AlertaTemporario tipo="erro" mensagem={erro} />

        <label>
          Usuário
          <input value={loginUsuario} onChange={(e) => setLoginUsuario(e.target.value)} minLength={6} pattern="[A-Za-z0-9]+" autoComplete="username" required />
        </label>

        <label>
          Senha
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} minLength={6} autoComplete="current-password" required />
        </label>

        <button type="submit" disabled={enviando}>
          {enviando ? 'Entrando...' : 'Entrar'}
        </button>

        <p className="link-secundario">
          Não tem conta? <Link to="/registrar">Cadastre-se</Link>
        </p>
      </form>
    </div>
  );
}
