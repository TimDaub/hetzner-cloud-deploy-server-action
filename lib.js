// @format
const core = require("@actions/core");
const fetch = require("cross-fetch");
const isPortReachable = require("is-port-reachable");
const { periodicExecution, TimeoutError } = require("periodic-execution");
const process = require("process");

const config = require("./config.js");

// TODO: Move within each function
const options = {
  server: {
    name: core.getInput("server-name"),
    image: core.getInput("server-image"),
    type: core.getInput("server-type")
  },
  sshKeyName: core.getInput("ssh-key-name"),
  hcloudToken: core.getInput("hcloud-token"),
  timeout: core.getInput("startup-timeout")
};

async function deploy() {
  let res;
  try {
    res = await fetch(`${config.API}/servers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.hcloudToken}`,
        "User-Agent": config.USER_AGENT
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
    core.info("Hetzner Cloud Server deployment successful");
    const body = await res.json();
    // NOTE: We set the SERVER_ID optimistically as we definitely want to still
    // delete the server if our periodic request fails.
    const ipv4 = body.server.public_net.ipv4.ip;
    core.exportVariable("SERVER_ID", body.server.id);
    core.exportVariable("SERVER_IPV4", ipv4);

    const fn = async () =>
      await isPortReachable(config.DEFAULT_PORT, {
        ipv4
      });

    let online;

    try {
      online = await periodicExecution(fn, true, options.timeout);
    } catch(err) {
      if (err instanceof TimeoutError) {
        online = false;
      } else {
        throw err;
      }
    }

    if (online) {
      return res;
    } else {
      core.setFailed(
        `Waited ${
          options.timeout
        }ms for server to come online, but it never came online. Value: "${online}"`
      );
    }
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
    core.warning("Aborted post cleaning procedure with delete-server: false");
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
        "User-Agent": config.USER_AGENT
      }
    });
  } catch (err) {
    core.setFailed(err.message);
  }

  if (res.status === 200) {
    core.info("Hetzner Cloud Server deleted in clean up routine");
    return res;
  } else {
    core.setFailed(
      `When sending the request to Hetzner's API, an error occurred "${
        res.statusText
      }"`
    );
    return;
  }
}

function getAssignmentProgress(floatingIPId, actionId) {
  return async () => {
    const URI = `${
      config.API
    }/floating_ips/${floatingIPId}/actions/${actionId}`;

    let res;
    try {
      res = await fetch(URI, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${options.hcloudToken}`,
          "User-Agent": config.USER_AGENT
        }
      });
    } catch (err) {
      core.setFailed(err.message);
    }

    if (res.status === 200) {
      const body = await res.json();
      return body.action.status;
    } else {
      core.setFailed(
        `When trying to check on the ip's assignment progress, an error occurred: ${
          res.status
        }`
      );
      return;
    }
  };
}

async function getFloatingIP(id) {
  const URI = `${config.API}/floating_ips/${id}`;

  try {
    res = await fetch(URI, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.hcloudToken}`,
        "User-Agent": config.USER_AGENT
      }
    });
  } catch (err) {
    core.setFailed(err.message);
  }

  if (res.status === 200) {
    const body = await res.json();
    return body.floating_ip.ip;
  } else {
    core.setFailed(
      `When trying to get a floating ip, an error occurred ${res.status}`
    );
    return;
  }
}

async function assignIP() {
  const floatingIPId = core.getInput("floating-ip-id");
  if (!floatingIPId) {
    core.warning(
      "No value for floating-ip-id input was found. Hence skipping this step."
    );
    return;
  }
  const assignmentTimeout = parseInt(
    core.getInput("floating-ip-assignment-timeout"),
    10
  );

  const parsedIPId = parseInt(floatingIPId, 10);
  if (isNaN(parsedIPId)) {
    core.setFailed(
      `Not assigning server a floating-ip-id as it asn't parseable as an integer. Unparsed value: ${floatingIPId}`
    );
    return;
  }

  let res;
  const URI = `${config.API}/floating_ips/${parsedIPId}/actions/assign`;
  let { SERVER_ID } = process.env;
  SERVER_ID = parseInt(SERVER_ID, 10);

  try {
    res = await fetch(URI, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.hcloudToken}`,
        "User-Agent": config.USER_AGENT
      },
      body: JSON.stringify({ server: SERVER_ID })
    });
  } catch (err) {
    core.setFailed(err.message);
  }

  if (res.status === 201) {
    const body = await res.json();

    const expectedStatus = "success";
    let _status;
    try {
      _status = await periodicExecution(
        getAssignmentProgress(parsedIPId, body.action.id),
        expectedStatus,
        assignmentTimeout
      );
    } catch (err) {
      if (err instanceof TimeoutError) {
        _status = "timeout";
      } else {
        throw err;
      }
    }

    if (_status === "success") {
      const floatingIP = await getFloatingIP(parsedIPId);
      core.exportVariable("SERVER_FLOATING_IPV4", floatingIP);
      core.info(
        `Floating IP with ID "${parsedIPId}" was assigned to server with id: "${SERVER_ID}"`
      );
      return;
    } else {
      core.setFailed(
        `An error happened while trying to get the IP's assignment progress. Status: "${_status}"`
      );
      return;
    }
  } else {
    core.setFailed(
      `When assigning a floating ip to the server an error occurred "${
        res.statusText
      }"`
    );
    return;
  }
}

module.exports = {
  deploy,
  clean,
  assignIP,
  getAssignmentProgress,
  getFloatingIP
};
