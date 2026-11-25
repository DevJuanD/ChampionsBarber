import { createRoot } from 'react-dom/client';
import App from './App';
import Login from './Login';
import Cadastro from './Cadastro';
import './style.css';

const paginas = { '/login': <Login />, '/cadastro': <Cadastro /> };
const caminho = window.location.pathname.replace(/\/$/, '');

createRoot(document.getElementById('root')).render(paginas[caminho] || <App />);
