// @format
const { deploy, assignIP } = require("./lib.js");

(async () => {
  await deploy();
  await assignIP();
})();
