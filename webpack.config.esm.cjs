const path = require('path'); // eslint-disable-line @typescript-eslint/no-var-requires

/** @type {import('webpack').Configuration} */
module.exports = {
	mode: 'production',
	entry: './src/index.ts',
	output: {
		path: path.resolve(__dirname, 'dist/browser'),
		filename: 'belote-api.esm.js',
		library: {
			type: 'module',
		},
		clean: true,
	},
	experiments: {
		outputModule: true,
	},
	resolve: {
		extensions: ['.ts', '.js'],
		fallback: {
			events: require.resolve('events/'),
		},
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				use: 'ts-loader',
				exclude: /node_modules/,
			},
		],
	},
	target: 'web',
	optimization: {
		minimize: true,
	},
};
