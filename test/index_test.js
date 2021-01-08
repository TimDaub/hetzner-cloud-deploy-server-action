// @format
const test = require("ava");
const createWorker = require("expressively-mocked-fetch");
const proxyquire = require("proxyquire");

const { assignIP } = require("../lib.js");

test("if a request creates a server on Hetzner Cloud", async t => {
  const hetznerServerMock = await createWorker(`
    app.get("/", async (req, res) => {
      return res.status(200).send()
    });
  `);
  const worker = await createWorker(`
    app.post("/servers", (req, res) => {
      if (req.body.name &&
          req.body.server_type &&
          req.body.image &&
          req.body.ssh_keys.length > 0) {
        return res.status(201).send({server: {id: 124, public_net: { ipv4: { ip: "localhost" } }}});
      } else {
        return res.status(422).send();
      }
    });
  `);

  const options = {
    server: {
      name: "server",
      type: "cx11",
      image: "ubuntu-20.04"
    },
    sshKeyName: "abc",
    hcloudToken: "def",
    timeout: 10000
  };

  let serverIdSet = false;
  let serverIPSet = false;
  const { deploy } = proxyquire("../lib.js", {
    "./config.js": {
      API: `http://localhost:${worker.port}`,
      DEFAULT_PORT: hetznerServerMock.port
    },
    "@actions/core": {
      getInput: name => {
        switch (name) {
          case "startup-timeout":
            return options.timeout;
          case "server-name":
            return options.server.name;
          case "server-type":
            return options.server.type;
          case "server-image":
            return options.server.image;
          case "ssh-key-name":
            return options.sshKeyName;
          case "hcloud-token":
            return options.hcloudToken;
          default:
            throw new Error("didn't match possible cases");
        }
      },
      setFailed: console.error,
      setOutput: () => {},
      exportVariable: name => {
        if (name === "SERVER_ID") serverIdSet = true;
        if (name === "SERVER_IPV4") serverIPSet = true;
      }
    }
  });

  const res = await deploy();
  t.assert(res.url.includes("localhost"));
  t.assert(res.status === 201);
  t.true(serverIdSet);
  t.true(serverIPSet);
});

test("if a server can be deleted in cleanup ", async t => {
  const options = {
    server: {
      name: "server",
      type: "cx11",
      image: "ubuntu-20.04"
    },
    sshKeyName: "abc",
    hcloudToken: "def",
    timeout: 10000
  };
  const worker = await createWorker(`
    app.delete("/servers/:id", (req, res) => {
      if (req.params.id) {
        return res.status(200).send(); 
      } else {
        return res.status(400).send();
      }
    });
  `);

  const { clean } = proxyquire("../lib.js", {
    "./config.js": {
      API: `http://localhost:${worker.port}`
    },
    "@actions/core": {
      getInput: name => {
        switch (name) {
          case "startup-timeout":
            return options.timeout;
          case "delete-server":
            // NOTE: core.getInput always returns strings.
            return "true";
          case "server-name":
            return options.server.name;
          case "server-type":
            return options.server.type;
          case "server-image":
            return options.server.image;
          case "ssh-key-name":
            return options.sshKeyName;
          case "hcloud-token":
            return options.hcloudToken;
          case "server-id":
            return 123;
          default:
            throw new Error("didn't match possible cases");
        }
      },
      setFailed: console.error,
      setOutput: () => {}
    }
  });
  const res = await clean();
  t.assert(res.url.includes("localhost"));
  t.assert(res.status === 200);
});

test("if a server is kept when delete-server input is set to false", async t => {
  const options = {
    server: {
      name: "server",
      type: "cx11",
      image: "ubuntu-20.04"
    },
    sshKeyName: "abc",
    hcloudToken: "def",
    timeout: 10000
  };
  const worker = await createWorker(`
    app.delete("/servers/:id", (req, res) => {
      return res.status(400).send();
    });
  `);

  const { clean } = proxyquire("../lib.js", {
    "./config.js": {
      API: `http://localhost:${worker.port}`
    },
    "@actions/core": {
      getInput: name => {
        switch (name) {
          case "startup-timeout":
            return options.timeout;
          case "delete-server":
            // NOTE: core.getInput always returns strings
            return "false";
          case "server-name":
            return options.server.name;
          case "server-type":
            return options.server.type;
          case "server-image":
            return options.server.image;
          case "ssh-key-name":
            return options.sshKeyName;
          case "hcloud-token":
            return options.hcloudToken;
          case "server-id":
            return 123;
          default:
            throw new Error("didn't match possible cases");
        }
      },
      setFailed: console.error,
      setOutput: () => {}
    }
  });
  const res = await clean();
  t.assert(!res);
});

