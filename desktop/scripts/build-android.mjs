import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cacheRoot = process.env.PERSONAL_BLOG_ANDROID_BUILD_DIR
  || (process.platform === 'win32'
    ? path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'PersonalBlogBuild')
    : path.join(os.homedir(), '.cache', 'personal-blog-build'))
const tauriCli = path.join(projectRoot, 'node_modules', '@tauri-apps', 'cli', 'tauri.js')
const androidRoot = path.join(projectRoot, 'src-tauri', 'gen', 'android')
const forwardedArgs = process.argv.slice(2)
const debug = forwardedArgs.includes('--debug')
const testBuild = forwardedArgs.includes('--test')
const signedRelease = !debug && !testBuild
const cargoProfile = debug ? 'debug' : 'release'
const gradleProfile = signedRelease ? 'release' : 'debug'
const gradleProfileTitle = signedRelease ? 'Release' : 'Debug'
const artifactKind = testBuild ? 'test' : gradleProfile
const args = ['android', 'build', '--apk', '--target', 'aarch64', ...forwardedArgs.filter((arg) => arg !== '--test')]
const environment = {
  ...process.env,
  CARGO_TARGET_DIR: path.join(cacheRoot, 'cargo-target'),
}

if (signedRelease && !fs.existsSync(path.join(androidRoot, 'keystore.properties'))) {
  console.error('Release signing is not configured. See docs/ANDROID_BUILD.md.')
  process.exit(2)
}

const result = spawnSync(process.execPath, [tauriCli, ...args], {
  cwd: projectRoot,
  env: environment,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
})

process.stdout.write(result.stdout || '')
process.stderr.write(result.stderr || '')

if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}
if (result.status === 0) process.exit(0)

const output = `${result.stdout || ''}\n${result.stderr || ''}`
const nativeLibrary = path.join(environment.CARGO_TARGET_DIR, 'aarch64-linux-android', cargoProfile, 'libpersonal_blog_lib.so')
const jniLibrary = path.join(androidRoot, 'app', 'src', 'main', 'jniLibs', 'arm64-v8a', 'libpersonal_blog_lib.so')
const expectedSymlinkFailure = process.platform === 'win32'
  && /symbolic link|symlink/i.test(output)
  && fs.existsSync(nativeLibrary)

if (!expectedSymlinkFailure) process.exit(result.status ?? 1)

console.log('Windows developer mode is disabled; copying the native library instead of creating a symbolic link.')
fs.mkdirSync(path.dirname(jniLibrary), { recursive: true })
fs.copyFileSync(nativeLibrary, jniLibrary)

const gradleWrapper = path.join(androidRoot, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew')
const gradleArgs = [
  'clean',
  `assembleArm64${gradleProfileTitle}`,
  '-x',
  `rustBuildArm64${gradleProfileTitle}`,
  '--stacktrace',
]
const quoteShellArg = (value) => `"${value.replaceAll('"', '""')}"`
const gradleCommand = process.platform === 'win32'
  ? [gradleWrapper, ...gradleArgs].map(quoteShellArg).join(' ')
  : gradleWrapper
const gradle = spawnSync(gradleCommand, process.platform === 'win32' ? [] : gradleArgs, {
  cwd: androidRoot,
  env: environment,
  shell: process.platform === 'win32',
  stdio: 'inherit',
})

if (gradle.error) {
  console.error(gradle.error.message)
  process.exit(1)
}
if (gradle.status !== 0) process.exit(gradle.status ?? 1)

const version = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')).version
const builtApk = path.join(androidRoot, 'app', 'build', 'outputs', 'apk', 'arm64', gradleProfile, `app-arm64-${gradleProfile}.apk`)
const outputDir = path.join(projectRoot, 'output')
const outputApk = path.join(outputDir, `Personal-Blog-v${version}-arm64-${artifactKind}.apk`)
fs.mkdirSync(outputDir, { recursive: true })
fs.copyFileSync(builtApk, outputApk)
console.log(`APK copied to ${outputApk}`)
