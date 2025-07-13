const path = require('path'); // eslint-disable-line @typescript-eslint/no-var-requires

/** @type {import('webpack').Configuration} */
module.exports = {
	mode: 'production',
	entry: './src/index.ts',
	output: {
		path: path.resolve(__dirname, 'dist/browser'),
		filename: 'belote-api.min.js',
		library: {
			name: 'BelotAPI',
			type: 'umd',
			export: 'default',
		},
		globalObject: 'this',
		clean: true,
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