test("if assigning an IP fails inputs that are not a number", async t => {
  const floatingIPId = "hello world";
  const { assignIP } = proxyquire("../lib.js", {
    "cross-fetch": () => t.fail(),
    "@actions/core": {
      getInput: name => {
        switch (name) {
          case "floating-ip-id":
            return floatingIPId;
          default:
            return "mock value";
        }
      },
      setFailed: () => t.pass()
    }
  });

  await assignIP();
});

test("if non-assigned floating-ip-id stops assigning procedure silently", async t => {
  const floatingIPId = undefined;
  const { assignIP } = proxyquire("../lib.js", {
    "cross-fetch": () => t.fail(),
    "@actions/core": {
      getInput: name => {
        switch (name) {
          case "floating-ip-id":
            return floatingIPId;
          default:
            return "mock value";
        }
      },
      setFailed: () => t.fail()
    }
  });

  await assignIP();
  t.pass();
});

test("if assigning a floating IP to a server is possible", async t => {
  const floatingIPId = 1337;
  const floatingIP = "127.0.0.1";
  const SERVER_ID = 1234;
  const hcloudToken = "abc";
  const IPAssignmentTimeout = 10000;

  const worker = await createWorker(`
    const actionId = 4321;
    app.post("/floating_ips/:floatingIPId/actions/assign", (req, res) => {
      if (typeof req.body.server === "number") {
        return res.status(201).json({
          action: {
            id: actionId
          }
        });
      } else {
        return res.status(400).send();
      }
    });

    let c = 0;
    app.get("/floating_ips/:floatingIPId/actions/:actionId", (req, res) => {
      if (c === 0) {
        res.status(200).json({
          action: {
            id: actionId,
            status: "running"
          }
        });
      } else if (c === 1) {
        res.status(200).json({
          action: {
            id: actionId,
            status: "success"
          }
        });
      }

      c++;
      return;
    });

    app.get("/floating_ips/:floatingIPId", (req, res) => {
      return res.status(200).json({
        floating_ip: {
          ip: "${floatingIP}"
        }
      });
    });
  `, { requestCount: 4 });

  const { assignIP } = proxyquire("../lib.js", {
    "./config.js": {
      API: `http://localhost:${worker.port}`
    },
    process: {
      env: {
        SERVER_ID
      }
    },
    "@actions/core": {
      getInput: name => {
        switch (name) {
          case "floating-ip-id":
            return floatingIPId;
          case "hcloud-token":
            return hcloudToken;
          case "floating-ip-assignment-timeout":
            return IPAssignmentTimeout;
          default:
            return "mock value";
        }
      },
      setFailed: () => t.fail(),
      exportVariable: (name, val) => {
        t.assert(name === "SERVER_FLOATING_IPV4");
        t.assert(val === floatingIP);
      }
    }
  });

  const res = await assignIP();
  t.pass();
});

test("getting the status of assigning a floating IP", async t => {
  const worker = await createWorker(`
    const actionId = 4321;
    app.get("/floating_ips/:floatingIPId/actions/:actionId", (req, res) => {
      return res.status(200).json({
        action: {
          id: actionId,
          status: "success"
        }
      });
    });
  `);
  const { getAssignmentProgress } = proxyquire("../lib.js", {
    "./config.js": {
      API: `http://localhost:${worker.port}`
    }
  });

  const status = await getAssignmentProgress(1234, 4321)();
  t.assert(status === "success");
});

test("getting a floating ip", async t => {

  const ip = "127.0.0.1";
  const worker = await createWorker(`
    app.get("/floating_ips/:floatingIPId", (req, res) => {
      return res.status(200).json({
        floating_ip: {
          ip: "${ip}"
        }
      });
    });
  `);
  const { getFloatingIP } = proxyquire("../lib.js", {
    "./config.js": {
      API: `http://localhost:${worker.port}`
    }
  });

  t.assert(await getFloatingIP(1234) === ip);
});
