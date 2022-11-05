# AWS EC2 Region Switcher

A simple single page web interface to toggle / spawn AWS EC2 instances on different region at will.

This use [Pug](https://pugjs.org/) to render the page, Node.js with Express.js and the AWS API.

This can be customized easily for different use cases.

See `views/index.pug` `views/style.css` for page customization and eventually `server.js` `config.js` for logic customization.

## What does it do

My use case for this is a personal multi region VPN portal.

It show a list of flags which spawn an instance on the corresponding region from a launch template when a flag is clicked on.

All named instances matching the `nameTag` config property are terminated upon a flag click so it is basically moving a single instance across regions.

There is also a CloudWatch alarm on the instance it spawn, the alarm terminate the instance automatically based on some amount of inbound network inactivity, this can be removed easily for a permanent instance.

I use a free [dynamic DNS service](https://www.noip.com) to cust costs (no static IP) and provide a way to reach the instance with the same address when it move to other regions but there is less setup to do on the instance with a static Elastic IP.

## Howto

This require some prior setup on AWS interface (console) such as :

* correct authorizations must be given for the AWS API user so the AWS API works
* an EC2 launch template must be created on each regions you want to spawn instances on, makes sure to provide an identifiable instance NAME (this app will match the template instance NAME when fetching / terminating instances)
* the `nameTag` in the `config.js` file must be updated to match the one in the launch template
* the `launchTemplate` and region name for each regions must be given in the `config.js` file, the `code` property is to show the correct flag
* if you use `usePing: true` in the `config.js` you must allow inbound ICMP on your instance security group

If you use a static Elastic IP for the instances then set `usePing: true`, the instance status switch feedback on the UI will be more accurate.

If you use a dynamic DNS service (or a domain name) then in `config.js` set `usePing: true` and `instancesDomainName` to the domain that will be used to access the instances, the instance status switch feedback on the UI will be more accurate and probably faster than the default which use AWS InstanceStatus property.

Once everything is done you can just run it :

`npm install`
`node server.js`

I recommend [PM2](https://pm2.keymetrics.io/) if you want to run it permanently as a daemon process.

For AWS EC2 VPN setup see [here](https://www.onirom.fr/wiki/blog/30-10-2022_cheap_custom_vpn_aws_ec2_virtualization/) (this require some small prior knowledge about EC2)

![AWS EC2 Region Switcher screenshot](/screenshot.png?raw=true "AWS EC2 Region Switcher screenshot")