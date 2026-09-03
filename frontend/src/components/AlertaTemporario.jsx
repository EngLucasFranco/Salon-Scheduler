import { useEffect, useState } from 'react';

export default function AlertaTemporario({ tipo, mensagem }) {
  const [visivel, setVisivel] = useState(Boolean(mensagem));

  useEffect(() => {
    if (!mensagem) return undefined;
    setVisivel(true);
    const temporizador = window.setTimeout(() => setVisivel(false), 3000);
    return () => window.clearTimeout(temporizador);
  }, [mensagem]);

  if (!mensagem || !visivel) return null;
  return <div className={`alerta-${tipo}`} role="alert">{mensagem}</div>;
}
