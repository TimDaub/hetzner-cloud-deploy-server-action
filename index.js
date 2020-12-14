// @format
const core = require("@actions/core");
const fetch = require("cross-fetch");

const options = {
  server: {
    name: core.getInput("server-name"),
    image: core.getInput("server-image"),
    type: core.getInput("server-type")
  },
  sshKeyName: core.getInput("ssh-key-name"),
  hcloudToken: core.getInput("hcloud-token")
};

async function deploy() {
  let res;
  try {
    res = await fetch("https://api.hetzner.cloud/v1/servers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.hcloudToken}`
      },
      body: JSON.stringify({
        name: options.server.name,
        image: options.server.image,
        server_type: options.server.type,
        ssh_keys: [options.server.sshKeyName]
      })
    });
  } catch (err) {
    core.setFailed(err.message);
  }

  if (res.status < 300) {
    console.log("Hetzner Cloud Server deployment successful");
  } else {
    core.setFailed(res.statusText);
  }
}

deploy();
