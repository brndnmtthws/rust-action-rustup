import {
  debug,
  addPath,
  setFailed,
  info,
  getInput,
  group,
  setOutput
} from '@actions/core'
import { exec } from '@actions/exec'
import { downloadTool } from '@actions/tool-cache'
import { promises as fs } from 'fs'
import path from 'path'
import yn from 'yn'

const rustupExists = async (): Promise<boolean> => {
  try {
    await exec('rustup', ['show'])
    return true
  } catch (error) {
    if (error instanceof Error) debug(error.message)
    return false
  }
}

const fetchRustup = async () => {
  const rustupInstaller =
    process.platform === 'win32'
      ? await downloadTool('https://win.rustup.rs')
      : await downloadTool('https://sh.rustup.rs')
  await fs.chmod(rustupInstaller, 0o755)

  await exec(rustupInstaller, ['--default-toolchain', 'none', '-y'])

  addPath(path.join(process.env.HOME ?? process.cwd(), '.cargo', 'bin'))
}

const selfUpdateRustup = async () => {
  await exec('rustup', ['self', 'update'])
}

const installToolchain = async () => {
  const toolchain = getInput('toolchain')
  const allowDowngrade = yn(getInput('allow-downgrade'))
  const profile = getInput('profile')
  const components = getInput('components')
    .split(/(,|\s)+/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0)
    .flatMap((c) => ['--component', c])

  await exec('rustup', [
    'toolchain',
    'install',
    toolchain,
    ...(allowDowngrade ? ['--allow-downgrade'] : []),
    ...(profile ? ['--profile', profile] : []),
    ...components
  ])
  await exec('rustup', ['default', toolchain])
}

const showToolchain = async () => {
  let stdout: string[] = []
  await exec('rustup', ['show'], {
    listeners: {
      stdout: (data: Buffer) => {
        stdout = stdout.concat(data.toString().split(/[\r\n]+/))
      }
    }
  })
  stdout.forEach((line) => {
    const defaultToolchain = line.match(/(\S+) \(default\)/)
    if (defaultToolchain) {
      setOutput('toolchain', defaultToolchain[1])
    }
    const rustcVersion = line.match(/rustc ([\S]+) /)
    if (rustcVersion) {
      setOutput('rustc-version', rustcVersion[1])
    }
  })
}

const installAdditionalTargets = async (additionalTargets: string) => {
  const targets = additionalTargets
    .split(/(,|\s)+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)

  for (const target of targets) {
    await exec('rustup', ['target', 'add', target])
  }
}

async function run(): Promise<void> {
  try {
    if (!(await group('Checking for rustup', () => rustupExists()))) {
      info('Need to install rustup')
      await group('Installing rustup', () => fetchRustup())
    } else {
      info('Rustup is already installed, nice 😎')
    }
    const selfUpdate = yn(getInput('self-update')) ?? false
    if (selfUpdate) {
      await group('Updating rustup', () => selfUpdateRustup())
    }
    await group('Installing toolchain', () => installToolchain())
    await showToolchain()
    const additionalTargets = getInput('targets')
    if (additionalTargets && additionalTargets.length > 0) {
      await group('Installing additional targets', () =>
        installAdditionalTargets(additionalTargets)
      )
    }
  } catch (error) {
    if (error instanceof Error) setFailed(error.message)
  }
}

run()
