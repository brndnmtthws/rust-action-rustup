import { addPath, info, setFailed } from '@actions/core'
import { exec } from '@actions/exec'
import { downloadTool } from '@actions/tool-cache'
import { promises as fs } from 'fs'
import path from 'path'

const fetchRustup = async () => {
  const rustupInstaller =
    process.platform === 'win32'
      ? await downloadTool('https://win.rustup.rs')
      : await downloadTool('https://sh.rustup.rs')
  await fs.chmod(rustupInstaller, 0o755)

  await exec(rustupInstaller, ['--default-toolchain', 'none', '-y'])

  await exec('rustup show')
  await exec('cargo --version')

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  addPath(path.join(process.env.HOME!, '.cargo', 'bin'))
}

async function run(): Promise<void> {
  try {
    info('hello!!!!!')
    await fetchRustup()
  } catch (error) {
    if (error instanceof Error) setFailed(error.message)
  }
}

run()
