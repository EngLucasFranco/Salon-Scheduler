import { useEffect, useState } from 'react';
import api from '../api/axios';
import AlertaTemporario from '../components/AlertaTemporario';

const abas = [
  { id: 'geral', rotulo: 'Geral' },
  { id: 'layout', rotulo: 'Layout' },
  { id: 'profissionais', rotulo: 'Profissionais' },
];

export default function Configuracoes() {
  const [abaAtiva, setAbaAtiva] = useState('geral');
  const [profissionais, setProfissionais] = useState([]);
  const [formProfissional, setFormProfissional] = useState({ nome: '', especialidade: '', telefone: '' });
  const [carregandoProfissionais, setCarregandoProfissionais] = useState(false);
  const [salvandoProfissional, setSalvandoProfissional] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const abaSelecionada = abas.find((aba) => aba.id === abaAtiva);

  async function carregarProfissionais() {
    setCarregandoProfissionais(true);
    setErro('');
    try {
      const { data } = await api.get('/profissionais');
      setProfissionais(data);
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Não foi possível carregar os profissionais.');
    } finally {
      setCarregandoProfissionais(false);
    }
  }

  useEffect(() => {
    if (abaAtiva === 'profissionais') carregarProfissionais();
  }, [abaAtiva]);

  async function cadastrarProfissional(evento) {
    evento.preventDefault();
    setSalvandoProfissional(true);
    setErro('');
    setMensagem('');
    try {
      await api.post('/profissionais', formProfissional);
      setFormProfissional({ nome: '', especialidade: '', telefone: '' });
      setMensagem('Profissional cadastrado com sucesso.');
      await carregarProfissionais();
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Não foi possível cadastrar o profissional.');
    } finally {
      setSalvandoProfissional(false);
    }
  }

  return (
    <div className="pagina pagina-configuracoes">
      <header className="pagina-header">
        <h1>Configurações</h1>
        <p>Ajuste as preferências do seu negócio.</p>
      </header>

      <div className="configuracoes-abas" role="tablist" aria-label="Seções de configurações">
        {abas.map((aba) => (
          <button
            key={aba.id}
            id={`aba-configuracoes-${aba.id}`}
            type="button"
            role="tab"
            className={`configuracoes-aba${abaAtiva === aba.id ? ' ativa' : ''}`}
            aria-selected={abaAtiva === aba.id}
            aria-controls={`painel-configuracoes-${aba.id}`}
            tabIndex={abaAtiva === aba.id ? 0 : -1}
            onClick={() => setAbaAtiva(aba.id)}
          >
            {aba.rotulo}
          </button>
        ))}
      </div>

      <section id={`painel-configuracoes-${abaAtiva}`} className="configuracoes-painel" role="tabpanel" aria-labelledby={`aba-configuracoes-${abaAtiva}`}>
        {abaAtiva === 'profissionais' ? (
          <>
            <div className="configuracoes-painel-cabecalho">
              <h2>Profissionais disponíveis</h2>
              <p>Cadastre a equipe que poderá atender pelo sistema.</p>
            </div>

            <AlertaTemporario tipo="sucesso" mensagem={mensagem} />
            <AlertaTemporario tipo="erro" mensagem={erro} />

            <form className="card-profissional" onSubmit={cadastrarProfissional}>
              <h3>Novo profissional</h3>
              <div className="linha-form formulario-profissional">
                <label>
                  Nome
                  <input value={formProfissional.nome} onChange={(evento) => setFormProfissional((anterior) => ({ ...anterior, nome: evento.target.value }))} maxLength="100" required />
                </label>
                <label>
                  Especialidade
                  <input value={formProfissional.especialidade} onChange={(evento) => setFormProfissional((anterior) => ({ ...anterior, especialidade: evento.target.value }))} placeholder="Ex.: Cabeleireiro(a)" maxLength="100" />
                </label>
                <label>
                  Telefone
                  <input value={formProfissional.telefone} onChange={(evento) => setFormProfissional((anterior) => ({ ...anterior, telefone: evento.target.value }))} inputMode="tel" maxLength="30" />
                </label>
                <button type="submit" disabled={salvandoProfissional}>{salvandoProfissional ? 'Cadastrando...' : 'Cadastrar profissional'}</button>
              </div>
            </form>

            <div className="lista-profissionais" aria-label="Profissionais cadastrados">
              <h3>Equipe cadastrada</h3>
              {carregandoProfissionais ? <p>Carregando profissionais...</p> : profissionais.length > 0 ? profissionais.map((profissional) => (
                <article className="card-profissional-item" key={profissional.id}>
                  <div className="avatar-profissional" aria-hidden="true">{profissional.nome.charAt(0).toUpperCase()}</div>
                  <div>
                    <strong>{profissional.nome}</strong>
                    {(profissional.especialidade || profissional.telefone) && <p>{[profissional.especialidade, profissional.telefone].filter(Boolean).join(' · ')}</p>}
                  </div>
                </article>
              )) : <div className="aviso-vazio">Nenhum profissional cadastrado ainda.</div>}
            </div>
          </>
        ) : (
          <div className="aviso-vazio">
            As configurações de <strong>{abaSelecionada.rotulo}</strong> serão disponibilizadas aqui.
          </div>
        )}
      </section>
    </div>
  );
}
