+++
title = "Dynamically resizing EBS volumes"
author = "Daniel"
date = "2014-07-10T10:51:57+00:00"
lastmod = "2017-04-19T23:36:00+08:00"
categories = [
  "Server",
  "Ubuntu"
]
tags = [
  "AWS",
  "EBS",
  "EC2"
]
[amp]
  elements = ["amp-social-share"]
+++
[AWS](http://aws.amazon.com) provides multiples services that adjust sizes to your actual usage. This is not really the case when it comes to [EBS](http://aws.amazon.com/ebs/)EBS.

You can see EBS has a hard drive that you can attach to a running [EC2](http://aws.amazon.com/ec2/) instance. The attached EBS will be accessible like any other driver under /dev/xvdX.

The idea here, is to provide a way to increase and decrease the size of the used EBS volumes according to the actual usage of the disk, and even allow you to increase the partition size beyond the 1TB limit.

<!--more-->

When you launch en EC2, a root device (hosting the OS) is created. This root device has a default size of 8GB and can be an EBS volume. When we know that we need more space for our app, we can increase this root device at boot. When we reach the fatal "full disk", we can increase the size of this volume, but this requires painful manual steps that incurs downtime:

  * Stop the instance
  * Create an AMI
  * Use this AMI to start an instance with a bigger root volume

Once your volume reaches the 1TB limit, you need to another set of painful operations:

  * Add another volume
  * Move data to the new volume
  * Use symbolic links to keep path in the right place

## Enters LVM

[LVM](http://en.wikipedia.org/wiki/Logical_Volume_Manager_(Linux)) allows you to create logical volumes and group them into stripes, to expose only one single partition to the OS. Aside from "bundling" multiples volumes together, LVM allows you to resize the logical volumes (you can think of them as partitions) while the OS is running and the partition mounted. The scripts have been tested in [Ubuntu Server 14.04](http://www.ubuntu.com), but they should work on any Linux flavor with LVM2 support.

### Single EBS LVM

Launch an EC2 instance, create a new volume and attach it to the instance. This can be done from the web console or directly from the instance using the [AWS CLI](http://aws.amazon.com/cli/).

First install the LVM2 tools and modules

```bash
apt-get install lvm2
```

Get some information about our instance

```bash
INSTANCE_ID=`wget -q -O - http://169.254.169.254/latest/meta-data/instance-id`
AV_ZONE=`wget -q -O - http://169.254.169.254/latest/meta-data/placement/availability-zone`
REGION="`echo \"$AV_ZONE\" | sed -e 's:\([0-9][0-9]*\)[a-z]*\$:\\1:'`"
```

Create a 50GB volume

```bash
aws ec2 create-volume --volume-type gp2 --size 50 --availability-zone $AV_ZONE
```

Attach the volume to the instance, volume-id is the id of the volume created above

Use any unused device identifier

```bash
aws ec2 attach-volume --volume-id vol-xxxxxxx --instance-id $INSTANCE_ID --device /dev/sdf
```

Initialize the volume for use with LVM, Create a volume group, a logical volume using the entire group size and use and ext4 file system.

The instance sees /dev/sdf as /dev/xvdf

```bash
pvcreate /dev/xvdf
vgcreate test_group /dev/xvdf
lvcreate -l 100%VG -n test_volume test_group
mkfs.ext4 /dev/test_group/test_volume
mkdir -p /media/test
mount /dev/test_group/test_volume /media/test
```

You have now a brand new 500G partition. You can check that everything is there.

```bash
mount
df -h
```

### Increase the volume size

Add another 500G volume, attach it to the instance, add it to the volume group and increase the logical volume size.

```bash
aws ec2 create-volume --volume-type gp2 --size 50 --availability-zone $AV_ZONE
aws ec2 attach-volume -volume-id vol-xxxxxxx -instance-id $INSTANCE_ID -device /dev/sdg
pvcreate /dev/xvdg
vgextend test_group /dev/xvdg
lvextend -l +100%FREE /dev/test_group/test_volume
resize2fs /dev/test_group/test_volume
```

Check that the partition is now 1TB

```bash
mount
df -h
```

## Automating all the steps

By combining the steps above, and adding some scaling thresholds and logic, you can automate the process. The script below will take care of all that and is available in this [Gist](https://gist.github.com/bdd8b1bdb74299f0673d). I decided to use Bash to do it, Bash not being grate with JSON parsing or mathematical stuff, Python with [Boto](https://github.com/boto/boto) or Ruby with [AWS-SDK](http://aws.amazon.com/sdkforruby/) would be an easier choice, but less funny.

You obviously want to adapt some parameters to your needs.

  * *NAME*: Name of the VG and LV, will create /dev/vg\_$NAME/lv\_$NAME
  * *MOUNT_POINT*: Where to mount the partition
  * *DISK_SIZE*: Size (in GB) of each disk.
  * *SPACE_UP*: How much percentage of $DISK_SPACE left before adding a disk
  * *SPACE_DOWN*: How much percentage of $DISK_SPACE above 1 free disk before scaling down
  * *MIN_DISKS*: Minimum number of disks to keep
  * *MAX_DISKS*: Maximum number of disks to create
  * *START\_DISK\_LETTER*: Which should be the first letter (X as in /dev/sdX)

Choose _DISK_SIZE_, _SPACE_UP_ and _SPACE_DOWN_ depending on the kind of content you will store and at which pace it grows. Disk increments of 500GB, with upscaling when there is 25% free space left (125GB) and downscaling when there is 50% free space left (750GB = 1 disk + 50% of 2nd disk) is a reasonable choice.

[comment]: <> (once amp-gist is official)
[comment]: <> ({{<amp-gist gistid="bdd8b1bdb74299f0673d" height="520" >}})

```bash
#!/bin/bash

# Allows to attach and remove EBS volumes managed under LVM to
# have a dynamically sized partition attached to an EC2 instance
#
# Intance needs either to be launched with a role able to access to relevant AWS API endpoints
# or the credentials can be hardcoded in the config.
#
# Minimal IAM Role:
# {
#  "Version": "2012-10-17",
#  "Statement": [
#    {
#      "Sid": "EBS-autoscale",
#      "Effect": "Allow",
#      "Action": [
#        "ec2:AttachVolume",
#        "ec2:CreateVolume",
#        "ec2:DeleteVolume",
#        "ec2:DescribeInstanceAttribute",
#        "ec2:DescribeInstances",
#        "ec2:DescribeVolumeAttribute",
#        "ec2:DescribeVolumeStatus",
#        "ec2:DescribeVolumes",
#        "ec2:DetachVolume",
#        "ec2:EnableVolumeIO",
#        "ec2:ModifyInstanceAttribute",
#        "ec2:ModifyVolumeAttribute"
#      ],
#      "Resource": [
#        "*"
#      ]
#    }
#  ]
# }
#
#
#

# Base name for VG and LV.
# VG = vg_$NAME
# LV = lv_$NAME
NAME="junk"

# Where to mount it
MOUNT_POINT="/media/$NAME"

# Size of each disk in GB
# Maximum EBS size is 1024GB
DISK_SIZE="2"

# %age of free space (relative to disk size) before adding a new disk
SPACE_UP="25"

# %age of free space above 1 free disk (relative to disk size) before removing one.
SPACE_DOWN="50"

# If you want to start with a higher disk identifier to leave room for other partitions.
# /dev/sda is the root device
# /dev/sdb is the default instance-store partition
# No disk above /dev/sdz will be created

START_DISK_LETTER='c'

# Minimum number of disks to keep
MIN_DISKS=1

# Maximum number of disks to use
MAX_DISKS=10

# base AWS CLI command
AWS_EC2="/usr/local/bin/aws ec2"


chr() {
  printf \\$(printf '%03o' $1)
}
ord() {
  printf '%d' "'$1"
}

next_disk() {
    # No disk is existing yet
    if [ "x"$1 == "x" ]; then
        DISK_LETTER=$START_DISK_LETTER
    else
        num=`ord $1`
        if [ $num -ge 122 ];then
            # Too lazy to handle /dev/sdaa, 24 disks (24TB) should be enough, no?
            echo "No more disk letter available"
            DISK_LETTER=""
            return 1
        fi
        let num=$num+1
        DISK_LETTER=`chr $num`
    fi
}

add_disk() {
    $AWS_EC2 create-volume --volume-type gp2 --size $DISK_SIZE --availability-zone $AV_ZONE > /tmp/volume_info
    volume_id=`jq -r '.VolumeId' /tmp/volume_info`

    volume_status=""
    while [ "x"$volume_status != "xavailable" ]; do
        sleep 1
        $AWS_EC2 describe-volumes --volume-ids $volume_id > /tmp/volume_info
        volume_status=`jq -r '.Volumes[].State' /tmp/volume_info`
    done
    last_disk
    next_disk $LAST_DISK_LETTER || return 1

    $AWS_EC2 attach-volume --volume-id $volume_id --instance-id $INSTANCE_ID --device /dev/sd${DISK_LETTER} || return 1
    attached=""
    while [ "x"$attached != "xattached" ]; do
        sleep 1
        $AWS_EC2 describe-instances --instance-ids $INSTANCE_ID > /tmp/instance_info
        attached=`jq --arg drive "/dev/sd${DISK_LETTER}" -r '.Reservations[].Instances[].BlockDeviceMappings[] | {name: .DeviceName, status: .Ebs.Status}|select(.name==$drive)|.status' /tmp/instance_info`
    done
    $AWS_EC2 modify-instance-attribute --instance-id $INSTANCE_ID --block-device-mappings "[{\"DeviceName\": \"/dev/sd${DISK_LETTER}\",\"Ebs\":{\"DeleteOnTermination\":true}}]" || return 1

    pvcreate /dev/xvd${DISK_LETTER} || return 1 #/dev/sdX is attached as /dev/xvdX
}

last_disk() {
    $AWS_EC2 describe-instances --instance-ids $INSTANCE_ID > /tmp/instance_info
    root_device=`jq -r '.Reservations[].Instances[].RootDeviceName' /tmp/instance_info`
    LAST_DISK_LETTER=`jq -r '.Reservations[].Instances[].BlockDeviceMappings[].DeviceName' /tmp/instance_info | grep -v $root_device | sort | tail -n1 | sed -e 's/^.*\([a-z]\)$/\1/'`
}

initialize_lv() {
    vgcreate vg_$NAME /dev/xvd${DISK_LETTER}
    lvcreate -l 100%VG -n lv_$NAME vg_$NAME
    mkfs.ext4 /dev/vg_$NAME/lv_$NAME

    mkdir -p $MOUNT_POINT
    mount /dev/vg_$NAME/lv_$NAME $MOUNT_POINT
}

extend_lv() {
    vgextend vg_$NAME /dev/xvd${DISK_LETTER}
    lvextend -l +100%FREE /dev/vg_$NAME/lv_$NAME
    resize2fs /dev/vg_$NAME/lv_$NAME
}

INSTANCE_ID=`wget -q -O - http://169.254.169.254/latest/meta-data/instance-id`
AV_ZONE=`wget -q -O - http://169.254.169.254/latest/meta-data/placement/availability-zone`
REGION="`echo \"$AV_ZONE\" | sed -e 's:\([0-9][0-9]*\)[a-z]*\$:\\1:'`"

# Create base VG if not existing
if [[ ! -d "/dev/vg_$NAME/lv_$NAME" && ! -L "/dev/vg_$NAME/lv_$NAME" ]]; then
    if [ ! `which unzip` ];then
        apt-get -y update
        apt-get -y install unzip lvm2 jq
    fi
    if [ ! -f /usr/local/bin/aws ]; then
        wget -O awscli-bundle.zip https://s3.amazonaws.com/aws-cli/awscli-bundle.zip
        unzip -u awscli-bundle.zip
        ./awscli-bundle/install -i /usr/local/aws -b /usr/local/bin/aws
        mkdir -p ~/.aws
        # If we want to hardcode the credentials in the config:
        # cat > ~/.aws/config << EOF
# [default]
# aws_access_key_id = MY_ACCESS_KEY
# aws_secret_access_key = MY_SECRET
# region = $REGION
# EOF

        cat > ~/.aws/config << EOF
[default]
region = $REGION
EOF
    fi
    add_disk || exit 1
    initialize_lv || exit 1
    for n in $(seq 2 $MIN_DISKS);do
        add_disk || exit 1
        extend_lv || exit 1
    done
fi

# Checking if we need to do something
free_space=`df | grep $MOUNT_POINT | awk '{print $4}'`

# Calc threshold values
min_free_space=`echo "($SPACE_UP/100*$DISK_SIZE)*1000000" | bc -l`
max_free_space=`echo "(($SPACE_DOWN+100)/100*$DISK_SIZE)*1000000" | bc -l`

# Check if more space or less space is needed
more_space_needed=`echo $free_space'<'$min_free_space | bc -l`
less_space_needed=`echo $free_space'>'$max_free_space | bc -l`

# Amount of mounted disks
actual_disks=`lvdisplay /dev/vg_${NAME}/lv_${NAME}|grep Segments|awk '{print $2}'`

# Check if we are inside disk limit bounds
max_limit_reached=`echo $actual_disks'>='$MAX_DISKS | bc -l`
min_limit_reached=`echo $actual_disks'<='$MIN_DISKS | bc -l`

# When more space needed, add and extend as long we are insinde the disk amount limit
if [[ $more_space_needed -eq 1 ]]; then
    if [[ $max_limit_reached -eq 1 ]]; then
        echo "Space needed but maximum disk limit reached"
    else
        add_disk || exit 1
        extend_lv || exit 1
    fi
fi

# When less space needed and still inside the disk limit print out manual action to carry out.
# resize2fs can't do a resize while the parition is mounted. The partition needs to be unmounted first,
# which mostly requires the service to be put in maintencance mode

if [[ $less_space_needed -eq 1 ]]; then
    if [[ $min_limit_reached -eq 1 ]]; then
        echo "Too much space but minimum disk limit reached"
    else
        TOTAL_SPACE=`df | grep $MOUNT_POINT | awk '{print $2}'`
        NEW_SIZE=`echo "($TOTAL_SPACE-($DISK_SIZE*1000000*1.1))/1024" | bc`
        LAST_VOLUME=`jq -r '.Reservations[].Instances[].BlockDeviceMappings[].Ebs.VolumeId' /tmp/instance_info | tail -n1`

        cat << EOF
Too much empty space.
Unable to perform an online shrinking. The partion need to be unmounted.

Tasks to perform:

umount $MOUNT_POINT
e2fsck -f /dev/vg_${NAME}/lv_${NAME}
resize2fs /dev/vg_${NAME}/lv_${NAME} ${NEW_SIZE}M
lvreduce -f -L -${DISK_SIZE}.1G vg_${NAME}/lv_${NAME}
vgreduce -a vg_${NAME}
lvextend -l +100%FREE /dev/vg_${NAME}/lv_${NAME}
e2fsck -f /dev/vg_${NAME}/lv_${NAME}
resize2fs /dev/vg_${NAME}/lv_${NAME}
mount /dev/vg_${NAME}/lv_$NAME $MOUNT_POINT
$AWS_EC2 detach-volume --instance-id $INSTANCE_ID --volume-id $LAST_VOLUME
$AWS_EC2 delete-volume --volume-id $LAST_VOLUME
Detach and delete volume in AWS console
EOF
    fi
fi
```

### Downscaling issues

_resize2fs_ is unable to downsize while the partition is mounted. The script outputs all the necessary command lines, but you will need to do this manually, since the app writing to that drive needs to be put into maintenance mode during the operation.
