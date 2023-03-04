import core from '@actions/core'
import {exec} from '@actions/exec'
import tc from '@actions/tool-cache'
import {promises as fs} from 'fs'
import path from 'path'

const fetchRustup = async () => {
  const rustupInstaller =
    process.platform === 'win32'
      ? await tc.downloadTool('https://win.rustup.rs')
      : await tc.downloadTool('https://sh.rustup.rs')
  await fs.chmod(rustupInstaller, 0o755)

  await exec(rustupInstaller, ['--default-toolchain', 'none', '-y'])

  await exec('rustup show')
  await exec('cargo --version')

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  core.addPath(path.join(process.env.HOME!, '.cargo', 'bin'))
}

async function run(): Promise<void> {
  try {
    await fetchRustup()
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
