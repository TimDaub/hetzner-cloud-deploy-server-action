// @format
const test = require("ava");
const createWorker = require("expressively-mocked-fetch");
const proxyquire = require("proxyquire");

test("if a request creates a server on Hetzner Cloud", async t => {
  const worker = await createWorker(`
    app.post("/servers", (req, res) => {
      if (req.body.name &&
          req.body.server_type &&
          req.body.image &&
          req.body.ssh_keys.length > 0) {
        return res.status(201).send({server: {id: 124}}); 
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
    hcloudToken: "def"
  };

  const { deploy } = proxyquire("../lib.js", {
    "./config.js": {
      API: `http://localhost:${worker.port}`
    },
    "@actions/core": {
      getInput: name => {
        switch (name) {
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
      setOutput: () => {}
    }
  });
  const res = await deploy();
  t.assert(res.url.includes("localhost"));
  t.assert(res.status === 201);
});

test("if a server can be deleted in cleanup ", async t => {
  const options = {
    server: {
      name: "server",
      type: "cx11",
      image: "ubuntu-20.04"
    },
    sshKeyName: "abc",
    hcloudToken: "def"
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
          case "delete-server":
            return true;
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
    hcloudToken: "def"
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
          case "delete-server":
            return false;
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
