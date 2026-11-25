-- Corrige acesso a campos variaveis do registro NEW na funcao compartilhada.
-- Nao recria tabelas nem remove registros.
CREATE OR REPLACE FUNCTION public.fn_auditar_mudancas_mvp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_ator INTEGER;
  v_motivo TEXT;
  v_antigo JSONB;
  v_novo JSONB;
  v_id INTEGER;
BEGIN
  v_ator := NULLIF(current_setting('app.cd_usuario', true), '')::INTEGER;
  v_motivo := NULLIF(current_setting('app.justificativa', true), '');

  IF TG_TABLE_NAME = 'usuario' THEN
    v_id := NEW.cd_usuario;
    v_antigo := jsonb_build_object('telefone', OLD.telefone,'email',OLD.email,'status',OLD.status);
    v_novo := jsonb_build_object('telefone', NEW.telefone,'email',NEW.email,'status',NEW.status);
  ELSIF TG_TABLE_NAME = 'agendamento' THEN
    v_id := NEW.cd_agendamento;
    IF TG_OP = 'INSERT' THEN
      v_antigo := NULL;
    ELSE
      v_antigo := jsonb_build_object('status',OLD.status,'modalidade',OLD.modalidade,
        'encaixe_autorizado_por',OLD.encaixe_autorizado_por,
        'encaixe_justificativa',OLD.encaixe_justificativa,
        'encaixe_alertas',OLD.encaixe_alertas,'cancelado_em',OLD.cancelado_em);
    END IF;
    v_novo := jsonb_build_object('status',NEW.status,'modalidade',NEW.modalidade,
      'encaixe_autorizado_por',NEW.encaixe_autorizado_por,
      'encaixe_justificativa',NEW.encaixe_justificativa,
      'encaixe_alertas',NEW.encaixe_alertas,'cancelado_em',NEW.cancelado_em);
    v_ator := COALESCE(v_ator,NEW.encaixe_autorizado_por);
    v_motivo := COALESCE(v_motivo,NEW.encaixe_justificativa);
  ELSE
    v_antigo := to_jsonb(OLD);
    v_novo := to_jsonb(NEW);
    v_id := CASE TG_TABLE_NAME
      WHEN 'configuracao' THEN (v_novo->>'cd_configuracao')::INTEGER
      WHEN 'servico' THEN (v_novo->>'cd_servico')::INTEGER
      WHEN 'profissional' THEN (v_novo->>'cd_profissional')::INTEGER
      WHEN 'usuario_papel' THEN (v_novo->>'cd_usuario_papel')::INTEGER
    END;
  END IF;
  IF v_antigo IS DISTINCT FROM v_novo THEN
    INSERT INTO auditoria(cd_usuario,operacao,entidade,cd_registro,
      valor_anterior,valor_novo,justificativa)
    VALUES(v_ator, CASE WHEN TG_OP = 'INSERT' THEN 'CRIACAO' ELSE 'ATUALIZACAO' END,
      upper(TG_TABLE_NAME),v_id,v_antigo,v_novo,v_motivo);
  END IF;
  RETURN NEW;
END;
$function$
