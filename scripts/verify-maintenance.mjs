import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = mkdtempSync(join(tmpdir(), 'seed-maintenance-'));
const environment = { ...process.env };
for (const key of ['CI', 'HUSKY', 'NODE_ENV', 'npm_config_omit']) {
  delete environment[key];
}
environment.GIT_CONFIG_NOSYSTEM = '1';
environment.GIT_CONFIG_GLOBAL = '/dev/null';
environment.GIT_TERMINAL_PROMPT = '0';

function run(cwd, command, args, extraEnv = {}, succeeds = true) {
  const result = spawnSync(command, args, {
    cwd,
    env: { ...environment, ...extraEnv },
    encoding: 'utf8',
    timeout: 120_000,
  });
  if (result.error) throw result.error;
  if (succeeds && result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`
    );
  }
  if (!succeeds) assert.notEqual(result.status, 0, 'Expected a failing check');
  return result.stdout.trim();
}

function fixture(name, git = false, tooling = false) {
  const cwd = join(root, name);
  mkdirSync(cwd);
  for (const file of ['package.json', 'package-lock.json']) {
    cpSync(join(source, file), join(cwd, file));
  }
  if (tooling) {
    for (const file of [
      '.husky',
      '.prettierrc',
      '.prettierignore',
      '.gitignore',
      '.github/workflows',
      'scripts/verify-maintenance.mjs',
    ]) {
      cpSync(join(source, file), join(cwd, file), { recursive: true });
    }
    mkdirSync(join(cwd, 'src'));
  }
  if (git) {
    run(cwd, 'git', ['init', '--quiet']);
    run(cwd, 'git', ['config', 'user.name', 'Maintenance fixture']);
    run(cwd, 'git', ['config', 'user.email', 'fixture@example.invalid']);
    run(cwd, 'git', ['config', 'commit.gpgsign', 'false']);
  }
  return cwd;
}

function install(cwd, extraEnv = {}, args = []) {
  run(cwd, 'npm', ['ci', '--no-audit', '--no-fund', ...args], extraEnv);
}

function commit(cwd, message, env = {}, succeeds = true) {
  return run(
    cwd,
    'git',
    [
      'commit',
      '--quiet',
      '-m',
      message,
      '-m',
      'Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>',
    ],
    env,
    succeeds
  );
}

try {
  const developer = fixture('developer', true, true);
  install(developer);
  assert.equal(
    run(developer, 'git', ['config', '--get', 'core.hooksPath']),
    '.husky/_'
  );
  assert.ok(existsSync(join(developer, '.husky/_/pre-commit')));
  const partial = join(developer, 'src/partial.ts');
  const other = join(developer, 'unstaged.js');
  const original = [
    'export const staged = 1;',
    ...Array.from(
      { length: 10 },
      (_, index) => `export const spacer${index} = ${index};`
    ),
    'export const unstaged = 1;',
    '',
  ].join('\n');
  writeFileSync(partial, original);
  writeFileSync(other, 'export const untouched = 1;\n');
  run(developer, 'git', ['add', '.']);
  commit(developer, 'fixture baseline', { HUSKY: '0' });

  writeFileSync(partial, original.replace('staged = 1;', 'staged=2;'));
  run(developer, 'git', ['add', 'src/partial.ts']);
  writeFileSync(
    partial,
    readFileSync(partial, 'utf8').replace('unstaged = 1;', 'unstaged = 9;')
  );
  writeFileSync(other, 'export const untouched = 10;\n');
  mkdirSync(join(developer, 'contracts'));
  writeFileSync(
    join(developer, 'contracts/generated.ts'),
    'export const generated=1;\n'
  );
  run(developer, 'git', ['add', 'contracts/generated.ts']);
  commit(developer, 'fixture formatting');
  const staged = run(developer, 'git', ['show', 'HEAD:src/partial.ts']);
  assert.ok(staged.includes('staged = 2;'));
  assert.ok(staged.includes('unstaged = 1;'));
  assert.ok(readFileSync(partial, 'utf8').includes('unstaged = 9;'));
  assert.equal(readFileSync(other, 'utf8'), 'export const untouched = 10;\n');
  assert.equal(
    run(developer, 'git', ['show', 'HEAD:contracts/generated.ts']),
    'export const generated=1;'
  );
  console.log(
    'PASS: developer install enables hooks; staged formatting, partial staging, unrelated edits and generated exclusions'
  );

  writeFileSync(partial, original.replace('staged = 1;', 'staged=3;'));
  const beforeCheck = readFileSync(partial, 'utf8');
  run(developer, 'npm', ['run', 'format:check'], { CI: 'true' }, false);
  assert.equal(readFileSync(partial, 'utf8'), beforeCheck);
  console.log('PASS: actual CI format:check rejects drift without mutation');

  writeFileSync(join(developer, 'src/broken.ts'), 'export const =;\n');
  run(developer, 'git', ['add', 'src/broken.ts']);
  const head = run(developer, 'git', ['rev-parse', 'HEAD']);
  commit(developer, 'fixture must fail', {}, false);
  assert.equal(run(developer, 'git', ['rev-parse', 'HEAD']), head);
  assert.equal(readFileSync(partial, 'utf8'), beforeCheck);
  assert.equal(readFileSync(other, 'utf8'), 'export const untouched = 10;\n');
  console.log(
    'PASS: formatter failure blocks commit and retains unrelated edits'
  );

  for (const [name, env] of [
    ['ci', { CI: 'true' }],
    ['disabled', { HUSKY: '0' }],
  ]) {
    const cwd = fixture(name, true);
    install(cwd, env);
    assert.equal(
      run(cwd, 'git', ['config', '--get', 'core.hooksPath'], {}, false),
      ''
    );
    console.log(`PASS: ${name} clean install skips hook configuration`);
  }
  const docker = fixture('package-only');
  install(docker);
  assert.ok(!existsSync(join(docker, '.husky')));
  console.log('PASS: Docker-style package-only/no-Git clean install');

  const production = fixture('production', true);
  install(production, {}, ['--omit=dev']);
  assert.ok(!existsSync(join(production, 'node_modules/husky')));
  assert.equal(
    run(production, 'git', ['config', '--get', 'core.hooksPath'], {}, false),
    ''
  );
  console.log('PASS: production --omit=dev install without Husky');
} finally {
  rmSync(root, { recursive: true, force: true });
}
