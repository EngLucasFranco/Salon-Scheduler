import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import ModalConfirmacao from '../components/ModalConfirmacao';
import AlertaTemporario from '../components/AlertaTemporario';

const formularioInicial = { nome: '', login: '', telefone: '', senha: '', papel: 'cliente' };

export default function Usuarios() {
  const { usuario: usuarioLogado } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [usuarioParaExcluir, setUsuarioParaExcluir] = useState(null);
  const [usuarioEmEdicao, setUsuarioEmEdicao] = useState(null);
  const [form, setForm] = useState(formularioInicial);
  const [salvando, setSalvando] = useState(false);

  async function carregarUsuarios() {
    setCarregando(true);
    setErro('');
    try {
      const { data } = await api.get('/usuarios');
      setUsuarios(data);
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Não foi possível carregar os usuários.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregarUsuarios(); }, []);

  function abrirCadastro() {
    setUsuarioEmEdicao(null);
    setForm(formularioInicial);
    setErro('');
    setModalAberto(true);
  }

  function abrirEdicao(usuario) {
    setUsuarioEmEdicao(usuario);
    setForm({ nome: usuario.nome, login: usuario.login, telefone: usuario.telefone || '', senha: '', papel: usuario.papel });
    setErro('');
    setModalAberto(true);
  }

  function fecharModal() {
    if (!salvando) setModalAberto(false);
  }

  function atualizar(campo, valor) {
    setForm((anterior) => ({ ...anterior, [campo]: valor }));
  }

  async function salvar(evento) {
    evento.preventDefault();
    setSalvando(true);
    setErro('');
    try {
      if (usuarioEmEdicao) {
        await api.put(`/usuarios/${usuarioEmEdicao.id}`, form);
      } else {
        await api.post('/usuarios', form);
      }
      setModalAberto(false);
      await carregarUsuarios();
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Não foi possível salvar o usuário.');
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarExclusao() {
    if (!usuarioParaExcluir) return;
    setErro('');
    try {
      await api.delete(`/usuarios/${usuarioParaExcluir.id}`);
      setUsuarioParaExcluir(null);
      await carregarUsuarios();
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Não foi possível excluir o usuário.');
    }
  }

  return (
    <div className="pagina">
      <header className="pagina-header pagina-header-acoes">
        <div>
          <h1>Usuários</h1>
          <p>Cadastre usuários e defina o nível de acesso de cada um.</p>
        </div>
        <button onClick={abrirCadastro}>Cadastrar usuário</button>
      </header>

      {!modalAberto && <AlertaTemporario tipo="erro" mensagem={erro} />}
      {carregando ? <p>Carregando usuários...</p> : (
        <div className="tabela-responsiva">
          <table className="tabela-usuarios">
            <thead>
              <tr><th>Nome</th><th>Usuário</th><th>Telefone</th><th>Acesso</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {usuarios.map((usuario) => (
                <tr key={usuario.id}>
                  <td data-label="Nome">{usuario.nome}</td>
                  <td data-label="Usuário">{usuario.login}</td>
                  <td data-label="Telefone">{usuario.telefone || '—'}</td>
                  <td data-label="Acesso"><span className={'badge badge-' + usuario.papel}>{usuario.papel === 'gestor' ? 'Gestor' : 'Cliente'}</span></td>
                  <td data-label="Ações" className="acoes-tabela">
                    <button className="botao-pequeno botao-secundario" onClick={() => abrirEdicao(usuario)}>Editar</button>
                    <button className="botao-pequeno botao-perigo" onClick={() => setUsuarioParaExcluir(usuario)} disabled={usuario.id === usuarioLogado?.id}>Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {usuarios.length === 0 && <div className="aviso-vazio">Nenhum usuário cadastrado.</div>}
        </div>
      )}

      {modalAberto && (
        <div className="modal-fundo" role="presentation" onMouseDown={fecharModal}>
          <form className="modal" onSubmit={salvar} onMouseDown={(evento) => evento.stopPropagation()}>
            <div className="modal-cabecalho">
              <h2>{usuarioEmEdicao ? 'Editar usuário' : 'Cadastrar usuário'}</h2>
              <button type="button" className="modal-fechar" onClick={fecharModal} aria-label="Fechar">×</button>
            </div>
            <p className="subtitulo">{usuarioEmEdicao ? 'Deixe a senha em branco para mantê-la inalterada.' : 'Defina os dados e o nível de acesso do usuário.'}</p>
            <AlertaTemporario tipo="erro" mensagem={erro} />

            <label>Nome completo<input value={form.nome} onChange={(e) => atualizar('nome', e.target.value)} required /></label>
            <label>Usuário<input value={form.login} onChange={(e) => atualizar('login', e.target.value)} minLength={6} pattern="[A-Za-z0-9]+" autoComplete="username" required /></label>
            <label>Telefone<input value={form.telefone} onChange={(e) => atualizar('telefone', e.target.value)} /></label>
            <label>Senha<input type="password" value={form.senha} onChange={(e) => atualizar('senha', e.target.value)} minLength={6} autoComplete="new-password" required={!usuarioEmEdicao} /></label>
            <label>Nível de acesso
              <select value={form.papel} onChange={(e) => atualizar('papel', e.target.value)}>
                <option value="cliente">Cliente</option>
                <option value="gestor">Gestor</option>
              </select>
            </label>
            <div className="modal-acoes">
              <button type="button" className="botao-secundario" onClick={fecharModal}>Cancelar</button>
              <button type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar usuário'}</button>
            </div>
          </form>
        </div>
      )}

      {usuarioParaExcluir && (
        <ModalConfirmacao
          aberto
          titulo="Excluir usuário"
          mensagem={<>Deseja realmente excluir <strong>{usuarioParaExcluir.nome}</strong>?</>}
          textoConfirmar="Excluir usuário"
          onCancelar={() => setUsuarioParaExcluir(null)}
          onConfirmar={confirmarExclusao}
        />
      )}
    </div>
  );
}
