// @format
const core = require("@actions/core");
const fetch = require("cross-fetch");

const config = require("./config.js");

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
    res = await fetch(`${config.API}/servers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.hcloudToken}`,
        "User-Agent": config.userAgent
      },
      body: JSON.stringify({
        name: options.server.name,
        image: options.server.image,
        server_type: options.server.type,
        ssh_keys: [options.sshKeyName]
      })
    });
  } catch (err) {
    core.setFailed(err.message);
  }

  if (res.status === 201) {
    console.log("Hetzner Cloud Server deployment successful");
    const body = await res.json();
    core.exportVariable("SERVER_ID", body.server.id);
    core.exportVariable("SERVER_IPV4", body.server.public_net.ipv4.ip);
    return res;
  } else {
    core.setFailed(
      `When sending the request to Hetzner's API, an error occurred "${
        res.statusText
      }"`
    );
  }
}

async function clean() {
  const deleteServer = core.getInput("delete-server") === "true";
  if (!deleteServer) {
    console.log("Aborted post cleaning procedure with delete-server: false");
    return;
  }

  let res;
  const URI = `${config.API}/servers/${process.env.SERVER_ID}`;
  try {
    res = await fetch(URI, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.hcloudToken}`,
        "User-Agent": config.userAgent
      }
    });
  } catch (err) {
    core.setFailed(err.message);
  }

  if (res.status === 200) {
    console.log("Hetzner Cloud Server deleted in clean up routine");
    return res;
  } else {
    core.setFailed(
      `When sending the request to Hetzner's API, an error occurred "${
        res.statusText
      }"`
    );
  }
}

module.exports = {
  deploy,
  clean
};
