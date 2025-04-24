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
import { chmod } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir, platform } from 'node:os'
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

const fetchRustup = async (): Promise<void> => {
  const tempDir = _getTempDirectory()
  const rustupInstaller = await downloadTool(
    platform() === 'win32' ? 'https://win.rustup.rs' : 'https://sh.rustup.rs',
    join(tempDir, platform() === 'win32' ? 'rustup-init.exe' : 'rustup-init.sh')
  )

  await chmod(rustupInstaller, 0o755)
  await exec(rustupInstaller, ['--default-toolchain', 'none', '-y'])

  addPath(join(homedir(), '.cargo', 'bin'))
}

const selfUpdateRustup = async (): Promise<void> => {
  await exec('rustup', ['self', 'update'])
}

const installToolchain = async (): Promise<void> => {
  const toolchain = getInput('toolchain')
  const allowDowngrade = yn(getInput('allow-downgrade'))
  const profile = getInput('profile')

  const components = getInput('components')
    .split(/(,|\s)+/)
    .map((c) => c.trim())
    .filter(Boolean)
    .flatMap((c) => ['--component', c])

  const installArgs = [
    'toolchain',
    'install',
    toolchain,
    ...(allowDowngrade ? ['--allow-downgrade'] : []),
    ...(profile ? ['--profile', profile] : []),
    ...components
  ]

  await exec('rustup', installArgs)
  await exec('rustup', ['default', toolchain])
}

const showToolchain = async (): Promise<void> => {
  const stdout: string[] = []

  await exec('rustup', ['show'], {
    listeners: {
      stdout: (data: Buffer) => {
        stdout.push(...data.toString().split(/[\r\n]+/))
      }
    }
  })

  for (const line of stdout) {
    const defaultToolchain = line.match(/(\S+) \(default\)/)?.at(1)
    if (defaultToolchain) {
      setOutput('toolchain', defaultToolchain)
    }

    const rustcVersion = line.match(/rustc ([\S]+) /)?.at(1)
    if (rustcVersion) {
      setOutput('rustc-version', rustcVersion)
    }
  }
}

const installAdditionalTargets = async (
  additionalTargets: string
): Promise<void> => {
  const targets = additionalTargets
    .split(/(,|\s)+/)
    .map((t) => t.trim())
    .filter(Boolean)

  await Promise.all(
    targets.map((target) => exec('rustup', ['target', 'add', target]))
  )
}

function _getTempDirectory(): string {
  const tempDirectory = process.env.RUNNER_TEMP ?? ''

  if (!tempDirectory) {
    throw new Error(
      'RUNNER_TEMP environment variable is not set. This action requires RUNNER_TEMP to be set.'
    )
  }

  return tempDirectory
}

async function run(): Promise<void> {
  try {
    if (!(await group('Checking for rustup', rustupExists))) {
      info('Need to install rustup')
      await group('Installing rustup', fetchRustup)
    } else {
      info('Rustup is already installed, nice 😎')
    }

    const selfUpdate = yn(getInput('self-update')) ?? false
    if (selfUpdate) {
      await group('Updating rustup', selfUpdateRustup)
    }

    await group('Installing toolchain', installToolchain)
    await showToolchain()

    const additionalTargets = getInput('targets')
    if (additionalTargets?.length > 0) {
      await group('Installing additional targets', () =>
        installAdditionalTargets(additionalTargets)
      )
    }
  } catch (error) {
    if (error instanceof Error) setFailed(error.message)
  }
}

void run()
