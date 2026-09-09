const LIMITE_LOGOMARCA_BYTES = 100 * 1024;

function lerComoDataUrl(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(leitor.result);
    leitor.onerror = () => reject(new Error('Não foi possível ler a imagem selecionada.'));
    leitor.readAsDataURL(arquivo);
  });
}

function criarImagem(arquivo) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const imagem = new Image();
    imagem.onload = () => { URL.revokeObjectURL(url); resolve(imagem); };
    imagem.onerror = () => { URL.revokeObjectURL(url); reject(new Error('A imagem selecionada é inválida.')); };
    imagem.src = url;
  });
}

function gerarPng(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Não foi possível redimensionar a imagem.')), 'image/png');
  });
}

// Mantém PNG (inclusive transparência) e reduz as dimensões até atingir 100 KB.
export async function prepararLogomarca(arquivo) {
  if (!arquivo?.type.startsWith('image/')) throw new Error('Selecione uma imagem válida.');
  if (arquivo.size <= LIMITE_LOGOMARCA_BYTES) return { dataUrl: await lerComoDataUrl(arquivo), redimensionada: false };

  const imagem = await criarImagem(arquivo);
  const proporcaoInicial = Math.min(1, Math.sqrt((LIMITE_LOGOMARCA_BYTES * 0.8) / arquivo.size));
  let largura = Math.max(1, Math.round(imagem.naturalWidth * proporcaoInicial));
  let altura = Math.max(1, Math.round(imagem.naturalHeight * proporcaoInicial));

  for (let tentativa = 0; tentativa < 16; tentativa += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = largura;
    canvas.height = altura;
    canvas.getContext('2d').drawImage(imagem, 0, 0, largura, altura);
    const png = await gerarPng(canvas);
    if (png.size <= LIMITE_LOGOMARCA_BYTES) return { dataUrl: await lerComoDataUrl(png), redimensionada: true };
    if (largura === 1 && altura === 1) break;
    largura = Math.max(1, Math.round(largura * 0.75));
    altura = Math.max(1, Math.round(altura * 0.75));
  }

  throw new Error('Não foi possível reduzir a logomarca para 100 KB. Tente outra imagem.');
}

export { LIMITE_LOGOMARCA_BYTES };
