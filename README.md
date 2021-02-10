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
- `ssh-key-name`'s value should be the name of the SSH key as recorded in the Hetzner's cloud console (Under Security -> SSH Keys)
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
- When assigning an instance to a floating IP, the [Hetzner
  recommends](https://docs.hetzner.com/cloud/floating-ips/faq/) configuring a
  temporary or permanent IPV4 on the machine.
- After a server has been successfully assigned a floating IP, it is exported
  as an environment variable called `SERVER_FLOATING_IPV4`.

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

### How do I use this Action with e.g. a Domain Name?

All Hetzner servers created with this Action get assigned an arbitrary IP, which
can make it difficult to immediately set it as an A-record on a domain you own.

Hetzner, however, provides a feature called [Floating
IPs](https://docs.hetzner.com/cloud/floating-ips/faq/), that allows a user to
assign a static IP to a server.

By setting your DNS A-record to a floating IP and adding its ID as an input,
you can hence make your launched server predictably-addressable.

Specifically, working with floating IPs can get a bit messy. Here's an example
configuration.

```yml
jobs:
  build:
    runs-on: Ubuntu-20.04
    steps:
      - uses: TimDaub/hetzner-cloud-deploy-server-action@v2
        with:
          server-name: "server"
          server-image: "ubuntu-20.04"
          server-type: "cx11"
          ssh-key-name: "my key name"
          hcloud-token: ${{ secrets.HCLOUD_TOKEN }}
          startup-timeout: 40000
          floating-ip-id: my-id
          floating-ip-assignment-timeout: 30000
      - uses: webfactory/ssh-agent@v0.4.1
        with:
          ssh-private-key: ${{ secrets.SSH_PRIVATE_KEY }}
      - run: mkdir -p ~/.ssh/ && ssh-keyscan -H $SERVER_IPV4 >> ~/.ssh/known_hosts
      - run: ssh root@$SERVER_IPV4 "ip addr add $SERVER_FLOATING_IPV4 dev eth0"
      - run: mkdir -p ~/.ssh/ && ssh-keyscan -H $SERVER_FLOATING_IPV4 >> ~/.ssh/known_hosts
      - run: ssh root@$SERVER_FLOATING_IPV4 touch tim_was_here
      - run: ssh root@$SERVER_FLOATING_IPV4 ls

```

Note how we use `ssh-keyscan` twice here to configure the GitHub Action server
for once with the `SERVER_IPV4` but then later also with the
`SERVER_FLOATING_IPV4`.
This specific step is optional, but it allows a subsequent step to directly
connect to the floating IP.

### Can I lose money when running this script?

**Yes, you certainly can.**

There may be instances where something within my
script's cleanup fails and the instance remains online. So if you're planning
to run your tests many times or if you're planning to launch huge instances,
please make sure to double check if some instances remain running after the
action has completed.

Also, please note that [Hetzner bills per hours, not minutes](https://docs.hetzner.com/cloud/billing/faq/#how-do-you-bill-your-servers). This means that a 30 second run will be billed as a 1 hour run, a 61 minute run will be billed as a 2 hour run, etc. ([#14](https://github.com/TimDaub/hetzner-cloud-deploy-server-action/issues/14))

If you push very frequently, you might want to ensure that your workflow requires explicit approval before running by using [GitHub's Environment approval mechanism](https://web.archive.org/web/20210209175158/https://www.aaron-powell.com/posts/2021-01-11-using-environments-for-approval-workflows-with-github/).

You have been warned.

### What do these errors mean?
- `When sending the request to Hetzner's API, an error occurred "Unprocessable Entity"`
  - The data you are passing is syntactically correct, but Hetzner could not achieve the task. Make sure all your secrets are set correctly, and that your `ssh-key-name` is the same as in the Hetzner Cloud interface.

## License

See [License](./LICENSE).
