# Hetzner Cloud Deploy GitHub Action

> Deploy a Hetzner Cloud Server from a GitHub Action.

Hetzner is a [zero-carbon infrastructure
provider](https://github.com/vrde/notes/tree/master/zero-carbon).

## Usage

See [action.yml](./action.yml).

Basic:

```yml
jobs:
  build:
    runs-on: Ubuntu-20.04
    steps:
      - uses: TimDaub/hetzner-cloud-deploy-server-action@v2
        with:
          server-name: "gh-actions-server"
          server-image: "ubuntu-20.04"
          server-type: "cx11"
          ssh-key-name: "my key name"
          hcloud-token: ${{ secrets.HCLOUD_TOKEN }}
```


1.  Visit the Hetzner Cloud Console at
    [console.hetzner.cloud](https://console.hetzner.cloud/), select your
    project, and create a new Read & Write API token ("Security" => "API
    Tokens").
1. In the "Security" tab in the Hetzner Cloud Console, you can check your ssh
   key's name.
1. Add the Hetzner API token to your GitHub repositories secrets ("Settings" =>
   "Secrets") as `HCLOUD_TOKEN`.
1. To know which `server-images` and `server-types` Hetzner provides, check the
   [FAQ](#FAQ).

### Notes

- `server-name` MUST NOT contain spaces.
- If you don't want the server to be deleted after the action's run, add
  `delete-server: false` as an input in your workflow
- The server's ipv4 is available to subsequent steps by accessing the env
  variable `SERVER_IPV4`.
- By default, the action queries the launched server's port 22 (SSH) for
  maximally 10 seconds. Only if this request succeeds, are next steps queued.
  The idea is that this should allow a following step to immediately connect to
  ssh.

## FAQ

### How do I get all possible images to build from?

You can use the Hetzner Cloud [API](https://docs.hetzner.cloud/#images-get-all-images).
The following `curl` command works well with [jq](https://github.com/stedolan/jq):

```bash
$ curl \
  -H "Authorization: Bearer $API_TOKEN" \
  'https://api.hetzner.cloud/v1/images' | jq '.images[].name'

"ubuntu-16.04"
"debian-9"
"centos-7"
"ubuntu-18.04"
"debian-10"
"centos-8"
"ubuntu-20.04"
"fedora-32"
"fedora-33"
```

### How do I get all possible server types?


You can use the Hetzner Cloud [API](https://docs.hetzner.cloud/#server-types-get-all-server-types).
The following `curl` command works well with [jq](https://github.com/stedolan/jq):

```bash
$ curl \
  -H "Authorization: Bearer $API_TOKEN" \
  'https://api.hetzner.cloud/v1/server_types' | jq '.server_types[].name'

"cx11"
"cx11-ceph"
"cx21"
"cx21-ceph"
"cx31"
"cx31-ceph"
"cx41"
"cx41-ceph"
"cx51"
"cx51-ceph"
"ccx11"
"ccx21"
"ccx31"
"ccx41"
"ccx51"
"cpx11"
"cpx21"
"cpx31"
"cpx41"
"cpx51"
```

## License

See [License](./LICENSE).
