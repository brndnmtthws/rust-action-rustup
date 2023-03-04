import core from '@actions/core'
import { exec } from '@actions/exec'
import { downloadTool } from '@actions/tool-cache'
import { promises as fs } from 'fs'
import path from 'path'

const fetchRustup = async () => {
  core.startGroup('Install rustup')
  const rustupInstaller =
    process.platform === 'win32'
      ? await downloadTool('https://win.rustup.rs')
      : await downloadTool('https://sh.rustup.rs')
  await fs.chmod(rustupInstaller, 0o755)

  await exec(rustupInstaller, ['--default-toolchain', 'none', '-y'])

  core.addPath(path.join(process.env.HOME ?? process.cwd(), '.cargo', 'bin'))

  await exec('rustup', ['show'])
  await exec('cargo', ['--version'])
  core.endGroup()
}

async function run(): Promise<void> {
  try {
    await fetchRustup()
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
