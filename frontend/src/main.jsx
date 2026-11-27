import { createRoot } from 'react-dom/client';
import App from './App';
import Login from './Login';
import Cadastro from './Cadastro';
import Painel from './Painel';
import SenhaInicial from './SenhaInicial';
import './style.css';

const paginas = { '/login': <Login />, '/cadastro': <Cadastro />, '/painel': <Painel />, '/definir-senha': <SenhaInicial /> };
const caminho = window.location.pathname.replace(/\/$/, '');

createRoot(document.getElementById('root')).render(paginas[caminho] || <App />);
