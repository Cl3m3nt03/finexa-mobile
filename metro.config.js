const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const config = getDefaultConfig(__dirname)

// Isolate from parent (Next.js) node_modules to avoid duplicate react versions
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')]
config.watchFolders = [__dirname]

module.exports = config
