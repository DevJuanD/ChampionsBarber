const desenhos = {
  inicio: ['M3 10 12 3l9 7', 'M5 9v12h14V9', 'M9 21v-8h6v8'],
  agenda: ['M8 2v4m8-4v4', 'M3 10h18', 'M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z', 'M8 14h2m4 0h2m-8 4h2'],
  usuarios: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M16 3a4 4 0 0 1 0 8', 'M22 21v-2a4 4 0 0 0-3-3.87'],
  servicos: ['m14 4 6 6m-7-5 6 6', 'm3 21 9-9', 'M4 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm0 12a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z', 'm6 8 14 13'],
  profissionais: ['M4 21v-2a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v2', 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z', 'm10 15 2 3 2-3'],
  horarios: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M12 7v5l3 2'],
  bloqueios: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'm6 6 12 12'],
  encaixes: ['M4 4h16v16H4Z', 'M12 8v8m-4-4h8'],
  configuracoes: ['M4 7h16M4 17h16', 'M8 4v6m8 4v6'],
  auditoria: ['M6 3h12v18H6Z', 'M9 8h6m-6 4h6m-6 4h4'],
  notificacoes: ['M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9', 'M10 21h4'],
  conta: ['M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z', 'M4 21v-2a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v2'],
  sair: ['M9 4H4v16h5', 'M9 12h12m-4-4 4 4-4 4'],
  site: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M3 12h18', 'M12 3a18 18 0 0 0 0 18 18 18 0 0 0 0-18Z'],
  menu: ['M4 6h16M4 12h16M4 18h16'],
};

export default function IconePainel({ nome }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {nome === 'usuarios' && <circle cx="9" cy="7" r="4" />}
      {(desenhos[nome] || desenhos.inicio).map((d, index) => <path d={d} key={index} />)}
    </svg>
  );
}
