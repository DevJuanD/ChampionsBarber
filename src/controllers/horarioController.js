const prisma = require('../config/prisma');

function horario(valor) {
  return typeof valor === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(valor)
    ? new Date(`1970-01-01T${valor}:00.000Z`) : null;
}

function periodoPublico(periodo) {
  return { ...periodo, hora_inicio: periodo.hora_inicio.toISOString().slice(11, 16), hora_fim: periodo.hora_fim.toISOString().slice(11, 16) };
}

async function listarHorarios(req, res, next) {
  try {
    const [funcionamento, jornadas] = await Promise.all([
      prisma.funcionamento.findMany({ where: { ativo: true }, orderBy: [{ dia_semana: 'asc' }, { hora_inicio: 'asc' }] }),
      prisma.jornadaProfissional.findMany({ where: { ativo: true }, include: { profissional: { select: { nome: true } } }, orderBy: [{ dia_semana: 'asc' }, { hora_inicio: 'asc' }] }),
    ]);
    res.json({ funcionamento: funcionamento.map(periodoPublico), jornadas: jornadas.map(periodoPublico) });
  } catch (error) { next(error); }
}

async function criarHorario(req, res, next) {
  const { tipo, cd_profissional } = req.body || {};
  const lote = req.body?.dias_semana !== undefined || req.body?.periodos !== undefined;
  const dias = lote ? req.body.dias_semana : [req.body?.dia_semana];
  const periodos = lote ? req.body.periodos : [{ hora_inicio: req.body?.hora_inicio, hora_fim: req.body?.hora_fim }];
  if (!['funcionamento', 'jornada'].includes(tipo) || !Array.isArray(dias) || !dias.length || dias.length > 7 ||
      new Set(dias).size !== dias.length || dias.some((dia) => !Number.isInteger(dia) || dia < 0 || dia > 6) ||
      !Array.isArray(periodos) || !periodos.length || periodos.length > 6 ||
      periodos.some((periodo) => !horario(periodo?.hora_inicio) || !horario(periodo?.hora_fim) || periodo.hora_inicio >= periodo.hora_fim) ||
      (tipo === 'jornada' && (!Number.isSafeInteger(cd_profissional) || cd_profissional <= 0))) {
    return res.status(400).json({ mensagem: 'Selecione os dias e informe períodos válidos, com início anterior ao fim.' });
  }
  const ordenados = [...periodos].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
  if (ordenados.some((periodo, indice) => indice > 0 && periodo.hora_inicio < ordenados[indice - 1].hora_fim)) {
    return res.status(400).json({ mensagem: 'Os períodos informados não podem se sobrepor.' });
  }
  try {
    const registros = await prisma.$transaction(async (tx) => {
      const diasOrdenados = [...dias].sort((a, b) => a - b);
      for (const dia of diasOrdenados) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(71001, ${dia}::integer)`;
      }
      const jornada = tipo === 'jornada';
      const modelo = jornada ? tx.jornadaProfissional : tx.funcionamento;
      if (jornada) {
        const profissional = await tx.profissional.findFirst({ where: { cd_profissional, ativo: true } });
        if (!profissional) throw Object.assign(new Error('Selecione um profissional ativo.'), { status: 400 });
      }
      const novos = [];
      for (const dia_semana of diasOrdenados) {
        for (const periodo of ordenados) {
          const inicio = horario(periodo.hora_inicio);
          const fim = horario(periodo.hora_fim);
          const where = { dia_semana, ativo: true, ...(jornada ? { cd_profissional } : {}) };
          if (jornada) {
        const aberto = await tx.funcionamento.findFirst({ where: { dia_semana, ativo: true, hora_inicio: { lte: inicio }, hora_fim: { gte: fim } } });
        if (!aberto) throw Object.assign(new Error('A jornada deve estar dentro de um período de funcionamento da barbearia.'), { status: 400 });
          }
      const conflito = await modelo.findFirst({ where: { ...where, hora_inicio: { lt: fim }, hora_fim: { gt: inicio } } });
      if (conflito) throw Object.assign(new Error('Já existe um período nesse intervalo. Confira os horários cadastrados.'), { status: 409 });
          novos.push({ dia_semana, hora_inicio: inicio, hora_fim: fim, ...(jornada ? { cd_profissional } : {}) });
        }
      }
      const criados = [];
      for (const data of novos) criados.push(await modelo.create({ data }));
      return criados;
    }, { timeout: 30000 });
    res.status(201).json(lote ? registros.map(periodoPublico) : periodoPublico(registros[0]));
  } catch (error) { next(error); }
}

module.exports = { listarHorarios, criarHorario };
