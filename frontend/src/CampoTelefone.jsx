import { useState } from 'react';

export default function CampoTelefone({ onChange, defaultValue = '', ...props }) {
  const [valor, setValor] = useState(defaultValue);
  function alterar(event) {
    let numeros = event.target.value.replace(/\D/g, '');
    if (numeros.startsWith('55') && [12, 13].includes(numeros.length)) numeros = numeros.slice(2);
    numeros = numeros.slice(0, 11);
    let formatado = numeros;
    if (numeros.length > 2) formatado = `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`;
    if (numeros.length > 6) formatado = `(${numeros.slice(0, 2)}) ${numeros.slice(2, numeros.length > 10 ? 7 : 6)}-${numeros.slice(numeros.length > 10 ? 7 : 6)}`;
    setValor(formatado);
    event.target.value = formatado;
    onChange?.(event);
  }
  return <input {...props} type="tel" inputMode="tel" maxLength={19} value={valor} onChange={alterar} pattern="\([1-9][0-9]\) [0-9]{4,5}-[0-9]{4}" title="Informe 10 ou 11 dígitos, incluindo o DDD." />;
}
