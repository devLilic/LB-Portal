import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(scriptDirectory, '..', '..')

const starterModuleIds = [
    'i18n',
    'autoUpdate',
    'appProtection',
    'licensing',
    'database',
    'logging',
]

async function main() {
    const inputs = parseInitInputs(process.argv.slice(2), starterModuleIds)
    const files = readStarterFiles(repositoryRoot)
    const features = resolveStarterFeatureSelection(inputs.initialEnabledModules)
    const nextFiles = applyStarterInit(files, inputs, features)

    writeStarterFiles(repositoryRoot, nextFiles)
    console.log('Starter initialized successfully.')
}

function parseInitInputs(argv, moduleIds) {
    const args = new Map()

    for (const rawArgument of argv) {
        if (!rawArgument.startsWith('--')) {
            throw new Error(`Unsupported argument "${rawArgument}".`)
        }

        const separatorIndex = rawArgument.indexOf('=')

        if (separatorIndex === -1) {
            throw new Error(`Arguments must use --key=value format. Received "${rawArgument}".`)
        }

        const key = rawArgument.slice(2, separatorIndex)
        const value = rawArgument.slice(separatorIndex + 1)
        args.set(key, value)
    }

    const appName = requireArgument(args, 'app-name')
    const appId = requireArgument(args, 'app-id')
    const packageName = requireArgument(args, 'package-name')
    const displayName = requireArgument(args, 'display-name')

    const updateOwner = args.get('update-owner') ?? 'YOUR_GITHUB_OWNER'
    const updateRepo = args.get('update-repo') ?? 'YOUR_RELEASE_REPO'
    const updateVisibility = args.get('update-visibility') ?? 'public'
    const defaultLanguage = args.get('default-language') ?? 'ro'

    const modulesArgument = args.get('modules') ?? 'logging'
    const initialEnabledModules = parseModules(modulesArgument, moduleIds)

    if (!['public', 'private'].includes(updateVisibility)) {
        throw new Error('update-visibility must be public or private.')
    }

    if (!['en', 'ro', 'ru'].includes(defaultLanguage)) {
        throw new Error('default-language must be one of: en, ro, ru.')
    }

    return {
        appName,
        appId,
        packageName,
        displayName,
        updateOwner,
        updateRepo,
        updateVisibility,
        defaultLanguage,
        initialEnabledModules,
    }
}

function requireArgument(args, key) {
    const value = args.get(key)

    if (!value) {
        throw new Error(`Missing required argument --${key}=...`)
    }

    return value
}

function parseModules(value, moduleIds) {
    const selectedModules = value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)

    for (const selectedModule of selectedModules) {
        if (!moduleIds.includes(selectedModule)) {
            throw new Error(
                `Unsupported module "${selectedModule}". Expected one of: ${moduleIds.join(', ')}.`,
            )
        }
    }

    return selectedModules
}

function readStarterFiles(rootDirectory) {
    return {
        packageJson: fs.readFileSync(path.join(rootDirectory, 'package.json'), 'utf8'),
        electronBuilderJson: fs.readFileSync(
            path.join(rootDirectory, 'electron-builder.json'),
            'utf8',
        ),
        baseConfig: fs.readFileSync(path.join(rootDirectory, 'config', 'base.ts'), 'utf8'),
        readme: fs.readFileSync(path.join(rootDirectory, 'README.md'), 'utf8'),
    }
}

function writeStarterFiles(rootDirectory, files) {
    fs.writeFileSync(path.join(rootDirectory, 'package.json'), files.packageJson)
    fs.writeFileSync(path.join(rootDirectory, 'electron-builder.json'), files.electronBuilderJson)
    fs.writeFileSync(path.join(rootDirectory, 'config', 'base.ts'), files.baseConfig)
    fs.writeFileSync(path.join(rootDirectory, 'README.md'), files.readme)
}

function resolveStarterFeatureSelection(enabledModules) {
    const enabledModuleSet = new Set(enabledModules)

    return {
        i18n: enabledModuleSet.has('i18n'),
        autoUpdate: enabledModuleSet.has('autoUpdate'),
        appProtection: enabledModuleSet.has('appProtection'),
        licensing: enabledModuleSet.has('licensing'),
        database: enabledModuleSet.has('database'),
        logging: enabledModuleSet.has('logging'),
    }
}

function applyStarterInit(files, inputs, features) {
    return {
        packageJson: updatePackageJson(files.packageJson, inputs),
        electronBuilderJson: updateElectronBuilderJson(files.electronBuilderJson, inputs),
        baseConfig: updateBaseConfig(files.baseConfig, inputs, features),
        readme: updateReadme(files.readme, inputs),
    }
}

