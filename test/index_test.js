// @format
const test = require("ava");
const createWorker = require("expressively-mocked-fetch");
const proxyquire = require("proxyquire");

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
