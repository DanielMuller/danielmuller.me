+++
title = "AWS, VPN and Public IP"
author = "Daniel"
date = "2014-09-19T11:21:49+00:00"
lastmod = "2017-04-19T23:36:00+08:00"
categories = [
  "Internet",
  "Network",
  "Routing",
  "Server",
  "Ubuntu"
]
tags = [
  "AWS",
  "EC2",
  "Internet",
  "VPN"
]
[amp]
  elements = ["amp-image-lightbox","amp-social-share"]
+++
Once you start to integrate services with Telcos, ISPs or other major Network players who are not "Cloud Aware", you will need to go the VPN way using IPSec. Their setups have used all the available IP's defined by [RFC 1918](http://tools.ietf.org/html/rfc1918) (or just don't want to use them). They will want to use Public IP's behind your VPN.

The problem is that your EC2 instances are running behind a 1:1 NAT with only a private IP's attached to them. To add to the complexity, your instances are part of an auto-scaling group, with IP's all over 10.0.0.0/8.

Luckily the way to solve this problem is actually quite easy, we just need to add some iptables rules and a proxy.
<!--more-->
{{<amp-image-lightbox id="lightbox">}}
{{<amp-figure
  src="/images/2014/09/VPN.png"
  caption="Standard Site-to-Site VPN setup"
  lightbox="lightbox"
>}}

## Setup sample

The IP adresses in the image above are all fake. They are just here to help with the samples.

| Our Network                | BigCorporate Ltd Network      |
|----------------------------|-------------------------------|
| VPN public IP: 54.17.32.74 | VPN public IP: 110.220.9.72   |
| VPN Private IP: 172.16.0.5 | App Server #1: 110.220.10.7   |
| Subnet: 172.16.0.0/24      | App Server #2: 110.220.10.135 |

## In a nutshell
Use NAT to redirects the packets through a public IP (54.17.45.23 in the sample), this public IP isn't attached to any physical interface.

```bash
iptables -t nat -A POSTROUTING -s 172.16.0.0/24 -d 110.220.10.7/32 -j SNAT --to-source 54.17.45.23
iptables -t nat -A POSTROUTING -s 172.16.0.0/24 -d 110.220.10.135/32 -j SNAT --to-source 54.17.45.23
iptables -t nat -A PREROUTING -s 110.220.10.7/32 -d 54.17.45.23/32 -j DNAT --to-destination 172.16.0.5
iptables -t nat -A PREROUTING -s 110.220.10.135/32 -d 54.17.45.23/32 -j DNAT --to-destination 172.16.0.5
```

## Classic EC2 vs VPC

The setup will work in classic EC2, but there a several constraints:
* You will only be able to use the VPN tunnel from the VPN endpoint itself. I solved this by using an http proxy running on the VPN endpoint.
* No control on the internal IP, can be anything inside 10.0.0.0/8

Having your instances in VPC will add some benefit:
* You can make use of the routing feature to route all traffic to 110.220.0.0/16 through your VPN gateway and get rid of the proxy server.
* You can use a fixed internal IP (172.16.0.5)

## VPN endpoint

First piece of the puzzle, the VPN endpoint. This server will bind your network with the partner's one.

