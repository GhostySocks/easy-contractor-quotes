// Adds the commit a build was made from to app.json's config, so a tester
// build can show which build it is (Settings, internal builds only). EAS Build
// sets EAS_BUILD_GIT_COMMIT_HASH; it's absent when running locally.
module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    ...(process.env.EAS_BUILD_GIT_COMMIT_HASH
      ? { buildCommit: process.env.EAS_BUILD_GIT_COMMIT_HASH }
      : {}),
  },
});
