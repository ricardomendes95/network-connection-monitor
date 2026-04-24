import { writeMainLog } from './logger'

// Ações que passam pelo IPC e podem falhar; usadas para customizar a mensagem
// final quando não há match específico no código/mensagem do erro.
export type ErrorAction =
  | 'create-network'
  | 'update-network'
  | 'delete-network'
  | 'set-active-network'
  | 'list-networks'
  | 'suggest-network'
  | 'save-settings'
  | 'run-test'
  | 'export'
  | 'generic'

// Erro cuja `message` já está pronta para ser exibida ao usuário.
// O renderer lê apenas `err.message`, então basta usar Error — esta subclasse
// existe para que o processo main saiba que a mensagem já é "amigável" e não
// deve ser remapeada se passar por outro camada de tratamento.
export class UserFacingError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'UserFacingError'
  }
}

interface SqliteLike {
  code?: string
  message?: string
}

function isSqliteError(err: unknown): err is SqliteLike & Error {
  if (!(err instanceof Error)) return false
  const code = (err as unknown as { code?: unknown }).code
  return typeof code === 'string' && code.startsWith('SQLITE_')
}

const FALLBACKS: Record<ErrorAction, string> = {
  'create-network': 'Não foi possível cadastrar a rede. Tente novamente.',
  'update-network': 'Não foi possível salvar as alterações na rede. Tente novamente.',
  'delete-network': 'Não foi possível excluir a rede. Tente novamente.',
  'set-active-network': 'Não foi possível trocar a rede selecionada. Tente novamente.',
  'list-networks': 'Não foi possível carregar as redes cadastradas.',
  'suggest-network': 'Não foi possível detectar a rede atual.',
  'save-settings': 'Não foi possível salvar as configurações. Tente novamente.',
  'run-test': 'Não foi possível iniciar o teste de velocidade.',
  'export': 'Não foi possível gerar o arquivo.',
  'generic': 'Ocorreu um erro inesperado. Tente novamente.'
}

// SQLite → mensagens em português
function mapSqliteError(err: SqliteLike): string | null {
  const code = err.code ?? ''
  const message = err.message ?? ''

  if (code === 'SQLITE_CONSTRAINT_UNIQUE') {
    // Caso específico: tentativa de criar/atualizar rede com SSID+tipo já existente
    if (/networks\.ssid/.test(message) && /networks\.connection_type/.test(message)) {
      return 'Já existe uma rede cadastrada com este SSID e tipo de conexão. Use outro SSID ou edite a rede existente.'
    }
    return 'Já existe um registro com esses mesmos dados. Valores duplicados não são permitidos.'
  }

  if (code === 'SQLITE_CONSTRAINT_NOTNULL') {
    return 'Preencha todos os campos obrigatórios antes de salvar.'
  }

  if (code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    return 'Esta operação está bloqueada porque existem dados vinculados a este registro.'
  }

  if (code === 'SQLITE_CONSTRAINT_CHECK') {
    return 'Um dos valores informados é inválido.'
  }

  if (code.startsWith('SQLITE_BUSY') || code.startsWith('SQLITE_LOCKED')) {
    return 'O banco de dados está ocupado no momento. Tente novamente em instantes.'
  }

  if (code.startsWith('SQLITE_')) {
    return 'Erro ao acessar o banco de dados.'
  }

  return null
}

// Erros de rede / timeout do Node/Electron
function mapNetworkError(err: Error): string | null {
  const code = (err as unknown as { code?: unknown }).code
  if (typeof code === 'string') {
    if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
      return 'Sem conexão com a internet. Verifique sua rede e tente novamente.'
    }
    if (code === 'ETIMEDOUT' || code === 'UND_ERR_CONNECT_TIMEOUT') {
      return 'A operação demorou demais para responder. Tente novamente.'
    }
    if (code === 'ECONNREFUSED' || code === 'ECONNRESET') {
      return 'A conexão foi recusada pelo servidor remoto.'
    }
  }
  return null
}

/**
 * Converte qualquer erro em uma mensagem amigável em português para o usuário.
 * `action` ajusta o fallback quando não há match específico.
 */
export function toUserMessage(err: unknown, action: ErrorAction = 'generic'): string {
  if (err instanceof UserFacingError) return err.message

  if (isSqliteError(err)) {
    const mapped = mapSqliteError(err)
    if (mapped) return mapped
  }

  if (err instanceof Error) {
    const network = mapNetworkError(err)
    if (network) return network

    // Mensagens que o próprio código já escreve em português (ex. networks.repo)
    // passam direto — evita esconder erros úteis atrás do fallback genérico.
    if (/^Rede\b/.test(err.message)) return err.message
  }

  return FALLBACKS[action]
}

/**
 * Loga o erro original com stack e devolve um `UserFacingError` pronto para
 * ser relançado dentro de um `ipcMain.handle` — o renderer recebe apenas a
 * mensagem em português.
 */
export function toUserFacingError(err: unknown, action: ErrorAction = 'generic'): UserFacingError {
  if (err instanceof UserFacingError) return err

  const userMessage = toUserMessage(err, action)

  writeMainLog('IPC handler error', {
    action,
    userMessage,
    originalMessage: err instanceof Error ? err.message : String(err),
    code: (err as { code?: unknown } | undefined)?.code,
    stack: err instanceof Error ? err.stack : undefined
  })

  return new UserFacingError(userMessage, { cause: err })
}