function updatePackageJson(packageJsonContent, inputs) {
    const packageJson = JSON.parse(packageJsonContent)

    packageJson.name = inputs.packageName
    packageJson.productName = inputs.displayName
    packageJson.description = `${inputs.displayName} desktop application.`

    return `${JSON.stringify(packageJson, null, 2)}\n`
}

function updateElectronBuilderJson(electronBuilderJsonContent, inputs) {
    const electronBuilderJson = JSON.parse(electronBuilderJsonContent)

    electronBuilderJson.appId = inputs.appId

    if (Array.isArray(electronBuilderJson.publish) && electronBuilderJson.publish[0]) {
        electronBuilderJson.publish[0].owner = inputs.updateOwner
        electronBuilderJson.publish[0].repo = inputs.updateRepo
    }

    return `${JSON.stringify(electronBuilderJson, null, 2)}\n`
}

function updateBaseConfig(baseConfigContent, inputs, features) {
    let nextContent = replaceStringLiteral(baseConfigContent, 'appName', inputs.appName)
    nextContent = replaceObjectBooleanBlock(nextContent, 'features', features)
    nextContent = replaceBooleanLiteral(nextContent, 'update', 'enabled', features.autoUpdate)
    nextContent = replaceNestedStringLiteral(nextContent, 'update', 'owner', inputs.updateOwner)
    nextContent = replaceNestedStringLiteral(nextContent, 'update', 'repo', inputs.updateRepo)
    nextContent = replaceNestedStringLiteral(
        nextContent,
        'update',
        'visibility',
        inputs.updateVisibility,
    )

    nextContent = replaceBooleanLiteral(nextContent, 'i18n', 'enabled', features.i18n)
    nextContent = replaceNestedStringLiteral(
        nextContent,
        'i18n',
        'defaultLanguage',
        inputs.defaultLanguage,
    )

    nextContent = replaceBooleanLiteral(
        nextContent,
        'appProtection',
        'enabled',
        features.appProtection,
    )
    nextContent = replaceBooleanLiteral(nextContent, 'licensing', 'enabled', features.licensing)
    nextContent = replaceBooleanLiteral(nextContent, 'database', 'enabled', features.database)
    nextContent = replaceBooleanLiteral(nextContent, 'logging', 'enabled', features.logging)

    return nextContent
}

function updateReadme(readmeContent, inputs) {
    return readmeContent
        .replaceAll('Default Electron App', inputs.displayName)
        .replaceAll('default-electron-app', inputs.appName)
}

function replaceStringLiteral(content, key, value) {
    const nextContent = content.replace(
        new RegExp(`(${key}:\\s*)'[^']*'`),
        `$1'${escapeSingleQuotedString(value)}'`,
    )

    if (nextContent === content) {
        throw new Error(`Could not update "${key}".`)
    }

    return nextContent
}

function replaceNestedStringLiteral(content, objectKey, fieldKey, value) {
    const blockPattern = createObjectBlockPattern(objectKey)
    const match = content.match(blockPattern)

    if (!match) {
        throw new Error(`Could not locate "${objectKey}" block.`)
    }

    const nextBlockBody = match[2].replace(
        new RegExp(`(${fieldKey}:\\s*)'[^']*'`),
        `$1'${escapeSingleQuotedString(value)}'`,
    )

    return content.replace(blockPattern, `$1${nextBlockBody}$3`)
}

function replaceObjectBooleanBlock(content, objectKey, features) {
    const blockPattern = createObjectBlockPattern(objectKey)
    const match = content.match(blockPattern)

    if (!match) {
        throw new Error(`Could not locate "${objectKey}" block.`)
    }

    const indent = detectIndentation(match[2])
    const nextBlockBody = Object.entries(features)
        .map(([featureKey, enabled]) => `${indent}${featureKey}: ${String(enabled)},`)
        .join('\n')

    return content.replace(blockPattern, `$1\n${nextBlockBody}$3`)
}

function replaceBooleanLiteral(content, objectKey, fieldKey, value) {
    const blockPattern = createObjectBlockPattern(objectKey)
    const match = content.match(blockPattern)

    if (!match) {
        throw new Error(`Could not locate "${objectKey}" block.`)
    }

    const nextBlockBody = match[2].replace(
        new RegExp(`(${fieldKey}:\\s*)(true|false)`),
        `$1${String(value)}`,
    )

    return content.replace(blockPattern, `$1${nextBlockBody}$3`)
}

function createObjectBlockPattern(objectKey) {
    return new RegExp(`((?:^|\\n)\\s*${objectKey}:\\s*\\{)([\\s\\S]*?)(\\n\\s*\\})`)
}

function detectIndentation(content) {
    const match = content.match(/\n(\s+)[a-zA-Z]/)
    return match?.[1] ?? '    '
}

function escapeSingleQuotedString(value) {
    return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
})