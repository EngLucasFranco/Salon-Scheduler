import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AlertaTemporario from '../components/AlertaTemporario';
import api from '../api/axios';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loginUsuario, setLoginUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [nomeEstabelecimento, setNomeEstabelecimento] = useState('Salon Scheduler');
  const [logomarca, setLogomarca] = useState('');

  useEffect(() => {
    api.get('/configuracoes/geral').then(({ data }) => { setNomeEstabelecimento(data.nomeEstabelecimento?.trim() || 'Salon Scheduler'); setLogomarca(data.logomarca || ''); }).catch(() => setNomeEstabelecimento('Salon Scheduler'));
  }, []);

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
        <h1>{logomarca ? <img className="logo-login" src={logomarca} alt="Logomarca" /> : '💇'} {nomeEstabelecimento}</h1>
        <p className="subtitulo">Entre para ver ou marcar seu horário</p>

        <AlertaTemporario tipo="erro" mensagem={erro} />

        <label>
          Usuário
          <input value={loginUsuario} onChange={(e) => setLoginUsuario(e.target.value)} autoComplete="username" required />
        </label>

        <label>
          Senha
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required />
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
