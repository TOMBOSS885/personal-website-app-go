import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const backend = relativePath => readFileSync(resolve(process.cwd(), `../php_backend/${relativePath}`), 'utf8')

describe('PHP OAuth security contract', () => {
  const oauth = backend('app/oauth.php')
  const migration = backend('migrations/015_oauth_identities.sql')

  it('binds one-time OAuth state to the browser session and initiating user', () => {
    expect(oauth).toMatch(/random_bytes\((?:32|[3-9]\d+)\)/)
    expect(oauth).toContain("hash('sha256', $state, true)")
    expect(oauth).toContain('app_oauth_session_hash()')
    expect(oauth).toContain("unset($_SESSION['oauth_states'][$stateKey])")
    expect(oauth).toMatch(/empty\(\$transaction\['used_at'\]\)/)
    expect(oauth).toMatch(/UPDATE oauth_transactions SET used_at = NOW\(\)/)
    expect(oauth).toMatch(/\(int\) \$transaction\['user_id'\].*\(int\) \$_SESSION\['user_id'\]/s)
  })

  it('requires CSRF protection and password reauthentication to start a bind', () => {
    const bindStart = oauth.slice(oauth.indexOf('function app_oauth_bind_start'), oauth.indexOf('function app_oauth_http'))
    expect(bindStart).toContain('app_user_required()')
    expect(bindStart).toContain('app_user_csrf_required()')
    expect(bindStart).toContain('password_verify(')
    expect(backend('app/bootstrap.php')).toMatch(/\$method === 'POST'.+oauth\/.+\/bind-start/)
  })

  it('allows only local return paths and fixed HTTPS provider requests', () => {
    expect(oauth).toMatch(/substr\(\$path, 0, 2\) === '\/\/'/)
    expect(oauth).toMatch(/strpos\(\$path, '\\\\'\) !== false/)
    expect(oauth).toMatch(/preg_match\('\/\[\\x00-\\x1f\\x7f\]\/', \$path\)/)
    expect(oauth).toContain('CURLOPT_FOLLOWLOCATION => false')
    expect(oauth).toContain('CURLOPT_PROTOCOLS')
    expect(oauth).toContain('CURLPROTO_HTTPS')
    expect(oauth).not.toMatch(/app_oauth_http\([^,]+,\s*\$_(?:GET|POST|REQUEST)/)
  })

  it('uses the provider-global stable GitHub id', () => {
    const identityFunction = oauth.slice(oauth.indexOf('function app_oauth_remote_identity'))
    const githubBranch = identityFunction.slice(identityFunction.indexOf("if ($key === 'github')"), identityFunction.indexOf("if ($key === 'qq')"))
    expect(githubBranch).toContain("'scope' => 'global'")
    expect(githubBranch).not.toContain("'scope' => $provider['client_id']")
    expect(githubBranch).toMatch(/\['id'\]/)
    expect(githubBranch).not.toMatch(/'subject'\s*=>.*\['(?:login|email|name)'\]/)
  })

  it('enforces identity ownership and concurrency invariants in MySQL', () => {
    expect(migration).toMatch(/provider_scope VARCHAR\(191\).+(?:ascii_bin|utf8mb4_bin)/i)
    expect(migration).toMatch(/provider_subject VARCHAR\(191\).+(?:ascii_bin|utf8mb4_bin)/i)
    expect(migration).toMatch(/provider_union_id VARCHAR\(191\).+(?:ascii_bin|utf8mb4_bin)/i)
    expect(migration).toMatch(/UNIQUE KEY\s+uq_oauth_provider_subject\s*\(provider, provider_scope, provider_subject\)/i)
    expect(migration).toMatch(/UNIQUE KEY\s+uq_oauth_provider_union\s*\(provider, provider_union_id\)/i)
    expect(migration).toMatch(/UNIQUE KEY\s+uq_oauth_user_provider\s*\(user_id, provider\)/i)
    expect(migration).toMatch(/FOREIGN KEY\s*\(user_id\).*user_accounts\s*\(id\).*ON DELETE CASCADE/is)
    expect(migration).toMatch(/requires_oauth_identity TINYINT\(1\) NOT NULL DEFAULT 0/i)
  })

  it('never creates a user or changes a QQ email from an OAuth callback', () => {
    expect(oauth).not.toMatch(/INSERT\s+INTO\s+user_accounts/i)
    expect(oauth).not.toMatch(/UPDATE\s+user_accounts\s+SET\s+email/i)
    expect(oauth).not.toMatch(/DELETE\s+FROM\s+user_accounts/i)
  })

  it('records redirected OAuth failures as failed security events', () => {
    const audit = backend('app/audit.php')
    const redirect = oauth.slice(oauth.indexOf('function app_oauth_redirect'), oauth.indexOf('function app_oauth_find_identity'))
    expect(redirect).toContain("'success' => $success")
    expect(audit).toMatch(/\$context\['success'\].+\$statusCode >= 200/s)
  })
})

describe('third-party-gated article security contract', () => {
  const bootstrap = backend('app/bootstrap.php')
  const articleSites = backend('app/article_sites.php')

  it('checks third-party identity before returning article content', () => {
    expect(bootstrap).toContain('requires_oauth_identity')
    expect(bootstrap).toContain('app_oauth_user_has_identity')
    expect(bootstrap).toMatch(/requires_oauth_identity[\s\S]{0,1800}app_article_row\(\$row,true\)/)
    expect(bootstrap).toMatch(/Cache-Control:\s*no-store/)
  })

  it('rechecks access on every signed static-article request', () => {
    expect(articleSites).toContain('requires_oauth_identity')
    expect(articleSites).toContain('app_oauth_user_has_identity')
    expect(articleSites).toMatch(/app_article_site_serve[\s\S]+Cache-Control:\s*no-store[\s\S]+app_article_site_send_file/)
  })

  it('does not make protected body text searchable or publish it in feeds', () => {
    expect(bootstrap).toMatch(/login_required\s*=\s*0\s+AND\s+requires_oauth_identity\s*=\s*0\s+AND\s+content\s+LIKE/i)
    expect(bootstrap).toMatch(/if \(!empty\(\$row\['login_required'\]\)\s*\|\|\s*!empty\(\$row\['requires_oauth_identity'\]\)\)/)
  })
})
