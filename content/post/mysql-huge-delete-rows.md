+++
author = "Daniel"
date = "2018-03-16T00:15:10+08:00"
lastmod = "2018-03-16T00:15:10+08:00"
draft = false
title = "MySQL: deleting a huge amount of rows"
categories = [
  "Server"
]
tags = ["AWS", "MySQL", "RDS"]
[blackfriday]
  fractions = false
[amp]
  elements = ["amp-social-share", "amp-gist"]
+++
One of our MySQL tables has started to grow out of control with more than 1 billion rows (that's 10<sup>9</sup>).

The table is a typical "Rails Active-Record table" with *id* as primary key (auto increment), *created_at*, *updated_at* and a few columns for the business data.

The table has multiple indexes on various columns, some of them having a cardinality in the millions. *created_at* and *status* don't have an index.

The majority of results from Google, involved peoples with millions of rows and deleting them in batches of 1000. We had the problem amplified by 10<sup>3</sup>.

## The setup
MySQL 5.6 running on [AWS-RDS](https://aws.amazon.com/rds/) on a db.r3.2xlarge (8 vCPU, 61GiB RAM).

## The problem
Inserting new rows was becoming an issue, specially at peak hours when request concurrency was high. Some inserts would take several seconds and indexes creation would just put the CPU to it's knees.

Some rows in the past are still needed and can't be deleted. But most of the rows are obsolete and can be removed.

The table is heavily used 24/7 and the services using it can't therefore easily be stopped, even for a short amount of time.

Running on RDS, `SELECT INTO OUTFILE` is not an option.

## Failed attempts
### Single delete
The easiest would be to run a single delete query, but with several millions of rows concerned and the lack of index on *created_at*, this would put the server on fire.
```sql
delete from table where created_at<(NOW() - INTERVAL 1 MONTH) and status='obsolete';
```didn't

### Add index
Adding an index on *created_at* and *status* is too time consuming and would lock the table for too long.

### Create a new table
Since the services can't be stopped, solutions like `TRUNCATE TABLE` or `INSERT INTO SELECT ...; RENAME;` aren't a solution.

### Delete in batches
The first attempt to batch-delete failed too.
```sql
delete from table where created_at<(NOW() - INTERVAL 1 MONTH) and status='obsolete' order by id limit 1000;
```
The lack of indexes on the concerned fields made selecting 1000 rows too slow.

## The solution
The solution was to export the data to [Athena](https://aws.amazon.com/athena/) and get a list of id's to delete.

The advantage of Athena, it allows to execute queries on big amount of data in a timely manner. It also gives a backup to the data that will be deleted from MySQL.
The caveat is that the data needs to be prepared and structured the right way. Queries need to make heavy use of partitions to be efficient and cost effective.

### Export the data to S3

Define some variables.
```bash
DBUSER=my_username
DBPASS=my_secret_password
DBHOST=my_hostname
DBNAME=my_database_name
TABLE=my_table
BUCKET=my_bucket
```
Export the whole content to a tsv file. This operation can take a certain amount of time, think of running it in an EC2 with screen and provision a big enough EBS volume.
```bash
query="select id, status, created_at from $TABLE order by id"

mysql -u $DBUSER -p$DBPASS -h $DBHOST -B -N --quick -e "$query" $DBNAME > output.tsv
```
Split the file by *created_at*:
```bash
mkdir -p daily
rm -rf daily/*

awk '{ print $0 > "daily/" $3 ".tsv" }' output.tsv
rm -f daily/.tsv
```
Move each file to folders suited for Athena's partitioning. And Split each daily file into chunks of 1GB. Athena works best with files around 100MB. 1GB text files will result in gzipped files of 50-100 MB.
```bash
cd daily

for file in *.tsv; do
  filename=`basename $file '.tsv'`
  year=`echo $filename | cut -b1-4`
  month=`echo $filename | cut -b6-7`
  day=`echo $filename | cut -b9-10`
  path="year=$year/month=$month/day=$day"
  mkdir -p $path
  mv $file $path/
  prev=$(pwd)
  cd $path
  split -a 2 -d --additional-suffix=.tsv -C 1024m $file data_
  gzip data_*
  rm -f $file
  cd $prev
done
cd ..
```
Sync the content to your [S3](https://aws.amazon.com/s3/) Bucket:
```bash
aws s3 sync daily/ s3://$BUCKET/mysql-data/$TABLE/
```
### Define the table in Athena
```sql
CREATE EXTERNAL TABLE `my_table`(
  `id` int,
  `status` string,
  `created_at` timestamp)
PARTITIONED BY (
  `year` string,
  `month` string,
  `day` string)
ROW FORMAT DELIMITED
  FIELDS TERMINATED BY '\t'
STORED AS INPUTFORMAT
  'org.apache.hadoop.mapred.TextInputFormat'
OUTPUTFORMAT
  'org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat'
LOCATION
  's3://my_bucket/mysql-data/my_table'
TBLPROPERTIES (
  'has_encrypted_data'='false');
```
### Load partitions
```sql
MSCK REPAIR TABLE my_table;
```
### List of ID
Depending on how much data you want to work on at a time, you can limit the list by day, month or year. Make good use of the partitions.
```sql
select id from `my_table` where year='2018' and month='01' and status='obsolete' order by id;
```
### Download the result
Still on your EC2 instance:
```bash
aws s3 cp s3://aws-athena-query-results-<accountid>-<region>/Unsaved/2018/03/15/<uuid>.csv temp.csv
```
### Remove the quotes and the header
```bash
tail -n +2 temp.csv > 2018_01.csv
sed -i 's/"//g' 2018_01.csv
```
### Split into batches
The idea is to delete a "few" rows at a time only. This amounts depends on your data size and server capacity. For us 100'000 was the sweat spot.
```bash
mkdir delete
cd delete
split -a 3 -l 100000 ../2018_01.csv
```
This will create files named *xaaa*, *xaab* and so on, each with a list of 100000 ids.

Convert the list to an sql delete command. This results in a single delete command with a list of 100000 rows.
```bash
for file in *;do
  sed -i 's/$/,/' $file;
  tr -d '\n' < $file > output.lst;
  mv output.lst $file;
  sed -i 's/^/set autocommit=0;\ndelete from my_table where id in (/' $file;sed -i 's/,$/);\ncommit;/' $file;
done
```
### Run all the scripts
Run each file through MySQL and rename the file. This allows to stop the script and continue where we left of.

To let the server breath and allow other queries to perform without too much interference, we pause 30s after each delete, and pause 15 minutes every 20 command.
The time needed to rest may vary depending on server load, table size and server performances.
```bash
n=0;
for file in x*; do
  echo $file;
  time mysql -u $DBUSER -p$DBPASS -h $DBHOST $DBNAME < $file;
  mv $file y$file;
  if [ $(($n % 20)) -eq 0 ];then
    sleep 900;
  else
    sleep 30;
  fi;
  let n=$n+1;
done;
```
## Next step: daily maintenance
The above script should be run automatically at a defined interval. The backup part can be found in the following Gist. The missing part is exporting the ids to be deleted.
{{< amp-gist gistid="2361f0a3a1a51e3561825b3b54399cb5" height="520" >}}
