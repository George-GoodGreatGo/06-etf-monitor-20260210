import fetch from 'node-fetch';

async function main() {
  const url = 'https://www.csindex.com.cn/csindex-home/perf/index-perf?indexCode=000300&startDate=20240101&endDate=20240110';
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'application/json,text/plain,*/*',
    },
  });
  const json = await res.json() as any;
  console.log(JSON.stringify(json.data[0], null, 2));
}
main().catch(console.error);
