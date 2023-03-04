import { debug, startGroup, addPath, endGroup, setFailed } from '@actions/core'
import { exec } from '@actions/exec'
import { downloadTool } from '@actions/tool-cache'
import { promises as fs } from 'fs'
import path from 'path'

const checkIfRustupExists = async () => {
  startGroup('Checking for rustup')
  let output = ''
  const options = {
    listeners: {
      stdout: (data: Buffer) => {
        output += data.toString()
      },
      stderr: (data: Buffer) => {
        output += data.toString()
      }
    }
  }

  const result = await exec('rustup', ['show'], options)
  debug(output)
  debug(`result=${result}`)
  endGroup()
}

const fetchRustup = async () => {
  startGroup('Install rustup')
  const rustupInstaller =
    process.platform === 'win32'
      ? await downloadTool('https://win.rustup.rs')
      : await downloadTool('https://sh.rustup.rs')
  await fs.chmod(rustupInstaller, 0o755)

  await exec(rustupInstaller, ['--default-toolchain', 'none', '-y'])

  addPath(path.join(process.env.HOME ?? process.cwd(), '.cargo', 'bin'))

  await exec('rustup', ['show'])
  await exec('cargo', ['--version'])
  endGroup()
}

async function run(): Promise<void> {
  try {
    await checkIfRustupExists()
    await fetchRustup()
  } catch (error) {
    if (error instanceof Error) setFailed(error.message)
  }
}

run()
