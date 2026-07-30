const packageMetadata = require('./package.json');

module.exports = {
  ...packageMetadata.build,
  extraMetadata: {
    version: `${packageMetadata.version}-beta`
  },
  nsis: {
    ...packageMetadata.build.nsis,
    artifactName: 'diaxeirisi-Ylikoy-Beta-Setup-${version}.${ext}'
  }
};
