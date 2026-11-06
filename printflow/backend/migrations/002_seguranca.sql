-- Invalidação de sessões na troca de senha
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS token_versao INT NOT NULL DEFAULT 1;

