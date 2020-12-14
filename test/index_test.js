// @format
const test = require("ava");
const createWorker = require("expressively-mocked-fetch");
const proxyquire = require("proxyquire");

test("if request to Hetzner is valid", async t => {
  const worker = await createWorker(`
    app.post("/servers", (req, res) => {
      if (req.body.name &&
          req.body.server_type &&
          req.body.image &&
          req.body.ssh_keys.length > 0) {
        return res.status(201).send(); 
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
      setFailed: console.error
    }
  });
  const res = await deploy();
  t.assert(res.url.includes("localhost"));
  t.assert(res.status === 201);
});
