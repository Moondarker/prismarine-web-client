const webpack = require('webpack')
const path = require('path')
const CopyPlugin = require('copy-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
// https://webpack.js.org/guides/production/

const config = {
  entry: path.resolve(__dirname, './index.js'),
  output: {
    path: path.resolve(__dirname, './public'),
    filename: './index.js',
    publicPath: '/'
  },
  resolve: {
    alias: {
      'aVeryUniqueGame-protocol': path.resolve(
        __dirname,
        'node_modules/aVeryUniqueGame-protocol/src/index.js'
      ), // Hack to allow creating the client in a browser
      express: false,
      net: 'net-browserify',
      fs: 'memfs'
    },
    fallback: {
      zlib: require.resolve('browserify-zlib'),
      stream: require.resolve('stream-browserify'),
      buffer: require.resolve('buffer/'),
      events: require.resolve('events/'),
      assert: require.resolve('assert/'),
      crypto: require.resolve('crypto-browserify'),
      path: require.resolve('path-browserify'),
      constants: require.resolve('constants-browserify'),
      os: require.resolve('os-browserify/browser'),
      http: require.resolve('http-browserify'),
      https: require.resolve('https-browserify'),
      timers: require.resolve('timers-browserify'),
      // fs: require.resolve("fs-memory/singleton"),
      child_process: false,
      perf_hooks: path.resolve(__dirname, 'lib/perf_hooks_replacement.js'),
      dns: path.resolve(__dirname, 'lib/dns.js')
    }
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: 'index.html',
      hash: true
    }),
    // fix "process is not defined" error:
    new webpack.ProvidePlugin({
      process: 'process/browser'
    }),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer']
    }),
    new webpack.NormalModuleReplacementPlugin(
      /prismarine-viewer[/|\\]viewer[/|\\]lib[/|\\]utils/,
      './utils.web.js'
    ),
    new CopyPlugin({
      patterns: [
        { from: path.join(__dirname, '/styles.css'), to: './styles.css' },
        { from: path.join(__dirname, '/node_modules/prismarine-viewer/public/blocksStates/'), to: './blocksStates/' },
        { from: path.join(__dirname, '/node_modules/prismarine-viewer/public/textures/'), to: './textures/' },
        { from: path.join(__dirname, '/node_modules/prismarine-viewer/public/worker.js'), to: './' },
        { from: path.join(__dirname, '/node_modules/prismarine-viewer/public/supportedVersions.json'), to: './' },
        { from: path.join(__dirname, 'assets/aVeryUniqueGameia.woff'), to: './' },
        { from: path.join(__dirname, 'assets/mojangles.ttf'), to: './' },
        { from: path.join(__dirname, 'extra-textures/'), to: './extra-textures/' }
      ]
    })
  ]
}

module.exports = config
