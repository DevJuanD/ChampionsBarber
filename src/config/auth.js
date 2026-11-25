const producao = process.env.NODE_ENV === 'production';

module.exports = {
  nomeCookie: producao ? '__Host-champions_session' : 'champions_session',
  opcoesCookie: { httpOnly: true, secure: producao, sameSite: 'lax', path: '/' },
};
