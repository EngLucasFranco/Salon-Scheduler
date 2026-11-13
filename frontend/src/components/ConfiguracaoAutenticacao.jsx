import { useEffect, useState } from 'react';
import api from '../api/axios';
import AlertaTemporario from './AlertaTemporario';

const camposVazios = { baseUrl: '', systemKey: '', apiKey: '' };

export default function ConfiguracaoAutenticacao() {
  const [configurado, setConfigurado] = useState(false);
  const [editando, setEditando] = useState(false);
  const [campos, setCampos] = useState(camposVazios);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    api.get('/configuracoes/autenticacao')
      .then(({ data }) => { setConfigurado(Boolean(data.configurado)); setEditando(!data.configurado); })
      .catch((err) => setErro(err.response?.data?.mensagem || 'Não foi possível consultar a configuração do NexusControl.'))
      .finally(() => setCarregando(false));
  }, []);

  function atualizar(campo, valor) {
    setCampos((anteriores) => ({ ...anteriores, [campo]: valor }));
  }

  async function salvar(evento) {
    evento.preventDefault();
    setSalvando(true); setErro(''); setMensagem('');
    try {
      await api.put('/configuracoes/autenticacao', campos);
      setCampos(camposVazios);
      setConfigurado(true);
      setEditando(false);
      setMensagem('Autenticação cadastrada e protegida com sucesso.');
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Não foi possível salvar a autenticação.');
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <p>Carregando configuração de autenticação...</p>;

  return (
    <section className="card-profissional configuracao-autenticacao">
      <div className="configuracao-autenticacao-cabecalho">
        <div><h2>Sistema de Autenticação</h2><p>Os valores são criptografados e não poderão ser visualizados depois do cadastro.</p></div>
        {configurado && <span className="status-autenticacao-configurada">Configurado</span>}
      </div>
      <AlertaTemporario tipo="erro" mensagem={erro} />
      <AlertaTemporario tipo="sucesso" mensagem={mensagem} />
      {configurado && !editando ? (
        <div className="autenticacao-protegida">
          <p>URL da API, System Key e API Key estão protegidas. Por segurança, os valores não são exibidos.</p>
          <button type="button" className="botao-secundario" onClick={() => { setCampos(camposVazios); setEditando(true); setMensagem(''); }}>Substituir configuração</button>
        </div>
      ) : (
        <form className="formulario-autenticacao" onSubmit={salvar} autoComplete="off">
          <label>URL da API<input type="url" value={campos.baseUrl} onChange={(e) => atualizar('baseUrl', e.target.value)} placeholder="http://localhost:3002" autoComplete="off" spellCheck="false" required /></label>
          <label>System Key<input value={campos.systemKey} onChange={(e) => atualizar('systemKey', e.target.value)} autoComplete="off" spellCheck="false" required /></label>
          <label>API Key<input value={campos.apiKey} onChange={(e) => atualizar('apiKey', e.target.value)} autoComplete="off" spellCheck="false" required /></label>
          <div className="formulario-autenticacao-acoes">
            {configurado && <button type="button" className="botao-secundario" onClick={() => { setCampos(camposVazios); setEditando(false); }}>Cancelar</button>}
            <button type="submit" disabled={salvando}>{salvando ? 'Protegendo e salvando...' : 'Salvar autenticação'}</button>
          </div>
        </form>
      )}
    </section>
  );
}
