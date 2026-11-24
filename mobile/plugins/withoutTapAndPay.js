// Android release builds failed in Stripe's lint step: Stripe's optional
// card "push provisioning" library (compileOnly, never shipped in the app)
// needs Google's play-services-tapandpay, which isn't on any public Maven
// repository. The app doesn't use push provisioning, so that dependency is
// left out of every Gradle configuration.
const { withProjectBuildGradle } = require("expo/config-plugins");

const MARK = "// mentorsmd: without tapandpay";
const BLOCK = `
${MARK}
subprojects {
  configurations.all {
    exclude group: "com.google.android.gms", module: "play-services-tapandpay"
  }
}
`;

module.exports = function withoutTapAndPay(config) {
  return withProjectBuildGradle(config, (c) => {
    if (!c.modResults.contents.includes(MARK)) c.modResults.contents += BLOCK;
    return c;
  });
};
