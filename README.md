# Hetzner Cloud Deploy GitHub Action

> Deploy a [Hetzner](https://hetzner.cloud/?ref=zHBLL3AHXP0S) Cloud Server from a GitHub Action.

[Hetzner](https://hetzner.cloud/?ref=zHBLL3AHXP0S) is a [zero-carbon
infrastructure
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


1.  [Create a Hetzner Account](https://hetzner.cloud/?ref=zHBLL3AHXP0S)
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
- If you don't want the server to be deleted after the action has run, add
`delete-server: false` as an input in your workflow
- The server's ipv4 is available to subsequent steps by accessing the env
variable `SERVER_IPV4`.
- By default, the action queries the to-be-launched server's port 22 (SSH) for
maximally 20 seconds (`startup-timeout`). Continous steps are only run if the
server has responded within this time.
- `startup-timeout` (milliseconds) can be adjusted manually. For a `cx11`
instance, I recommend at least 20 seconds bootup time.
- To assign a [Floating IP](https://docs.hetzner.cloud/#floating-ips) the input
  `floating-ip-id` can be set. See FAQ for [instruction about how to get a
  floating IP's id](#how-do-i-get-the-id-of-a-floating-ip).

## FAQ

### How do I get all possible images to build from?

You can use the Hetzner Cloud
[API](https://docs.hetzner.cloud/#images-get-all-images).  The following `curl`
command works well with [jq](https://github.com/stedolan/jq):

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

You can use the Hetzner Cloud
[API](https://docs.hetzner.cloud/#server-types-get-all-server-types).  The
following `curl` command works well with [jq](https://github.com/stedolan/jq):

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

### How do I get the ID of a Floating IP?

You can use the Hetzner Cloud
[API](https://docs.hetzner.cloud/#floating-ips-get-all-floating-ips).  The
following `curl` command works well with [jq](https://github.com/stedolan/jq):

```bash
$ curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  'https://api.hetzner.cloud/v1/floating_ips' | jq '.floating_ips[].id'
1
2
3
```

### Why is this action useful?

In combination with
[webfactory/ssh-agent](https://github.com/webfactory/ssh-agent) you can use it
to provision a Hetzner Cloud instance completely from within a GitHub Action. An
example:

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
      - uses: webfactory/ssh-agent@v0.4.1
        with:
          ssh-private-key: ${{ secrets.SSH_PRIVATE_KEY }}
      - run: mkdir -p ~/.ssh/ && ssh-keyscan -H $SERVER_IPV4 >> ~/.ssh/known_hosts
      - run: ssh root@$SERVER_IPV4 touch tim_was_here
      - run: ssh root@$SERVER_IPV4 ls
```

After all steps have run, your provisioned Hetzner instance gets shutdown by
the cleanup script.

### Can I lose money when running this script?

Yes, you certainly can. There may be instances where something within my
script's cleanup fails and the instance remains online. So if you're planning
to run your tests many times or if you're planning to launch huge instances,
please make sure to double check if some instances remain running after the
action has completed. You have been warned.

## License

See [License](./LICENSE).
