/**
 * Conversion et validation de configurations Nginx et Apache.
 *
 * La traduction porte sur les directives réellement courantes en production.
 * Toute ligne non reconnue est reportée telle quelle, en commentaire, plutôt
 * que d'être silencieusement perdue : une configuration à moitié convertie
 * sans le dire est pire qu'une conversion incomplète assumée.
 */

export type ServerFlavour = 'nginx' | 'apache'

export interface ConvertIssue {
  line: number
  text: string
  reason: string
}

export interface ConvertResult {
  output: string
  /** Directives reportées en commentaire, faute d'équivalent direct. */
  issues: ConvertIssue[]
  translated: number
  total: number
}

export interface ValidationIssue {
  line: number
  severity: 'error' | 'warning'
  message: string
  hint?: string
}

export interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
  directives: number
}

/* ------------------------------------------------------------ Validation */

/** Contrôle de structure d'une configuration Nginx. */
export function validateNginx(source: string): ValidationResult {
  const issues: ValidationIssue[] = []
  const lines = source.split('\n')

  let depth = 0
  let directives = 0
  const openings: number[] = []

  lines.forEach((raw, index) => {
    const line = raw.split('#')[0]!.trim()
    if (!line) return

    for (const char of line) {
      if (char === '{') { depth++; openings.push(index + 1) }
      if (char === '}') {
        depth--
        openings.pop()
        if (depth < 0) {
          issues.push({
            line: index + 1, severity: 'error',
            message: 'Accolade fermante en trop.',
            hint: 'Aucun bloc n\'était ouvert à cet endroit.'
          })
          depth = 0
        }
      }
    }

    const isBlock = line.endsWith('{') || line === '}'
    if (isBlock) return

    directives++

    if (!line.endsWith(';') && !line.endsWith('}')) {
      issues.push({
        line: index + 1, severity: 'error',
        message: `Point-virgule manquant : « ${line} ».`,
        hint: 'En Nginx, chaque directive simple se termine par un point-virgule.'
      })
    }

    // Pièges classiques.
    if (/^\s*if\s*\(/.test(line) && /\breturn\b|\brewrite\b/.test(line) === false) {
      issues.push({
        line: index + 1, severity: 'warning',
        message: 'Bloc « if » dans un contexte location.',
        hint: 'Nginx recommande d\'éviter « if » hors return et rewrite.'
      })
    }

    if (/proxy_pass\s+http/.test(line) && !/proxy_set_header/.test(source)) {
      issues.push({
        line: index + 1, severity: 'warning',
        message: 'proxy_pass sans en-têtes transmis.',
        hint: 'Ajoutez proxy_set_header Host $host et X-Forwarded-For.'
      })
    }
  })

  if (depth > 0) {
    issues.push({
      line: openings[0] ?? 1, severity: 'error',
      message: `${depth} bloc(s) non refermé(s).`,
      hint: 'Il manque autant d\'accolades fermantes.'
    })
  }

  return { valid: !issues.some(issue => issue.severity === 'error'), issues, directives }
}

/** Contrôle de structure d'une configuration Apache. */
export function validateApache(source: string): ValidationResult {
  const issues: ValidationIssue[] = []
  const lines = source.split('\n')
  const stack: { tag: string, line: number }[] = []
  let directives = 0

  lines.forEach((raw, index) => {
    const line = raw.split('#')[0]!.trim()
    if (!line) return

    const close = line.match(/^<\/(\w+)\s*>$/)
    if (close) {
      const open = stack.pop()
      if (!open) {
        issues.push({
          line: index + 1, severity: 'error',
          message: `Balise fermante </${close[1]}> sans ouverture.`
        })
      } else if (open.tag.toLowerCase() !== close[1]!.toLowerCase()) {
        issues.push({
          line: index + 1, severity: 'error',
          message: `</${close[1]}> ferme <${open.tag}> ouvert ligne ${open.line}.`,
          hint: 'Les balises doivent être imbriquées dans l\'ordre.'
        })
      }
      return
    }

    const open = line.match(/^<(\w+)[^>]*>$/)
    if (open) {
      stack.push({ tag: open[1]!, line: index + 1 })
      return
    }

    directives++

    if (line.endsWith(';')) {
      issues.push({
        line: index + 1, severity: 'warning',
        message: 'Point-virgule en fin de directive.',
        hint: 'Apache n\'en attend pas ; c\'est une habitude venue de Nginx.'
      })
    }

    if (/^RewriteRule/.test(line) && !/RewriteEngine\s+On/i.test(source)) {
      issues.push({
        line: index + 1, severity: 'error',
        message: 'RewriteRule sans RewriteEngine On.',
        hint: 'Le moteur de réécriture doit être activé avant toute règle.'
      })
    }
  })

  for (const open of stack) {
    issues.push({
      line: open.line, severity: 'error',
      message: `<${open.tag}> n'est jamais refermée.`
    })
  }

  return { valid: !issues.some(issue => issue.severity === 'error'), issues, directives }
}

export function validate(source: string, flavour: ServerFlavour): ValidationResult {
  return flavour === 'nginx' ? validateNginx(source) : validateApache(source)
}

/* ------------------------------------------------------------ Conversion */

type Rule = {
  match: RegExp
  /** Renvoie les lignes traduites, ou `null` si la directive doit être reportée. */
  convert: (groups: RegExpMatchArray, indent: string) => string[] | null
}

/** Indicateurs de réécriture Nginx vers les drapeaux Apache. */
function rewriteFlags(flag: string): string {
  switch (flag) {
    case 'permanent': return '[R=301,L]'
    case 'redirect': return '[R=302,L]'
    case 'last': return '[L]'
    case 'break': return '[L]'
    default: return '[L]'
  }
}

const NGINX_TO_APACHE: Rule[] = [
  {
    match: /^server_name\s+(.+?);?$/,
    convert: ([, names], indent) => {
      const list = names!.trim().split(/\s+/)
      const lines = [`${indent}ServerName ${list[0]}`]
      if (list.length > 1) lines.push(`${indent}ServerAlias ${list.slice(1).join(' ')}`)
      return lines
    }
  },
  { match: /^root\s+([^;]+);?$/, convert: ([, path], i) => [`${i}DocumentRoot ${path!.trim()}`] },
  { match: /^index\s+([^;]+);?$/, convert: ([, files], i) => [`${i}DirectoryIndex ${files!.trim()}`] },
  {
    match: /^return\s+(30[1278])\s+(.+?);?$/,
    convert: ([, code, target], i) => [`${i}Redirect ${code} / ${target!.trim().replace(/\$request_uri/g, '')}`]
  },
  {
    match: /^rewrite\s+(\S+)\s+(\S+)(?:\s+(\w+))?;?$/,
    convert: ([, from, to, flag], i) => [`${i}RewriteRule ${from} ${to} ${rewriteFlags(flag ?? '')}`]
  },
  {
    match: /^location\s+(=\s*)?(\S+)\s*\{$/,
    convert: ([, exact, path], i) => [`${i}<Location${exact ? 'Match' : ''} ${path}>`]
  },
  {
    match: /^proxy_pass\s+(.+?);?$/,
    convert: ([, target], i) => {
      const clean = target!.trim().replace(/\/$/, '')
      return [`${i}ProxyPass / ${clean}/`, `${i}ProxyPassReverse / ${clean}/`]
    }
  },
  { match: /^client_max_body_size\s+(\d+)([kKmMgG])?;?$/, convert: ([, size, unit], i) => {
    const factor = { k: 1024, m: 1048576, g: 1073741824 }[(unit ?? '').toLowerCase()] ?? 1
    return [`${i}LimitRequestBody ${Number(size) * factor}`]
  } },
  { match: /^ssl_certificate\s+([^;]+);?$/, convert: ([, path], i) => [`${i}SSLCertificateFile ${path!.trim()}`] },
  { match: /^ssl_certificate_key\s+([^;]+);?$/, convert: ([, path], i) => [`${i}SSLCertificateKeyFile ${path!.trim()}`] },
  { match: /^access_log\s+([^\s;]+)[^;]*;?$/, convert: ([, path], i) => [`${i}CustomLog ${path} combined`] },
  { match: /^error_log\s+([^\s;]+)[^;]*;?$/, convert: ([, path], i) => [`${i}ErrorLog ${path}`] },
  { match: /^add_header\s+(\S+)\s+([^;]+?)(\s+always)?;?$/, convert: ([, name, value], i) =>
    [`${i}Header set ${name} ${value!.trim()}`] },
  { match: /^gzip\s+on;?$/, convert: (_m, i) => [`${i}SetOutputFilter DEFLATE`] },
  { match: /^autoindex\s+(on|off);?$/, convert: ([, state], i) =>
    [`${i}Options ${state === 'on' ? '+' : '-'}Indexes`] },
  { match: /^try_files\s+([^;]+);?$/, convert: ([, chain], i) => {
    const last = chain!.trim().split(/\s+/).pop()
    return [
      `${i}RewriteCond %{REQUEST_FILENAME} !-f`,
      `${i}RewriteCond %{REQUEST_FILENAME} !-d`,
      `${i}RewriteRule ^ ${last?.replace(/^=?\d+$/, '/index.html')} [L]`
    ]
  } },
  { match: /^deny\s+([^;]+);?$/, convert: ([, who], i) => [`${i}Require not ip ${who!.trim()}`] },
  { match: /^allow\s+([^;]+);?$/, convert: ([, who], i) => [`${i}Require ip ${who!.trim()}`] }
]

const APACHE_TO_NGINX: Rule[] = [
  { match: /^<VirtualHost\s+\S*:(\d+)>$/i, convert: ([, port], i) => [`${i}server {`, `${i}    listen ${port};`] },
  { match: /^<\/VirtualHost>$/i, convert: (_m, i) => [`${i}}`] },
  { match: /^ServerName\s+(.+)$/i, convert: ([, name], i) => [`${i}server_name ${name};`] },
  { match: /^ServerAlias\s+(.+)$/i, convert: ([, names], i) => [`${i}# alias : ${names} — à joindre au server_name`] },
  { match: /^DocumentRoot\s+(.+)$/i, convert: ([, path], i) => [`${i}root ${path};`] },
  { match: /^DirectoryIndex\s+(.+)$/i, convert: ([, files], i) => [`${i}index ${files};`] },
  {
    match: /^Redirect\s+(30[1278])\s+(\S+)\s+(\S+)$/i,
    convert: ([, code, , target], i) => [`${i}return ${code} ${target};`]
  },
  {
    match: /^RewriteRule\s+(\S+)\s+(\S+)(?:\s+\[([^\]]+)\])?$/i,
    convert: ([, from, to, flags], i) => {
      const list = (flags ?? '').split(',')
      const permanent = list.some(flag => flag.startsWith('R=301'))
      const redirect = list.some(flag => flag.startsWith('R'))
      const suffix = permanent ? ' permanent' : redirect ? ' redirect' : ' last'
      return [`${i}rewrite ${from} ${to}${suffix};`]
    }
  },
  { match: /^<Location(?:Match)?\s+(\S+)>$/i, convert: ([, path], i) => [`${i}location ${path} {`] },
  { match: /^<\/Location(?:Match)?>$/i, convert: (_m, i) => [`${i}}`] },
  { match: /^<Directory\s+(\S+)>$/i, convert: ([, path], i) => [`${i}# <Directory ${path}> — géré par root/location en Nginx`] },
  { match: /^<\/Directory>$/i, convert: () => [] },
  {
    match: /^ProxyPass\s+(\S+)\s+(\S+)$/i,
    convert: ([, path, target], i) => [`${i}location ${path} {`, `${i}    proxy_pass ${target};`, `${i}}`]
  },
  { match: /^ProxyPassReverse\s+.+$/i, convert: (_m, i) => [`${i}# ProxyPassReverse : implicite en Nginx`] },
  { match: /^SSLCertificateFile\s+(.+)$/i, convert: ([, path], i) => [`${i}ssl_certificate ${path};`] },
  { match: /^SSLCertificateKeyFile\s+(.+)$/i, convert: ([, path], i) => [`${i}ssl_certificate_key ${path};`] },
  { match: /^CustomLog\s+(\S+).*$/i, convert: ([, path], i) => [`${i}access_log ${path};`] },
  { match: /^ErrorLog\s+(\S+)$/i, convert: ([, path], i) => [`${i}error_log ${path};`] },
  { match: /^Header\s+set\s+(\S+)\s+(.+)$/i, convert: ([, name, value], i) => [`${i}add_header ${name} ${value};`] },
  { match: /^LimitRequestBody\s+(\d+)$/i, convert: ([, size], i) =>
    [`${i}client_max_body_size ${Math.ceil(Number(size) / 1048576)}m;`] },
  { match: /^Options\s+([+-])Indexes$/i, convert: ([, sign], i) =>
    [`${i}autoindex ${sign === '+' ? 'on' : 'off'};`] },
  { match: /^RewriteEngine\s+(on|off)$/i, convert: () => [] },
  { match: /^RewriteCond\s+(.+)$/i, convert: ([, cond], i) => [`${i}# condition : ${cond}`] },
  { match: /^Require\s+ip\s+(.+)$/i, convert: ([, who], i) => [`${i}allow ${who};`] },
  { match: /^Require\s+not\s+ip\s+(.+)$/i, convert: ([, who], i) => [`${i}deny ${who};`] },
  { match: /^Require\s+all\s+granted$/i, convert: (_m, i) => [`${i}allow all;`] },
  { match: /^Require\s+all\s+denied$/i, convert: (_m, i) => [`${i}deny all;`] }
]

export function convert(source: string, from: ServerFlavour): ConvertResult {
  const rules = from === 'nginx' ? NGINX_TO_APACHE : APACHE_TO_NGINX
  const output: string[] = []
  const issues: ConvertIssue[] = []

  let translated = 0
  let total = 0

  // Le port du VirtualHost se lit sur la directive `listen` du bloc server.
  const listenPort = source.match(/^\s*listen\s+(\d+)/m)?.[1] ?? '80'
  const stack: string[] = []

  source.split('\n').forEach((raw, index) => {
    const indent = raw.match(/^\s*/)?.[0] ?? ''
    const line = raw.trim()

    if (!line) { output.push(''); return }

    if (line.startsWith('#')) { output.push(raw); return }

    if (from === 'nginx') {
      // Ouverture du bloc server : devient l'hôte virtuel.
      if (/^server\s*\{$/.test(line)) {
        stack.push('VirtualHost')
        output.push(`${indent}<VirtualHost *:${listenPort}>`)
        total++
        translated++
        return
      }

      // La directive listen est absorbée par l'ouverture ci-dessus.
      if (/^listen\s+/.test(line)) {
        total++
        translated++
        return
      }

      // Fermeture : on referme la balise correspondante.
      if (line === '}') {
        const tag = stack.pop() ?? 'Location'
        output.push(`${indent}</${tag}>`)
        return
      }

      if (/^location\s+/.test(line)) stack.push('Location')
    }

    total++

    const rule = rules.find(candidate => candidate.match.test(line))
    if (!rule) {
      issues.push({
        line: index + 1,
        text: line,
        reason: 'Aucun équivalent direct connu pour cette directive.'
      })
      output.push(`${indent}# NON CONVERTI : ${line}`)
      return
    }

    const converted = rule.convert(line.match(rule.match)!, indent)
    if (converted === null) {
      issues.push({ line: index + 1, text: line, reason: 'Conversion ambiguë.' })
      output.push(`${indent}# NON CONVERTI : ${line}`)
      return
    }

    translated++
    output.push(...converted)
  })

  return { output: output.join('\n'), issues, translated, total }
}

export const SAMPLES: Record<ServerFlavour, string> = {
  nginx: `server {
    listen 443 ssl;
    server_name exemple.fr www.exemple.fr;

    root /var/www/exemple;
    index index.html index.php;

    ssl_certificate /etc/ssl/exemple.crt;
    ssl_certificate_key /etc/ssl/exemple.key;

    client_max_body_size 20m;
    add_header X-Frame-Options SAMEORIGIN;
    gzip on;

    access_log /var/log/nginx/exemple.access.log;
    error_log /var/log/nginx/exemple.error.log;

    location /api {
        proxy_pass http://127.0.0.1:3000;
    }
}`,
  apache: `<VirtualHost *:443>
    ServerName exemple.fr
    ServerAlias www.exemple.fr

    DocumentRoot /var/www/exemple
    DirectoryIndex index.html index.php

    SSLCertificateFile /etc/ssl/exemple.crt
    SSLCertificateKeyFile /etc/ssl/exemple.key

    Header set X-Frame-Options SAMEORIGIN
    LimitRequestBody 20971520

    CustomLog /var/log/apache2/exemple.access.log combined
    ErrorLog /var/log/apache2/exemple.error.log

    RewriteEngine On
    RewriteRule ^/ancien$ /nouveau [R=301,L]

    ProxyPass /api http://127.0.0.1:3000/
    ProxyPassReverse /api http://127.0.0.1:3000/
</VirtualHost>`
}
