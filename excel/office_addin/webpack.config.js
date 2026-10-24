const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './src/taskpane.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'taskpane.js',
    clean: true,
  },
  resolve: { extensions: ['.ts', '.js'] },
  module: {
    rules: [{ test: /\.ts$/, use: 'ts-loader', exclude: /node_modules/ }],
  },
  plugins: [
    new HtmlWebpackPlugin({ template: './taskpane.html', filename: 'taskpane.html' }),
    new HtmlWebpackPlugin({ template: './support.html', filename: 'support.html', chunks: [] }),
    new CopyPlugin({ patterns: [{ from: 'assets', to: 'assets' }, { from: 'src/ui/styles.css', to: 'styles.css' }] }),
  ],
  devServer: {
    port: 3000,
    server: 'https',
    static: { directory: path.join(__dirname, 'dist') },
    headers: { 'Access-Control-Allow-Origin': '*' },
  },
};
