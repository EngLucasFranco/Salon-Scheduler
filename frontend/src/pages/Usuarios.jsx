import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import ModalConfirmacao from '../components/ModalConfirmacao';
import AlertaTemporario from '../components/AlertaTemporario';

const agendaFixaInicial = { ativa: false, profissionalId: '', frequencia: '', diaSemana: '', diaMes: '', horario: '', servicoId: '', inicioEm: '' };
const formularioInicial = { nome: '', login: '', telefone: '', senha: '', papel: 'cliente', profissionalId: '', agendaFixa: agendaFixaInicial };

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
  const [profissionais, setProfissionais] = useState([]);
  const [servicos, setServicos] = useState([]);

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
  useEffect(() => { api.get('/profissionais').then(({ data }) => setProfissionais(data)).catch(() => {}); }, []);
  useEffect(() => { api.get('/servicos').then(({ data }) => setServicos(data.filter((servico) => servico.tipo !== 'produto'))).catch(() => {}); }, []);

  function abrirCadastro() {
    setUsuarioEmEdicao(null);
    setForm(formularioInicial);
    setErro('');
    setModalAberto(true);
  }

  function abrirEdicao(usuario) {
    setUsuarioEmEdicao(usuario);
    setForm({ nome: usuario.nome, login: usuario.login, telefone: usuario.telefone || '', senha: '', papel: usuario.papel, profissionalId: usuario.profissionalId || '', agendaFixa: { ...agendaFixaInicial, ...(usuario.agendaFixa || {}) } });
    setErro('');
    setModalAberto(true);
  }

  function fecharModal() {
    if (!salvando) setModalAberto(false);
  }

  function atualizar(campo, valor) {
    setForm((anterior) => ({ ...anterior, [campo]: valor }));
  }
  function atualizarAgendaFixa(campo, valor) { setForm((anterior) => ({ ...anterior, agendaFixa: { ...anterior.agendaFixa, [campo]: valor } })); }
  function alternarAgendaFixa() { setForm((anterior) => ({ ...anterior, agendaFixa: { ...anterior.agendaFixa, ativa: !anterior.agendaFixa.ativa, inicioEm: !anterior.agendaFixa.ativa && !anterior.agendaFixa.inicioEm ? new Date().toISOString().slice(0, 10) : anterior.agendaFixa.inicioEm } })); }
  const profissionalAgendaFixa = profissionais.find((profissional) => String(profissional.id) === String(form.agendaFixa.profissionalId));
  const diasAgendaFixa = profissionalAgendaFixa?.diasAtendimento || [];
  const nomesDias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  function alterarHorarioAgendaFixa(horario) { if ((profissionalAgendaFixa?.intervalos || []).some((intervalo) => horario >= intervalo.inicio && horario < intervalo.fim)) { setErro('O horário da agenda fixa não pode coincidir com o intervalo da profissional.'); return; } setErro(''); atualizarAgendaFixa('horario', horario); }

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
                  <td data-label="Acesso"><span className={'badge badge-' + usuario.papel}>{usuario.papel === 'gestor' ? 'Gestor' : usuario.papel === 'colaborador' ? 'Colaborador' : 'Cliente'}</span></td>
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
            <label>Telefone<input value={form.telefone} onChange={(e) => atualizar('telefone', e.target.value)} /></label>
            <label>Usuário<input value={form.login} onChange={(e) => atualizar('login', e.target.value)} minLength={6} pattern="[A-Za-z0-9]+" autoComplete="username" required /></label>
            <label>Senha<input type="password" value={form.senha} onChange={(e) => atualizar('senha', e.target.value)} minLength={6} autoComplete="new-password" required={!usuarioEmEdicao} /></label>
            <label>Nível de acesso
              <select value={form.papel} onChange={(e) => atualizar('papel', e.target.value)}>
                <option value="cliente">Cliente</option>
                <option value="gestor">Gestor</option>
                <option value="colaborador">Colaborador</option>
              </select>
            </label>
            {form.papel === 'colaborador' && (
              <label>Profissional
                <select value={form.profissionalId} onChange={(e) => atualizar('profissionalId', e.target.value)} required>
                  <option value="">Selecione</option>
                  {profissionais.map((profissional) => <option key={profissional.id} value={profissional.id}>{profissional.nome}</option>)}
                </select>
              </label>
            )}
            {usuarioEmEdicao && form.papel === 'cliente' && <><div className="agenda-fixa-switch"><span>Agenda Fixa</span><button type="button" role="switch" aria-checked={form.agendaFixa.ativa} className={form.agendaFixa.ativa ? 'ligado' : ''} onClick={alternarAgendaFixa}><span className="agenda-fixa-indicador">{form.agendaFixa.ativa ? 'On' : 'Off'}</span><span className="agenda-fixa-trilho" /></button></div>{form.agendaFixa.ativa && <div className="configuracao-agenda-fixa"><label>Profissional<select value={form.agendaFixa.profissionalId} onChange={(e) => atualizarAgendaFixa('profissionalId', e.target.value)} required><option value="">Selecione</option>{profissionais.map((profissional) => <option key={profissional.id} value={profissional.id}>{profissional.nome}</option>)}</select></label><label>Recorrência<select value={form.agendaFixa.frequencia} onChange={(e) => atualizarAgendaFixa('frequencia', e.target.value)} required><option value="">Selecione</option><option value="diario">Diário</option><option value="semanal">Semanal</option><option value="quinzenal">Quinzenal</option><option value="mensal">Mensal</option></select></label>{['semanal', 'quinzenal'].includes(form.agendaFixa.frequencia) && <label>Dia da semana<select value={form.agendaFixa.diaSemana} onChange={(e) => atualizarAgendaFixa('diaSemana', e.target.value)} required><option value="">Selecione</option>{diasAgendaFixa.map((dia) => <option key={dia} value={dia}>{nomesDias[dia]}</option>)}</select></label>}{form.agendaFixa.frequencia === 'mensal' && <label>Dia do mês<input type="number" min="1" max="31" value={form.agendaFixa.diaMes} onChange={(e) => atualizarAgendaFixa('diaMes', e.target.value)} required /></label>}<label>Horário<input type="time" value={form.agendaFixa.horario} onChange={(e) => alterarHorarioAgendaFixa(e.target.value)} required /></label><label>Serviço<select value={form.agendaFixa.servicoId} onChange={(e) => atualizarAgendaFixa('servicoId', e.target.value)} required><option value="">Selecione</option>{servicos.map((servico) => <option key={servico.id} value={servico.id}>{servico.nome}</option>)}</select></label></div>}</>}
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