To build and maintain the IPSec tunnel, we will be using [OpenSwan](https://www.openswan.org/). Version 2.6.38 on Ubuntu 14.04 will just work fine (`sudo apt-get install openswan`).

### Fixed public IP

For your partner to configure his side of the network, you obviously need a fixed and well known IP. Create a new Elastic IP (54.17.32.74 for the sample) and attach it to your instance.

### EC2 instance

I used Ubuntu 14.04 running on a micro. Adapt distro and instance to your needs.

Apart from ssh, you need to allow inbound traffic on UDP/500 and UDP/4500 from 110.220.9.72.

### Openswan config

Not adding partner specific requirements, like encryption method or key life time.

__*/etc/ipsec.d/vpn_tunnel.conf*__

```cfg
conn vpn_tunnel
&nbsp;&nbsp;type=tunnel
&nbsp;&nbsp;authby=secret
&nbsp;&nbsp;forceencaps=yes
&nbsp;&nbsp;auto=start
&nbsp;&nbsp;left=%defaultroute
&nbsp;&nbsp;leftid=54.17.32.74
&nbsp;&nbsp;leftnexthop=%defaultroute
&nbsp;&nbsp;leftsubnet=172.16.0.5/32
&nbsp;&nbsp;right=110.220.9.72
&nbsp;&nbsp;rightid=110.220.9.72
&nbsp;&nbsp;rightsubnets={110.220.10.7/32,110.220.10.135/32}
```

_**/etc/ipsec.secrets**_

```cfg
54.17.32.74 110.220.9.72: PSK "MySuperSecureSecret"
```
Once the IPSec tunnel  is up and running, connecting from this server to 110.220.10.7 will be made from 172.16.0.5, which is not what we want. We still need to make the request come from a public IP.

## SNAT and DNAT

To have the requests come from public IP, we will use a SNAT iptables rule. We could use any IP, but to avoid an overlap with someone else in the world, we use a another Elastic IP: 54.17.45.23. We just need to reserve it, no need to attach it to an instance.

```bash
iptables -t nat -A POSTROUTING -s 172.16.0.0/24 -d 110.220.10.7/32 -j SNAT --to-source 54.17.45.23
iptables -t nat -A POSTROUTING -s 172.16.0.0/24 -d 110.220.10.135/32 -j SNAT --to-source 54.17.45.23
iptables -t nat -A PREROUTING -s 110.220.10.7/32 -d 54.17.45.23/32 -j DNAT --to-destination 172.16.0.5
iptables -t nat -A PREROUTING -s 110.220.10.135/32 -d 54.17.45.23/32 -j DNAT --to-destination 172.16.0.5
```

### Openswan config

We just need to adapt *righsubnet* to reflect the public IP:
```cfg
conn vpn_tunnel
&nbsp;&nbsp;type=tunnel
&nbsp;&nbsp;authby=secret
&nbsp;&nbsp;forceencaps=yes
&nbsp;&nbsp;auto=start
&nbsp;&nbsp;left=%defaultroute
&nbsp;&nbsp;leftid=54.17.32.74
&nbsp;&nbsp;leftnexthop=%defaultroute
&nbsp;&nbsp;leftsubnet=54.17.45.23/32
&nbsp;&nbsp;right=110.220.9.72
&nbsp;&nbsp;rightid=110.220.9.72
&nbsp;&nbsp;rightsubnets={110.220.10.7/32,110.220.10.135/32
```

Outgoing traffic from 172.16.0.5 will be seen as coming from 54.17.45.23 and inbound traffic to 54.17.45.23 will be redirected to 172.16.0.5

## Proxy

When using EC2 classic, only traffic from the VPN endpoint is sent through the tunnel. Using Nginx as a proxy will allow other instances to "route" through it. This simple config will do the trick:

_**/etc/nginx/nginx.conf**_
```nginx
server {
  listen 8080;
  location / {
    proxy_pass http://110.220.10.7:80;
  }
  listen 8081;
  location / {
    proxy_pass http://110.220.10.135:80;
  }
}
```

With this, our App needs to call http://172.16.0.5:8080 or http://172.16.0.5:8081 to get redirected to the right service. On the partner side, call will be seen as coming from 54.17.45.23

## VPC

There is no need for the proxy server when using VPC. Just create a route in your subnet sending all traffic to 110.220.10.7 and 110.220.10.135 through our VPN instance.

### SNAT and DNAT

Route all traffic from 172.16.0.0/24 through the SNAT.
Redirect incoming traffic to the right instance.

```bash
iptables -t nat -A POSTROUTING -s 172.16.0.0/24 -d 110.220.10.7/32 -j SNAT --to-source 54.17.45.23
iptables -t nat -A POSTROUTING -s 172.16.0.0/24 -d 110.220.10.135/32 -j SNAT --to-source 54.17.45.23
iptables -t nat -A PREROUTING -s 110.220.10.7/32 -d 54.17.45.23/32 -j DNAT --to-destination 172.16.0.10
iptables -t nat -A PREROUTING -s 110.220.10.135/32 -d 54.17.45.23/32 -j DNAT --to-destination 172.16.0.11
```
