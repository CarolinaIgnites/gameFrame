module.exports = Object.assign(
	{},
	require('physicsjs'),
	require('./src/js/interactive-custom.js'),
	require('./src/js/gameframe.js'),
	require('./src/js/manifest.json')
);