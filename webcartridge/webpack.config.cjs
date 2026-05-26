
const IgnoreDynamicRequire = require('webpack-ignore-dynamic-require');
const type="esm";
const outputs={
  esm: {
    libraryTarget: 'module',
    path: `${__dirname}/dist`,
    filename: "webcartridge.js",
  },
};
module.exports = (env,argv)=>({
    mode: 'development',
    entry: './js/main.js',
    experiments: {
    	outputModule: true,
    },
    output: outputs[type],
    module: {
        rules: [
          {
            test: /\.css$/i,
            use: ['style-loader', 'css-loader'],
          },  
        ],
        parser: {
          javascript: {
            importMeta: !env.production,
            commonjsMagicComments: true
          },
        },
    },
    resolve: {
        extensions: [
            '.js',
        ],
    },
    plugins: [
      new IgnoreDynamicRequire()
    ],
});
